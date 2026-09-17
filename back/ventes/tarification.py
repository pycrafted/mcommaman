"""
Ce que coûte une commande.

Une seule règle gouverne ce fichier : **rien de ce que le navigateur annonce
n'est retenu**. Ni le prix d'un article, ni les frais de livraison, ni la
remise, ni le total. Tout est refait ici, depuis la base.
"""

from dataclasses import dataclass, field

from django.utils import timezone

from vitrine.models import Reglages

from .models import Campagne, Commande
from .remises import campagnes_automatiques, prix_effectif, remise_en_pourcentage


class ErreurTarification(Exception):
    """Ce qui empêche la commande d'aboutir, dit à la cliente."""


@dataclass
class LigneCalculee:
    variante: object
    quantite: int
    prix_unitaire: int

    @property
    def sous_total(self) -> int:
        return self.prix_unitaire * self.quantite


@dataclass
class Devis:
    """Le détail chiffré d'un panier, prêt à devenir une commande."""

    lignes: list[LigneCalculee] = field(default_factory=list)
    sous_total: int = 0
    frais_livraison: int = 0
    remise: int = 0
    total: int = 0
    campagne: Campagne | None = None


def chiffrer(lignes_demandees, zone: str, cliente=None, remise_manuelle: int = 0) -> Devis:
    """
    Chiffre un panier.

    `lignes_demandees` est une suite de couples (variante, quantité). Le prix
    vient du produit en base ; celui qu'aurait envoyé le navigateur n'est même
    pas lu. `remise_manuelle` n'est ouverte qu'à l'équipe (saisie d'une vente).
    """
    if not lignes_demandees:
        raise ErreurTarification("Le panier est vide.")

    reglages = Reglages.actuels()
    devis = Devis()

    # Les campagnes en cours sont lues une fois pour tout le panier : chaque
    # ligne les réinterrogerait sinon.
    campagnes = campagnes_automatiques()

    for variante, quantite in lignes_demandees:
        if quantite < 1:
            raise ErreurTarification("Une quantité doit être d'au moins un article.")
        if variante.produit.statut != variante.produit.Statut.PUBLIE:
            raise ErreurTarification(f"« {variante.produit.nom} » n'est plus en vente.")
        if variante.stock < quantite:
            raise ErreurTarification(
                f"« {variante.produit.nom} » en {variante.taille.valeur} : "
                f"il n'en reste que {variante.stock}."
            )
        # Le prix retenu est celui qu'affiche la boutique, remise comprise :
        # annoncer 9 600 F et facturer 12 000 F serait pire que ne pas remiser.
        devis.lignes.append(
            LigneCalculee(
                variante=variante,
                quantite=quantite,
                prix_unitaire=prix_effectif(variante.produit, campagnes),
            )
        )

    devis.sous_total = sum(ligne.sous_total for ligne in devis.lignes)
    devis.frais_livraison = reglages.frais_pour(zone, devis.sous_total)

    devis.campagne = _campagne_de_commande(devis.sous_total, cliente)
    if devis.campagne:
        devis.remise = _remise(devis.campagne, devis.sous_total)

    # Le geste commercial accordé par la gérante, en plus d'une éventuelle
    # campagne. Il ne peut pas rendre la commande négative.
    if remise_manuelle:
        devis.remise = min(devis.remise + remise_manuelle, devis.sous_total + devis.frais_livraison)

    devis.total = max(0, devis.sous_total + devis.frais_livraison - devis.remise)
    return devis


def _campagne_de_commande(sous_total: int, cliente) -> Campagne | None:
    """
    La meilleure remise « sur la commande » à laquelle ce panier a droit.

    Il n'y a pas de code à saisir : une campagne de commande en cours
    s'applique dès que sa condition est remplie. Première commande : il faut un
    compte, sans quoi rien ne dit que ce n'est pas la dixième. Montant minimum :
    le sous-total doit l'atteindre. Plusieurs campagnes ne se cumulent pas — la
    cliente garde la plus avantageuse.
    """
    aujourdhui = timezone.localdate()
    candidates = [
        c for c in Campagne.objects.filter(active=True, portee=Campagne.Portee.COMMANDE)
        if c.date_effet <= aujourdhui <= c.date_fin
    ]
    if not candidates:
        return None

    connue = cliente is not None and cliente.is_authenticated
    premiere = connue and not Commande.objects.filter(cliente=cliente).exists()

    eligibles = []
    for campagne in candidates:
        if campagne.condition == Campagne.Condition.MONTANT_MINIMUM:
            if sous_total >= campagne.montant_minimum:
                eligibles.append(campagne)
        elif campagne.condition == Campagne.Condition.PREMIERE and premiere:
            eligibles.append(campagne)

    return max(eligibles, key=lambda c: _remise(c, sous_total), default=None)


def _remise(campagne: Campagne, sous_total: int) -> int:
    if campagne.type == Campagne.Type.POURCENTAGE:
        return remise_en_pourcentage(sous_total, campagne.valeur)
    # Une remise fixe ne descend pas le panier sous zéro.
    return min(campagne.valeur, sous_total)


def prochaine_reference() -> str:
    """
    La référence lisible d'une commande : MCM-10240, MCM-10241…

    Tirée du dernier numéro utilisé plutôt que d'un compteur séparé : une
    référence doit rester devinable à l'œil quand la gérante la lit au téléphone.
    """
    derniere = (
        Commande.objects.filter(reference__startswith="MCM-")
        .order_by("-reference")
        .values_list("reference", flat=True)
        .first()
    )
    numero = 10_240
    if derniere:
        try:
            numero = int(derniere.split("-")[1])
        except (IndexError, ValueError):
            pass
    return f"MCM-{numero + 1}"
