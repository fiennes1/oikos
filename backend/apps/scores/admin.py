from django.contrib import admin

from apps.scores.models import PointsTableEntry, Result, ResultAuditLog, ScoreConfig


@admin.register(ScoreConfig)
class ScoreConfigAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "metric", "lower_is_better")


@admin.register(PointsTableEntry)
class PointsTableEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "position", "points")


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "athlete", "team", "raw_score", "position", "points_earned")


@admin.register(ResultAuditLog)
class ResultAuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "result", "edited_by", "changed_at")
