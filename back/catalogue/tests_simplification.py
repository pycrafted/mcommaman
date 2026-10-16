"""La saisie simplifiée et la suppression depuis la boutique."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from ventes.models import Commande, LigneCommande

from .models import Media, PhotoProduit, Produit, Rayon
from .tests import fabriquer_produit


class FicheSimplifieeTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.gerante = get_user_model().objects.create_user(
            email="fiche-gerante@test.sn", nom="Gérante", role="gerante",
        )
        cls.cliente = get_user_model().objects.create_user(
            email="fiche-cliente@test.sn", nom="Cliente", role="cliente",
        )

    def test_les_lectures_n_exposent_plus_la_composition(self):
        produit = fabriquer_produit()
        urls = [
            reverse("produit-public-detail", args=[produit.slug]),
            reverse("produit-public-list"),
            reverse("produit-gestion-detail", args=[produit.pk]),
            reverse("produit-gestion-list"),
            reverse("referentiels-list"),
        ]
        self.client.force_authenticate(self.gerante)
        for url in urls:
            with self.subTest(url=url):
                reponse = self.client.get(url)
                self.assertEqual(reponse.status_code, 200)
                for champ in ['"matiere"', '"matieres"', '"matieres_noms"']:
                    self.assertNotIn(champ, reponse.content.decode())

    def test_creer_modifier_publier_et_dupliquer_sans_composition(self):
        self.client.force_authenticate(self.gerante)
        rayon = Rayon.objects.create(nom="Robes", slug="robes")
        creation = self.client.post(reverse("produit-gestion-list"), {
            "nom": "Robe", "slug": "robe", "sku": "ROB-0001",
            "prix": 6000, "rayon": rayon.pk,
        }, format="json")
        self.assertEqual(creation.status_code, 201)
        produit_id = creation.data["id"]
        media = Media.objects.create(nom="Robe", url="https://exemple.test/robe.jpg")
        PhotoProduit.objects.create(produit_id=produit_id, media=media)
        modification = self.client.patch(
            reverse("produit-gestion-detail", args=[produit_id]),
            {"prix": 7000}, format="json",
        )
        self.assertEqual(modification.status_code, 200)
        self.assertEqual(modification.data["prix"], 7000)
        publication = self.client.post(reverse("produit-gestion-publier", args=[produit_id]))
        self.assertEqual(publication.status_code, 200)
        copie = self.client.post(reverse("produit-gestion-dupliquer", args=[produit_id]))
        self.assertEqual(copie.status_code, 201)
        self.assertEqual(copie.data["prix"], 7000)
        self.assertEqual(copie.data["statut"], "brouillon")
        self.assertEqual(len(copie.data["photos"]), 1)

    def test_la_suppression_reste_reservee_a_l_equipe(self):
        produit = fabriquer_produit()
        for utilisateur in [None, self.cliente]:
            with self.subTest(utilisateur=utilisateur):
                self.client.force_authenticate(utilisateur)
                reponse = self.client.delete(reverse("produit-gestion-detail", args=[produit.pk]))
                self.assertIn(reponse.status_code, [401, 403])
                self.assertTrue(Produit.objects.filter(pk=produit.pk).exists())

    def test_supprimer_conserve_les_commandes_et_la_phototheque(self):
        produit = fabriquer_produit()
        media_id = produit.photos.first().media_id
        commande = Commande.objects.create(
            reference="MCM-SUPPRESSION", nom_client="Cliente", telephone="771234567",
            zone="dakar", moyen_paiement="cod", sous_total=produit.prix, total=produit.prix,
        )
        ligne = LigneCommande.objects.create(
            commande=commande, variante=produit.variantes.first(), nom_produit=produit.nom,
            slug_produit=produit.slug, libelle_option="Écru · 4", prix_unitaire=produit.prix,
        )
        self.client.force_authenticate(self.gerante)
        reponse = self.client.delete(reverse("produit-gestion-detail", args=[produit.pk]))
        self.assertEqual(reponse.status_code, 204)
        self.assertFalse(Produit.objects.filter(pk=produit.pk).exists())
        self.assertFalse(PhotoProduit.objects.filter(produit_id=produit.pk).exists())
        self.assertTrue(Media.objects.filter(pk=media_id).exists())
        ligne.refresh_from_db()
        commande.refresh_from_db()
        self.assertIsNone(ligne.variante_id)
        self.assertEqual(ligne.nom_produit, produit.nom)
        self.assertEqual(commande.total, produit.prix)
        self.assertEqual(ligne.sous_total, produit.prix)
