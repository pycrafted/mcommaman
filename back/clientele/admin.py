from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Adresse, LignePanier, Panier, Utilisateur


class AdresseEnLigne(admin.TabularInline):
    model = Adresse
    extra = 0


@admin.register(Utilisateur)
class UtilisateurAdmin(BaseUserAdmin):
    """L'adresse électronique remplace le pseudo : tous les écrans le reflètent."""

    ordering = ["-date_creation"]
    list_display = ["email", "nom", "role", "ville", "is_active", "date_creation"]
    list_filter = ["role", "is_active"]
    search_fields = ["email", "nom", "telephone"]
    inlines = [AdresseEnLigne]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Identité", {"fields": ("nom", "telephone", "ville")}),
        ("Rôle et accès", {"fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Préférences", {"fields": ("tailles_suivies",)}),
        ("Dates", {"fields": ("last_login", "date_creation")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "nom", "role", "password1", "password2"),
        }),
    )
    readonly_fields = ["last_login", "date_creation"]


class LigneEnLigne(admin.TabularInline):
    model = LignePanier
    extra = 0
    autocomplete_fields = ["variante"]


@admin.register(Panier)
class PanierAdmin(admin.ModelAdmin):
    list_display = ["__str__", "modifie_le"]
    inlines = [LigneEnLigne]
