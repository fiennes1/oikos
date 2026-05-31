from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.events.models import Championship, Event, HeatSchedule
from apps.leaderboard.cache_utils import bump_public_api_cache


@receiver(post_save, sender=Championship)
@receiver(post_delete, sender=Championship)
@receiver(post_save, sender=Event)
@receiver(post_delete, sender=Event)
@receiver(post_save, sender=HeatSchedule)
@receiver(post_delete, sender=HeatSchedule)
def invalidate_public_cache_on_schedule_change(sender, **kwargs):
    bump_public_api_cache()
