"""
Identités et clientèle.

Un seul modèle d'utilisateur pour les deux publics — les clientes et l'équipe de
la boutique — distingués par leur rôle. Deux modèles séparés auraient obligé à
dupliquer la connexion, les sessions et la réinitialisation de mot de passe.

Deux rôles, donc, et pas un de plus : on achète, ou on tient la boutique.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class GestionnaireUtilisateur(BaseUserManager):
    """L'adresse électronique tient lieu d'identifiant : il n'y a pas de pseudo."""

    use_in_migrations = True

    def _creer(self, email, password, **extra):
        if not email:
            raise ValueError("Une adresse électronique est obligatoire.")
        email = self.normalize_email(email).lower()
        utilisateur = self.model(email=email, **extra)
        utilisateur.set_password(password)
        utilisateur.save(using=self._db)
        return utilisateur

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", Utilisateur.Role.CLIENTE)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._creer(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", Utilisateur.Role.GERANTE)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Un superutilisateur doit avoir is_staff=True.")
        return self._creer(email, password, **extra)


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CLIENTE = "cliente", "Cliente"
        GERANTE = "gerante", "Gérante"

    email = models.EmailField("adresse électronique", unique=True)
    nom = models.CharField("nom complet", max_length=120)
    telephone = models.CharField("téléphone", max_length=32, blank=True)
    ville = models.CharField(max_length=80, blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.CLIENTE)

    # Préférence de la cliente : les tailles qu'elle suit.
    tailles_suivies = models.JSONField(default=list, blank=True)

    # Pour l'équipe : jusqu'où la cloche du back-office a été lue. Tenu sur le
    # serveur et non dans le navigateur, pour qu'une commande arrivée pendant
    # que le back-office était fermé reste signalée, sur n'importe quel appareil.
    notifications_lues_le = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField("compte actif", default=True)
    is_staff = models.BooleanField("accès à l'admin Django", default=False)
    date_creation = models.DateTimeField("créé le", default=timezone.now)

    objects = GestionnaireUtilisateur()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nom"]

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.nom} <{self.email}>"

    @property
    def est_equipe(self) -> bool:
        """Qui peut entrer dans le back-office."""
        return self.role in ROLES_EQUIPE


# Les rôles qui ouvrent le back-office, tenus à un seul endroit : la permission
# et la vue de gestion s'y réfèrent. Il n'y en a qu'un — la boutique ne distingue
# pas deux niveaux d'accès, une gérante en fait entrer une autre. Le jour où il
# faudra un accès partiel, c'est un rôle de plus dans `Role` et dans ce tuple,
# et rien d'autre à chercher ailleurs.
ROLES_EQUIPE = (Utilisateur.Role.GERANTE,)


class Adresse(models.Model):
    """
    Une entrée du carnet d'adresses.

    La zone détermine les frais de livraison : c'est elle qui compte, pas la
    ville, qui n'est qu'une indication pour le livreur.
    """

    class Zone(models.TextChoices):
        DAKAR = "dakar", "Dakar et banlieue"
        THIES = "thies", "Thiès, Mbour"
        REGIONS = "regions", "Autres régions"

    cliente = models.ForeignKey(
        Utilisateur, on_delete=models.CASCADE, related_name="adresses"
    )
    libelle = models.CharField("libellé", max_length=60, help_text="« Maison », « Bureau »…")
    zone = models.CharField(max_length=12, choices=Zone.choices, default=Zone.DAKAR)
    ville = models.CharField(max_length=80)
    adresse = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    par_defaut = models.BooleanField("adresse par défaut", default=False)

    class Meta:
        verbose_name = "adresse"
        verbose_name_plural = "adresses"
        ordering = ["-par_defaut", "libelle"]
        constraints = [
            # Une seule adresse par défaut par cliente : la contrainte évite de
            # devoir y penser à chaque écriture.
            models.UniqueConstraint(
                fields=["cliente"],
                condition=models.Q(par_defaut=True),
                name="une_seule_adresse_par_defaut",
            )
        ]

    def __str__(self):
        return f"{self.libelle} — {self.ville}"


class Favori(models.Model):
    """Un article mis de côté. Le couple cliente/produit est unique."""

    cliente = models.ForeignKey(
        Utilisateur, on_delete=models.CASCADE, related_name="favoris"
    )
    produit = models.ForeignKey(
        "catalogue.Produit", on_delete=models.CASCADE, related_name="favoris"
    )
    ajoute_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "favori"
        verbose_name_plural = "favoris"
        ordering = ["-ajoute_le"]
        constraints = [
            models.UniqueConstraint(fields=["cliente", "produit"], name="favori_unique")
        ]

    def __str__(self):
        return f"{self.cliente.nom} ♥ {self.produit.nom}"


class Panier(models.Model):
    """
    Le panier serveur.

    Tant que la visiteuse n'est pas connectée, son panier reste dans son
    navigateur ; à la connexion, il fusionne avec celui-ci. D'où la clé de
    session, qui permet de retrouver un panier avant même qu'un compte existe.
    """

    cliente = models.OneToOneField(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name="panier",
        null=True,
        blank=True,
    )
    cle_session = models.CharField(max_length=64, blank=True, db_index=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "panier"
        verbose_name_plural = "paniers"

    def __str__(self):
        return f"Panier de {self.cliente.nom}" if self.cliente else f"Panier {self.cle_session[:8]}"

    @property
    def sous_total(self) -> int:
        return sum(ligne.sous_total for ligne in self.lignes.all())


class LignePanier(models.Model):
    panier = models.ForeignKey(Panier, on_delete=models.CASCADE, related_name="lignes")
    variante = models.ForeignKey(
        "catalogue.Variante", on_delete=models.CASCADE, related_name="lignes_panier"
    )
    quantite = models.PositiveSmallIntegerField(default=1)

    class Meta:
        verbose_name = "ligne de panier"
        verbose_name_plural = "lignes de panier"
        constraints = [
            models.UniqueConstraint(
                fields=["panier", "variante"], name="ligne_panier_unique"
            )
        ]

    def __str__(self):
        return f"{self.quantite} × {self.variante}"

    @property
    def sous_total(self) -> int:
        return self.variante.produit.prix * self.quantite
