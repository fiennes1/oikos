from rest_framework import permissions
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.events.models import Championship, ChampionshipMode, Event, HeatSchedule, HeatStatus
from apps.events.serializers import (
    ChampionshipSerializer,
    EventSerializer,
    PublicHeatSerializer,
)
from apps.scores.serializers import ResultSerializer
from apps.scores.services import leaderboard_for_category, leaderboard_for_championship


def get_active_championship():
    ch = Championship.objects.filter(is_active=True).order_by("-start_date").first()
    if not ch:
        ch = Championship.objects.order_by("-start_date").first()
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


class PublicChampionshipScheduleView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        comp = Championship.objects.filter(pk=pk).first()
        if not comp:
            return Response({"heats": [], "current_heat_id": None, "events": []})
        heats = (
            HeatSchedule.objects.filter(event__competition=comp)
            .select_related("event", "athlete", "team")
            .order_by("event__display_order", "heat_number", "scheduled_time")
        )
        current = (
            heats.filter(status=HeatStatus.IN_PROGRESS)
            .order_by("event__display_order", "heat_number")
            .first()
        )
        data = PublicHeatSerializer(heats, many=True).data
        return Response(
            {
                "heats": data,
                "current_heat_id": current.id if current else None,
                "events": EventSerializer(
                    Event.objects.filter(competition=comp).order_by("display_order"),
                    many=True,
                ).data,
            }
        )


class PublicCompetitionInfoView(APIView):
    """Legado: campeonato ativo."""

    permission_classes = [AllowAny]

    def get(self, request):
        comp = get_active_championship()
        if not comp:
            return Response({"detail": "Nenhum campeonato cadastrado."}, status=404)
        return Response(ChampionshipSerializer(comp).data)


class PublicScheduleView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        comp = get_active_championship()
        if not comp:
            return Response({"heats": [], "current_heat_id": None, "events": []})
        heats = (
            HeatSchedule.objects.filter(event__competition=comp)
            .select_related("event", "athlete", "team")
            .order_by("event__display_order", "heat_number", "scheduled_time")
        )
        current = (
            heats.filter(status=HeatStatus.IN_PROGRESS)
            .order_by("event__display_order", "heat_number")
            .first()
        )
        data = PublicHeatSerializer(heats, many=True).data
        return Response(
            {
                "heats": data,
                "current_heat_id": current.id if current else None,
                "events": EventSerializer(
                    Event.objects.filter(competition=comp).order_by("display_order"),
                    many=True,
                ).data,
            }
        )


class PublicEventResultsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        from apps.scores.models import Result

        event = Event.objects.filter(pk=pk).select_related("competition").first()
        if not event:
            return Response({"detail": "Prova não encontrada"}, status=404)
        results = Result.objects.filter(event=event).select_related("athlete", "team").order_by(
            "position"
        )
        return Response(
            {
                "event": EventSerializer(event).data,
                "results": ResultSerializer(results, many=True).data,
            }
        )


class PublicLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        category = request.query_params.get("category", "rx")
        comp = get_active_championship()
        if not comp:
            return Response({"category": category, "competition_id": None, "rows": []})
        if comp.mode == ChampionshipMode.TEAM:
            rows = leaderboard_for_championship(comp.id, category_slug=None)
        else:
            rows = leaderboard_for_category(comp.id, category)
        return Response({"category": category, "competition_id": comp.id, "rows": rows})


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
            results = Result.objects.filter(athlete=athlete, event__competition=comp).select_related(
                "event"
            )
            board = leaderboard_for_championship(comp.id, category_slug=athlete.category.slug if athlete.category_id else None)
            overall = next(
                (r for r in board if r["type"] == "athlete" and r["id"] == athlete.id),
                None,
            )
        return Response(
            {
                "athlete": AthleteSerializer(athlete).data,
                "results": ResultSerializer(results, many=True).data,
                "overall": overall,
            }
        )
