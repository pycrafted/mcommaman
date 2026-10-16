"""
Routes du catalogue.

Deux préfixes : `/api/catalogue/` est public et en lecture seule, `/api/gestion/`
est réservé à l'équipe. Un oubli de permission dans le second n'expose donc
jamais le premier.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CatalogueViewSet,
    ColorisViewSet,
    MediaViewSet,
    MouvementStockViewSet,
    PhotoProduitViewSet,
    ProduitGestionViewSet,
    RayonGestionViewSet,
    RayonPublicViewSet,
    ReferentielsView,
    TailleViewSet,
    VarianteViewSet,
)

public = DefaultRouter()
public.register("produits", CatalogueViewSet, basename="produit-public")
public.register("rayons", RayonPublicViewSet, basename="rayon-public")
public.register("referentiels", ReferentielsView, basename="referentiels")

gestion = DefaultRouter()
gestion.register("produits", ProduitGestionViewSet, basename="produit-gestion")
gestion.register("variantes", VarianteViewSet, basename="variante")
gestion.register("mouvements", MouvementStockViewSet, basename="mouvement")
gestion.register("photos", PhotoProduitViewSet, basename="photo")
gestion.register("rayons", RayonGestionViewSet, basename="rayon-gestion")
gestion.register("tailles", TailleViewSet, basename="taille")
gestion.register("coloris", ColorisViewSet, basename="coloris")
gestion.register("photheque", MediaViewSet, basename="media")

urlpatterns = [
    path("catalogue/", include(public.urls)),
    path("gestion/", include(gestion.urls)),
]
