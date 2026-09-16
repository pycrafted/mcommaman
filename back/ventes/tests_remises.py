"""
Ce que le moteur de remises doit garantir.

Les tests portent sur les règles commerciales, pas sur le code : une campagne
qui court baisse le prix, une campagne de commande ne touche pas aux prix, et
la caisse facture exactement ce que la boutique affiche.

    python manage.py test ventes.tests_remises
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from catalogue.models import Media, PhotoProduit, Produit, Rayon, Taille, Variante
from ventes.models import Campagne
from ventes.remises import campagnes_automatiques, prix_effectif, remise_pour
from ventes.tarification import chiffrer


class MoteurRemisesTest(TestCase):
    def setUp(self):
        self.aujourdhui = timezone.localdate()

        self.rayon = Rayon.objects.create(nom="Vestiaire", slug="vestiaire")
        self.sous_rayon = Rayon.objects.create(nom="Hauts", slug="hauts")
        self.sous_rayon.parents.add(self.rayon)

        self.produit = Produit.objects.create(
            nom="Tee-shirt raye", slug="tee-shirt-raye", sku="TEE-0001",
            prix=12_000, description="Un tee-shirt de test, coton peigne, coupe droite.",
            rayon=self.sous_rayon, statut=Produit.Statut.PUBLIE,
        )
        media = Media.objects.create(url="https://exemple.test/t.jpg", nom="t.jpg")
        PhotoProduit.objects.create(produit=self.produit, media=media, position=0)

        taille = Taille.objects.create(valeur="4", repere="4 ans")
        self.variante = Variante.objects.create(
            produit=self.produit, taille=taille, sku="TEE-0001-4", stock=10
        )

    def _campagne(self, **kwargs):
        defauts = {
            "libelle": "Campagne", "type": Campagne.Type.POURCENTAGE, "valeur": 20,
            "date_effet": self.aujourdhui, "duree_jours": 7,
            "portee": Campagne.Portee.BOUTIQUE, "active": True,
        }
        return Campagne.objects.create(**{**defauts, **kwargs})

    def test_sans_campagne_le_prix_ne_bouge_pas(self):
        self.assertIsNone(remise_pour(self.produit))
        self.assertEqual(prix_effectif(self.produit), 12_000)

    def test_une_campagne_boutique_baisse_le_prix(self):
        self._campagne(valeur=25)
        self.assertEqual(prix_effectif(self.produit), 9_000)

    def test_une_remise_fixe_se_soustrait(self):
        self._campagne(type=Campagne.Type.MONTANT, valeur=3_000)
        self.assertEqual(prix_effectif(self.produit), 9_000)

    def test_une_campagne_de_rayon_atteint_les_sous_categories(self):
        """Viser « Vestiaire » doit remiser ce qui est rangé dans « Hauts »."""
        self._campagne(portee=Campagne.Portee.RAYON, rayon=self.rayon, valeur=10)
        self.assertEqual(prix_effectif(self.produit), 10_800)

    def test_une_campagne_visant_un_autre_rayon_ne_s_applique_pas(self):
        ailleurs = Rayon.objects.create(nom="Chaussures", slug="chaussures")
        self._campagne(portee=Campagne.Portee.RAYON, rayon=ailleurs, valeur=50)
        self.assertEqual(prix_effectif(self.produit), 12_000)

    def test_une_campagne_de_commande_ne_touche_pas_aux_prix(self):
        self._campagne(portee=Campagne.Portee.COMMANDE, valeur=20)
        self.assertEqual(prix_effectif(self.produit), 12_000)

    def test_une_campagne_inactive_ou_expiree_ne_s_applique_pas(self):
        self._campagne(valeur=20, active=False)
        self.assertEqual(prix_effectif(self.produit), 12_000)

        Campagne.objects.all().delete()
        self._campagne(valeur=20, date_effet=self.aujourdhui - timedelta(days=30), duree_jours=5)
        self.assertEqual(prix_effectif(self.produit), 12_000)

        Campagne.objects.all().delete()
        self._campagne(valeur=20, date_effet=self.aujourdhui + timedelta(days=3))
        self.assertEqual(prix_effectif(self.produit), 12_000)

    def test_deux_campagnes_ne_se_cumulent_pas(self):
        """La cliente garde la meilleure, pas la somme des deux."""
        self._campagne(libelle="Vingt pour cent", valeur=20)
        self._campagne(libelle="Trois mille francs", type=Campagne.Type.MONTANT, valeur=3_000)
        # 20 % donne 9 600, 3 000 F donne 9 000 : c'est 9 000, pas 6 600.
        self.assertEqual(prix_effectif(self.produit), 9_000)

    def test_la_caisse_facture_le_prix_affiche(self):
        """L'écart entre l'étiquette et la caisse serait pire que pas de remise."""
        self._campagne(valeur=20)
        affiche = prix_effectif(self.produit)
        devis = chiffrer([(self.variante, 2)], zone="dakar")
        self.assertEqual(affiche, 9_600)
        self.assertEqual(devis.sous_total, affiche * 2)

    def test_une_campagne_visant_ce_produit_s_applique(self):
        """La portée la plus fine : un article nommément désigné."""
        self._campagne(portee=Campagne.Portee.PRODUIT, produit=self.produit, valeur=1)
        # 1 % de 12 000 fait 120 : la remise existe bien.
        self.assertEqual(prix_effectif(self.produit), 11_880)

    def test_les_campagnes_sont_lues_une_fois_pour_toute_une_liste(self):
        self._campagne(valeur=20)
        campagnes = campagnes_automatiques()
        with self.assertNumQueries(0):
            # Rayon déjà chargé : aucune requête pour un second article.
            remise_pour(self.produit, campagnes)
