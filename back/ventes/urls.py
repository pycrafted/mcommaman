"""Routes des commandes."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CampagnePubliqueViewSet,
    CampagneViewSet,
    CommandeGestionViewSet,
    CommandeViewSet,
    DevisView,
    MesCommandesView,
    NotificationsGestionView,
)

public = DefaultRouter()
public.register("commandes", CommandeViewSet, basename="commande")
public.register("campagnes", CampagnePubliqueViewSet, basename="campagne-publique")

gestion = DefaultRouter()
gestion.register("commandes", CommandeGestionViewSet, basename="commande-gestion")
gestion.register("campagnes", CampagneViewSet, basename="campagne")

urlpatterns = [
    path("devis/", DevisView.as_view(), name="devis"),
    path("mes-commandes/", MesCommandesView.as_view(), name="mes-commandes"),
    path("gestion/notifications/", NotificationsGestionView.as_view(), name="notifications-gestion"),
    path("", include(public.urls)),
    path("gestion/", include(gestion.urls)),
]
