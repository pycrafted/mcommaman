"""Réglages et bandeau : qui lit, qui écrit."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Reglages

Utilisateur = get_user_model()


class ReglagesTest(APITestCase):
    def setUp(self):
        self.gerante = Utilisateur.objects.create_user(
            email="g@test.sn", nom="Gérante", password="motdepasse123",
            role=Utilisateur.Role.GERANTE,
        )
        # Le contre-exemple de `EstGerante`. C'était une préparatrice tant que ce
        # rôle existait ; il n'y a plus qu'une cliente à opposer à la gérante.
        self.cliente = Utilisateur.objects.create_user(
            email="p@test.sn", nom="Cliente", password="motdepasse123",
        )

    def test_la_boutique_lit_les_reglages_sans_compte(self):
        reponse = self.client.get(reverse("reglages-public"))
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data["nom_boutique"], "M comme Maman")

    def test_les_reglages_publics_ne_livrent_pas_les_seuils_internes(self):
        reponse = self.client.get(reverse("reglages-public"))
        self.assertNotIn("seuil_stock_bas", reponse.data)

    def test_seule_la_gerante_modifie_les_reglages(self):
        self.client.force_authenticate(self.cliente)
        refus = self.client.patch(reverse("reglages-gestion"), {"franco_dakar": 30000}, format="json")
        self.assertEqual(refus.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.gerante)
        accepte = self.client.patch(reverse("reglages-gestion"), {"franco_dakar": 30000}, format="json")
        self.assertEqual(accepte.status_code, status.HTTP_200_OK)
        self.assertEqual(Reglages.actuels().franco_dakar, 30000)

    def test_le_calcul_des_frais_suit_la_zone(self):
        reglages = Reglages.actuels()
        # Sur Dakar, offerte au-dessus du franco.
        self.assertEqual(reglages.frais_pour("dakar", 30000), 0)
        self.assertEqual(reglages.frais_pour("dakar", 10000), 2000)
        # Ailleurs, jamais offerte, quel que soit le montant.
        self.assertEqual(reglages.frais_pour("regions", 100000), 3500)

    def test_il_n_y_a_jamais_deux_jeux_de_reglages(self):
        Reglages.objects.create(nom_boutique="Doublon")
        self.assertEqual(Reglages.objects.count(), 1)
