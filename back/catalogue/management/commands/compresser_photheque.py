"""
Fabrique les variantes web des photos déjà envoyées.

    python manage.py compresser_photheque

Les photos envoyées avant `catalogue/imaging.py` sont servies en taille
d'origine. Cette commande leur fabrique leurs trois largeurs et fait pointer
`Media.url` vers la variante de 800 px : toutes les fiches, rayons et bandeaux
qui s'en servent suivent d'eux-mêmes, puisqu'ils passent par la photothèque.

Les originaux ne sont ni modifiés ni supprimés. La relancer ne refait rien
pour une photo déjà traitée.
"""

from django.core.management.base import BaseCommand

from catalogue.imaging import est_variante
from catalogue.models import Media


class Command(BaseCommand):
    help = "Fabrique les variantes web (400, 800, 1600 px) des photos déjà envoyées."

    def handle(self, *args, **options):
        a_traiter = [m for m in Media.objects.exclude(fichier="") if not est_variante(m.url)]
        self.stdout.write(f"{len(a_traiter)} photo(s) à examiner.")

        faites = 0
        for media in a_traiter:
            avant = media.url
            try:
                media.save()
            except Exception as e:  # une photo illisible ne doit pas arrêter les autres
                self.stderr.write(f"  ✗ {media.nom} : {e}")
                continue
            if media.url != avant:
                faites += 1
                self.stdout.write(f"  ✓ {media.nom}")
            else:
                self.stdout.write(f"  · {media.nom} : déjà légère, servie telle quelle")

        self.stdout.write(self.style.SUCCESS(f"{faites} photo(s) allégée(s)."))
