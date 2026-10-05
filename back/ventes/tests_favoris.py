"""
Favoris.

Une mise de côté appartient à qui l'a faite : elle se lit, s'ajoute et se retire
avec son compte, et personne d'autre ne la voit.
"""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from catalogue.models import Produit
from clientele.models import Favori

from .models import Commande
from .tests import commande_type, fabriquer_variante

Utilisateur = get_user_model()


class FavorisTest(APITestCase):
    def setUp(self):
        self.variante = fabriquer_variante()
        self.produit = self.variante.produit
        self.cliente = Utilisateur.objects.create_user(
            email="fav@test.sn", nom="Favorite", password="motdepasse123"
        )
        self.client.force_authenticate(self.cliente)

    def test_ajouter_puis_lister(self):
        reponse = self.client.post(reverse("favori-list"), {"produit": self.produit.pk},
                                   format="json")
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reponse.data["nom"], self.produit.nom)
        liste = self.client.get(reverse("favori-list"))
        self.assertEqual(len(liste.data["results"]), 1)

    def test_deux_clics_sur_le_coeur_ne_font_pas_d_erreur(self):
        self.client.post(reverse("favori-list"), {"produit": self.produit.pk}, format="json")
        second = self.client.post(reverse("favori-list"), {"produit": self.produit.pk},
                                  format="json")
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.cliente.favoris.count(), 1)

    def test_retirer_par_produit(self):
        self.client.post(reverse("favori-list"), {"produit": self.produit.pk}, format="json")
        reponse = self.client.delete(reverse("favori-retirer-par-produit", args=[self.produit.pk]))
        self.assertEqual(reponse.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.cliente.favoris.count(), 0)

    def test_un_brouillon_ne_se_met_pas_de_cote(self):
        self.produit.statut = Produit.Statut.BROUILLON
        self.produit.save()
        reponse = self.client.post(reverse("favori-list"), {"produit": self.produit.pk},
                                   format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_la_fusion_ajoute_sans_effacer(self):
        """Les favoris gardés dans le navigateur remontent à la connexion."""
        autre = fabriquer_variante(slug="jupe", sku="JUP-001").produit
        self.client.post(reverse("favori-list"), {"produit": self.produit.pk}, format="json")
        reponse = self.client.post(reverse("favori-fusionner"), {"produits": [autre.pk]},
                                   format="json")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(self.cliente.favoris.count(), 2)

    def test_les_favoris_sont_fermes_aux_visiteurs(self):
        self.client.force_authenticate(None)
        reponse = self.client.get(reverse("favori-list"))
        self.assertIn(reponse.status_code,
                      {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_on_ne_voit_pas_les_favoris_d_une_autre(self):
        autre_cliente = Utilisateur.objects.create_user(
            email="x@test.sn", nom="X", password="motdepasse123"
        )
        Favori.objects.create(cliente=autre_cliente, produit=self.produit)
        liste = self.client.get(reverse("favori-list"))
        self.assertEqual(len(liste.data["results"]), 0)
