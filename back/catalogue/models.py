"""
Le catalogue : rayons, référentiels, produits, variantes, photothèque.

Les prix sont des entiers en francs CFA. Le franc CFA n'a pas de centime : un
décimal n'apporterait que des arrondis à surveiller.
"""

import os

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify


class Univers(models.TextChoices):
    """
    Les deux mondes de la boutique.

    Le Coin Maman vend du tissu et du voile : ni âge ni genre n'y ont de sens.
    Les mélanger au vestiaire enfant appliquerait des filtres absurdes.
    """

    ENFANT = "enfant", "Enfants"
    MAMAN = "maman", "Coin Maman"


class Rayon(models.Model):
    """
    Une catégorie de la boutique, ou une sous-catégorie.

    C'est le même objet : ce qui les distingue est d'avoir ou non des parentes.
    Deux tables auraient dupliqué chaque champ et interdit à une sous-catégorie
    d'appartenir à deux endroits.

    Or c'est précisément ce qu'on veut : « Chaussures » se range aussi bien sous
    « Enfants » que sous « Coin Maman ». D'où une liaison multiple et non une
    clé unique — l'arborescence est un treillis, pas un arbre.

    Deux niveaux, pas trois : une catégorie qui a des parentes ne peut pas en
    être une. Une boutique qui aurait besoin d'un troisième étage a surtout
    besoin de moins de catégories.
    """

    nom = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True, blank=True)
    parents = models.ManyToManyField(
        "self",
        blank=True,
        symmetrical=False,
        related_name="enfants",
        verbose_name="catégories parentes",
        help_text="Vide pour une catégorie de premier niveau",
    )
    # Choisi, plus déduit : avec plusieurs parentes, il n'y a pas de « monde de
    # la parente » à reprendre. Une sous-catégorie rangée sous « Enfants » et
    # sous « Coin Maman » doit dire elle-même où elle se montre.
    univers = models.CharField(max_length=8, choices=Univers.choices, default=Univers.ENFANT)
    description = models.CharField(max_length=255, blank=True)
    image = models.ForeignKey(
        "catalogue.Media",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rayons_illustres",
    )
    visible = models.BooleanField("visible en boutique", default=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "rayon"
        verbose_name_plural = "rayons"
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.nom)
        super().save(*args, **kwargs)

    @property
    def est_racine(self) -> bool:
        """Vrai tant qu'aucune catégorie ne la contient."""
        return not self.parents.exists()

    def descendance(self):
        """
        Ce rayon et tout ce qu'il contient — de quoi filtrer d'un coup.

        Le passage par un ensemble d'identifiants n'est pas une précaution de
        style : une sous-catégorie partagée par deux parentes apparaîtrait deux
        fois, et un cycle ferait tourner la fonction sans fin.
        """
        vus = {}

        def parcourir(rayon):
            if rayon.pk in vus:
                return
            vus[rayon.pk] = rayon
            for enfant in rayon.enfants.all():
                parcourir(enfant)

        parcourir(self)
        return list(vus.values())


class Taille(models.Model):
    """
    Une taille : une lettre ou un nombre, et rien d'autre.

    Elle ne dépend d'aucun rayon ni d'aucun âge. Le repère est une aide au
    choix, facultative : « S » peut convenir vers 2 ans sans que « 2 ans »
    devienne une taille.
    """

    valeur = models.CharField("taille", max_length=12, unique=True, help_text="S, 4, 24, TU…")
    repere = models.CharField(
        "repère", max_length=40, blank=True, help_text="Indication d'âge, facultative"
    )
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "taille"
        verbose_name_plural = "tailles"
        ordering = ["ordre", "valeur"]

    def __str__(self):
        return self.valeur


class Coloris(models.Model):
    nom = models.CharField(max_length=60, unique=True)
    hexa = models.CharField("pastille", max_length=7, default="#000000", help_text="#rrggbb")

    class Meta:
        verbose_name = "coloris"
        verbose_name_plural = "coloris"
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Matiere(models.Model):
    """Proposée en saisie rapide sur la fiche produit, jamais imposée."""

    nom = models.CharField(max_length=80, unique=True)

    class Meta:
        verbose_name = "matière"
        verbose_name_plural = "matières"
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Media(models.Model):
    """
    La photothèque, partagée par les fiches, les rayons et le bandeau d'accueil.

    Deux provenances, une seule adresse. Ou bien l'image vit déjà quelque part
    et on colle son adresse, ou bien on l'envoie et le serveur la range dans
    `MEDIA_ROOT` — dans les deux cas, `url` est ce que la boutique affiche.

    Le jour où les fichiers partiront chez un hébergeur d'images, seul le calcul
    de `url` changera : rien de ce qui s'en sert n'aura à bouger.
    """

    fichier = models.ImageField("fichier envoyé", upload_to="photheque/%Y/%m", blank=True)
    url = models.URLField(max_length=500, unique=True, blank=True)
    nom = models.CharField(max_length=160)
    largeur = models.PositiveIntegerField(null=True, blank=True)
    hauteur = models.PositiveIntegerField(null=True, blank=True)
    ajoute_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "média"
        verbose_name_plural = "photothèque"
        ordering = ["-ajoute_le"]

    def __str__(self):
        return self.nom

    def save(self, *args, **kwargs):
        # Un fichier envoyé doit d'abord être écrit sur le disque pour avoir une
        # adresse : d'où l'enregistrement en deux temps.
        super().save(*args, **kwargs)
        if self.fichier:
            from django.conf import settings

            from .imaging import est_variante, generer_variantes

            # Variantes déjà faites pour ce fichier : l'adresse est bonne, on
            # ne repasse pas par Pillow à chaque enregistrement.
            racine = os.path.splitext(os.path.basename(self.fichier.name))[0]
            if est_variante(self.url) and f"/{racine}-web-" in self.url:
                return

            # La boutique affiche la variante web, pas l'original : voir
            # `imaging.py`. Une photo déjà légère est servie telle quelle.
            adresse, dimensions = generer_variantes(self)
            if adresse is None:
                adresse = self.fichier.url
            champs = ["url"]
            if dimensions:
                self.largeur, self.hauteur = dimensions
                champs += ["largeur", "hauteur"]

            # Absolue, pas relative : la vitrine tourne sur un autre port et
            # `/media/...` la renverrait chez elle.
            #
            # Selon le stockage, l'adresse est déjà absolue — Cloudflare R2
            # rend `https://<domaine>/photheque/...` — ou relative, quand les
            # fichiers sont sur le disque et servis par Django. Préfixer une
            # adresse déjà complète donnerait une URL inutilisable, d'où le test.
            if not adresse.startswith(("http://", "https://")):
                adresse = settings.URL_API.rstrip("/") + adresse
            if self.url != adresse or len(champs) > 1:
                self.url = adresse
                super().save(update_fields=champs)


class Produit(models.Model):
    """
    Une fiche du catalogue.

    Le statut commande la visibilité : seul un produit publié apparaît en
    boutique. Les conditions de publication sont vérifiées par
    `manque_pour_publier()` — la même liste que celle affichée dans le
    back-office, mais ici elle est opposable.
    """

    class Statut(models.TextChoices):
        BROUILLON = "brouillon", "Brouillon"
        PUBLIE = "publie", "Publié"
        ARCHIVE = "archive", "Archivé"

    nom = models.CharField("nom commercial", max_length=160)
    slug = models.SlugField(max_length=180, unique=True, help_text="Adresse en boutique : /p/<slug>")
    sku = models.CharField("référence interne", max_length=32, unique=True)

    prix = models.PositiveIntegerField("prix en F CFA", validators=[MinValueValidator(0)])
    prix_barre = models.PositiveIntegerField("prix barré", null=True, blank=True)

    description = models.TextField(blank=True)
    matieres = models.ManyToManyField(
        Matiere,
        blank=True,
        related_name="produits",
        help_text="Une composition peut réunir plusieurs matières.",
    )

    rayon = models.ForeignKey(Rayon, on_delete=models.PROTECT, related_name="produits")

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.BROUILLON)

    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "produit"
        verbose_name_plural = "produits"
        ordering = ["-cree_le"]
        indexes = [
            models.Index(fields=["statut", "rayon"]),
        ]
        constraints = [
            # Un prix barré doit être plus élevé que le prix, sinon ce n'est pas
            # une promotion mais une erreur de saisie.
            models.CheckConstraint(
                condition=models.Q(prix_barre__isnull=True) | models.Q(prix_barre__gt=models.F("prix")),
                name="prix_barre_superieur_au_prix",
            )
        ]

    def __str__(self):
        return self.nom

    @property
    def photo_principale(self):
        return self.photos.order_by("position").first()

    @property
    def stock_total(self) -> int:
        return sum(v.stock for v in self.variantes.all())

    @property
    def univers(self) -> str:
        """L'univers vient du rayon : une seule source de vérité."""
        return self.rayon.univers

    @property
    def composition(self) -> str:
        return ", ".join(self.matieres.values_list("nom", flat=True))

    def manque_pour_publier(self) -> list[str]:
        """
        Ce qui empêche encore la publication.

        Trois conditions, les mêmes que celles affichées dans le back-office :
        de quoi nommer la fiche, la montrer et la facturer. C'est ce contrôle
        qui manquait quand « Safari enfant » est parti en ligne à 0 F.

        Aucune longueur minimale n'est imposée : un nom court est un nom. La
        description, la composition et les tailles restent facultatives — une
        fiche sans variante s'affiche en boutique sans être achetable, ce qui
        est le comportement voulu pour un article annoncé avant réassort.
        """
        manques = []
        if not self.nom.strip():
            manques.append("un nom commercial")
        if not self.pk or not self.photos.exists():
            manques.append("au moins une photo")
        if self.prix <= 0:
            manques.append("un prix supérieur à zéro")
        return manques

    @property
    def publiable(self) -> bool:
        return not self.manque_pour_publier()


class PhotoProduit(models.Model):
    """Les vues d'un produit. La position 0 est la photo de couverture."""

    produit = models.ForeignKey(Produit, on_delete=models.CASCADE, related_name="photos")
    media = models.ForeignKey(Media, on_delete=models.PROTECT, related_name="utilisations")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "photo de produit"
        verbose_name_plural = "photos de produit"
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["produit", "media"], name="photo_produit_unique")
        ]

    def __str__(self):
        return f"{self.produit.nom} — vue {self.position + 1}"


class Variante(models.Model):
    """
    Le couple taille × coloris réellement vendu, et son stock propre.

    C'est la variante qu'on met au panier, pas le produit : deux tailles du même
    article n'ont ni le même stock ni la même disponibilité.
    """

    produit = models.ForeignKey(Produit, on_delete=models.CASCADE, related_name="variantes")
    taille = models.ForeignKey(Taille, on_delete=models.PROTECT, related_name="variantes")
    coloris = models.ForeignKey(
        Coloris, on_delete=models.PROTECT, related_name="variantes", null=True, blank=True
    )
    sku = models.CharField("référence", max_length=40, unique=True)
    stock = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "variante"
        verbose_name_plural = "variantes"
        ordering = ["produit", "taille"]
        constraints = [
            models.UniqueConstraint(
                fields=["produit", "taille", "coloris"], name="variante_unique"
            )
        ]

    def __str__(self):
        if self.coloris:
            return f"{self.produit.nom} — {self.coloris.nom} · {self.taille.valeur}"
        return f"{self.produit.nom} — {self.taille.valeur}"

    @property
    def libelle_option(self) -> str:
        """Le choix en toutes lettres, figé dans la commande au moment de l'achat."""
        return f"{self.coloris.nom} · {self.taille.valeur}" if self.coloris else self.taille.valeur

    @property
    def disponible(self) -> bool:
        return self.stock > 0


class MouvementStock(models.Model):
    """
    Chaque variation de stock laisse une trace : vente, réapprovisionnement,
    retour, ajustement. Le back-office affiche déjà ce journal ; sans lui, une
    erreur de stock est impossible à expliquer.
    """

    class Motif(models.TextChoices):
        VENTE = "vente", "Vente"
        REAPPRO = "reappro", "Réapprovisionnement"
        RETOUR = "retour", "Retour cliente"
        AJUSTEMENT = "ajustement", "Ajustement manuel"
        ANNULATION = "annulation", "Annulation de commande"

    variante = models.ForeignKey(Variante, on_delete=models.CASCADE, related_name="mouvements")
    quantite = models.SmallIntegerField(help_text="Négatif pour une sortie")
    motif = models.CharField(max_length=12, choices=Motif.choices)
    reference = models.CharField(max_length=40, blank=True, help_text="Référence de commande, s'il y en a une")
    reste = models.PositiveIntegerField("stock après le mouvement")
    auteur = models.ForeignKey(
        "clientele.Utilisateur", on_delete=models.SET_NULL, null=True, blank=True
    )
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "mouvement de stock"
        verbose_name_plural = "mouvements de stock"
        ordering = ["-date"]

    def __str__(self):
        signe = "+" if self.quantite > 0 else ""
        return f"{signe}{self.quantite} — {self.variante} ({self.get_motif_display()})"
