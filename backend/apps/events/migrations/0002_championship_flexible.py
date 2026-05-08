# Generated manually for Championship flexível — mantém tabela events_competition

import django.db.models.deletion
from django.db import migrations, models


def copy_is_current_to_is_active(apps, schema_editor):
    Championship = apps.get_model("events", "Championship")
    for row in Championship.objects.all():
        row.is_active = bool(getattr(row, "is_current", False))
        row.save(update_fields=["is_active"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0001_initial"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="Competition",
            new_name="Championship",
        ),
        migrations.AlterModelTable(
            name="Championship",
            table="events_competition",
        ),
        migrations.AddField(
            model_name="championship",
            name="mode",
            field=models.CharField(
                choices=[
                    ("individual", "Individual (por categoria)"),
                    ("team", "Times (ranking único)"),
                    ("mixed", "Misto (futuro)"),
                ],
                default="individual",
                max_length=20,
                verbose_name="modalidade",
            ),
        ),
        migrations.AddField(
            model_name="championship",
            name="scoring_type",
            field=models.CharField(
                choices=[
                    ("points_by_position", "Pontos por posição"),
                    ("raw_score", "Melhor score bruto"),
                    ("custom", "Personalizado"),
                ],
                default="points_by_position",
                max_length=30,
                verbose_name="tipo de pontuação",
            ),
        ),
        migrations.AddField(
            model_name="championship",
            name="tiebreak_rule",
            field=models.CharField(
                choices=[
                    ("most_wins", "Mais vitórias (1º lugares)"),
                    ("last_wod", "Melhor posição no último WOD"),
                    ("tiebreak_field", "Menor tie-break acumulado"),
                ],
                default="most_wins",
                max_length=30,
                verbose_name="desempate geral",
            ),
        ),
        migrations.AddField(
            model_name="championship",
            name="is_active",
            field=models.BooleanField(db_index=True, default=False, verbose_name="ativo"),
        ),
        migrations.AlterField(
            model_name="championship",
            name="active_categories",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Legado; usar modelo Category.",
                verbose_name="categorias ativas (legado)",
            ),
        ),
        migrations.AlterField(
            model_name="championship",
            name="logo",
            field=models.ImageField(blank=True, null=True, upload_to="championships/logos/", verbose_name="logo"),
        ),
        migrations.RunPython(copy_is_current_to_is_active, noop_reverse),
        migrations.RemoveField(
            model_name="championship",
            name="is_current",
        ),
        migrations.CreateModel(
            name="Category",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, verbose_name="nome")),
                ("slug", models.SlugField(blank=True, max_length=140)),
                (
                    "applies_to",
                    models.CharField(
                        choices=[
                            ("athlete", "Ranking individual nesta categoria"),
                            ("team", "Ranking de times nesta categoria"),
                            ("none", "Sem ranking (ex.: composição de time)"),
                        ],
                        default="athlete",
                        max_length=10,
                        verbose_name="aplica-se a",
                    ),
                ),
                ("order", models.PositiveIntegerField(default=0, verbose_name="ordem")),
                ("color", models.CharField(default="#1a3a1a", max_length=7, verbose_name="cor (hex)")),
                (
                    "championship",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="categories",
                        to="events.championship",
                        verbose_name="campeonato",
                    ),
                ),
            ],
            options={
                "verbose_name": "Categoria",
                "verbose_name_plural": "Categorias",
                "ordering": ["championship", "order", "name"],
            },
        ),
        migrations.AddConstraint(
            model_name="category",
            constraint=models.UniqueConstraint(fields=("championship", "slug"), name="events_category_championship_slug_uniq"),
        ),
        migrations.AddField(
            model_name="event",
            name="score_mode",
            field=models.CharField(
                choices=[
                    ("lower_is_better", "Menor é melhor"),
                    ("higher_is_better", "Maior é melhor"),
                ],
                default="lower_is_better",
                max_length=24,
                verbose_name="modo de score",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="scored_by",
            field=models.CharField(
                choices=[("athlete", "Atleta"), ("team", "Time")],
                default="athlete",
                max_length=10,
                verbose_name="pontuação por",
            ),
        ),
        migrations.AlterField(
            model_name="event",
            name="eligible_category",
            field=models.CharField(blank=True, default="Rx", max_length=20, verbose_name="categoria elegível (legado)"),
        ),
        migrations.AlterField(
            model_name="event",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("for_time", "For Time"),
                    ("amrap", "AMRAP"),
                    ("max_load", "Max Load"),
                    ("max_reps", "Max Reps"),
                    ("points", "Pontos"),
                    ("tiebreak", "Tiebreak"),
                ],
                default="for_time",
                max_length=20,
                verbose_name="tipo",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="eligible_categories",
            field=models.ManyToManyField(
                blank=True,
                help_text="Vazio = todas as categorias de atleta da prova participam.",
                related_name="events",
                to="events.category",
                verbose_name="categorias elegíveis",
            ),
        ),
        migrations.AlterField(
            model_name="event",
            name="competition",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="events",
                to="events.championship",
                verbose_name="campeonato",
            ),
        ),
    ]
