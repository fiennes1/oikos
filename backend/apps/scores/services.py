from typing import Optional

from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum

from apps.events.models import ChampionshipMode, Event, EventScoreMode, EventType, ScoredBy, TeamAggregateMethod, TeamScoringFormat
from apps.scores.models import PointsTableEntry, Result, ScoreConfig


def _sort_key_result(r: Result, lower_is_better: bool):
    raw = r.raw_score
    tb = r.tiebreak_score if r.tiebreak_score is not None else Decimal("999999999")

    if lower_is_better:
        primary = raw
        tb_adj = tb
    else:
        primary = -raw
        tb_adj = tb

    return (primary, tb_adj)


def default_points_for_position(position: int) -> int:
    return max(0, 105 - int(position) * 5)


def _ensure_score_config(event: Event) -> ScoreConfig:
    metric_map = {
        EventType.FOR_TIME: "seconds",
        EventType.AMRAP: "reps",
        EventType.MAX_LOAD: "kg",
        EventType.MAX_REPS: "reps",
        EventType.POINTS: "points",
        EventType.TIEBREAK: "seconds",
    }
    metric = getattr(event, "metric_type", None) or metric_map.get(event.event_type, "seconds")

    lower = event.score_mode == EventScoreMode.LOWER_IS_BETTER

    cfg, _ = ScoreConfig.objects.update_or_create(
        event=event,
        defaults={
            "metric": metric,
            "lower_is_better": lower,
        },
    )
    return cfg


def _lookup_points(event: Event, category_id: Optional[int], position: int) -> int:
    qs = PointsTableEntry.objects.filter(event=event, position=position)
    if category_id:
        row = qs.filter(category_id=category_id).first()
        if row:
            return row.points
    row = qs.filter(category__isnull=True).first()
    if row:
        return row.points
    return default_points_for_position(position)


def _assign_placements(event: Event, ordered: list, category_id: Optional[int]) -> None:
    """Atribui position e points_earned tratando empates (mesmo raw + tiebreak)."""
    rank = 0
    i = 0
    prev_key = None
    while i < len(ordered):
        r = ordered[i]
        key = (r.raw_score, r.tiebreak_score)
        if key != prev_key:
            rank = i + 1
            prev_key = key
        pts = _lookup_points(event, category_id, rank)
        if r.position_override is None:
            Result.objects.filter(pk=r.pk).update(position=rank, points_earned=pts)
        j = i + 1
        while j < len(ordered):
            r2 = ordered[j]
            if (r2.raw_score, r2.tiebreak_score) != key:
                break
            if r2.position_override is None:
                Result.objects.filter(pk=r2.pk).update(position=rank, points_earned=pts)
            j += 1
        i = j


def _aggregate_raw(scores: list, method: str, lower_is_better: bool):
    if not scores:
        return None
    if method == TeamAggregateMethod.AVERAGE:
        return sum(scores) / len(scores)
    if method == TeamAggregateMethod.BEST:
        return min(scores) if lower_is_better else max(scores)
    return sum(scores)


def _uses_team_individual_scoring(event: Event) -> bool:
    if event.scored_by == ScoredBy.TEAM and event.team_scoring_format == TeamScoringFormat.INDIVIDUAL:
        return True
    if event.scored_by == ScoredBy.ATHLETE and event.competition.mode == ChampionshipMode.TEAM:
        return True
    return False


def _sync_team_aggregate_results(event: Event, lower: bool) -> None:
    """Atualiza resultados sintéticos por time a partir dos lançamentos individuais."""
    athlete_results = list(
        Result.objects.filter(event=event, athlete__isnull=False).select_related("athlete", "athlete__team")
    )
    if not athlete_results:
        Result.objects.filter(event=event, team__isnull=False, athlete__isnull=True).delete()
        return

    by_team: dict[int, list] = defaultdict(list)
    for r in athlete_results:
        tid = r.athlete.team_id if r.athlete_id else None
        if tid:
            by_team[tid].append(r)

    method = event.team_aggregate_method or TeamAggregateMethod.SUM
    if method == TeamAggregateMethod.MANUAL:
        return

    existing_team_ids = set(
        Result.objects.filter(event=event, team__isnull=False, athlete__isnull=True).values_list("team_id", flat=True)
    )
    seen_team_ids = set()

    for team_id, group in by_team.items():
        seen_team_ids.add(team_id)
        agg = _aggregate_raw([r.raw_score for r in group], method, lower)
        if agg is None:
            continue
        Result.objects.update_or_create(
            event=event,
            team_id=team_id,
            athlete=None,
            defaults={"raw_score": agg},
        )

    for tid in existing_team_ids - seen_team_ids:
        Result.objects.filter(event=event, team_id=tid, athlete__isnull=True).delete()


def recalculate_event_rankings(event: Event) -> None:
    # Em cascatas grandes (ex.: excluir campeonato), o Event pode já ter sido
    # removido do banco enquanto post_delete de Result ainda roda com o objeto
    # em memória — não recriar ScoreConfig com FK inválida.
    if event.pk is None or not Event.objects.filter(pk=event.pk).exists():
        return

    cfg = _ensure_score_config(event)
    lower = cfg.lower_is_better

    if _uses_team_individual_scoring(event):
        _sync_team_aggregate_results(event, lower)
        # Posição/pontos só nos resultados consolidados por time
        Result.objects.filter(event=event, athlete__isnull=False).update(position=None, points_earned=0)

    results = list(
        Result.objects.filter(event=event).select_related("athlete", "athlete__category", "team")
    )
    if not results:
        return

    if event.scored_by == ScoredBy.TEAM or _uses_team_individual_scoring(event):
        bucket = [r for r in results if r.team_id and not r.athlete_id]
        bucket.sort(key=lambda r: _sort_key_result(r, lower))
        _assign_placements(event, bucket, category_id=None)
        return

    eligible_ids = set(event.eligible_categories.values_list("pk", flat=True))
    groups: dict[int, list[Result]] = defaultdict(list)
    for r in results:
        if not r.athlete_id:
            continue
        cid = r.athlete.category_id
        if eligible_ids and cid not in eligible_ids:
            continue
        groups[cid].append(r)

    for cid, group in groups.items():
        group.sort(key=lambda x: _sort_key_result(x, lower))
        _assign_placements(event, group, category_id=cid)


def leaderboard_for_championship(championship_id: int, category_slug: str | None = None):
    """Ranking agregado: modo individual filtra por slug de categoria; modo team só times."""
    from apps.athletes.models import Athlete, Team
    from apps.events.models import Category, Championship, ChampionshipMode, TiebreakRule

    champ = Championship.objects.filter(pk=championship_id).first()
    if not champ:
        return []

    events = list(
        Event.objects.filter(competition_id=championship_id).order_by("display_order", "scheduled_at", "id")
    )
    last_event = events[-1] if events else None

    tiebreak_rule = champ.tiebreak_rule or TiebreakRule.MOST_WINS

    if champ.mode == ChampionshipMode.TEAM:
        rows = []
        teams = Team.objects.filter(championship_id=championship_id)
        for t in teams:
            agg = Result.objects.filter(team=t, event__competition_id=championship_id).aggregate(
                total=Sum("points_earned"),
                wins=Count("id", filter=Q(position=1)),
            )
            total = agg["total"] or 0
            wins = agg["wins"] or 0
            last_rank = None
            last_tb = None
            if last_event:
                lr = (
                    Result.objects.filter(team=t, event=last_event)
                    .values_list("position", "tiebreak_score")
                    .first()
                )
                if lr:
                    last_rank, last_tb = lr
            member_names = list(t.athletes.values_list("name", flat=True))
            rows.append(
                {
                    "type": "team",
                    "id": t.id,
                    "name": t.name,
                    "logo": t.logo.url if t.logo else None,
                    "total_points": int(total),
                    "wins": wins,
                    "last_event_rank": last_rank,
                    "last_tiebreak": float(last_tb) if last_tb is not None else None,
                    "members": member_names,
                }
            )

        def sort_team_key(r):
            if tiebreak_rule == TiebreakRule.LAST_WOD:
                last_rk = r["last_event_rank"] if r["last_event_rank"] is not None else 9999
                tb = r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12
                return (-r["total_points"], last_rk, tb)
            if tiebreak_rule == TiebreakRule.TIEBREAK_FIELD:
                tb = r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12
                return (-r["total_points"], tb)
            last_rk = r["last_event_rank"] if r["last_event_rank"] is not None else 9999
            tb = r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12
            return (-r["total_points"], -r["wins"], last_rk, tb)

        rows.sort(key=sort_team_key)
        for idx, r in enumerate(rows, start=1):
            r["overall_rank"] = idx
        return rows

    # Individual (por categoria se slug informado)
    cat_filter = Q()
    if category_slug:
        cat = Category.objects.filter(championship_id=championship_id, slug=category_slug).first()
        if cat:
            cat_filter = Q(category=cat)

    athletes = Athlete.objects.filter(championship_id=championship_id).filter(cat_filter)

    rows = []
    for a in athletes.select_related("category"):
        agg = Result.objects.filter(athlete=a, event__competition_id=championship_id).aggregate(
            total=Sum("points_earned"),
            wins=Count("id", filter=Q(position=1)),
        )
        total = agg["total"] or 0
        wins = agg["wins"] or 0
        last_rank = None
        last_tb = None
        if last_event:
            lr = (
                Result.objects.filter(athlete=a, event=last_event)
                .values_list("position", "tiebreak_score")
                .first()
            )
            if lr:
                last_rank, last_tb = lr
        rows.append(
            {
                "type": "athlete",
                "id": a.id,
                "name": a.name,
                "nickname": a.nickname,
                "photo": a.photo.url if a.photo else None,
                "team_name": a.team.name if a.team_id else None,
                "category_name": a.category.name,
                "category_slug": a.category.slug,
                "total_points": int(total),
                "wins": wins,
                "last_event_rank": last_rank,
                "last_tiebreak": float(last_tb) if last_tb is not None else None,
            }
        )

    def sort_key(r):
        if tiebreak_rule == TiebreakRule.LAST_WOD:
            last_rk = r["last_event_rank"] if r["last_event_rank"] is not None else 9999
            tb = r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12
            return (-r["total_points"], last_rk, tb)
        if tiebreak_rule == TiebreakRule.TIEBREAK_FIELD:
            tb = r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12
            return (-r["total_points"], tb)
        last_rk = r["last_event_rank"] if r["last_event_rank"] is not None else 9999
        tb = r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12
        return (-r["total_points"], -r["wins"], last_rk, tb)

    rows.sort(key=sort_key)

    for idx, r in enumerate(rows, start=1):
        r["overall_rank"] = idx

    return rows


def leaderboard_for_category(competition_id: int, category: str):
    """Compatibilidade: category é slug ou nome da divisão."""
    from apps.events.models import Category

    q = category.strip()
    cat = Category.objects.filter(championship_id=competition_id).filter(
        Q(slug__iexact=q) | Q(name__iexact=q)
    ).first()
    slug_use = cat.slug if cat else None
    return leaderboard_for_championship(competition_id, category_slug=slug_use)


def recalculate_competition_leaderboards(competition_id: int) -> None:
    event_ids = Event.objects.filter(competition_id=competition_id).values_list("id", flat=True)
    with transaction.atomic():
        for eid in event_ids:
            recalculate_event_rankings(Event.objects.get(pk=eid))
