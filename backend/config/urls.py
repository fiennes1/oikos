from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, HttpResponse
from django.urls import include, path, re_path
from django.views import View
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.athletes.views import AthleteViewSet, TeamViewSet
from apps.events.views import CategoryViewSet, CompetitionViewSet, EventViewSet, HeatScheduleViewSet
from apps.leaderboard.views import (
    AdminDashboardView,
    PublicAthleteProfileView,
    PublicChampionshipDetailView,
    PublicChampionshipLeaderboardView,
    PublicChampionshipListView,
    PublicChampionshipScheduleView,
    PublicCompetitionInfoView,
    PublicEventResultsView,
    PublicLeaderboardView,
    PublicScheduleView,
)
from apps.scores.views import (
    PointsTableEntryViewSet,
    ResultAuditLogViewSet,
    ResultViewSet,
    ScoreConfigViewSet,
)

router = DefaultRouter()
router.register(r"teams", TeamViewSet, basename="team")
router.register(r"athletes", AthleteViewSet, basename="athlete")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"competitions", CompetitionViewSet, basename="competition")
router.register(r"events/wods", EventViewSet, basename="event")
router.register(r"events/heats", HeatScheduleViewSet, basename="heat")
router.register(r"scores/config", ScoreConfigViewSet, basename="scoreconfig")
router.register(r"scores/points", PointsTableEntryViewSet, basename="points")
router.register(r"scores/results", ResultViewSet, basename="result")
router.register(r"scores/audit", ResultAuditLogViewSet, basename="audit")

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/public/championships/", PublicChampionshipListView.as_view()),
    path("api/public/championships/<int:pk>/", PublicChampionshipDetailView.as_view()),
    path(
        "api/public/championships/<int:pk>/leaderboard/",
        PublicChampionshipLeaderboardView.as_view(),
    ),
    path(
        "api/public/championships/<int:pk>/schedule/",
        PublicChampionshipScheduleView.as_view(),
    ),
    path("api/public/competition/info/", PublicCompetitionInfoView.as_view()),
    path("api/public/events/schedule/", PublicScheduleView.as_view()),
    path("api/public/events/<int:pk>/results/", PublicEventResultsView.as_view()),
    path("api/public/leaderboard/", PublicLeaderboardView.as_view()),
    path("api/public/athletes/<int:pk>/profile/", PublicAthleteProfileView.as_view()),
    path("api/admin/dashboard/", AdminDashboardView.as_view()),
    path("api/admin/", include(router.urls)),
]


class SpaEntryView(View):
    def get(self, request, *args, **kwargs):
        p = getattr(settings, "FRONTEND_INDEX", None)
        if p is None or not p.is_file():
            return HttpResponse(
                "Compile o frontend: cd frontend && npm install && npm run build",
                status=503,
                content_type="text/plain; charset=utf-8",
            )
        return FileResponse(open(p, "rb"), content_type="text/html; charset=utf-8")


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(
        r"^(?!api/|django-admin/|media/|static/).*$",
        SpaEntryView.as_view(),
    ),
]
