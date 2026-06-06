"""Controle de signals durante recálculo em lote (evita cascata post_save/post_delete)."""

import threading
from contextlib import contextmanager

_local = threading.local()
_event_recalc_locks: dict[int, threading.Lock] = {}
_event_recalc_locks_guard = threading.Lock()


def ranking_signals_muted() -> bool:
    return getattr(_local, "depth", 0) > 0


@contextmanager
def mute_result_ranking_signals():
    prev = getattr(_local, "depth", 0)
    _local.depth = prev + 1
    try:
        yield
    finally:
        _local.depth = prev


def recalc_lock_for_event(event_id: int) -> threading.Lock:
    with _event_recalc_locks_guard:
        if event_id not in _event_recalc_locks:
            _event_recalc_locks[event_id] = threading.Lock()
        return _event_recalc_locks[event_id]
