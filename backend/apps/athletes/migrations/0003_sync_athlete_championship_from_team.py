# Preenche championship do atleta a partir do time (dados legados / vínculo sem campeonato).

from django.db import migrations


def sync_championship_from_team(apps, schema_editor):
    Athlete = apps.get_model("athletes", "Athlete")
    for athlete in Athlete.objects.filter(team__isnull=False).select_related("team"):
        team_cid = athlete.team.championship_id
        if team_cid and athlete.championship_id != team_cid:
            athlete.championship_id = team_cid
            athlete.save(update_fields=["championship_id"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("athletes", "0002_championship_flexible"),
    ]

    operations = [
        migrations.RunPython(sync_championship_from_team, noop_reverse),
    ]
