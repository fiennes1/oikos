from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.events.models import Championship, Event, HeatSchedule
from apps.leaderboard.cache_utils import bump_public_api_cache

# Campos cuja alteração exige reordenar resultados já lançados
SCORING_RECALC_FIELDS = (
    "score_mode",
    "event_type",
    "metric_type",
    "scored_by",
    "team_scoring_format",
    "team_aggregate_method",
)


@receiver(pre_save, sender=Event)
def _track_event_scoring_field_changes(sender, instance, **kwargs):
    if not instance.pk:
        instance._scoring_fields_changed = False
        return
    try:
        old = Event.objects.only(*SCORING_RECALC_FIELDS).get(pk=instance.pk)
    except Event.DoesNotExist:
        instance._scoring_fields_changed = False
        return
    instance._scoring_fields_changed = any(
        getattr(instance, field) != getattr(old, field) for field in SCORING_RECALC_FIELDS
    )


@receiver(post_save, sender=Event)
def _recalculate_on_event_scoring_change(sender, instance, created, **kwargs):
    if created or not getattr(instance, "_scoring_fields_changed", False):
        return
    from apps.scores.signals import enqueue_event_rankings_recalculate

    enqueue_event_rankings_recalculate(instance.pk)


@receiver(post_save, sender=Championship)
@receiver(post_delete, sender=Championship)
@receiver(post_save, sender=Event)
@receiver(post_delete, sender=Event)
@receiver(post_save, sender=HeatSchedule)
@receiver(post_delete, sender=HeatSchedule)
def invalidate_public_cache_on_schedule_change(sender, **kwargs):
    bump_public_api_cache()
