import csv
import io
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.scores.models import PointsTableEntry, Result, ResultAuditLog, ScoreConfig
from apps.scores.serializers import (
    PointsTableEntrySerializer,
    ResultAuditLogSerializer,
    ResultSerializer,
    ScoreConfigSerializer,
)
from apps.scores.services import recalculate_event_rankings


class ScoreConfigViewSet(viewsets.ModelViewSet):
    queryset = ScoreConfig.objects.select_related("event")
    serializer_class = ScoreConfigSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]


class PointsTableEntryViewSet(viewsets.ModelViewSet):
    queryset = PointsTableEntry.objects.select_related("event", "category")
    serializer_class = PointsTableEntrySerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        eid = self.request.query_params.get("event")
        if eid:
            qs = qs.filter(event_id=eid)
        return qs


class ResultViewSet(viewsets.ModelViewSet):
    queryset = Result.objects.select_related("event", "athlete", "team")
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        eid = self.request.query_params.get("event")
        if eid:
            qs = qs.filter(event_id=eid)
        return qs

    def perform_update(self, serializer):
        inst = serializer.instance
        old = {
            "raw_score": str(inst.raw_score),
            "tiebreak_score": str(inst.tiebreak_score) if inst.tiebreak_score is not None else None,
            "notes": inst.notes,
        }
        result = serializer.save()
        ResultAuditLog.objects.create(
            result=result,
            edited_by=self.request.user if self.request.user.is_authenticated else None,
            snapshot={"before": old},
        )

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """Corpo: { \"event\": id, \"rows\": [ {\"athlete\": id?, \"team\": id?, \"raw_score\": ..., \"tiebreak_score\": ... } ] }"""
        event_id = request.data.get("event")
        rows = request.data.get("rows")
        if not event_id or not isinstance(rows, list):
            return Response({"detail": "event e rows (lista) são obrigatórios"}, status=400)
        created = 0
        errors = []
        for i, row in enumerate(rows, start=1):
            data = {"event": int(event_id), **row}
            ser = ResultSerializer(data=data)
            if ser.is_valid():
                ser.save()
                created += 1
            else:
                errors.append({"index": i, "errors": ser.errors})
        if event_id:
            recalculate_event_rankings_by_id(int(event_id))
        return Response({"created": created, "errors": errors[:40]}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="preview-csv")
    def preview_csv(self, request):
        event_id = request.data.get("event")
        file = request.FILES.get("file")
        if not event_id or not file:
            return Response({"detail": "event e file são obrigatórios"}, status=400)
        text = file.read().decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)[:50]
        return Response({"columns": reader.fieldnames, "preview": rows})

    @action(detail=False, methods=["post"], url_path="import-csv")
    def import_csv(self, request):
        event_id = request.data.get("event")
        file = request.FILES.get("file")
        if not event_id or not file:
            return Response({"detail": "event e file são obrigatórios"}, status=400)
        text = file.read().decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        created = 0
        errors = []
        for i, row in enumerate(reader, start=2):
            try:
                aid = row.get("athlete_id") or row.get("atleta_id")
                tid = row.get("team_id") or row.get("time_id")
                raw = (
                    row.get("raw_score")
                    or row.get("raw_value")
                    or row.get("valor")
                    or row.get("tempo_seg")
                )
                tb = row.get("tiebreak_score") or row.get("tiebreak") or row.get("tb") or ""
                if not raw:
                    continue
                data = {
                    "event": int(event_id),
                    "raw_score": Decimal(str(raw).replace(",", ".")),
                    "tiebreak_score": Decimal(str(tb).replace(",", ".")) if tb not in ("", None) else None,
                    "notes": row.get("notes") or row.get("obs") or "",
                }
                if aid:
                    data["athlete"] = int(aid)
                    data["team"] = None
                elif tid:
                    data["team"] = int(tid)
                    data["athlete"] = None
                else:
                    errors.append({"line": i, "error": "athlete_id ou team_id ausente"})
                    continue
                ser = ResultSerializer(data=data)
                if not ser.is_valid():
                    errors.append({"line": i, "error": ser.errors})
                    continue
                ser.save()
                created += 1
            except (ValueError, InvalidOperation) as e:
                errors.append({"line": i, "error": str(e)})
        recalculate_event_rankings_by_id(int(event_id))
        return Response({"created": created, "errors": errors[:30]}, status=status.HTTP_200_OK)


def recalculate_event_rankings_by_id(event_id: int):
    from apps.events.models import Event

    recalculate_event_rankings(Event.objects.get(pk=event_id))


class ResultAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ResultAuditLog.objects.select_related("result", "edited_by")
    serializer_class = ResultAuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
