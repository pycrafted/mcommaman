"""Les lectures du catalogue restent bornées quand la boutique grandit."""

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Media, PhotoProduit, Produit, Rayon
from .tests import fabriquer_produit


class RayonsPerformancesTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.gerante = get_user_model().objects.create_user(
            email="performance@test.sn", nom="Gérante", role="gerante",
        )

    def ajouter_rayons(self, debut, fin):
        for i in range(debut, fin):
            media = Media.objects.create(url=f"https://exemple.test/rayon-{i}.jpg", nom=str(i))
            parent = Rayon.objects.create(nom=f"Parent {i}", slug=f"parent-{i}", image=media)
            enfant = Rayon.objects.create(nom=f"Enfant {i}", slug=f"enfant-{i}", image=media)
            enfant.parents.add(parent)

    def verifier_requetes(self, gestion=False):
        if gestion:
            self.client.force_authenticate(self.gerante)
        url = reverse("rayon-gestion-list" if gestion else "rayon-public-list")
        self.ajouter_rayons(0, 1)
        with CaptureQueriesContext(connection) as petite:
            self.client.get(url, {"page_size": 200})
        self.ajouter_rayons(1, 21)
        with CaptureQueriesContext(connection) as grande:
            reponse = self.client.get(url, {"page_size": 200})
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(len(petite), len(grande))
        self.assertLessEqual(len(grande), 6)

    def test_les_rayons_publics_ne_font_pas_de_requetes_par_categorie(self):
        self.verifier_requetes()

    def test_les_rayons_de_gestion_ne_font_pas_de_requetes_par_categorie(self):
        self.verifier_requetes(gestion=True)

    def test_les_comptages_respectent_la_visibilite_et_les_parentes_multiples(self):
        parent = Rayon.objects.create(nom="Parent", slug="parent")
        autre = Rayon.objects.create(nom="Autre", slug="autre")
        enfant = Rayon.objects.create(nom="Enfant", slug="enfant")
        enfant.parents.add(parent, autre)
        masque = Rayon.objects.create(nom="Masqué", slug="masque", visible=False)
        masque.parents.add(parent)
        for i, rayon in enumerate([parent, enfant, masque]):
            fabriquer_produit(slug=f"publie-{i}", sku=f"PUB-{i}", rayon=rayon)
        fabriquer_produit(slug="brouillon", sku="BRO", rayon=enfant, statut=Produit.Statut.BROUILLON)

        public = self.client.get(reverse("rayon-public-detail", args=[parent.slug])).data
        self.assertEqual(public["nombre_produits"], 2)
        self.assertEqual([(e["slug"], e["nombre_produits"]) for e in public["enfants"]], [("enfant", 1)])
        self.client.force_authenticate(self.gerante)
        gestion = self.client.get(reverse("rayon-gestion-detail", args=[parent.pk])).data
        self.assertEqual(gestion["nombre_produits"], 3)
        self.assertEqual(gestion["fiches"], 1)
        self.assertEqual(len(gestion["enfants"]), 2)


class PhotosCibleesTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.gerante = get_user_model().objects.create_user(
            email="photos-performance@test.sn", nom="Gérante", role="gerante",
        )
        cls.produit = fabriquer_produit()
        cls.autre = fabriquer_produit(slug="autre", sku="AUTRE")

    def setUp(self):
        self.client.force_authenticate(self.gerante)

    def test_seules_les_photos_du_produit_demande_sont_chargees(self):
        page = self.client.get(reverse("photo-list"), {"produit": self.autre.pk}).data
        self.assertEqual(page["count"], 1)
        self.assertEqual(page["results"][0]["produit"], self.autre.pk)

    def test_un_produit_invalide_ne_charge_pas_toute_la_phototheque(self):
        for valeur in ["invalide", "", "0"]:
            with self.subTest(valeur=valeur):
                reponse = self.client.get(reverse("photo-list"), {"produit": valeur})
                self.assertEqual(reponse.status_code, 200)
                self.assertEqual(reponse.data["count"], 0)

    def test_la_recherche_de_medias_ne_renvoie_que_les_adresses_demandees(self):
        adresses = list(Media.objects.values_list("url", flat=True))
        Media.objects.create(url="https://exemple.test/hors-selection.jpg", nom="Autre")
        page = self.client.get(reverse("media-list"), {"url": adresses}).data
        self.assertEqual(page["count"], 2)
        self.assertCountEqual([m["url"] for m in page["results"]], adresses)

    def test_les_photos_restent_reservees_a_l_equipe(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("photo-list"), {"produit": self.produit.pk}).status_code, 403)
        self.assertEqual(self.client.get(reverse("media-list"), {"url": "https://exemple.test/photo.jpg"}).status_code, 403)
