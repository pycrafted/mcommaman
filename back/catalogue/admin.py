"""
L'admin Django sert à l'équipe technique, pas à la gérante : elle, elle a le
back-office de la vitrine. Ici on veut voir les données brutes et corriger vite.
"""

from django.contrib import admin

from .models import (
    AlerteStock,
    Coloris,
    Matiere,
    Media,
    MouvementStock,
    PhotoProduit,
    Produit,
    Rayon,
    Taille,
    Variante,
)


class PhotoEnLigne(admin.TabularInline):
    model = PhotoProduit
    extra = 1
    autocomplete_fields = ["media"]


class VarianteEnLigne(admin.TabularInline):
    model = Variante
    extra = 0
    autocomplete_fields = ["taille", "coloris"]


@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ["nom", "sku", "prix", "rayon", "statut", "stock_total", "publiable"]
    list_filter = ["statut", "rayon", "matieres"]
    search_fields = ["nom", "sku", "slug"]
    prepopulated_fields = {"slug": ["nom"]}
    inlines = [PhotoEnLigne, VarianteEnLigne]
    readonly_fields = ["cree_le", "modifie_le"]

    @admin.display(boolean=True, description="Publiable")
    def publiable(self, obj):
        return obj.publiable


@admin.register(Rayon)
class RayonAdmin(admin.ModelAdmin):
    list_display = ["nom", "slug", "visible", "ordre"]
    list_editable = ["visible", "ordre"]
    search_fields = ["nom"]
    prepopulated_fields = {"slug": ["nom"]}
    filter_horizontal = ["parents"]


@admin.register(Taille)
class TailleAdmin(admin.ModelAdmin):
    list_display = ["valeur", "repere", "ordre"]
    list_editable = ["repere", "ordre"]
    search_fields = ["valeur"]


@admin.register(Coloris)
class ColorisAdmin(admin.ModelAdmin):
    list_display = ["nom", "hexa"]
    search_fields = ["nom"]


@admin.register(Matiere)
class MatiereAdmin(admin.ModelAdmin):
    search_fields = ["nom"]


@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    list_display = ["nom", "url", "ajoute_le"]
    search_fields = ["nom", "url"]


@admin.register(Variante)
class VarianteAdmin(admin.ModelAdmin):
    list_display = ["__str__", "sku", "stock"]
    list_editable = ["stock"]
    list_filter = ["taille", "coloris"]
    search_fields = ["sku", "produit__nom"]


@admin.register(MouvementStock)
class MouvementStockAdmin(admin.ModelAdmin):
    list_display = ["date", "variante", "quantite", "motif", "reste", "reference"]
    list_filter = ["motif", "date"]
    search_fields = ["reference", "variante__sku"]
    readonly_fields = ["date"]


@admin.register(AlerteStock)
class AlerteStockAdmin(admin.ModelAdmin):
    list_display = ["email", "produit", "cree_le", "prevenue_le"]
    list_filter = ["prevenue_le"]
    search_fields = ["email", "produit__nom"]
    autocomplete_fields = ["produit"]
