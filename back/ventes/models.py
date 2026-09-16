"""
Ventes : commandes, paiements, campagnes de remise, avis.

Le front portait deux notions de commande qui ne se ressemblaient pas — cinq
statuts côté vitrine, six côté back-office, la remise d'un côté seulement. Elles
sont réconciliées ici : les six statuts du back-office font foi, et la vitrine
n'en montre que quatre à la cliente (voir `Statut.pour_la_cliente`).
"""

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Commande(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente de paiement"
        PAYEE = "payee", "Payée"
        PREPARATION = "preparation", "En préparation"
        EXPEDIEE = "expediee", "En route"
        LIVREE = "livree", "Livrée"
        ANNULEE = "annulee", "Annulée"

        @classmethod
        def pour_la_cliente(cls, statut: str) -> str:
            """
            Ce que la cliente lit dans son suivi.

            Elle n'a pas besoin de distinguer « en attente » de « payée » : dans
            les deux cas sa commande est reçue. La gérante, elle, en a besoin.
            """
            return {
                cls.EN_ATTENTE: "Commande reçue",
                cls.PAYEE: "Commande reçue",
                cls.PREPARATION: "En préparation",
                cls.EXPEDIEE: "En route",
                cls.LIVREE: "Livrée",
                cls.ANNULEE: "Annulée",
            }[statut]

    class Paiement(models.TextChoices):
        WAVE = "wave", "Wave"
        ORANGE_MONEY = "om", "Orange Money"
        CARTE = "cb", "Carte bancaire"
        LIVRAISON = "cod", "À la livraison"

    reference = models.CharField("référence", max_length=20, unique=True, db_index=True)

    # La cliente peut avoir été supprimée : la commande, elle, doit rester.
    cliente = models.ForeignKey(
        "clientele.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="commandes",
    )

    # Coordonnées figées au moment de l'achat : un changement de profil ne doit
    # pas réécrire l'adresse d'une commande déjà partie.
    nom_client = models.CharField(max_length=120)
    telephone = models.CharField(max_length=32)
    email = models.EmailField(blank=True)

    zone = models.CharField(max_length=12, choices=[
        ("dakar", "Dakar et banlieue"),
        ("thies", "Thiès, Mbour"),
        ("regions", "Autres régions"),
    ])
    ville = models.CharField(max_length=80)
    adresse = models.CharField(max_length=255)
    notes = models.TextField(blank=True)

    sous_total = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    frais_livraison = models.PositiveIntegerField(default=0)
    remise = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(validators=[MinValueValidator(0)])

    moyen_paiement = models.CharField(max_length=6, choices=Paiement.choices)
    statut = models.CharField(max_length=12, choices=Statut.choices, default=Statut.EN_ATTENTE)

    creee_le = models.DateTimeField(default=timezone.now, db_index=True)
    modifiee_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "commande"
        verbose_name_plural = "commandes"
        ordering = ["-creee_le"]
        indexes = [
            models.Index(fields=["statut", "-creee_le"]),
        ]
        constraints = [
            # Le paiement à la livraison n'est proposé que sur Dakar : la façade
            # l'annonce, le serveur le fait respecter.
            models.CheckConstraint(
                condition=~models.Q(moyen_paiement="cod") | models.Q(zone="dakar"),
                name="paiement_livraison_dakar_seulement",
            ),
        ]

    def __str__(self):
        return f"{self.reference} — {self.nom_client}"

    @property
    def statut_cliente(self) -> str:
        return self.Statut.pour_la_cliente(self.statut)

    @property
    def encaissee(self) -> bool:
        """Les statuts qui comptent dans le chiffre d'affaires."""
        return self.statut in {
            self.Statut.PAYEE,
            self.Statut.PREPARATION,
            self.Statut.EXPEDIEE,
            self.Statut.LIVREE,
        }

    def total_recalcule(self) -> int:
        """
        Le total refait depuis les lignes.

        Le montant envoyé par le navigateur n'est jamais retenu : il sert tout
        au plus à détecter un écart et à refuser la commande.
        """
        lignes = sum(ligne.prix_unitaire * ligne.quantite for ligne in self.lignes.all())
        return max(0, lignes + self.frais_livraison - self.remise)


class LigneCommande(models.Model):
    """
    Un article acheté.

    Le nom, le prix et le libellé d'option sont recopiés, pas référencés : si le
    catalogue change de prix ou si un coloris disparaît, la commande garde ce qui
    a réellement été acheté.
    """

    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="lignes")
    variante = models.ForeignKey(
        "catalogue.Variante",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lignes_commande",
    )

    nom_produit = models.CharField(max_length=160)
    slug_produit = models.SlugField(max_length=180, help_text="Pour reconstruire le lien vers la fiche")
    url_image = models.URLField(max_length=500, blank=True)
    libelle_option = models.CharField(max_length=80, help_text="« Rose poudré · 4 »")

    prix_unitaire = models.PositiveIntegerField()
    quantite = models.PositiveSmallIntegerField(default=1)

    class Meta:
        verbose_name = "ligne de commande"
        verbose_name_plural = "lignes de commande"

    def __str__(self):
        return f"{self.quantite} × {self.nom_produit}"

    @property
    def sous_total(self) -> int:
        return self.prix_unitaire * self.quantite


class Paiement(models.Model):
    """
    Une tentative de paiement.

    Une commande peut en compter plusieurs : un échec Wave suivi d'une reprise
    par carte laisse deux lignes. C'est l'historique qui permet d'expliquer une
    commande payée deux fois ou pas du tout.
    """

    class Etat(models.TextChoices):
        INITIE = "initie", "Initié"
        EN_ATTENTE = "en_attente", "En attente du prestataire"
        REUSSI = "reussi", "Réussi"
        ECHOUE = "echoue", "Échoué"
        REMBOURSE = "rembourse", "Remboursé"

    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="paiements")
    moyen = models.CharField(max_length=6, choices=Commande.Paiement.choices)
    montant = models.PositiveIntegerField()
    etat = models.CharField(max_length=12, choices=Etat.choices, default=Etat.INITIE)

    reference_prestataire = models.CharField(max_length=120, blank=True, db_index=True)
    # La réponse brute du prestataire, gardée telle quelle : c'est la seule
    # preuve exploitable le jour où un montant ne tombe pas juste.
    reponse_brute = models.JSONField(default=dict, blank=True)

    initie_le = models.DateTimeField(auto_now_add=True)
    confirme_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "paiement"
        verbose_name_plural = "paiements"
        ordering = ["-initie_le"]

    def __str__(self):
        return f"{self.commande.reference} — {self.get_moyen_display()} ({self.get_etat_display()})"


class Campagne(models.Model):
    """
    Une remise commerciale.

    La fin se calcule à partir de la date d'effet et de la durée : c'est la
    saisie du back-office, et elle évite les campagnes qui finissent avant de
    commencer.

    La boutique n'a pas de code de réduction : une campagne s'applique
    d'elle-même tant qu'elle court, et celle « sur la commande » dès que sa
    condition est remplie.
    """

    class Type(models.TextChoices):
        POURCENTAGE = "pourcentage", "Pourcentage"
        MONTANT = "montant", "Montant fixe"

    class Portee(models.TextChoices):
        BOUTIQUE = "boutique", "Toute la boutique"
        RAYON = "rayon", "Un rayon"
        PRODUIT = "produit", "Un produit"
        COMMANDE = "commande", "Sur la commande"

    class Condition(models.TextChoices):
        PREMIERE = "premiere", "Première commande"
        MONTANT_MINIMUM = "montant_minimum", "À partir d'un montant"

    libelle = models.CharField(max_length=120)
    type = models.CharField(max_length=12, choices=Type.choices, default=Type.POURCENTAGE)
    valeur = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    date_effet = models.DateField()
    duree_jours = models.PositiveSmallIntegerField(default=30, validators=[MinValueValidator(1)])

    portee = models.CharField(max_length=10, choices=Portee.choices, default=Portee.BOUTIQUE)
    rayon = models.ForeignKey(
        "catalogue.Rayon", on_delete=models.CASCADE, null=True, blank=True, related_name="campagnes"
    )
    produit = models.ForeignKey(
        "catalogue.Produit", on_delete=models.CASCADE, null=True, blank=True, related_name="campagnes"
    )
    condition = models.CharField(
        max_length=16, choices=Condition.choices, default=Condition.PREMIERE
    )
    montant_minimum = models.PositiveIntegerField(default=0)

    active = models.BooleanField(default=True)
    note = models.TextField("note interne", blank=True, help_text="Jamais affichée en boutique")

    class Meta:
        verbose_name = "campagne"
        verbose_name_plural = "campagnes"
        ordering = ["-date_effet"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(type="pourcentage") | models.Q(valeur__lte=100),
                name="pourcentage_au_plus_cent",
            ),
        ]

    def __str__(self):
        return self.libelle

    @property
    def date_fin(self):
        """Dernier jour inclus."""
        return self.date_effet + timezone.timedelta(days=self.duree_jours - 1)

    @property
    def en_cours(self) -> bool:
        aujourdhui = timezone.localdate()
        return self.active and self.date_effet <= aujourdhui <= self.date_fin


class Avis(models.Model):
    """
    Un avis sur un article ou sur la boutique.

    Le droit d'écrire vient d'une commande **livrée** contenant l'article : sans
    cette contrainte, n'importe qui note n'importe quoi. La modération est
    explicite — un avis n'apparaît pas tant qu'il n'est pas approuvé.
    """

    class Etat(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente de modération"
        PUBLIE = "publie", "Publié"
        REFUSE = "refuse", "Refusé"

    auteur = models.ForeignKey(
        "clientele.Utilisateur", on_delete=models.CASCADE, related_name="avis"
    )
    commande = models.ForeignKey(
        Commande, on_delete=models.CASCADE, related_name="avis",
        help_text="La commande livrée qui donne le droit d'écrire cet avis",
    )
    # Vide : l'avis porte sur la boutique dans son ensemble.
    produit = models.ForeignKey(
        "catalogue.Produit",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="avis",
    )

    note = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    commentaire = models.TextField(blank=True)
    etat = models.CharField(max_length=12, choices=Etat.choices, default=Etat.EN_ATTENTE)

    ecrit_le = models.DateTimeField(auto_now_add=True)
    modere_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "avis"
        verbose_name_plural = "avis"
        ordering = ["-ecrit_le"]
        constraints = [
            models.CheckConstraint(condition=models.Q(note__lte=5), name="note_sur_cinq"),
            # Un seul avis par produit et par commande : on ne note pas deux fois
            # le même achat.
            models.UniqueConstraint(
                fields=["auteur", "commande", "produit"], name="avis_unique_par_achat"
            ),
        ]

    def __str__(self):
        cible = self.produit.nom if self.produit else "la boutique"
        return f"{self.note}/5 sur {cible} par {self.auteur.nom}"
