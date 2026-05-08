from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.scores.services import recalculate_event_rankings
from apps.events.models import Category, Championship, Event, HeatSchedule
from apps.events.serializers import (
    CategorySerializer,
    ChampionshipSerializer,
    EventSerializer,
    HeatScheduleSerializer,
)


class ChampionshipViewSet(viewsets.ModelViewSet):
    queryset = Championship.objects.all()
    serializer_class = ChampionshipSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def perform_create(self, serializer):
        obj = serializer.save()
        if obj.is_active:
            Championship.objects.exclude(pk=obj.pk).update(is_active=False)

    def perform_update(self, serializer):
        obj = serializer.save()
        if obj.is_active:
            Championship.objects.exclude(pk=obj.pk).update(is_active=False)


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.select_related("competition")
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    @action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        event = self.get_object()
        recalculate_event_rankings(event)
        return Response({"detail": "Recálculo concluído."})

    @action(detail=True, methods=["post"], url_path="heats/reorder")
    def reorder_heats(self, request, pk=None):
        event = self.get_object()
        order = request.data.get("order")
        if not isinstance(order, list):
            return Response({"detail": "order deve ser lista de IDs"}, status=400)
        for idx, hid in enumerate(order, start=1):
            HeatSchedule.objects.filter(pk=hid, event=event).update(heat_number=idx)
        heats = HeatSchedule.objects.filter(event=event).order_by("heat_number")
        return Response(HeatScheduleSerializer(heats, many=True).data)


class HeatScheduleViewSet(viewsets.ModelViewSet):
    queryset = HeatSchedule.objects.select_related("event", "athlete", "team")
    serializer_class = HeatScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        eid = self.request.query_params.get("event")
        if eid:
            qs = qs.filter(event_id=eid)
        return qs


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.select_related("championship")
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        cid = self.request.query_params.get("championship")
        if cid:
            qs = qs.filter(championship_id=cid)
        return qs


# Retrocompat router
CompetitionViewSet = ChampionshipViewSet
