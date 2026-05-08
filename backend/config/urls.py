from pathlib import Path

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
    """
    SPA: um único dyno serve API + arquivos estáticos (WhiteNoise) + index.html.
    Procura o build em frontend/dist/ ou, após collectstatic, em STATIC_ROOT/index.html.
    """

    def get(self, request, *args, **kwargs):
        repo_root = Path(settings.BASE_DIR).parent
        candidates = [
            repo_root / "frontend" / "dist" / "index.html",
            Path(settings.STATIC_ROOT) / "index.html",
        ]
        for p in candidates:
            if p.is_file():
                return FileResponse(open(p, "rb"), content_type="text/html; charset=utf-8")
        msg = (
            "Frontend não encontrado. Este app é monolítico: um único dyno serve Django + a SPA após o build do Vite.\n\n"
            "Na Heroku, confira o log de build:\n"
            "1) Buildpacks: Node.js em primeiro, Python em último.\n"
            "2) O package.json da raiz deve rodar heroku-postbuild (instala frontend e executa vite build).\n"
            "3) Faça deploy de novo; no log deve aparecer \"vite build\" e não pode haver erro antes do release.\n\n"
            "Local: cd frontend && npm install && npm run build && cd ../backend && python manage.py collectstatic --noinput"
        )
        return HttpResponse(msg, status=503, content_type="text/plain; charset=utf-8")


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(
        r"^(?!api/|django-admin/|media/|static/).*$",
        SpaEntryView.as_view(),
    ),
]
