from django.db import models


class Gender(models.TextChoices):
    MALE = "M", "Masculino"
    FEMALE = "F", "Feminino"
    OTHER = "O", "Outro"


class Team(models.Model):
    championship = models.ForeignKey(
        "events.Championship",
        on_delete=models.CASCADE,
        related_name="teams",
        verbose_name="campeonato",
        null=True,
        blank=True,
    )
    name = models.CharField("nome", max_length=200)
    logo = models.ImageField("logo", upload_to="teams/logos/", blank=True, null=True)
    description = models.TextField("descrição", blank=True)

    class Meta:
        ordering = ["championship", "name"]
        verbose_name = "Time"
        verbose_name_plural = "Times"
        constraints = [
            models.UniqueConstraint(
                fields=["championship", "name"],
                name="athletes_team_championship_name_uniq",
            ),
        ]

    def __str__(self):
        return self.name


class Athlete(models.Model):
    championship = models.ForeignKey(
        "events.Championship",
        on_delete=models.CASCADE,
        related_name="athletes",
        verbose_name="campeonato",
        null=True,
        blank=True,
    )
    name = models.CharField("nome", max_length=200)
    nickname = models.CharField("apelido", max_length=120, blank=True)
    category = models.ForeignKey(
        "events.Category",
        on_delete=models.PROTECT,
        related_name="athletes",
        verbose_name="categoria",
        null=True,
        blank=True,
    )
    gender = models.CharField(
        "gênero",
        max_length=1,
        choices=Gender.choices,
        default=Gender.MALE,
    )
    photo = models.ImageField("foto", upload_to="athletes/photos/", blank=True, null=True)
    team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="athletes",
        verbose_name="time",
    )

    class Meta:
        ordering = ["championship", "name"]
        verbose_name = "Atleta"
        verbose_name_plural = "Atletas"

    def __str__(self):
        return self.nickname or self.name
