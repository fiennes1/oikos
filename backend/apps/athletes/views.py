from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.athletes.models import Athlete, Team
from apps.athletes.serializers import AthleteSerializer, TeamSerializer


class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.prefetch_related("athletes", "athletes__category")
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        cid = self.request.query_params.get("championship")
        if cid:
            qs = qs.filter(championship_id=cid)
        return qs


class AthleteViewSet(viewsets.ModelViewSet):
    queryset = Athlete.objects.select_related("team", "category", "championship")
    serializer_class = AthleteSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        cid = self.request.query_params.get("championship")
        if cid:
            qs = qs.filter(championship_id=cid)
        return qs

    @action(detail=True, methods=["patch"], url_path="assign-team")
    def assign_team(self, request, pk=None):
        athlete = self.get_object()
        tid = request.data.get("team")
        if tid in (None, "", "null"):
            athlete.team = None
            athlete.save(update_fields=["team"])
            return Response(AthleteSerializer(athlete).data)
        team = Team.objects.filter(pk=tid, championship_id=athlete.championship_id).first()
        if not team:
            return Response({"detail": "Time inválido ou de outro campeonato."}, status=status.HTTP_400_BAD_REQUEST)
        athlete.team = team
        athlete.save(update_fields=["team"])
        return Response(AthleteSerializer(athlete).data)
