"""
Le service des fichiers envoyés depuis le back-office, lectures partielles comprises.

`django.views.static.serve` renvoie toujours le fichier entier. Pour une image,
c'est sans conséquence ; pour une vidéo, non : Safari (iPhone comme Mac)
demande la vidéo par morceaux (en-tête `Range`) et refuse de la lire si le
serveur ne répond pas `206 Partial Content`. Les autres navigateurs, eux, ne
peuvent pas avancer dans la vidéo.

Cette vue répond aux demandes partielles, et délègue tout le reste à `serve`.
"""

import mimetypes
import os
import re

from django.http import Http404, HttpResponse, StreamingHttpResponse
from django.utils._os import safe_join
from django.views.static import serve

PLAGE = re.compile(r"bytes=(\d*)-(\d*)$")


class _Tranche:
    """Un fichier lu de `debut` à `fin` inclus, par blocs."""

    def __init__(self, chemin: str, debut: int, longueur: int, bloc: int = 64 * 1024):
        self.fichier = open(chemin, "rb")
        self.fichier.seek(debut)
        self.reste = longueur
        self.bloc = bloc

    def __iter__(self):
        try:
            while self.reste > 0:
                morceau = self.fichier.read(min(self.bloc, self.reste))
                if not morceau:
                    break
                self.reste -= len(morceau)
                yield morceau
        finally:
            self.fichier.close()


def servir_media(request, path):
    # Lu à chaque requête, et non figé dans la route : un changement de
    # `MEDIA_ROOT` (disque monté, tests) est pris en compte.
    from django.conf import settings

    document_root = settings.MEDIA_ROOT
    plage = request.headers.get("Range", "")
    trouve = PLAGE.match(plage.strip())
    if not trouve:
        reponse = serve(request, path, document_root=document_root)
        # Annonce que les lectures partielles sont possibles.
        reponse["Accept-Ranges"] = "bytes"
        return reponse

    try:
        chemin = safe_join(str(document_root), path)
    except ValueError as erreur:
        raise Http404("Fichier introuvable.") from erreur
    if not os.path.isfile(chemin):
        raise Http404("Fichier introuvable.")

    taille = os.path.getsize(chemin)
    debut_txt, fin_txt = trouve.groups()
    if debut_txt == "" and fin_txt == "":
        return serve(request, path, document_root=document_root)
    if debut_txt == "":
        # « bytes=-500 » : les 500 derniers octets.
        debut = max(0, taille - int(fin_txt))
        fin = taille - 1
    else:
        debut = int(debut_txt)
        fin = min(int(fin_txt), taille - 1) if fin_txt else taille - 1

    if debut >= taille or debut > fin:
        reponse = HttpResponse(status=416)
        reponse["Content-Range"] = f"bytes */{taille}"
        return reponse

    longueur = fin - debut + 1
    type_contenu = mimetypes.guess_type(chemin)[0] or "application/octet-stream"
    reponse = StreamingHttpResponse(
        _Tranche(chemin, debut, longueur), status=206, content_type=type_contenu
    )
    reponse["Content-Length"] = str(longueur)
    reponse["Content-Range"] = f"bytes {debut}-{fin}/{taille}"
    reponse["Accept-Ranges"] = "bytes"
    return reponse
