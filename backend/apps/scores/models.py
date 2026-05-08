from django.conf import settings
from django.db import models

from apps.events.models import Event


class MetricType(models.TextChoices):
    SECONDS = "seconds", "Tempo (segundos)"
    REPS = "reps", "Repetições"
    KG = "kg", "Quilogramas"
    POINTS = "points", "Pontos"


class ScoreConfig(models.Model):
    event = models.OneToOneField(
        Event,
        on_delete=models.CASCADE,
        related_name="score_config",
        verbose_name="prova",
    )
    metric = models.CharField(
        "métrica",
        max_length=20,
        choices=MetricType.choices,
        default=MetricType.SECONDS,
    )
    lower_is_better = models.BooleanField(
        "menor valor é melhor",
        default=True,
        help_text="Sincronizado com Event.score_mode quando possível.",
    )

    class Meta:
        verbose_name = "Configuração de pontuação"
        verbose_name_plural = "Configurações de pontuação"

    def __str__(self):
        return f"ScoreConfig: {self.event.name}"


class PointsTableEntry(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="points_table",
        verbose_name="prova",
    )
    category = models.ForeignKey(
        "events.Category",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="points_entries",
        verbose_name="categoria",
        help_text="Vazio = mesma tabela para todas as categorias.",
    )
    position = models.PositiveIntegerField("posição (1 = primeiro)")
    points = models.PositiveIntegerField("pontos")

    class Meta:
        ordering = ["event", "category", "position"]
        verbose_name = "Entrada da tabela de pontos"
        verbose_name_plural = "Tabela de pontos"
        constraints = [
            models.UniqueConstraint(
                fields=["event", "position"],
                condition=models.Q(category__isnull=True),
                name="scores_pts_event_pos_global",
            ),
            models.UniqueConstraint(
                fields=["event", "category", "position"],
                condition=models.Q(category__isnull=False),
                name="scores_pts_event_cat_pos",
            ),
        ]

    def __str__(self):
        c = f" [{self.category.name}]" if self.category_id else ""
        return f"{self.event_id}{c} — {self.position}º = {self.points} pts"


class Result(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="results",
        verbose_name="prova",
    )
    athlete = models.ForeignKey(
        "athletes.Athlete",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="results",
    )
    team = models.ForeignKey(
        "athletes.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="results",
    )
    raw_score = models.DecimalField(
        "valor bruto",
        max_digits=12,
        decimal_places=3,
        help_text="Segundos, reps ou kg conforme a prova",
    )
    tiebreak_score = models.DecimalField(
        "tie-break",
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
    )
    position = models.PositiveIntegerField("posição calculada", null=True, blank=True)
    points_earned = models.PositiveIntegerField("pontos ganhos", default=0)
    notes = models.TextField("observações", blank=True)

    class Meta:
        ordering = ["event", "position"]
        verbose_name = "Resultado"
        verbose_name_plural = "Resultados"
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(athlete__isnull=False, team__isnull=True)
                    | models.Q(athlete__isnull=True, team__isnull=False)
                ),
                name="result_athlete_xor_team",
            ),
        ]

    def __str__(self):
        u = self.athlete or self.team
        return f"{u} @ {self.event.name}: {self.raw_score}"


class ResultAuditLog(models.Model):
    result = models.ForeignKey(
        Result,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    snapshot = models.JSONField(
        help_text="Campos antes da edição ou diff",
    )

    class Meta:
        ordering = ["-changed_at"]
        verbose_name = "Auditoria de resultado"
        verbose_name_plural = "Auditorias de resultados"
