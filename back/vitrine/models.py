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

    # Le bandeau d'accueil : ses textes et les pièces qui défilent dans la carte
    # posée sur la photo. Ses photos, elles, sont les lignes de `Bandeau`.
    hero_pastille = models.CharField(
        "pastille", max_length=60, blank=True, default="Nouvelle collection · 2026",
    )
    hero_titre = models.CharField(
        "titre", max_length=120, default="Des looks\nqui suivent",
        help_text="Un retour à la ligne pour couper le titre",
    )
    hero_accent = models.CharField(
        "fin du titre en couleur", max_length=60, blank=True, default="leurs aventures.",
    )
    hero_chapo = models.CharField(
        "texte d'introduction", max_length=240, blank=True,
        default="Des pièces joyeuses, faciles à vivre et choisies avec le regard exigeant d’une maman.",
    )
    hero_sceau = models.CharField(
        "texte du macaron", max_length=60, blank=True, default="LIVRAISON 24 H · DAKAR ·",
        help_text="Le texte qui tourne autour du macaron ; vide, le macaron disparaît",
    )
    hero_sceau_centre = models.CharField("centre du macaron", max_length=12, blank=True, default="24 h")
    hero_sceau_legende = models.CharField(
        "sous le centre du macaron", max_length=20, blank=True, default="chez vous",
    )
    hero_produits = models.ManyToManyField(
        "catalogue.Produit", blank=True, related_name="+",
        verbose_name="produits mis en avant",
        help_text="Vide : les dernières nouveautés défilent",
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
        if zone == "retrait":
            return 0
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


class Video(models.Model):
    """
    Une vidéo de la vidéothèque.

    Celles qui sont `sur_accueil` défilent dans la section « Nos pièces,
    filmées » de la page d'accueil, dans l'ordre choisi, chacune avec la pièce
    qu'elle montre. Sans aucune vidéo à l'accueil, la vitrine garde celles
    livrées avec le site.
    """

    fichier = models.FileField(upload_to="videotheque/%Y/%m")
    # L'adresse publique, calculée à l'enregistrement comme pour la photothèque.
    url = models.URLField(max_length=500, blank=True)
    titre = models.CharField(max_length=120)
    produit = models.ForeignKey(
        "catalogue.Produit",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="videos",
        help_text="La pièce proposée sous la vidéo",
    )
    sur_accueil = models.BooleanField("sur l'accueil", default=True)
    ordre = models.PositiveSmallIntegerField(default=0)
    ajoutee_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "vidéo"
        verbose_name_plural = "vidéothèque"
        ordering = ["ordre", "-ajoutee_le"]

    def __str__(self):
        return self.titre

    def save(self, *args, **kwargs):
        # Même règle que `catalogue.Media` : l'adresse n'existe qu'une fois le
        # fichier écrit, et elle doit être absolue.
        super().save(*args, **kwargs)
        if self.fichier:
            from django.conf import settings

            adresse = self.fichier.url
            if not adresse.startswith(("http://", "https://")):
                adresse = settings.URL_API.rstrip("/") + adresse
            if self.url != adresse:
                self.url = adresse
                super().save(update_fields=["url"])

    def delete(self, *args, **kwargs):
        fichier = self.fichier
        super().delete(*args, **kwargs)
        # Une vidéo pèse lourd : on ne laisse pas le fichier orphelin.
        if fichier:
            fichier.delete(save=False)


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
