from django.contrib import admin

from .models import Avis, Campagne, Commande, LigneCommande, Paiement


class LigneEnLigne(admin.TabularInline):
    model = LigneCommande
    extra = 0
    readonly_fields = ["nom_produit", "libelle_option", "prix_unitaire", "quantite"]
    can_delete = False


class PaiementEnLigne(admin.TabularInline):
    model = Paiement
    extra = 0
    readonly_fields = ["initie_le", "confirme_le"]


@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ["reference", "nom_client", "ville", "moyen_paiement", "statut", "total", "creee_le"]
    list_filter = ["statut", "moyen_paiement", "zone", "creee_le"]
    search_fields = ["reference", "nom_client", "telephone", "email"]
    date_hierarchy = "creee_le"
    inlines = [LigneEnLigne, PaiementEnLigne]
    readonly_fields = ["reference", "creee_le", "modifiee_le", "total_recalcule"]

    @admin.display(description="Total recalculé")
    def total_recalcule(self, obj):
        return obj.total_recalcule() if obj.pk else "—"


@admin.register(Campagne)
class CampagneAdmin(admin.ModelAdmin):
    list_display = ["libelle", "type", "valeur", "date_effet", "duree_jours", "portee", "active"]
    list_filter = ["type", "portee", "active"]
    search_fields = ["libelle"]


@admin.register(Avis)
class AvisAdmin(admin.ModelAdmin):
    list_display = ["__str__", "note", "etat", "ecrit_le"]
    list_filter = ["etat", "note"]
    search_fields = ["auteur__nom", "commentaire", "commande__reference"]
    actions = ["publier", "refuser"]

    @admin.action(description="Publier les avis choisis")
    def publier(self, request, queryset):
        from django.utils import timezone
        n = queryset.update(etat=Avis.Etat.PUBLIE, modere_le=timezone.now())
        self.message_user(request, f"{n} avis publié(s).")

    @admin.action(description="Refuser les avis choisis")
    def refuser(self, request, queryset):
        from django.utils import timezone
        n = queryset.update(etat=Avis.Etat.REFUSE, modere_le=timezone.now())
        self.message_user(request, f"{n} avis refusé(s).")
