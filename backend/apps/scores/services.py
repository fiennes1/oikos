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

    cfg = ScoreConfig.objects.filter(event=event).first()
    if cfg:
        if cfg.metric != metric or cfg.lower_is_better != lower:
            ScoreConfig.objects.filter(pk=cfg.pk).update(metric=metric, lower_is_better=lower)
            cfg.metric = metric
            cfg.lower_is_better = lower
        return cfg

    return ScoreConfig.objects.create(event=event, metric=metric, lower_is_better=lower)


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

    existing = {
        row.team_id: row
        for row in Result.objects.filter(event=event, team__isnull=False, athlete__isnull=True)
    }
    seen_team_ids = set()

    for team_id, group in by_team.items():
        seen_team_ids.add(team_id)
        agg = _aggregate_raw([r.raw_score for r in group], method, lower)
        if agg is None:
            continue
        row = existing.get(team_id)
        if row is not None:
            if row.raw_score != agg:
                Result.objects.filter(pk=row.pk).update(raw_score=agg)
        else:
            Result.objects.create(
                event_id=event.pk,
                team_id=team_id,
                athlete_id=None,
                raw_score=agg,
            )

    stale_ids = [existing[tid].pk for tid in existing.keys() - seen_team_ids]
    if stale_ids:
        Result.objects.filter(pk__in=stale_ids).delete()


def recalculate_event_rankings(event: Event, *, bump_cache: bool = True) -> None:
    from apps.leaderboard.cache_utils import bump_public_api_cache
    from apps.scores.ranking_context import mute_result_ranking_signals

    # Em cascatas grandes (ex.: excluir campeonato), o Event pode já ter sido
    # removido do banco enquanto post_delete de Result ainda roda com o objeto
    # em memória — não recriar ScoreConfig com FK inválida.
    if event.pk is None or not Event.objects.filter(pk=event.pk).exists():
        return

    with mute_result_ranking_signals():
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
            if bump_cache:
                bump_public_api_cache()
            return

        if event.scored_by == ScoredBy.TEAM or _uses_team_individual_scoring(event):
            bucket = [r for r in results if r.team_id and not r.athlete_id]
            bucket.sort(key=lambda r: _sort_key_result(r, lower))
            _assign_placements(event, bucket, category_id=None)
        else:
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

    if bump_cache:
        bump_public_api_cache()


def leaderboard_for_championship(championship_id: int, category_slug: str | None = None):
    """Ranking agregado: modo individual filtra por slug de categoria; modo team só times."""
    from apps.scores.leaderboard_queries import leaderboard_for_championship_optimized

    return leaderboard_for_championship_optimized(championship_id, category_slug)


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
    from apps.leaderboard.cache_utils import bump_public_api_cache
    from apps.scores.ranking_context import mute_result_ranking_signals

    event_ids = Event.objects.filter(competition_id=competition_id).values_list("id", flat=True)
    with transaction.atomic(), mute_result_ranking_signals():
        for eid in event_ids:
            recalculate_event_rankings(Event.objects.get(pk=eid), bump_cache=False)
    bump_public_api_cache()
