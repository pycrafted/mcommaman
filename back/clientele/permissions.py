"""
Qui a le droit de quoi.

Ces classes sont la seule barrière qui compte. Le back-office peut bien cacher
un bouton : une interface qui masque ne protège rien, c'est ici que ça se joue.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class EstEquipe(BasePermission):
    """Réservé à l'équipe de la boutique — préparatrice ou gérante."""

    message = "Cette page est réservée à l'équipe de la boutique."

    def has_permission(self, request, view):
        utilisateur = request.user
        return bool(utilisateur and utilisateur.is_authenticated and utilisateur.est_equipe)


class EstGerante(BasePermission):
    """Réservé à la gérante : réglages, campagnes, suppression."""

    message = "Seule la gérante peut faire cette opération."

    def has_permission(self, request, view):
        utilisateur = request.user
        return bool(
            utilisateur
            and utilisateur.is_authenticated
            and utilisateur.role == utilisateur.Role.GERANTE
        )


class EstProprietaire(BasePermission):
    """
    L'objet appartient à la personne connectée.

    Vaut pour une adresse, un favori, une commande : tout ce qui porte
    un champ `cliente`, `auteur` ou `utilisateur`.
    """

    message = "Cet élément ne vous appartient pas."

    def has_object_permission(self, request, view, obj):
        for champ in ("cliente", "auteur", "utilisateur"):
            proprietaire = getattr(obj, champ, None)
            if proprietaire is not None:
                return proprietaire == request.user
        return False


class LectureSeulePourTous(BasePermission):
    """
    Tout le monde lit, seule l'équipe écrit.

    C'est le régime du catalogue : la vitrine doit pouvoir l'afficher sans
    compte, mais personne ne modifie une fiche sans être de la maison.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        utilisateur = request.user
        return bool(utilisateur and utilisateur.is_authenticated and utilisateur.est_equipe)
