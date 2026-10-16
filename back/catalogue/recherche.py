"""
La recherche de la boutique, côté serveur.

Reprend la logique de `lib/search.ts` : accents ignorés, table de synonymes, et
un mot qui ne se retrouve nulle part écarte la fiche. Ce qui change, c'est le
lieu : le navigateur n'a plus à connaître tout le catalogue pour chercher dedans.
"""

import unicodedata

from django.db.models import Q

# Ce qu'une cliente tape pour ce qu'elle cherche vraiment.
SYNONYMES = {
    "fille": "fille",
    "filles": "fille",
    "garcon": "garcon",
    "garcons": "garcon",
    "bebe": "0-1",
    "bebes": "0-1",
    "chaussure": "chaussures",
    "basket": "chaussures",
    "baskets": "chaussures",
    "soldes": "promo",
    "reduction": "promo",
    "nouveaute": "nouveau",
    "nouveautes": "nouveau",
}


def normaliser(valeur: str) -> str:
    """Minuscules, sans accent ni ponctuation : « Robe été » et « robe ete » se valent."""
    sans_accent = "".join(
        c for c in unicodedata.normalize("NFD", valeur.lower())
        if unicodedata.category(c) != "Mn"
    )
    return "".join(c if c.isalnum() else " " for c in sans_accent).strip()


def mots(requete: str) -> list[str]:
    return [SYNONYMES.get(mot, mot) for mot in normaliser(requete).split() if mot]


def filtrer(selection, requete: str):
    """
    Restreint une sélection de produits aux fiches qui contiennent **tous** les
    mots cherchés.

    Chaque mot doit se retrouver quelque part — nom, description ou
    rayon. Un « ou » ramènerait la moitié du catalogue dès le deuxième mot.
    """
    termes = mots(requete)
    if not termes:
        return selection

    for terme in termes:
        selection = selection.filter(
            Q(nom__unaccent__icontains=terme)
            | Q(description__unaccent__icontains=terme)
            | Q(rayon__nom__unaccent__icontains=terme)
        )
    return selection.distinct()
