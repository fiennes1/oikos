import threading

from django.db import close_old_connections, transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.scores.models import Result
from apps.scores.ranking_context import (
    mute_result_ranking_signals,
    ranking_signals_muted,
    recalc_lock_for_event,
)

# Reexport para imports legados (events/models.py, management commands)
__all__ = ["mute_result_ranking_signals", "ranking_signals_muted"]


def _run_recalculate(event_id: int) -> None:
    close_old_connections()
    lock = recalc_lock_for_event(event_id)
    with lock:
        from apps.events.models import Event
        from apps.scores.services import recalculate_event_rankings

        try:
            event = Event.objects.filter(pk=event_id).first()
            if event:
                recalculate_event_rankings(event)
        finally:
            close_old_connections()


def _enqueue_recalculate(event_id: int) -> None:
    def start_background_recalc():
        threading.Thread(
            target=_run_recalculate,
            args=(event_id,),
            daemon=True,
            name=f"recalc-event-{event_id}",
        ).start()

    transaction.on_commit(start_background_recalc)


def enqueue_event_rankings_recalculate(event_id: int) -> None:
    """Dispara recálculo de posições/pontos após alteração na configuração da prova."""
    _enqueue_recalculate(event_id)


@receiver(post_save, sender=Result)
def result_saved(sender, instance, **kwargs):
    if ranking_signals_muted():
        return
    _enqueue_recalculate(instance.event_id)


@receiver(post_delete, sender=Result)
def result_deleted(sender, instance, **kwargs):
    if ranking_signals_muted():
        return
    _enqueue_recalculate(instance.event_id)
