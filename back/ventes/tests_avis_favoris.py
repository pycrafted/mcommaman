"""
Favoris et avis.

Le droit d'écrire un avis se prouve, il ne se déclare pas : il faut une commande
livrée, la sienne, qui contienne l'article noté.
"""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from catalogue.models import Produit
from clientele.models import Favori

from .models import Avis, Commande
from .tests import commande_type, fabriquer_variante

Utilisateur = get_user_model()


class AvisTest(APITestCase):
    def setUp(self):
        self.variante = fabriquer_variante(stock=10)
        self.cliente = Utilisateur.objects.create_user(
            email="avis@test.sn", nom="Aminata", password="motdepasse123"
        )
        self.autre = Utilisateur.objects.create_user(
            email="autre@test.sn", nom="Autre", password="motdepasse123"
        )
        self.client.force_authenticate(self.cliente)
        creation = self.client.post(
            reverse("commande-list"), commande_type(self.variante), format="json"
        )
        self.commande = Commande.objects.get(reference=creation.data["reference"])

    def _livrer(self):
        self.commande.statut = Commande.Statut.LIVREE
        self.commande.save()

    def test_on_ne_note_pas_avant_la_livraison(self):
        reponse = self.client.post(reverse("avis-list"), {
            "note": 5, "commentaire": "Très joli", "produit": self.variante.produit.pk,
            "commande": self.commande.pk,
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_on_note_apres_la_livraison(self):
        self._livrer()
        reponse = self.client.post(reverse("avis-list"), {
            "note": 5, "commentaire": "Livré le lendemain, la taille correspond bien.",
            "produit": self.variante.produit.pk, "commande": self.commande.pk,
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        # Il attend la modération : il ne paraît pas encore.
        self.assertEqual(reponse.data["etat"], "en_attente")

    def test_on_ne_note_pas_la_commande_d_une_autre(self):
        self._livrer()
        self.client.force_authenticate(self.autre)
        reponse = self.client.post(reverse("avis-list"), {
            "note": 5, "commentaire": "Je n'ai rien acheté ici",
            "produit": self.variante.produit.pk, "commande": self.commande.pk,
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_on_ne_note_pas_un_article_absent_de_la_commande(self):
        self._livrer()
        autre_produit = fabriquer_variante(slug="pull", sku="PUL-009").produit
        reponse = self.client.post(reverse("avis-list"), {
            "note": 5, "commentaire": "Jamais acheté celui-là", "produit": autre_produit.pk,
            "commande": self.commande.pk,
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_un_seul_avis_par_achat(self):
        self._livrer()
        donnees = {"note": 5, "commentaire": "Parfait, rien à redire du tout.",
                   "produit": self.variante.produit.pk, "commande": self.commande.pk}
        self.client.post(reverse("avis-list"), donnees, format="json")
        second = self.client.post(reverse("avis-list"), donnees, format="json")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_un_avis_en_attente_reste_invisible(self):
        self._livrer()
        self.client.post(reverse("avis-list"), {
            "note": 5, "commentaire": "En attente de relecture ici même.",
            "produit": self.variante.produit.pk, "commande": self.commande.pk,
        }, format="json")
        self.client.force_authenticate(None)
        publics = self.client.get(reverse("avis-list"), {"produit": self.variante.produit.pk})
        self.assertEqual(len(publics.data["results"]), 0)

    def test_l_autrice_retrouve_son_avis_en_attente(self):
        """
        Un avis déposé ne doit pas disparaître sous les yeux de qui l'écrit.

        Il reste invisible des autres — c'est le test précédent —, mais son
        autrice doit le revoir : c'est aussi le seul moyen de comprendre
        pourquoi elle ne peut pas en écrire un second sur le même achat.
        """
        self._livrer()
        self.client.post(reverse("avis-list"), {
            "note": 5, "commentaire": "Déposé, pas encore relu.",
            "produit": self.variante.produit.pk, "commande": self.commande.pk,
        }, format="json")

        sien = self.client.get(reverse("avis-list"), {"produit": self.variante.produit.pk})
        self.assertEqual(len(sien.data["results"]), 1)
        self.assertEqual(sien.data["results"][0]["etat"], "en_attente")

        # Une autre cliente, elle, ne le voit toujours pas.
        self.client.force_authenticate(self.autre)
        ailleurs = self.client.get(reverse("avis-list"), {"produit": self.variante.produit.pk})
        self.assertEqual(len(ailleurs.data["results"]), 0)

    def test_la_liste_a_noter_donne_de_quoi_deposer_l_avis(self):
        """L'identifiant de commande, pas seulement sa référence : c'est lui qu'il faut renvoyer."""
        self._livrer()
        attendus = self.client.get(reverse("avis-a-noter")).data
        entree = next(a for a in attendus if a["produit"] == self.variante.produit.pk)
        self.assertEqual(entree["commande"], self.commande.pk)
        self.assertEqual(entree["commande_reference"], self.commande.reference)

        depot = self.client.post(reverse("avis-list"), {
            "note": 4, "commentaire": "Envoyé avec ce que la liste a donné.",
            "produit": entree["produit"], "commande": entree["commande"],
        }, format="json")
        self.assertEqual(depot.status_code, status.HTTP_201_CREATED)

    def test_le_resume_ne_compte_que_les_avis_publies(self):
        self._livrer()
        avis = Avis.objects.create(
            auteur=self.cliente, commande=self.commande, produit=self.variante.produit,
            note=4, commentaire="Bien", etat=Avis.Etat.PUBLIE,
        )
        reponse = self.client.get(reverse("avis-resume"), {"produit": self.variante.produit.pk})
        self.assertEqual(reponse.data["nombre"], 1)
        self.assertEqual(reponse.data["moyenne"], 4.0)
        self.assertEqual(reponse.data["repartition"]["4"], 1)

        avis.etat = Avis.Etat.EN_ATTENTE
        avis.save()
        apres = self.client.get(reverse("avis-resume"), {"produit": self.variante.produit.pk})
        self.assertEqual(apres.data["nombre"], 0)

    def test_la_liste_a_noter_montre_ce_qui_reste(self):
        self._livrer()
        attendus = self.client.get(reverse("avis-a-noter")).data
        cibles = {a["produit"] for a in attendus}
        # L'article acheté, et la boutique elle-même.
        self.assertIn(self.variante.produit.pk, cibles)
        self.assertIn(None, cibles)

        self.client.post(reverse("avis-list"), {
            "note": 5, "commentaire": "Un commentaire assez long pour passer.",
            "produit": self.variante.produit.pk, "commande": self.commande.pk,
        }, format="json")
        apres = self.client.get(reverse("avis-a-noter")).data
        self.assertNotIn(self.variante.produit.pk, {a["produit"] for a in apres})

    def test_la_moderation_fait_paraitre_l_avis(self):
        self._livrer()
        creation = self.client.post(reverse("avis-list"), {
            "note": 5, "commentaire": "Un avis qui attend sa relecture ici.",
            "produit": self.variante.produit.pk, "commande": self.commande.pk,
        }, format="json")
        gerante = Utilisateur.objects.create_user(
            email="mod@test.sn", nom="Modératrice", password="motdepasse123",
            role=Utilisateur.Role.GERANTE,
        )
        self.client.force_authenticate(gerante)
        self.client.post(reverse("avis-gestion-publier", args=[creation.data["id"]]))

        self.client.force_authenticate(None)
        publics = self.client.get(reverse("avis-list"), {"produit": self.variante.produit.pk})
        self.assertEqual(len(publics.data["results"]), 1)

    def test_une_cliente_ne_modere_pas(self):
        self.client.force_authenticate(self.cliente)
        reponse = self.client.get(reverse("avis-gestion-list"))
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)


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
