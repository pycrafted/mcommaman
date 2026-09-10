"""
Ce que la gérante règle sans toucher au code : identité de la boutique, frais de
livraison, bandeau d'accueil, et le journal de ce qui s'est passé.
"""

from django.core.exceptions import ValidationError
from django.db import models


class Reglages(models.Model):
    """
    Les réglages de la boutique. Une seule ligne, jamais deux.

    Les frais de livraison sont ici et non dans `settings.py` : ce sont des
    valeurs commerciales, elles changent sans mise en production.
    """

    # Les coordonnées de la boutique, et non des exemples : c'est ce qui
    # s'affiche en pied de page, sur la page contact et derrière chaque lien
    # WhatsApp. Un numéro d'exemple par défaut, et une installation neuve
    # publie un faux numéro sans que personne s'en aperçoive.
    nom_boutique = models.CharField(max_length=120, default="M comme Maman")
    signature = models.CharField(max_length=160, default="Le monde des mamans")
    email_contact = models.EmailField(default="mamand202122@gmail.com")
    telephone = models.CharField(max_length=32, default="+221 76 208 02 02")
    devise = models.CharField(max_length=8, default="F")

    franco_dakar = models.PositiveIntegerField(
        "livraison offerte à partir de", default=25_000,
        help_text="Sur Dakar uniquement",
    )
    frais_dakar = models.PositiveIntegerField(default=2_000)
    frais_thies = models.PositiveIntegerField(default=3_500)
    frais_regions = models.PositiveIntegerField(default=3_500)

    seuil_stock_bas = models.PositiveSmallIntegerField(
        "seuil d'alerte de stock", default=6,
        help_text="En dessous, le produit est signalé dans le back-office",
    )

    accepte_commandes = models.BooleanField(
        "accepter les commandes", default=True,
        help_text="Décocher pendant les congés : la boutique reste consultable",
    )
    affiche_bandeau_promo = models.BooleanField(default=True)
    texte_bandeau_promo = models.CharField(
        max_length=200,
        default="Livraison offerte à Dakar dès 25 000 F — Retours gratuits sous 14 jours",
    )

    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "réglages"
        verbose_name_plural = "réglages"

    def __str__(self):
        return self.nom_boutique

    def save(self, *args, **kwargs):
        # Un seul jeu de réglages : on force l'identifiant.
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Les réglages de la boutique ne se suppriment pas.")

    @classmethod
    def actuels(cls) -> "Reglages":
        objet, _ = cls.objects.get_or_create(pk=1)
        return objet

    def frais_pour(self, zone: str, sous_total: int) -> int:
        """Les frais de livraison d'un panier, seule source qui fasse foi."""
        if zone == "dakar":
            return 0 if sous_total >= self.franco_dakar else self.frais_dakar
        if zone == "thies":
            return self.frais_thies
        return self.frais_regions


class Bandeau(models.Model):
    """
    Le bandeau d'accueil.

    Tant qu'aucune photo n'est marquée active, la vitrine fait défiler les trois
    photos livrées avec le site. La page d'accueil n'est jamais vide.
    """

    titre = models.CharField(max_length=120, blank=True)
    accroche = models.CharField(max_length=200, blank=True)
    media = models.ForeignKey(
        "catalogue.Media", on_delete=models.PROTECT, related_name="bandeaux"
    )
    texte_alternatif = models.CharField("texte alternatif", max_length=200)
    cadrage = models.CharField(
        max_length=20, default="50% 40%",
        help_text="Recadrage CSS, quand le sujet n'est pas au centre",
    )
    etiquette = models.CharField(max_length=60, blank=True, help_text="« Les grands jours »")
    produit_associe = models.ForeignKey(
        "catalogue.Produit",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bandeaux",
        help_text="L'article proposé sous la photo",
    )

    active = models.BooleanField(default=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "photo du bandeau"
        verbose_name_plural = "bandeau d'accueil"
        ordering = ["ordre"]

    def __str__(self):
        return self.etiquette or self.texte_alternatif[:40]


class EntreeJournal(models.Model):
    """
    Qui a fait quoi, quand.

    Le back-office l'affiche déjà. Il sert surtout le jour où un prix a changé
    sans qu'on sache par qui.
    """

    auteur = models.ForeignKey(
        "clientele.Utilisateur", on_delete=models.SET_NULL, null=True, related_name="journal"
    )
    # Recopié : l'entrée doit rester lisible même si le compte est supprimé.
    nom_auteur = models.CharField(max_length=120)
    action = models.CharField(max_length=80, help_text="« a publié », « a modifié le prix de »")
    cible = models.CharField(max_length=200)
    date = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "entrée du journal"
        verbose_name_plural = "journal"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.nom_auteur} {self.action} {self.cible}"
