from rest_framework import serializers

from apps.events.models import Category, Championship, Event, HeatSchedule


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
            "metric_type",
            "team_scoring_format",
            "team_aggregate_method",
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
        categories_changed = cat_ids is not _MISSING and set(cat_ids) != set(
            instance.eligible_categories.values_list("pk", flat=True)
        )
        instance = super().update(instance, validated_data)
        if cat_ids is not _MISSING:
            instance.eligible_categories.set(
                Category.objects.filter(pk__in=cat_ids, championship_id=instance.competition_id)
            )
        self._sync_legacy_eligible_category(instance)
        if categories_changed:
            from apps.scores.signals import enqueue_event_rankings_recalculate

            enqueue_event_rankings_recalculate(instance.pk)
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
            "lane_number",
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
        new_status = validated_data.get("status")
        if new_status is not None and new_status != instance.status:
            from apps.events.heat_batch import HeatBatchError, set_heat_batch_status

            try:
                set_heat_batch_status(instance.event_id, instance.heat_number, new_status)
            except HeatBatchError as e:
                raise serializers.ValidationError({"status": str(e)}) from e
            instance.refresh_from_db()
            return instance
        return super().update(instance, validated_data)


class PublicHeatSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()

    class Meta:
        model = HeatSchedule
        fields = (
            "id",
            "event",
            "heat_number",
            "lane_number",
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
