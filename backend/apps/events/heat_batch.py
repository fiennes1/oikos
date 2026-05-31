from django.db import transaction

from apps.events.models import HeatSchedule, HeatStatus


class HeatBatchError(Exception):
    pass


def start_heat_batch(event_id: int, heat_number: int) -> int:
    """Marca todas as raias da bateria como em andamento e conclui baterias anteriores."""
    qs = HeatSchedule.objects.filter(event_id=event_id, heat_number=heat_number)
    if not qs.exists():
        raise HeatBatchError("Bateria não encontrada para esta prova.")

    with transaction.atomic():
        HeatSchedule.objects.filter(
            event_id=event_id,
            heat_number__lt=heat_number,
        ).update(status=HeatStatus.DONE)
        updated = HeatSchedule.objects.filter(
            event_id=event_id,
            heat_number=heat_number,
        ).update(status=HeatStatus.IN_PROGRESS)
    return updated


def set_heat_batch_status(event_id: int, heat_number: int, status: str) -> int:
    """Atualiza o status de todas as raias de uma bateria."""
    qs = HeatSchedule.objects.filter(event_id=event_id, heat_number=heat_number)
    if not qs.exists():
        raise HeatBatchError("Bateria não encontrada para esta prova.")
    if status == HeatStatus.IN_PROGRESS:
        return start_heat_batch(event_id, heat_number)
    return qs.update(status=status)
