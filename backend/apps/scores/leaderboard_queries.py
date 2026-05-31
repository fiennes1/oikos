"""Consultas agregadas para ranking — evita N+1 por atleta/time."""

from django.db.models import Count, Q, Sum

from apps.athletes.models import Athlete, Team
from apps.events.models import Category, Championship, ChampionshipMode, Event, TiebreakRule
from apps.scores.models import Result


def _sort_rows(rows, tiebreak_rule):
    if tiebreak_rule == TiebreakRule.LAST_WOD:
        rows.sort(
            key=lambda r: (
                -r["total_points"],
                r["last_event_rank"] if r["last_event_rank"] is not None else 9999,
                r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12,
            )
        )
    elif tiebreak_rule == TiebreakRule.TIEBREAK_FIELD:
        rows.sort(
            key=lambda r: (
                -r["total_points"],
                r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12,
            )
        )
    else:
        rows.sort(
            key=lambda r: (
                -r["total_points"],
                -r["wins"],
                r["last_event_rank"] if r["last_event_rank"] is not None else 9999,
                r["last_tiebreak"] if r["last_tiebreak"] is not None else 1e12,
            )
        )
    for idx, r in enumerate(rows, start=1):
        r["overall_rank"] = idx
    return rows


def _aggregate_stats(championship_id: int, group_field: str):
    """group_field: 'team_id' ou 'athlete_id'."""
    flt = {f"{group_field}__isnull": False}
    return {
        row[group_field]: row
        for row in Result.objects.filter(event__competition_id=championship_id, **flt)
        .values(group_field)
        .annotate(
            total=Sum("points_earned"),
            wins=Count("id", filter=Q(position=1)),
        )
    }


def _last_event_rank_map(last_event_id: int | None, group_field: str, ids: list[int]):
    if not last_event_id or not ids:
        return {}
    flt = {f"{group_field}__in": ids, "event_id": last_event_id}
    return {
        row[group_field]: (row["position"], row["tiebreak_score"])
        for row in Result.objects.filter(**flt).values(group_field, "position", "tiebreak_score")
    }


def leaderboard_for_championship_optimized(championship_id: int, category_slug: str | None = None):
    champ = Championship.objects.filter(pk=championship_id).first()
    if not champ:
        return []

    events = list(
        Event.objects.filter(competition_id=championship_id).order_by("display_order", "scheduled_at", "id")
    )
    last_event = events[-1] if events else None
    last_event_id = last_event.id if last_event else None
    tiebreak_rule = champ.tiebreak_rule or TiebreakRule.MOST_WINS

    if champ.mode == ChampionshipMode.TEAM:
        stats_map = _aggregate_stats(championship_id, "team_id")
        teams = list(Team.objects.filter(championship_id=championship_id).prefetch_related("athletes"))
        team_ids = [t.id for t in teams]
        last_map = _last_event_rank_map(last_event_id, "team_id", team_ids)

        rows = []
        for t in teams:
            st = stats_map.get(t.id, {})
            total = st.get("total") or 0
            wins = st.get("wins") or 0
            lr = last_map.get(t.id)
            last_rank, last_tb = lr if lr else (None, None)
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
                    "members": [a.name for a in t.athletes.all()],
                }
            )
        return _sort_rows(rows, tiebreak_rule)

    cat_filter = Q()
    if category_slug:
        cat = Category.objects.filter(championship_id=championship_id, slug=category_slug).first()
        if cat:
            cat_filter = Q(category=cat)

    stats_map = _aggregate_stats(championship_id, "athlete_id")
    athletes = list(
        Athlete.objects.filter(championship_id=championship_id)
        .filter(cat_filter)
        .select_related("category", "team")
    )
    athlete_ids = [a.id for a in athletes]
    last_map = _last_event_rank_map(last_event_id, "athlete_id", athlete_ids)

    rows = []
    for a in athletes:
        st = stats_map.get(a.id, {})
        total = st.get("total") or 0
        wins = st.get("wins") or 0
        lr = last_map.get(a.id)
        last_rank, last_tb = lr if lr else (None, None)
        rows.append(
            {
                "type": "athlete",
                "id": a.id,
                "name": a.name,
                "nickname": a.nickname,
                "photo": a.photo.url if a.photo else None,
                "team_name": a.team.name if a.team_id else None,
                "category_name": a.category.name if a.category_id else None,
                "category_slug": a.category.slug if a.category_id else None,
                "total_points": int(total),
                "wins": wins,
                "last_event_rank": last_rank,
                "last_tiebreak": float(last_tb) if last_tb is not None else None,
            }
        )
    return _sort_rows(rows, tiebreak_rule)
