# Garante categorias padrão (Iniciante, Scaled, Intermediário, Rx, Masters) em cada campeonato.

from django.db import migrations
from django.utils.text import slugify


DEFAULT_DIVISIONS = [
    ("Iniciante", 0),
    ("Scaled", 1),
    ("Intermediário", 2),
    ("Rx", 3),
    ("Masters", 4),
]


def forwards(apps, schema_editor):
    Championship = apps.get_model("events", "Championship")
    Category = apps.get_model("events", "Category")

    for ch in Championship.objects.all():
        for name, order in DEFAULT_DIVISIONS:
            slug = slugify(name) or "cat"
            Category.objects.get_or_create(
                championship=ch,
                slug=slug,
                defaults={
                    "name": name,
                    "order": order,
                    "applies_to": "athlete",
                    "color": "#1a3a1a",
                },
            )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0002_championship_flexible"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
