from django.contrib import admin

from apps.athletes.models import Athlete, Team


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "championship")


@admin.register(Athlete)
class AthleteAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "nickname", "championship", "category", "team")
    list_filter = ("championship", "category")
