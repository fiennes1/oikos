from rest_framework import serializers

from apps.athletes.models import Athlete, Team


class TeamAthleteMiniSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Athlete
        fields = ("id", "name", "nickname", "category_name")


class TeamSerializer(serializers.ModelSerializer):
    athlete_count = serializers.SerializerMethodField()
    athletes = TeamAthleteMiniSerializer(many=True, read_only=True)
    athlete_ids = serializers.PrimaryKeyRelatedField(
        queryset=Athlete.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Team
        fields = (
            "id",
            "championship",
            "name",
            "logo",
            "description",
            "athlete_count",
            "athletes",
            "athlete_ids",
        )

    def get_athlete_count(self, obj):
        return obj.athletes.count()

    def _sync_athletes(self, team: Team, athlete_list):
        """Define os membros do time; remove vínculo dos que saíram."""
        cid = team.championship_id
        desired_ids = []
        for a in athlete_list:
            if a.championship_id != cid:
                raise serializers.ValidationError(
                    {"athlete_ids": f'Atleta "{a.name}" não pertence ao mesmo campeonato do time.'}
                )
            desired_ids.append(a.pk)
        Athlete.objects.filter(team=team).exclude(pk__in=desired_ids).update(team=None)
        for a in athlete_list:
            Athlete.objects.filter(pk=a.pk).update(team_id=team.pk)

    def create(self, validated_data):
        athletes = validated_data.pop("athlete_ids", None)
        team = super().create(validated_data)
        if athletes is not None:
            self._sync_athletes(team, athletes)
        return team

    def update(self, instance, validated_data):
        athletes = validated_data.pop("athlete_ids", None)
        team = super().update(instance, validated_data)
        if athletes is not None:
            self._sync_athletes(team, athletes)
        return team


class AthleteSerializer(serializers.ModelSerializer):
    team_detail = TeamSerializer(source="team", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)

    class Meta:
        model = Athlete
        fields = (
            "id",
            "championship",
            "name",
            "nickname",
            "category",
            "category_name",
            "category_slug",
            "gender",
            "photo",
            "team",
            "team_detail",
        )
        read_only_fields = ("team",)


class AthleteListSerializer(serializers.ModelSerializer):
    category_slug = serializers.CharField(source="category.slug", read_only=True)

    class Meta:
        model = Athlete
        fields = ("id", "name", "nickname", "category", "category_slug", "photo", "team")
