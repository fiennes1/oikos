from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.athletes.models import Athlete, Team
from apps.events.models import (
    Category,
    CategoryAppliesTo,
    Championship,
    ChampionshipMode,
    Event,
    EventScoreMode,
    EventType,
    HeatSchedule,
    HeatStatus,
    ScoredBy,
)
from apps.scores.models import PointsTableEntry, Result, ScoreConfig
from apps.scores.services import recalculate_event_rankings


class Command(BaseCommand):
    help = "Popula o banco com campeonato, categorias, atletas, provas, heats e resultados de demonstração."

    def handle(self, *args, **options):
        Championship.objects.update(is_active=False)
        champ, _ = Championship.objects.get_or_create(
            name="Oikos Open 2026",
            defaults={
                "start_date": timezone.now().date(),
                "end_date": timezone.now().date() + timedelta(days=2),
                "description": "Demonstração do leaderboard.",
                "mode": ChampionshipMode.INDIVIDUAL,
                "is_active": True,
                "active_categories": ["Iniciante", "Scaled", "Intermediário", "Rx", "Masters"],
            },
        )
        champ.is_active = True
        champ.start_date = timezone.now().date()
        champ.end_date = timezone.now().date() + timedelta(days=2)
        champ.active_categories = ["Iniciante", "Scaled", "Intermediário", "Rx", "Masters"]
        champ.save()

        cats = {}
        default_specs = [
            ("Iniciante", CategoryAppliesTo.ATHLETE, 0),
            ("Scaled", CategoryAppliesTo.ATHLETE, 1),
            ("Intermediário", CategoryAppliesTo.ATHLETE, 2),
            ("Rx", CategoryAppliesTo.ATHLETE, 3),
            ("Masters", CategoryAppliesTo.ATHLETE, 4),
        ]
        for name, applies, order in default_specs:
            c, _ = Category.objects.get_or_create(
                championship=champ,
                name=name,
                defaults={"applies_to": applies, "order": order, "color": "#1a3a1a"},
            )
            cats[name] = c

        team, _ = Team.objects.get_or_create(
            championship=champ,
            name="Box Alpha",
            defaults={"description": "Time demo"},
        )

        athletes_data = [
            ("Ana Costa", "Ana", cats["Rx"], "F"),
            ("Bruno Lima", "Bruno", cats["Intermediário"], "M"),
            ("Carla Dias", "Carla", cats["Scaled"], "F"),
            ("Diego Souza", "Diego", cats["Iniciante"], "M"),
        ]
        athletes = []
        for name, nick, cat, gender in athletes_data:
            a, _ = Athlete.objects.get_or_create(
                championship=champ,
                nickname=nick,
                defaults={
                    "name": name,
                    "category": cat,
                    "gender": gender,
                    "team": team,
                },
            )
            if not a.team_id:
                a.team = team
                a.save()
            athletes.append(a)

        Event.objects.filter(competition=champ).delete()

        wod1 = Event.objects.create(
            competition=champ,
            name="WOD 1 — Fran",
            description="For Time: 21-15-9 Thruster e Pull-ups",
            event_type=EventType.FOR_TIME,
            score_mode=EventScoreMode.LOWER_IS_BETTER,
            scored_by=ScoredBy.ATHLETE,
            scheduled_at=timezone.now(),
            location="Pista A",
            display_order=1,
        )
        wod1.eligible_categories.set([cats["Rx"]])

        wod2 = Event.objects.create(
            competition=champ,
            name="WOD 2 — AMRAP 12'",
            description="AMRAP de burpees e KB swings",
            event_type=EventType.AMRAP,
            score_mode=EventScoreMode.HIGHER_IS_BETTER,
            scored_by=ScoredBy.ATHLETE,
            scheduled_at=timezone.now() + timedelta(hours=3),
            location="Pista B",
            display_order=2,
        )
        wod2.eligible_categories.set([cats["Rx"]])

        wod_team = Event.objects.create(
            competition=champ,
            name="WOD Equipes — Relay",
            event_type=EventType.FOR_TIME,
            score_mode=EventScoreMode.LOWER_IS_BETTER,
            scored_by=ScoredBy.TEAM,
            display_order=3,
        )

        ScoreConfig.objects.update_or_create(
            event=wod1,
            defaults={"metric": "seconds", "lower_is_better": True},
        )
        ScoreConfig.objects.update_or_create(
            event=wod2,
            defaults={"metric": "reps", "lower_is_better": False},
        )
        ScoreConfig.objects.update_or_create(
            event=wod_team,
            defaults={"metric": "seconds", "lower_is_better": True},
        )

        for pos, pts in enumerate([100, 85, 70, 55, 40, 25], start=1):
            for ev in (wod1, wod2, wod_team):
                PointsTableEntry.objects.get_or_create(
                    event=ev,
                    position=pos,
                    category=None,
                    defaults={"points": pts},
                )

        HeatSchedule.objects.filter(event__competition=champ).delete()
        for idx, a in enumerate(athletes[:2], start=1):
            HeatSchedule.objects.create(
                event=wod1,
                athlete=a,
                heat_number=idx,
                scheduled_time=timezone.now(),
                status=HeatStatus.DONE if idx == 1 else HeatStatus.IN_PROGRESS,
            )

        Result.objects.filter(event__competition=champ).delete()

        Result.objects.create(event=wod1, athlete=athletes[0], raw_score=320, tiebreak_score=None)
        Result.objects.create(event=wod1, athlete=athletes[1], raw_score=340, tiebreak_score=5)

        Result.objects.create(event=wod2, athlete=athletes[0], raw_score=180, tiebreak_score=10)
        Result.objects.create(event=wod2, athlete=athletes[1], raw_score=175, tiebreak_score=5)

        Result.objects.create(event=wod_team, team=team, raw_score=900, tiebreak_score=None)

        for ev in (wod1, wod2, wod_team):
            recalculate_event_rankings(ev)

        self.stdout.write(self.style.SUCCESS("Seed concluído. Campeonato ativo: %s" % champ.name))
