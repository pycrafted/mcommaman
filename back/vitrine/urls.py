"""Routes de la vitrine et de ses réglages."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BandeauGestionViewSet,
    BandeauPublicViewSet,
    JournalViewSet,
    ReglagesGestionView,
    ReglagesPublicView,
    VideoAccueilViewSet,
    VideoGestionViewSet,
)

public = DefaultRouter()
public.register("bandeau", BandeauPublicViewSet, basename="bandeau-public")
public.register("videos", VideoAccueilViewSet, basename="video-accueil")

gestion = DefaultRouter()
gestion.register("bandeau", BandeauGestionViewSet, basename="bandeau-gestion")
gestion.register("journal", JournalViewSet, basename="journal")
gestion.register("videotheque", VideoGestionViewSet, basename="video-gestion")

urlpatterns = [
    path("vitrine/reglages/", ReglagesPublicView.as_view(), name="reglages-public"),
    path("vitrine/", include(public.urls)),
    path("gestion/reglages/", ReglagesGestionView.as_view(), name="reglages-gestion"),
    path("gestion/", include(gestion.urls)),
]
