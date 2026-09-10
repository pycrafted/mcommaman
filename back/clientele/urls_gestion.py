"""Les comptes vus du back-office : la clientèle, et l'équipe elle-même."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ClienteGestionViewSet, EquipeGestionViewSet

routeur = DefaultRouter()
routeur.register("clientes", ClienteGestionViewSet, basename="cliente-gestion")
routeur.register("equipe", EquipeGestionViewSet, basename="equipe-gestion")

urlpatterns = [path("", include(routeur.urls))]
