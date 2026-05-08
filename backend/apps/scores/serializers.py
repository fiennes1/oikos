from typing import Optional

from rest_framework import serializers

from apps.events.models import Event, ScoredBy
from apps.scores.models import PointsTableEntry, Result, ResultAuditLog, ScoreConfig


class ScoreConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScoreConfig
        fields = ("id", "event", "metric", "lower_is_better")


class PointsTableEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = PointsTableEntry
        fields = ("id", "event", "category", "position", "points")


class ResultSerializer(serializers.ModelSerializer):
    athlete_name = serializers.SerializerMethodField()
    team_name = serializers.SerializerMethodField()
    event_name = serializers.CharField(source="event.name", read_only=True)
    entry_category = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = (
            "id",
            "event",
            "event_name",
            "athlete",
            "athlete_name",
            "team",
            "team_name",
            "entry_category",
            "raw_score",
            "tiebreak_score",
            "position",
            "points_earned",
            "notes",
        )
        read_only_fields = ("position", "points_earned")

    def get_athlete_name(self, obj):
        return str(obj.athlete) if obj.athlete_id else None

    def get_team_name(self, obj):
        return obj.team.name if obj.team_id else None

    def get_entry_category(self, obj):
        if obj.athlete_id and obj.athlete.category_id:
            return obj.athlete.category.name
        if obj.team_id:
            return "Team"
        return None

    def validate(self, attrs):
        athlete = attrs.get("athlete")
        team = attrs.get("team")
        event: Optional[Event] = attrs.get("event")

        if self.instance:
            athlete = attrs.get("athlete", self.instance.athlete)
            team = attrs.get("team", self.instance.team)
            event = attrs.get("event", self.instance.event)

        if bool(athlete) == bool(team):
            raise serializers.ValidationError("Informe exatamente um: atleta ou time.")

        if not event:
            return attrs

        if event.scored_by == ScoredBy.TEAM:
            if not team:
                raise serializers.ValidationError({"team": "Esta prova é pontuada por time."})
            if athlete:
                raise serializers.ValidationError({"athlete": "Esta prova não usa atleta individual."})
            if team.championship_id != event.competition_id:
                raise serializers.ValidationError({"team": "Time não pertence ao campeonato da prova."})
        else:
            if not athlete:
                raise serializers.ValidationError({"athlete": "Esta prova é pontuada por atleta."})
            if team:
                raise serializers.ValidationError({"team": "Esta prova não usa time."})
            if athlete.championship_id != event.competition_id:
                raise serializers.ValidationError({"athlete": "Atleta não pertence ao campeonato da prova."})

            eligible = event.eligible_categories.all()
            if eligible.exists():
                if athlete.category_id not in eligible.values_list("pk", flat=True):
                    raise serializers.ValidationError(
                        {"athlete": "A categoria do atleta não é elegível nesta prova."}
                    )

        return attrs


class ResultAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResultAuditLog
        fields = ("id", "result", "edited_by", "changed_at", "snapshot")
