import threading
from contextlib import contextmanager

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.scores.models import Result
from apps.scores.services import recalculate_event_rankings

_local = threading.local()


def ranking_signals_muted() -> bool:
    """True durante exclusão em cascata de campeonato/prova (evita recriar ScoreConfig)."""
    return getattr(_local, "depth", 0) > 0


@contextmanager
def mute_result_ranking_signals():
    prev = getattr(_local, "depth", 0)
    _local.depth = prev + 1
    try:
        yield
    finally:
        _local.depth = prev


@receiver(post_save, sender=Result)
def result_saved(sender, instance, **kwargs):
    if ranking_signals_muted():
        return
    recalculate_event_rankings(instance.event)


@receiver(post_delete, sender=Result)
def result_deleted(sender, instance, **kwargs):
    if ranking_signals_muted():
        return
    recalculate_event_rankings(instance.event)
