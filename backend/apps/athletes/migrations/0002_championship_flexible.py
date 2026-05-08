# Generated manually — migra categorias legadas (CharField) para FK.

import django.db.models.deletion
from django.db import migrations, models


def forwards_fill_championships_and_categories(apps, schema_editor):
    from django.utils.text import slugify

    Athlete = apps.get_model("athletes", "Athlete")
    Team = apps.get_model("athletes", "Team")
    Category = apps.get_model("events", "Category")
    Championship = apps.get_model("events", "Championship")

    ch = Championship.objects.order_by("-start_date").first()
    if not ch:
        return

    names = ["Rx", "Scaled", "Masters"]
    cats = {}
    for order, name in enumerate(names):
        slug = slugify(name) or "cat"
        cat, _ = Category.objects.get_or_create(
            championship=ch,
            slug=slug,
            defaults={
                "name": name,
                "order": order,
                "applies_to": "athlete",
                "color": "#1a3a1a",
            },
        )
        cats[name] = cat

    for t in Team.objects.all():
        if not t.championship_id:
            t.championship_id = ch.pk
            t.save(update_fields=["championship_id"])

    legacy_map = {"Rx": "Rx", "Scaled": "Scaled", "Masters": "Masters"}
    for a in Athlete.objects.all():
        if not a.championship_id:
            a.championship_id = ch.pk
        leg = (getattr(a, "category_legacy", None) or "Rx").strip()
        target = legacy_map.get(leg, "Rx")
        a.category_id = cats[target].pk
        a.save(update_fields=["championship_id", "category_id"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("athletes", "0001_initial"),
        ("events", "0002_championship_flexible"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="athlete",
            options={
                "ordering": ["championship", "name"],
                "verbose_name": "Atleta",
                "verbose_name_plural": "Atletas",
            },
        ),
        migrations.AlterModelOptions(
            name="team",
            options={
                "ordering": ["championship", "name"],
                "verbose_name": "Time",
                "verbose_name_plural": "Times",
            },
        ),
        migrations.RemoveField(
            model_name="team",
            name="category",
        ),
        migrations.RenameField(
            model_name="athlete",
            old_name="category",
            new_name="category_legacy",
        ),
        migrations.AddField(
            model_name="athlete",
            name="championship",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="athletes",
                to="events.championship",
                verbose_name="campeonato",
            ),
        ),
        migrations.AddField(
            model_name="team",
            name="championship",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="teams",
                to="events.championship",
                verbose_name="campeonato",
            ),
        ),
        migrations.AddField(
            model_name="athlete",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="athletes",
                to="events.category",
                verbose_name="categoria",
            ),
        ),
        migrations.RunPython(forwards_fill_championships_and_categories, noop_reverse),
        migrations.RemoveField(
            model_name="athlete",
            name="category_legacy",
        ),
        migrations.AddConstraint(
            model_name="team",
            constraint=models.UniqueConstraint(
                fields=("championship", "name"),
                name="athletes_team_championship_name_uniq",
            ),
        ),
    ]
