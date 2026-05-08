from django.db import models
from django.utils.text import slugify


class _CascadeMuteQuerySet(models.QuerySet):
    """QuerySet.delete em cascata não deve disparar recálculo em signals de Result."""

    def delete(self):
        from apps.scores.signals import mute_result_ranking_signals

        with mute_result_ranking_signals():
            return super().delete()


class ChampionshipMode(models.TextChoices):
    INDIVIDUAL = "individual", "Individual (por categoria)"
    TEAM = "team", "Times (ranking único)"
    MIXED = "mixed", "Individual e times (ambos)"


class ScoringType(models.TextChoices):
    POINTS_BY_POSITION = "points_by_position", "Pontos por posição"
    RAW_SCORE = "raw_score", "Melhor score bruto"
    CUSTOM = "custom", "Personalizado"


class TiebreakRule(models.TextChoices):
    MOST_WINS = "most_wins", "Mais vitórias (1º lugares)"
    LAST_WOD = "last_wod", "Melhor posição no último WOD"
    TIEBREAK_FIELD = "tiebreak_field", "Menor tie-break acumulado"


class CategoryAppliesTo(models.TextChoices):
    ATHLETE = "athlete", "Ranking individual nesta categoria"
    TEAM = "team", "Ranking de times nesta categoria"
    NONE = "none", "Sem ranking (ex.: composição de time)"


class EventType(models.TextChoices):
    FOR_TIME = "for_time", "For Time"
    AMRAP = "amrap", "AMRAP"
    MAX_LOAD = "max_load", "Max Load"
    MAX_REPS = "max_reps", "Max Reps"
    POINTS = "points", "Pontos"
    TIEBREAK = "tiebreak", "Tiebreak"


class EventScoreMode(models.TextChoices):
    LOWER_IS_BETTER = "lower_is_better", "Menor é melhor"
    HIGHER_IS_BETTER = "higher_is_better", "Maior é melhor"


class ScoredBy(models.TextChoices):
    ATHLETE = "athlete", "Atleta"
    TEAM = "team", "Time"


class Championship(models.Model):
    """Campeonato / competição — configuração flexível."""

    objects = _CascadeMuteQuerySet.as_manager()

    name = models.CharField("nome", max_length=300)
    description = models.TextField("descrição", blank=True)
    start_date = models.DateField("data início")
    end_date = models.DateField("data fim")
    mode = models.CharField(
        "modalidade",
        max_length=20,
        choices=ChampionshipMode.choices,
        default=ChampionshipMode.INDIVIDUAL,
    )
    scoring_type = models.CharField(
        "tipo de pontuação",
        max_length=30,
        choices=ScoringType.choices,
        default=ScoringType.POINTS_BY_POSITION,
    )
    tiebreak_rule = models.CharField(
        "desempate geral",
        max_length=30,
        choices=TiebreakRule.choices,
        default=TiebreakRule.MOST_WINS,
    )
    is_active = models.BooleanField("ativo", default=False, db_index=True)
    logo = models.ImageField("logo", upload_to="championships/logos/", blank=True, null=True)
    # Legacy JSON — preenchido por migração / compat; categorias passam a ser model Category
    active_categories = models.JSONField(
        "categorias ativas (legado)",
        default=list,
        blank=True,
        help_text="Legado; usar modelo Category.",
    )

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "Campeonato"
        verbose_name_plural = "Campeonatos"
        db_table = "events_competition"

    def __str__(self):
        return self.name

    def delete(self, using=None, keep_parents=False):
        from apps.scores.signals import mute_result_ranking_signals

        with mute_result_ranking_signals():
            return super().delete(using=using, keep_parents=keep_parents)


class Category(models.Model):
    championship = models.ForeignKey(
        Championship,
        on_delete=models.CASCADE,
        related_name="categories",
        verbose_name="campeonato",
    )
    name = models.CharField("nome", max_length=120)
    slug = models.SlugField(max_length=140, blank=True)
    applies_to = models.CharField(
        "aplica-se a",
        max_length=10,
        choices=CategoryAppliesTo.choices,
        default=CategoryAppliesTo.ATHLETE,
    )
    order = models.PositiveIntegerField("ordem", default=0)
    color = models.CharField("cor (hex)", max_length=7, default="#1a3a1a")

    class Meta:
        ordering = ["championship", "order", "name"]
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"
        constraints = [
            models.UniqueConstraint(
                fields=["championship", "slug"],
                name="events_category_championship_slug_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.championship.name} — {self.name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "categoria"
            s = base
            n = 2
            while (
                Category.objects.filter(championship=self.championship_id, slug=s)
                .exclude(pk=self.pk)
                .exists()
            ):
                s = f"{base}-{n}"
                n += 1
            self.slug = s
        super().save(*args, **kwargs)


class Event(models.Model):
    objects = _CascadeMuteQuerySet.as_manager()

    competition = models.ForeignKey(
        Championship,
        on_delete=models.CASCADE,
        related_name="events",
        verbose_name="campeonato",
    )
    name = models.CharField("nome", max_length=300)
    description = models.TextField("descrição", blank=True)
    event_type = models.CharField(
        "tipo",
        max_length=20,
        choices=EventType.choices,
        default=EventType.FOR_TIME,
    )
    score_mode = models.CharField(
        "modo de score",
        max_length=24,
        choices=EventScoreMode.choices,
        default=EventScoreMode.LOWER_IS_BETTER,
    )
    scored_by = models.CharField(
        "pontuação por",
        max_length=10,
        choices=ScoredBy.choices,
        default=ScoredBy.ATHLETE,
    )
    scheduled_at = models.DateTimeField("data e hora", null=True, blank=True)
    location = models.CharField("local/estação", max_length=200, blank=True)
    eligible_categories = models.ManyToManyField(
        Category,
        blank=True,
        related_name="events",
        verbose_name="categorias elegíveis",
        help_text="Vazio = todas as categorias de atleta da prova participam.",
    )
    display_order = models.PositiveIntegerField("ordem de exibição", default=0)
    # Legado — removido após migração de dados
    eligible_category = models.CharField(
        "categoria elegível (legado)",
        max_length=20,
        default="Rx",
        blank=True,
    )

    class Meta:
        ordering = ["competition", "display_order", "scheduled_at"]
        verbose_name = "Prova (WOD)"
        verbose_name_plural = "Provas (WODs)"

    def __str__(self):
        return f"{self.competition.name} — {self.name}"

    def delete(self, using=None, keep_parents=False):
        from apps.scores.signals import mute_result_ranking_signals

        with mute_result_ranking_signals():
            return super().delete(using=using, keep_parents=keep_parents)


class HeatStatus(models.TextChoices):
    PENDING = "pending", "Pendente"
    IN_PROGRESS = "in_progress", "Em andamento"
    DONE = "done", "Concluído"


class HeatSchedule(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="heats",
        verbose_name="prova",
    )
    athlete = models.ForeignKey(
        "athletes.Athlete",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="heat_schedules",
        verbose_name="atleta",
    )
    team = models.ForeignKey(
        "athletes.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="heat_schedules",
        verbose_name="time",
    )
    heat_number = models.PositiveIntegerField("número do heat", default=1)
    scheduled_time = models.DateTimeField("horário previsto", null=True, blank=True)
    status = models.CharField(
        "status",
        max_length=20,
        choices=HeatStatus.choices,
        default=HeatStatus.PENDING,
    )

    class Meta:
        ordering = ["event", "heat_number", "scheduled_time"]
        verbose_name = "Heat (cronograma)"
        verbose_name_plural = "Heats (cronograma)"
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(athlete__isnull=False, team__isnull=True)
                    | models.Q(athlete__isnull=True, team__isnull=False)
                ),
                name="heat_athlete_xor_team",
            ),
        ]

    def __str__(self):
        who = self.athlete or self.team
        return f"{self.event.name} H{self.heat_number}: {who}"


# Alias retrocompatível (imports antigos / migrações)
Competition = Championship
