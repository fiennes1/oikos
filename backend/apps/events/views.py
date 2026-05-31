from rest_framework import permissions, status, viewsets
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
    queryset = Championship.objects.prefetch_related("categories")
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
    queryset = Event.objects.select_related("competition").prefetch_related("eligible_categories")
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
        return qs.order_by("heat_number", "lane_number")

    @action(detail=False, methods=["post"], url_path="batch")
    def batch(self, request):
        """
        Cria uma bateria com várias raias de uma vez.
        Body: { event, heat_number, scheduled_time?, lanes: [{ lane_number, athlete?, team? }] }
        """
        event_id = request.data.get("event")
        heat_number = request.data.get("heat_number")
        scheduled_time = request.data.get("scheduled_time")
        lanes = request.data.get("lanes")
        if not event_id or heat_number is None or not isinstance(lanes, list):
            return Response(
                {"detail": "event, heat_number e lanes (lista) são obrigatórios."},
                status=400,
            )
        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({"detail": "Prova não encontrada."}, status=404)

        created = []
        errors = []
        for i, lane in enumerate(lanes, start=1):
            if not isinstance(lane, dict):
                errors.append({"index": i, "error": "lane inválida"})
                continue
            data = {
                "event": event.pk,
                "heat_number": int(heat_number),
                "lane_number": int(lane.get("lane_number") or i),
                "scheduled_time": scheduled_time,
                "athlete": lane.get("athlete"),
                "team": lane.get("team"),
            }
            ser = HeatScheduleSerializer(data=data)
            if ser.is_valid():
                created.append(ser.save())
            else:
                errors.append({"index": i, "errors": ser.errors})

        out = HeatScheduleSerializer(created, many=True).data
        return Response({"created": out, "errors": errors[:20]}, status=201 if created else 400)

    @action(detail=False, methods=["post"], url_path="start-batch")
    def start_batch(self, request):
        """Inicia uma bateria inteira (todas as raias) e conclui baterias anteriores da prova."""
        from apps.events.heat_batch import HeatBatchError, start_heat_batch

        event_id = request.data.get("event")
        heat_number = request.data.get("heat_number")
        if not event_id or heat_number is None:
            return Response(
                {"detail": "event e heat_number são obrigatórios."},
                status=400,
            )
        try:
            updated = start_heat_batch(int(event_id), int(heat_number))
        except HeatBatchError as e:
            return Response({"detail": str(e)}, status=404)
        rows = HeatSchedule.objects.filter(event_id=event_id, heat_number=heat_number).order_by("lane_number")
        return Response(
            {
                "updated": updated,
                "heat_number": int(heat_number),
                "lanes": HeatScheduleSerializer(rows, many=True).data,
            }
        )


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
