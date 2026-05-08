from django.contrib import admin

from apps.events.models import Category, Championship, Event, HeatSchedule


@admin.register(Championship)
class ChampionshipAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "mode", "start_date", "end_date", "is_active")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "championship", "applies_to", "order")
    list_filter = ("championship", "applies_to")


class HeatScheduleInline(admin.TabularInline):
    model = HeatSchedule
    fk_name = "event"
    extra = 0


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "competition", "event_type", "scored_by", "display_order")
    list_filter = ("competition", "event_type", "scored_by")
    filter_horizontal = ("eligible_categories",)
    inlines = [HeatScheduleInline]


@admin.register(HeatSchedule)
class HeatScheduleAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "heat_number", "athlete", "team", "status")
    list_filter = ("status", "event")
