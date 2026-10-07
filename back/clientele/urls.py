"""Routes des comptes et des sessions."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .panier import FusionPanierView, LignePanierView, PanierView
from .views import (
    AdresseViewSet,
    ConnexionView,
    DeconnexionView,
    InscriptionView,
    JetonCsrfView,
    MoiView,
    MotDePasseView,
    OubliMotDePasseView,
    ReinitialisationMotDePasseView,
)

routeur = DefaultRouter()
routeur.register("adresses", AdresseViewSet, basename="adresse")

urlpatterns = [
    path("csrf/", JetonCsrfView.as_view(), name="csrf"),
    path("inscription/", InscriptionView.as_view(), name="inscription"),
    path("connexion/", ConnexionView.as_view(), name="connexion"),
    path("deconnexion/", DeconnexionView.as_view(), name="deconnexion"),
    path("moi/", MoiView.as_view(), name="moi"),
    path("mot-de-passe/", MotDePasseView.as_view(), name="mot-de-passe"),
    path("mot-de-passe/oubli/", OubliMotDePasseView.as_view(), name="mot-de-passe-oubli"),
    path(
        "mot-de-passe/reinitialiser/",
        ReinitialisationMotDePasseView.as_view(),
        name="mot-de-passe-reinitialiser",
    ),
    path("panier/", PanierView.as_view(), name="panier"),
    path("panier/lignes/", LignePanierView.as_view(), name="panier-lignes"),
    path("panier/lignes/<int:ligne_id>/", LignePanierView.as_view(), name="panier-ligne"),
    path("panier/fusionner/", FusionPanierView.as_view(), name="panier-fusionner"),
    path("", include(routeur.urls)),
]
