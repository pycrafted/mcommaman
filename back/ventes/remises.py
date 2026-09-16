"""
Ce que coûte un article aujourd'hui.

Une campagne de portée « boutique », « rayon » ou « produit » s'applique
d'elle-même tant qu'elle court — la boutique n'a pas de code à saisir. Ce module est le seul
endroit qui décide du prix affiché, et `ventes.tarification` l'appelle avant de
chiffrer un panier — sinon la boutique annoncerait 9 600 F et la caisse en
demanderait 12 000.

Deux règles tiennent tout :

**La portée « commande » ne touche pas aux prix.** Elle remise un panier entier,
pas un article — c'est `tarification.chiffrer` qui s'en occupe.

**Quand plusieurs campagnes visent le même article, la cliente garde la
meilleure.** Elles ne se cumulent pas : deux remises de 30 % ne font pas 60 %, et
personne ne saurait dire laquelle s'applique en premier.
"""

from dataclasses import dataclass

from django.utils import timezone

from .models import Campagne


@dataclass(frozen=True)
class Remise:
    """Ce qu'une campagne fait au prix d'un article."""

    campagne: Campagne
    prix_initial: int
    prix_remise: int

    @property
    def economie(self) -> int:
        return self.prix_initial - self.prix_remise

    @property
    def pourcentage(self) -> int:
        """Le taux réellement obtenu, arrondi — y compris pour une remise fixe."""
        if self.prix_initial <= 0:
            return 0
        return round(self.economie * 100 / self.prix_initial)


def campagnes_automatiques():
    """
    Les campagnes qui s'appliquent sans qu'on les demande.

    Renvoie une liste, pas un `QuerySet` : elle est parcourue une fois par
    article et on ne veut pas la redemander à la base à chaque fois.
    """
    aujourdhui = timezone.localdate()
    candidates = (
        Campagne.objects.filter(active=True)
        .exclude(portee=Campagne.Portee.COMMANDE)
        .select_related("rayon", "produit")
    )
    # La fenêtre se calcule en Python : `date_fin` se déduit de la durée, il n'y
    # a pas de colonne à comparer en base.
    return [c for c in candidates if c.date_effet <= aujourdhui <= c.date_fin]


def _vise(campagne: Campagne, produit) -> bool:
    """La campagne concerne-t-elle cet article ?"""
    if campagne.portee == Campagne.Portee.BOUTIQUE:
        return True

    if campagne.portee == Campagne.Portee.PRODUIT:
        return campagne.produit_id == produit.pk

    if campagne.portee == Campagne.Portee.RAYON:
        if campagne.rayon_id is None:
            return False
        if produit.rayon_id == campagne.rayon_id:
            return True
        # Viser « Enfants » vise aussi ses sous-catégories : une remise de rayon
        # qui s'arrêterait au premier niveau ne remiserait presque rien.
        return produit.rayon.parents.filter(pk=campagne.rayon_id).exists()

    return False


def _prix_apres(campagne: Campagne, prix: int) -> int:
    if campagne.type == Campagne.Type.POURCENTAGE:
        return max(0, prix - round(prix * campagne.valeur / 100))
    # Une remise fixe ne rend pas l'article gratuit par accident.
    return max(0, prix - campagne.valeur)


def remise_pour(produit, campagnes=None) -> Remise | None:
    """
    La meilleure remise en cours sur cet article, s'il y en a une.

    Passer `campagnes` évite de réinterroger la base pour chaque article d'une
    liste — c'est ce que font les sérialiseurs du catalogue.
    """
    if campagnes is None:
        campagnes = campagnes_automatiques()

    meilleure = None
    for campagne in campagnes:
        if not _vise(campagne, produit):
            continue
        prix = _prix_apres(campagne, produit.prix)
        if prix >= produit.prix:
            # Une remise qui n'enlève rien n'en est pas une : l'afficher poserait
            # un badge « promo » sur un prix inchangé.
            continue
        if meilleure is None or prix < meilleure.prix_remise:
            meilleure = Remise(campagne=campagne, prix_initial=produit.prix, prix_remise=prix)

    return meilleure


def prix_effectif(produit, campagnes=None) -> int:
    """Le prix à payer aujourd'hui : le prix de la fiche, remise déduite."""
    remise = remise_pour(produit, campagnes)
    return remise.prix_remise if remise else produit.prix
