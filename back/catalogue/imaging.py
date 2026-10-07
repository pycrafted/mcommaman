"""
Variantes web des photos de la photothèque.

Le problème : R2 rend le fichier tel qu'il a été envoyé. Une photo de
téléphone de 3 à 8 Mo était donc téléchargée telle quelle pour remplir une
carte de 300 px — c'est ce qui rendait la boutique lente à s'afficher.

La réponse : à l'enregistrement, on fabrique trois largeurs à côté de
l'original, qui reste le master et n'est jamais modifié. C'est la variante
de 800 px que `Media.url` enregistre, et donc ce que la boutique affiche par
défaut ; la vitrine en déduit les deux autres pour son `srcset`.
"""

from io import BytesIO
import os
import re

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

# Largeurs générées, en pixels :
#   400  — miniatures, fonds floutés, cartes sur téléphone
#   800  — cartes sur grand écran, et adresse par défaut
#  1600  — fiche produit, bandeau, écrans à forte densité
LARGEURS_WEB = (400, 800, 1600)
LARGEUR_DEFAUT = 800

# 85 : au-delà, le JPEG grossit sans que l'œil y gagne.
QUALITE = 85

# En dessous de ce poids, l'original est déjà léger : on le sert tel quel.
SEUIL_OCTETS = 300 * 1024

# `photo-ab12cd-web-800.jpg` : le motif que la vitrine sait reconnaître.
MOTIF_VARIANTE = re.compile(r"-web-(\d+)\.(jpg|png)$")


def est_variante(adresse):
    return bool(adresse and MOTIF_VARIANTE.search(adresse))


def doit_generer(champ_image):
    """Vrai si la photo mérite des variantes web."""
    if not champ_image:
        return False
    try:
        return champ_image.size > SEUIL_OCTETS
    except (OSError, ValueError):
        # Fichier absent du stockage : rien à faire, et surtout pas planter
        # l'enregistrement pour autant.
        return False


def chemin_variante(nom_source, largeur, extension):
    """`photheque/2026/09/robe.jpg` + 800 → `photheque/2026/09/robe-web-800.jpg`."""
    dossier = os.path.dirname(nom_source)
    racine = os.path.splitext(os.path.basename(nom_source))[0]
    return f"{dossier}/{racine}-web-{largeur}.{extension}".lstrip("/")


def construire_variantes(champ_image):
    """
    Renvoie `(dimensions_origine, {largeur: (chemin, ContentFile)})`, ou
    `(None, {})` si la source est illisible.

    Les trois largeurs sont toujours produites, même quand l'original est plus
    étroit (il n'est alors pas agrandi) : la vitrine suppose qu'elles existent
    toutes, un `srcset` qui pointe vers un fichier absent montrerait un trou.
    """
    try:
        champ_image.open("rb")
        with Image.open(champ_image.file) as source:
            dimensions = source.size

            # Réduire PENDANT le décodage : sur une photo de 4000 × 6000, le
            # décodeur JPEG ne restitue qu'une fraction des pixels au lieu
            # d'allouer 72 Mo. Sans effet sur les autres formats.
            source.draft("RGB", (max(LARGEURS_WEB) * 2, max(LARGEURS_WEB) * 2))

            # Les téléphones notent l'orientation en EXIF au lieu de pivoter
            # les pixels : sans ceci, une photo verticale ressort couchée.
            base = ImageOps.exif_transpose(source)

            # Le JPEG ne connaît pas la transparence : un détourage deviendrait
            # un fond noir. Ces images-là restent en PNG.
            transparente = base.mode in ("RGBA", "LA", "P") and (
                "A" in base.mode or "transparency" in base.info
            )
            if transparente:
                base = base.convert("RGBA")
                extension = "png"
            else:
                if base.mode not in ("RGB", "L"):
                    base = base.convert("RGB")
                extension = "jpg"

            sorties = {}
            # De la plus grande à la plus petite : `thumbnail` réduit sur
            # place, chaque tour part du résultat du précédent.
            for largeur in sorted(LARGEURS_WEB, reverse=True):
                base.thumbnail((largeur, largeur * 4), Image.LANCZOS)
                tampon = BytesIO()
                if transparente:
                    base.save(tampon, format="PNG", optimize=True)
                else:
                    # Progressif : sur connexion lente, la photo se devine
                    # tout de suite puis gagne en netteté.
                    base.save(tampon, format="JPEG", quality=QUALITE,
                              optimize=True, progressive=True)
                chemin = chemin_variante(champ_image.name, largeur, extension)
                sorties[largeur] = (chemin, ContentFile(tampon.getvalue()))
    except (OSError, ValueError, Image.DecompressionBombError):
        return None, {}
    finally:
        champ_image.close()

    return dimensions, sorties


def generer_variantes(media):
    """
    Écrit les trois variantes de `media.fichier` dans le stockage et renvoie
    `(adresse_par_defaut, dimensions)`, ou `(None, None)` si rien n'a été fait.
    """
    if not doit_generer(media.fichier):
        return None, None

    dimensions, variantes = construire_variantes(media.fichier)
    if not variantes:
        return None, None

    stockage = media.fichier.storage
    adresse = None
    for largeur, (chemin, contenu) in variantes.items():
        # Le nom de l'original est déjà unique : ses variantes aussi. Un
        # fichier déjà présent vient d'un passage précédent, on le garde.
        if not stockage.exists(chemin):
            chemin = stockage.save(chemin, contenu)
        if largeur == LARGEUR_DEFAUT:
            adresse = stockage.url(chemin)
    return adresse, dimensions
