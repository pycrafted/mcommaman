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


class BandeauAccueilTest(APITestCase):
    """Les textes et les pièces du bandeau d'accueil se règlent dans le back-office."""

    def setUp(self):
        from django.contrib.auth import get_user_model

        from catalogue.tests import fabriquer_produit

        self.gerante = get_user_model().objects.create_user(
            email="accueil@test.sn", nom="Gérante", password="motdepasse123", role="gerante",
        )
        self.publie = fabriquer_produit(nom="Robe", slug="robe", sku="ROB-1")
        self.brouillon = fabriquer_produit(
            nom="Brouillon", slug="brouillon", sku="BRO-1", statut="brouillon"
        )

    def test_les_textes_par_defaut_sont_publics(self):
        donnees = self.client.get(reverse("reglages-public")).data
        self.assertEqual(donnees["hero_accent"], "leurs aventures.")
        self.assertNotIn("STOCK", donnees["hero_sceau"])
        self.assertEqual(donnees["hero_produits"], [])

    def test_la_gerante_change_les_textes_et_les_produits(self):
        self.client.force_authenticate(self.gerante)
        reponse = self.client.patch(
            reverse("reglages-gestion"),
            {"hero_titre": "Tabaski\nest là", "hero_produits": [self.publie.pk, self.brouillon.pk]},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(None)
        public = self.client.get(reverse("reglages-public")).data
        self.assertEqual(public["hero_titre"], "Tabaski\nest là")
        # Le brouillon ne s'annonce pas en vitrine.
        self.assertEqual(public["hero_produits"], [self.publie.pk])

    def test_une_cliente_ne_change_rien(self):
        from django.contrib.auth import get_user_model

        cliente = get_user_model().objects.create_user(
            email="cliente-accueil@test.sn", nom="Cliente", password="motdepasse123",
        )
        self.client.force_authenticate(cliente)
        reponse = self.client.patch(reverse("reglages-gestion"), {"hero_titre": "x"}, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)


class VideothequeTest(APITestCase):
    """La gérante choisit les vidéos de l'accueil."""

    def setUp(self):
        import shutil
        import tempfile

        from django.test import override_settings

        self.dossier = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dossier, ignore_errors=True)
        reglage = override_settings(MEDIA_ROOT=self.dossier)
        reglage.enable()
        self.addCleanup(reglage.disable)

        from catalogue.tests import fabriquer_produit

        self.gerante = Utilisateur.objects.create_user(
            email="videos@test.sn", nom="Gérante", password="motdepasse123",
            role=Utilisateur.Role.GERANTE,
        )
        self.produit = fabriquer_produit(nom="Robe", slug="robe-video", sku="ROB-V1")
        self.url = reverse("video-gestion-list")

    def _video(self, nom="essai.mp4", contenu=b"\x00\x00\x00\x18ftypmp42", type_="video/mp4"):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(nom, contenu, content_type=type_)

    def test_l_envoi_est_reserve_a_l_equipe(self):
        reponse = self.client.post(self.url, {"titre": "x", "fichier": self._video()}, format="multipart")
        self.assertIn(reponse.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_une_video_envoyee_s_affiche_sur_l_accueil_avec_sa_piece(self):
        self.client.force_authenticate(self.gerante)
        reponse = self.client.post(
            self.url,
            {"titre": "Chaussures", "fichier": self._video(), "produit": self.produit.pk},
            format="multipart",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertTrue(reponse.data["url"].endswith(".mp4"))

        self.client.force_authenticate(None)
        accueil = self.client.get(reverse("video-accueil-list")).data
        self.assertEqual(len(accueil), 1)
        self.assertEqual(accueil[0]["produit"]["slug"], "robe-video")

    def test_une_video_retiree_de_l_accueil_n_y_parait_plus(self):
        self.client.force_authenticate(self.gerante)
        video = self.client.post(
            self.url, {"titre": "x", "fichier": self._video()}, format="multipart"
        ).data
        self.client.patch(reverse("video-gestion-detail", args=[video["id"]]),
                          {"sur_accueil": False}, format="json")
        self.assertEqual(self.client.get(reverse("video-accueil-list")).data, [])

    def test_un_autre_format_est_refuse(self):
        self.client.force_authenticate(self.gerante)
        reponse = self.client.post(
            self.url,
            {"titre": "x", "fichier": self._video("photo.jpg", b"x", "image/jpeg")},
            format="multipart",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fichier", reponse.data)

    def test_la_piece_depubliee_ne_s_annonce_pas(self):
        self.client.force_authenticate(self.gerante)
        self.client.post(
            self.url,
            {"titre": "x", "fichier": self._video(), "produit": self.produit.pk},
            format="multipart",
        )
        self.produit.statut = "brouillon"
        self.produit.save()
        accueil = self.client.get(reverse("video-accueil-list")).data
        self.assertIsNone(accueil[0]["produit"])

    def test_la_video_se_lit_par_morceaux(self):
        """Safari n'accepte une vidéo que si le serveur répond aux demandes partielles."""
        from django.test import override_settings

        self.client.force_authenticate(self.gerante)
        video = self.client.post(
            self.url,
            {"titre": "x", "fichier": self._video(contenu=b"0123456789")},
            format="multipart",
        ).data
        chemin = "/" + video["url"].split("/", 3)[3]
        with override_settings(MEDIA_ROOT=self.dossier):
            reponse = self.client.get(chemin, HTTP_RANGE="bytes=2-5")
        self.assertEqual(reponse.status_code, 206)
        self.assertEqual(b"".join(reponse.streaming_content), b"2345")
        self.assertEqual(reponse["Content-Range"], "bytes 2-5/10")

