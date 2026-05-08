from rest_framework import serializers

from apps.events.models import Category, Championship, Event, HeatSchedule, HeatStatus


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "championship", "name", "slug", "applies_to", "order", "color")


class ChampionshipSerializer(serializers.ModelSerializer):
    categories = CategorySerializer(many=True, read_only=True)

    class Meta:
        model = Championship
        fields = (
            "id",
            "name",
            "description",
            "start_date",
            "end_date",
            "mode",
            "scoring_type",
            "tiebreak_rule",
            "is_active",
            "logo",
            "active_categories",
            "categories",
        )


_MISSING = object()


class EventSerializer(serializers.ModelSerializer):
    championship_name = serializers.CharField(source="competition.name", read_only=True)
    eligible_categories = CategorySerializer(many=True, read_only=True)
    eligible_category_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Event
        fields = (
            "id",
            "competition",
            "championship_name",
            "name",
            "description",
            "event_type",
            "score_mode",
            "scored_by",
            "scheduled_at",
            "location",
            "eligible_categories",
            "eligible_category_ids",
            "eligible_category",
            "display_order",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cat_ids = attrs.get("eligible_category_ids")
        comp = attrs.get("competition")
        if self.instance is not None:
            comp = comp if comp is not None else self.instance.competition
        if cat_ids is not None and comp is not None:
            valid = set(
                Category.objects.filter(championship=comp, pk__in=cat_ids).values_list("pk", flat=True)
            )
            if valid != set(cat_ids):
                raise serializers.ValidationError(
                    {"eligible_category_ids": "Uma ou mais categorias não pertencem a este campeonato."}
                )
        return attrs

    @staticmethod
    def _sync_legacy_eligible_category(instance):
        first = instance.eligible_categories.order_by("order", "id").first()
        legacy = first.slug[:20] if first else ""
        Event.objects.filter(pk=instance.pk).update(eligible_category=legacy)

    def create(self, validated_data):
        cat_ids = validated_data.pop("eligible_category_ids", [])
        instance = super().create(validated_data)
        if cat_ids is not None:
            instance.eligible_categories.set(
                Category.objects.filter(pk__in=cat_ids, championship_id=instance.competition_id)
            )
        self._sync_legacy_eligible_category(instance)
        return instance

    def update(self, instance, validated_data):
        cat_ids = validated_data.pop("eligible_category_ids", _MISSING)
        instance = super().update(instance, validated_data)
        if cat_ids is not _MISSING:
            instance.eligible_categories.set(
                Category.objects.filter(pk__in=cat_ids, championship_id=instance.competition_id)
            )
        self._sync_legacy_eligible_category(instance)
        return instance


class HeatScheduleSerializer(serializers.ModelSerializer):
    athlete_name = serializers.SerializerMethodField()
    team_name = serializers.SerializerMethodField()
    event_name = serializers.CharField(source="event.name", read_only=True)

    class Meta:
        model = HeatSchedule
        fields = (
            "id",
            "event",
            "event_name",
            "athlete",
            "athlete_name",
            "team",
            "team_name",
            "heat_number",
            "scheduled_time",
            "status",
        )

    def get_athlete_name(self, obj):
        return str(obj.athlete) if obj.athlete_id else None

    def get_team_name(self, obj):
        return obj.team.name if obj.team_id else None

    def validate(self, attrs):
        athlete = attrs.get("athlete")
        team = attrs.get("team")
        if self.instance:
            athlete = athlete if "athlete" in attrs else self.instance.athlete
            team = team if "team" in attrs else self.instance.team
        if bool(athlete) == bool(team):
            raise serializers.ValidationError("Informe exatamente um: atleta ou time.")
        return attrs

    def update(self, instance, validated_data):
        new_status = validated_data.get("status", instance.status)
        if new_status == HeatStatus.IN_PROGRESS and instance.status != HeatStatus.IN_PROGRESS:
            qs = HeatSchedule.objects.filter(
                event=instance.event,
                heat_number__lt=instance.heat_number,
                status=HeatStatus.IN_PROGRESS,
            )
            if qs.exists():
                raise serializers.ValidationError(
                    {"status": "Não é possível iniciar este heat enquanto um heat anterior ainda está em andamento."}
                )
        return super().update(instance, validated_data)


class PublicHeatSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()

    class Meta:
        model = HeatSchedule
        fields = (
            "id",
            "event",
            "heat_number",
            "scheduled_time",
            "status",
            "label",
            "athlete",
            "team",
        )

    def get_label(self, obj):
        if obj.athlete_id:
            return str(obj.athlete)
        if obj.team_id:
            return obj.team.name
        return ""


CompetitionSerializer = ChampionshipSerializer
