from django.apps import AppConfig


class ScoresConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.scores"
    verbose_name = "Pontuações"

    def ready(self):
        from apps.scores import signals  # noqa: F401
