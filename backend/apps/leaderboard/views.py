from rest_framework import permissions
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings

from apps.events.models import Championship, ChampionshipMode, Event, HeatSchedule, HeatStatus
from apps.events.serializers import (
    ChampionshipSerializer,
    EventSerializer,
    PublicHeatSerializer,
)
from apps.leaderboard.cache_utils import get_public_cached, public_cache_key, set_public_cached
from apps.scores.serializers import ResultSerializer
from apps.scores.services import leaderboard_for_category, leaderboard_for_championship


def get_active_championship():
    key = public_cache_key("active_championship")
    cached = get_public_cached(key)
    if cached is not None:
        return cached
    ch = Championship.objects.filter(is_active=True).order_by("-start_date").first()
    if not ch:
        ch = Championship.objects.order_by("-start_date").first()
    if ch:
        set_public_cached(key, ch, settings.PUBLIC_API_CACHE_SECONDS)
    return ch


class PublicChampionshipListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Championship.objects.all().order_by("-start_date")[:50]
        data = ChampionshipSerializer(qs, many=True).data
        return Response({"results": data})


class PublicChampionshipDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        ch = Championship.objects.filter(pk=pk).first()
        if not ch:
            return Response({"detail": "Campeonato não encontrado."}, status=404)
        return Response(ChampionshipSerializer(ch).data)


class PublicChampionshipLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        cat = request.query_params.get("category") or request.query_params.get("category_slug")
        rows = leaderboard_for_championship(int(pk), category_slug=cat if cat else None)
        return Response({"championship_id": int(pk), "category": cat, "rows": rows})


def _schedule_payload(comp):
    if not comp:
        return {"heats": [], "current_heat_id": None, "current_live_batch": None, "events": []}
    cache_key = public_cache_key("schedule", comp.pk)
    cached = get_public_cached(cache_key)
    if cached is not None:
        return cached

    heats = (
        HeatSchedule.objects.filter(event__competition=comp)
        .select_related("event", "athlete", "team")
        .order_by("event__display_order", "heat_number", "lane_number", "scheduled_time")
    )
    current = (
        heats.filter(status=HeatStatus.IN_PROGRESS)
        .order_by("event__display_order", "heat_number", "lane_number")
        .first()
    )
    live_batch = None
    if current:
        live_batch = {"event_id": current.event_id, "heat_number": current.heat_number}
    data = PublicHeatSerializer(heats, many=True).data
    payload = {
        "heats": data,
        "current_heat_id": current.id if current else None,
        "current_live_batch": live_batch,
        "events": EventSerializer(
            Event.objects.filter(competition=comp)
            .prefetch_related("eligible_categories")
            .order_by("display_order"),
            many=True,
        ).data,
    }
    set_public_cached(cache_key, payload, settings.PUBLIC_API_CACHE_SECONDS)
    return payload


class PublicChampionshipScheduleView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        comp = Championship.objects.filter(pk=pk).first()
        return Response(_schedule_payload(comp))


class PublicCompetitionInfoView(APIView):
    """Legado: campeonato ativo."""

    permission_classes = [AllowAny]

    def get(self, request):
        comp = get_active_championship()
        if not comp:
            return Response({"detail": "Nenhum campeonato cadastrado."}, status=404)
        cache_key = public_cache_key("competition_info", comp.pk)
        cached = get_public_cached(cache_key)
        if cached is not None:
            return Response(cached)
        data = ChampionshipSerializer(comp).data
        set_public_cached(cache_key, data, settings.PUBLIC_API_CACHE_SECONDS)
        return Response(data)


class PublicScheduleView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        comp = get_active_championship()
        return Response(_schedule_payload(comp))


class PublicEventResultsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        from collections import Counter

        from apps.scores.models import Result
        from apps.scores.services import _uses_team_individual_scoring

        cache_key = public_cache_key("event_results", pk)
        cached = get_public_cached(cache_key)
        if cached is not None:
            return Response(cached)

        event = Event.objects.filter(pk=pk).select_related("competition").first()
        if not event:
            return Response({"detail": "Prova não encontrada"}, status=404)
        results = list(
            Result.objects.filter(event=event).select_related(
                "athlete", "athlete__team", "athlete__category", "team"
            )
        )
        team_individual = _uses_team_individual_scoring(event)

        def sort_key(r):
            return r.position_override if r.position_override is not None else (r.position or 9999)

        def tied_positions_for(rows):
            counts = Counter(r.position for r in rows if r.position is not None)
            return {p for p, c in counts.items() if c > 1}

        if team_individual:
            team_rows = sorted([r for r in results if r.team_id and not r.athlete_id], key=sort_key)
            athlete_rows = sorted(
                [r for r in results if r.athlete_id],
                key=lambda r: (r.athlete.team_id or 0, r.athlete.name),
            )
            payload = {
                "event": EventSerializer(event).data,
                "results": ResultSerializer(
                    team_rows,
                    many=True,
                    context={"tied_positions": tied_positions_for(team_rows)},
                ).data,
                "individual_results": ResultSerializer(athlete_rows, many=True).data,
                "scoring_mode": "team_with_individual",
            }
        else:
            results.sort(key=sort_key)
            payload = {
                "event": EventSerializer(event).data,
                "results": ResultSerializer(
                    results,
                    many=True,
                    context={"tied_positions": tied_positions_for(results)},
                ).data,
                "individual_results": [],
                "scoring_mode": "standard",
            }
        set_public_cached(cache_key, payload, settings.PUBLIC_API_CACHE_SECONDS)
        return Response(payload)


class PublicLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        category = request.query_params.get("category", "rx")
        comp = get_active_championship()
        if not comp:
            return Response({"category": category, "competition_id": None, "rows": []})

        cache_key = public_cache_key("leaderboard", comp.id, comp.mode, category)
        cached = get_public_cached(cache_key)
        if cached is not None:
            return Response(cached)

        if comp.mode == ChampionshipMode.TEAM:
            rows = leaderboard_for_championship(comp.id, category_slug=None)
        elif comp.mode == ChampionshipMode.MIXED:
            team_rows = leaderboard_for_championship(comp.id, category_slug=None)
            ind_rows = leaderboard_for_category(comp.id, category)
            rows = {"team": team_rows, "individual": ind_rows}
        else:
            rows = leaderboard_for_category(comp.id, category)
        payload = {"category": category, "competition_id": comp.id, "rows": rows, "mode": comp.mode}
        set_public_cached(cache_key, payload, settings.PUBLIC_API_CACHE_SECONDS)
        return Response(payload)


class AdminDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        from apps.scores.models import Result

        comp = get_active_championship()
        if not comp:
            return Response(
                {
                    "competition": None,
                    "upcoming_heats": [],
                    "recent_results": [],
                }
            )
        heats = (
            HeatSchedule.objects.filter(event__competition=comp, status=HeatStatus.PENDING)
            .select_related("event", "athlete", "team")
            .order_by("scheduled_time", "heat_number")[:12]
        )
        recent = (
            Result.objects.filter(event__competition=comp)
            .select_related("event", "athlete", "team")
            .order_by("-id")[:15]
        )
        return Response(
            {
                "competition": ChampionshipSerializer(comp).data,
                "upcoming_heats": PublicHeatSerializer(heats, many=True).data,
                "recent_results": ResultSerializer(recent, many=True).data,
            }
        )


class PublicAthleteProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        from apps.athletes.models import Athlete
        from apps.athletes.serializers import AthleteSerializer
        from apps.scores.models import Result

        athlete = Athlete.objects.filter(pk=pk).select_related("team", "category").first()
        if not athlete:
            return Response({"detail": "Atleta não encontrado"}, status=404)
        comp = get_active_championship()
        results = []
        overall = None
        if comp:
            results = Result.objects.filter(athlete=athlete, event__competition=comp).select_related("event")
            cat_slug = athlete.category.slug if athlete.category_id else "rx"
            cache_key = public_cache_key("leaderboard", comp.id, comp.mode, cat_slug)
            board_payload = get_public_cached(cache_key)
            if board_payload and board_payload.get("rows"):
                rows = board_payload["rows"]
                if isinstance(rows, dict):
                    rows = rows.get("individual") or rows.get("team") or []
            elif comp.mode == ChampionshipMode.TEAM:
                rows = leaderboard_for_championship(comp.id, category_slug=None)
            elif comp.mode == ChampionshipMode.MIXED:
                rows = leaderboard_for_category(comp.id, cat_slug)
            else:
                rows = leaderboard_for_category(comp.id, cat_slug)
            overall = next(
                (r for r in rows if r.get("type") == "athlete" and r["id"] == athlete.id),
                None,
            )
        return Response(
            {
                "athlete": AthleteSerializer(athlete).data,
                "results": ResultSerializer(results, many=True).data,
                "overall": overall,
            }
        )
