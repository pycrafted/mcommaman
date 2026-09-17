"""
Ce que les commandes doivent garantir.

Toutes ces règles vivaient dans le navigateur : elles y étaient contournables.
Chaque test décrit ce qu'un navigateur ne peut désormais plus obtenir.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from catalogue.models import Coloris, Media, MouvementStock, PhotoProduit, Produit, Rayon, Taille, Variante
from vitrine.models import Reglages

from .models import Campagne, Commande

Utilisateur = get_user_model()


def fabriquer_variante(prix=10000, stock=5, slug="robe", sku="RBE-001"):
    rayon = Rayon.objects.get_or_create(nom="Robes & jupes", defaults={"slug": "robes-jupes"})[0]
    produit = Produit.objects.create(
        nom="Robe de fête écrue", slug=slug, sku=sku, prix=prix,
        description="Robe sans manches en satin écru, jupe en plumetis, doublure intégrale.",
        rayon=rayon, statut=Produit.Statut.PUBLIE,
    )
    media = Media.objects.get_or_create(url=f"https://exemple.test/{slug}.jpg",
                                        defaults={"nom": "Robe"})[0]
    PhotoProduit.objects.create(produit=produit, media=media, position=0)
    taille = Taille.objects.get_or_create(valeur="4", defaults={"repere": "4 ans", "ordre": 6})[0]
    coloris = Coloris.objects.get_or_create(nom="Écru", defaults={"hexa": "#efe6da"})[0]
    return Variante.objects.create(produit=produit, taille=taille, coloris=coloris,
                                   sku=f"{sku}-4", stock=stock)


def commande_type(variante, quantite=1, **surcharges):
    donnees = {
        "lignes": [{"variante": variante.pk, "quantite": quantite}],
        "nom_client": "Aminata Fall",
        "telephone": "+221 77 123 45 67",
        "email": "aminata@example.sn",
        "zone": "dakar",
        "ville": "Dakar",
        "adresse": "12 rue 10, Sacré-Cœur",
        "moyen_paiement": "cod",
    }
    donnees.update(surcharges)
    return donnees


class TarificationTest(APITestCase):
    def setUp(self):
        self.variante = fabriquer_variante(prix=10000, stock=5)

    def test_le_prix_vient_de_la_base_pas_du_navigateur(self):
        """Envoyer un total fantaisiste ne change rien : il n'est même pas lu."""
        donnees = commande_type(self.variante, quantite=2)
        donnees["total"] = 1
        donnees["sous_total"] = 1
        reponse = self.client.post(reverse("commande-list"), donnees, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reponse.data["sous_total"], 20000)
        self.assertEqual(reponse.data["total"], 22000)  # 20 000 + 2 000 de livraison

    def test_la_livraison_est_offerte_au_dessus_du_franco_sur_dakar(self):
        cher = fabriquer_variante(prix=30000, stock=3, slug="cher", sku="CHE-001")
        reponse = self.client.post(reverse("commande-list"), commande_type(cher), format="json")
        self.assertEqual(reponse.data["frais_livraison"], 0)

    def test_la_livraison_n_est_jamais_offerte_hors_de_dakar(self):
        cher = fabriquer_variante(prix=30000, stock=3, slug="cher2", sku="CHE-002")
        reponse = self.client.post(
            reverse("commande-list"),
            commande_type(cher, zone="regions", ville="Saint-Louis", moyen_paiement="wave"),
            format="json",
        )
        self.assertEqual(reponse.data["frais_livraison"], 3500)

    def test_le_devis_chiffre_sans_rien_enregistrer(self):
        reponse = self.client.post(reverse("devis"), {
            "lignes": [{"variante": self.variante.pk, "quantite": 2}], "zone": "dakar",
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data["total"], 22000)
        self.assertEqual(Commande.objects.count(), 0)


class StockCommandeTest(APITestCase):
    def setUp(self):
        self.variante = fabriquer_variante(prix=10000, stock=3)

    def test_la_commande_decremente_le_stock_et_laisse_une_trace(self):
        self.client.post(reverse("commande-list"), commande_type(self.variante, quantite=2),
                         format="json")
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 1)
        mouvement = MouvementStock.objects.get(variante=self.variante)
        self.assertEqual(mouvement.quantite, -2)
        self.assertEqual(mouvement.motif, MouvementStock.Motif.VENTE)

    def test_on_ne_commande_pas_plus_que_le_stock(self):
        reponse = self.client.post(reverse("commande-list"),
                                   commande_type(self.variante, quantite=9), format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("il n'en reste que 3", reponse.data["detail"])
        # Rien n'a été écrit : la transaction a tout annulé.
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 3)
        self.assertEqual(Commande.objects.count(), 0)

    def test_un_brouillon_ne_se_commande_pas(self):
        self.variante.produit.statut = Produit.Statut.BROUILLON
        self.variante.produit.save()
        reponse = self.client.post(reverse("commande-list"), commande_type(self.variante),
                                   format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_un_article_repete_est_refuse(self):
        """Sinon le stock serait vérifié ligne par ligne et deux fois dépassé."""
        donnees = commande_type(self.variante)
        donnees["lignes"].append({"variante": self.variante.pk, "quantite": 3})
        reponse = self.client.post(reverse("commande-list"), donnees, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


class RemiseDeCommandeTest(APITestCase):
    """Pas de code à saisir : une campagne de commande s'applique d'elle-même."""

    def setUp(self):
        self.variante = fabriquer_variante(prix=10000, stock=10)

    def _campagne(self, **kwargs):
        defauts = {
            "libelle": "Bienvenue", "type": Campagne.Type.MONTANT, "valeur": 2000,
            "date_effet": timezone.localdate(), "duree_jours": 90,
            "portee": Campagne.Portee.COMMANDE, "condition": Campagne.Condition.PREMIERE,
            "active": True,
        }
        return Campagne.objects.create(**{**defauts, **kwargs})

    def test_un_code_envoye_n_est_meme_pas_lu(self):
        reponse = self.client.post(reverse("commande-list"),
                                   commande_type(self.variante, code_promo="RENTREE15"),
                                   format="json")
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reponse.data["remise"], 0)

    def test_le_montant_minimum_declenche_la_remise(self):
        self._campagne(condition=Campagne.Condition.MONTANT_MINIMUM, montant_minimum=15000,
                       type=Campagne.Type.POURCENTAGE, valeur=10)
        petite = self.client.post(reverse("commande-list"),
                                  commande_type(self.variante, quantite=1), format="json")
        self.assertEqual(petite.data["remise"], 0)
        grande = self.client.post(reverse("commande-list"),
                                  commande_type(self.variante, quantite=2), format="json")
        self.assertEqual(grande.data["remise"], 2000)
        # Livraison Dakar payante sous le franco : 2 000 F.
        self.assertEqual(grande.data["total"], 20000 + 2000 - 2000)

    def test_la_premiere_commande_exige_un_compte(self):
        self._campagne()
        anonyme = self.client.post(reverse("commande-list"),
                                   commande_type(self.variante), format="json")
        self.assertEqual(anonyme.status_code, status.HTTP_201_CREATED)
        self.assertEqual(anonyme.data["remise"], 0)

    def test_la_remise_de_premiere_commande_ne_sert_qu_une_fois(self):
        self._campagne()
        cliente = Utilisateur.objects.create_user(
            email="fidele@test.sn", nom="Fidèle", password="motdepasse123"
        )
        self.client.force_authenticate(cliente)
        premiere = self.client.post(reverse("commande-list"),
                                    commande_type(self.variante), format="json")
        self.assertEqual(premiere.status_code, status.HTTP_201_CREATED)
        self.assertEqual(premiere.data["remise"], 2000)

        seconde = self.client.post(reverse("commande-list"),
                                   commande_type(self.variante), format="json")
        self.assertEqual(seconde.status_code, status.HTTP_201_CREATED)
        self.assertEqual(seconde.data["remise"], 0)

    def test_une_campagne_expiree_ne_remise_rien(self):
        self._campagne(condition=Campagne.Condition.MONTANT_MINIMUM, montant_minimum=0,
                       date_effet=timezone.localdate() - timedelta(days=60), duree_jours=10)
        reponse = self.client.post(reverse("commande-list"),
                                   commande_type(self.variante), format="json")
        self.assertEqual(reponse.data["remise"], 0)

    def test_le_devis_nomme_la_campagne(self):
        self._campagne(libelle="Panier généreux", condition=Campagne.Condition.MONTANT_MINIMUM,
                       montant_minimum=0)
        reponse = self.client.post(
            reverse("devis"),
            {"lignes": [{"variante": self.variante.pk, "quantite": 1}], "zone": "dakar"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data["remise"], 2000)
        self.assertEqual(reponse.data["remise_libelle"], "Panier généreux")


class PaiementLivraisonTest(APITestCase):
    def test_le_paiement_a_la_livraison_est_refuse_hors_de_dakar(self):
        variante = fabriquer_variante()
        reponse = self.client.post(
            reverse("commande-list"),
            commande_type(variante, zone="regions", ville="Thiès", moyen_paiement="cod"),
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


class SuiviTest(APITestCase):
    def setUp(self):
        self.variante = fabriquer_variante(stock=10)
        self.cliente = Utilisateur.objects.create_user(
            email="suivi@test.sn", nom="Suivi", password="motdepasse123"
        )

    def test_une_commande_sans_compte_se_suit_avec_la_reference_et_le_telephone(self):
        creation = self.client.post(reverse("commande-list"), commande_type(self.variante),
                                    format="json")
        reference = creation.data["reference"]

        sans_rien = self.client.get(reverse("commande-detail", args=[reference]))
        self.assertEqual(sans_rien.status_code, status.HTTP_403_FORBIDDEN)

        avec = self.client.get(reverse("commande-detail", args=[reference]),
                               {"telephone": "+221771234567"})
        self.assertEqual(avec.status_code, status.HTTP_200_OK)

    def test_on_ne_voit_pas_les_commandes_des_autres(self):
        self.client.post(reverse("commande-list"), commande_type(self.variante), format="json")
        self.client.force_authenticate(self.cliente)
        liste = self.client.get(reverse("commande-list"))
        self.assertEqual(len(liste.data["results"]), 0)

    def test_la_cliente_voit_un_statut_simplifie(self):
        self.client.force_authenticate(self.cliente)
        creation = self.client.post(reverse("commande-list"), commande_type(self.variante),
                                    format="json")
        # « en attente » côté gestion se lit « Commande reçue » côté cliente.
        self.assertEqual(creation.data["statut"], "en_attente")
        self.assertEqual(creation.data["statut_cliente"], "Commande reçue")


class CampagnesAnnonceesTest(APITestCase):
    """
    Ce que la boutique a le droit d'annoncer.

    Le bandeau d'accueil et son compte à rebours lisent cette route. Une
    campagne finie ou éteinte doit en disparaître : la vitrine ne fait pas
    semblant d'avoir une offre.
    """

    def setUp(self):
        aujourdhui = timezone.localdate()
        self.courante = Campagne.objects.create(
            libelle="Rentrée des classes", valeur=15,
            date_effet=aujourdhui - timedelta(days=1), duree_jours=10,
        )
        Campagne.objects.create(
            libelle="Campagne finie", valeur=10,
            date_effet=aujourdhui - timedelta(days=40), duree_jours=5,
        )
        Campagne.objects.create(
            libelle="Campagne éteinte", valeur=10,
            date_effet=aujourdhui, duree_jours=10, active=False,
        )

    def test_seules_les_campagnes_en_cours_sont_annoncees(self):
        reponse = self.client.get(reverse("campagne-publique-list"))
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        libelles = [c["libelle"] for c in reponse.data]
        self.assertEqual(libelles, ["Rentrée des classes"])

    def test_l_annonce_ne_dit_rien_de_la_note_interne(self):
        self.courante.note = "Marge serrée, ne pas prolonger."
        self.courante.save()
        annonce = self.client.get(reverse("campagne-publique-list")).data[0]
        self.assertNotIn("note", annonce)
        self.assertNotIn("code", annonce)
        self.assertEqual(annonce["valeur"], 15)


class AnnulationParLaClienteTest(APITestCase):
    """
    Se raviser tant que rien n'est préparé.

    Cette annulation vivait dans le navigateur : elle n'y changeait que
    l'affichage, la boutique continuait de préparer le colis et le stock restait
    retiré. Ici elle est opposable, et le stock revient.
    """

    def setUp(self):
        self.variante = fabriquer_variante(stock=10)
        self.cliente = Utilisateur.objects.create_user(
            email="annule@test.sn", nom="Aminata", password="motdepasse123"
        )

    def _commander(self, connectee=True):
        if connectee:
            self.client.force_authenticate(self.cliente)
        creation = self.client.post(
            reverse("commande-list"), commande_type(self.variante, quantite=2), format="json"
        )
        return creation.data["reference"]

    def test_annuler_avant_preparation_remet_le_stock(self):
        reference = self._commander()
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 8)

        reponse = self.client.post(reverse("commande-annuler", args=[reference]))
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data["statut"], "annulee")
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 10)

    def test_une_commande_en_preparation_ne_s_annule_plus_toute_seule(self):
        reference = self._commander()
        commande = Commande.objects.get(reference=reference)
        commande.statut = Commande.Statut.PREPARATION
        commande.save()

        reponse = self.client.post(reverse("commande-annuler", args=[reference]))
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 8)

    def test_on_n_annule_pas_la_commande_d_une_autre(self):
        reference = self._commander()
        autre = Utilisateur.objects.create_user(
            email="autre@test.sn", nom="Autre", password="motdepasse123"
        )
        self.client.force_authenticate(autre)
        reponse = self.client.post(reverse("commande-annuler", args=[reference]))
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Commande.objects.get(reference=reference).statut, "en_attente")

    def test_sans_compte_l_annulation_demande_le_telephone(self):
        reference = self._commander(connectee=False)

        sans_rien = self.client.post(reverse("commande-annuler", args=[reference]))
        self.assertEqual(sans_rien.status_code, status.HTTP_403_FORBIDDEN)

        avec = self.client.post(
            reverse("commande-annuler", args=[reference]),
            {"telephone": "+221771234567"}, format="json",
        )
        self.assertEqual(avec.status_code, status.HTTP_200_OK)


class GestionCommandeTest(APITestCase):
    def setUp(self):
        self.variante = fabriquer_variante(stock=10)
        self.gerante = Utilisateur.objects.create_user(
            email="g@test.sn", nom="Gérante", password="motdepasse123",
            role=Utilisateur.Role.GERANTE,
        )
        creation = self.client.post(reverse("commande-list"),
                                    commande_type(self.variante, quantite=2), format="json")
        self.reference = creation.data["reference"]

    def test_une_cliente_n_accede_pas_aux_commandes_de_la_boutique(self):
        cliente = Utilisateur.objects.create_user(
            email="c@test.sn", nom="C", password="motdepasse123"
        )
        self.client.force_authenticate(cliente)
        reponse = self.client.get(reverse("commande-gestion-list"))
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_le_statut_avance_pas_a_pas(self):
        self.client.force_authenticate(self.gerante)
        for attendu in ["preparation", "expediee", "livree"]:
            reponse = self.client.post(reverse("commande-gestion-avancer", args=[self.reference]))
            self.assertEqual(reponse.data["statut"], attendu)
        # Arrivée au bout, elle ne bouge plus.
        fin = self.client.post(reverse("commande-gestion-avancer", args=[self.reference]))
        self.assertEqual(fin.status_code, status.HTTP_400_BAD_REQUEST)

    def test_annuler_remet_le_stock(self):
        self.client.force_authenticate(self.gerante)
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 8)

        self.client.post(reverse("commande-gestion-annuler", args=[self.reference]))
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 10)
        self.assertEqual(Commande.objects.get(reference=self.reference).statut, "annulee")

    def test_retablir_reprend_le_stock(self):
        self.client.force_authenticate(self.gerante)
        self.client.post(reverse("commande-gestion-annuler", args=[self.reference]))
        reponse = self.client.post(reverse("commande-gestion-retablir", args=[self.reference]))
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data["statut"], "en_attente")
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 8)

    def test_retablir_est_refuse_sans_stock(self):
        self.client.force_authenticate(self.gerante)
        self.client.post(reverse("commande-gestion-annuler", args=[self.reference]))
        # Entre-temps, le stock remis est reparti ailleurs.
        self.variante.refresh_from_db()
        self.variante.stock = 1
        self.variante.save()
        reponse = self.client.post(reverse("commande-gestion-retablir", args=[self.reference]))
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("1 en stock pour 2", reponse.data["detail"])
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 1)
        self.assertEqual(Commande.objects.get(reference=self.reference).statut, "annulee")

    def test_seule_une_commande_annulee_se_retablit(self):
        self.client.force_authenticate(self.gerante)
        reponse = self.client.post(reverse("commande-gestion-retablir", args=[self.reference]))
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_une_commande_livree_ne_s_annule_pas(self):
        self.client.force_authenticate(self.gerante)
        for _ in range(4):
            self.client.post(reverse("commande-gestion-avancer", args=[self.reference]))
        reponse = self.client.post(reverse("commande-gestion-annuler", args=[self.reference]))
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


class ReglagesFraisTest(APITestCase):
    def test_le_changement_de_franco_s_applique_aussitot(self):
        """Les frais viennent des réglages, pas d'une constante du code."""
        variante = fabriquer_variante(prix=26000, stock=5, slug="pull", sku="PUL-001")
        reglages = Reglages.actuels()
        reglages.franco_dakar = 50000
        reglages.save()

        reponse = self.client.post(reverse("commande-list"), commande_type(variante), format="json")
        self.assertEqual(reponse.data["frais_livraison"], 2000)


class NotificationsGestionTest(APITestCase):
    """La cloche du back-office signale les commandes arrivées depuis sa dernière lecture."""

    def setUp(self):
        self.variante = fabriquer_variante(prix=10000, stock=10)
        self.gerante = Utilisateur.objects.create_user(
            email="gerante@test.sn", nom="Gérante", password="motdepasse123",
            role=Utilisateur.Role.GERANTE,
        )
        self.url = reverse("notifications-gestion")

    def _commander(self):
        self.client.force_authenticate(None)
        reponse = self.client.post(reverse("commande-list"), commande_type(self.variante),
                                   format="json")
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        return reponse.data["reference"]

    def test_la_cloche_est_reservee_a_l_equipe(self):
        self.assertIn(self.client.get(self.url).status_code,
                      (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        cliente = Utilisateur.objects.create_user(
            email="cliente@test.sn", nom="Cliente", password="motdepasse123"
        )
        self.client.force_authenticate(cliente)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_une_commande_arrivee_est_non_lue_puis_lue(self):
        reference = self._commander()
        self.client.force_authenticate(self.gerante)

        avant = self.client.get(self.url).data
        self.assertEqual(avant["non_lues"], 1)
        self.assertEqual(avant["notifications"][0]["reference"], reference)
        self.assertFalse(avant["notifications"][0]["lue"])

        apres = self.client.post(self.url).data
        self.assertEqual(apres["non_lues"], 0)
        self.assertTrue(apres["notifications"][0]["lue"])

    def test_seules_les_commandes_posterieures_a_la_lecture_comptent(self):
        self._commander()
        self.client.force_authenticate(self.gerante)
        self.client.post(self.url)

        nouvelle = self._commander()
        self.client.force_authenticate(self.gerante)
        donnees = self.client.get(self.url).data
        self.assertEqual(donnees["non_lues"], 1)
        self.assertEqual(donnees["notifications"][0]["reference"], nouvelle)
        self.assertTrue(donnees["notifications"][1]["lue"])


class SaisieParLEquipeTest(APITestCase):
    """Une vente conclue sur WhatsApp ou à la boutique, saisie dans le back-office."""

    def setUp(self):
        from catalogue.models import MouvementStock

        self.MouvementStock = MouvementStock
        self.variante = fabriquer_variante(prix=10000, stock=5)
        self.gerante = Utilisateur.objects.create_user(
            email="saisie@test.sn", nom="Gérante", password="motdepasse123",
            role=Utilisateur.Role.GERANTE,
        )
        self.url = reverse("commande-gestion-list")

    def _vente(self, **surcharges):
        donnees = {
            "lignes": [{"variante": self.variante.pk, "quantite": 2}],
            "nom_client": "Awa Ndiaye",
            "telephone": "77 555 44 33",
            "zone": "dakar",
            "ville": "Mermoz",
            "adresse": "Face pharmacie",
            "moyen_paiement": "wave",
        }
        donnees.update(surcharges)
        return donnees

    def test_la_saisie_est_reservee_a_l_equipe(self):
        reponse = self.client.post(self.url, self._vente(), format="json")
        self.assertIn(reponse.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_la_vente_retire_le_stock_et_laisse_une_trace(self):
        self.client.force_authenticate(self.gerante)
        reponse = self.client.post(self.url, self._vente(), format="json")
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertTrue(reponse.data["reference"].startswith("MCM-"))
        self.assertEqual(reponse.data["total"], 20000 + 2000)
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 3)
        mouvement = self.MouvementStock.objects.get(reference=reponse.data["reference"])
        self.assertEqual((mouvement.quantite, mouvement.motif, mouvement.auteur), (-2, "vente", self.gerante))

    def test_on_ne_vend_pas_plus_que_le_stock(self):
        self.client.force_authenticate(self.gerante)
        reponse = self.client.post(
            self.url, self._vente(lignes=[{"variante": self.variante.pk, "quantite": 6}]), format="json"
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 5)

    def test_l_annulation_remet_le_stock(self):
        self.client.force_authenticate(self.gerante)
        reference = self.client.post(self.url, self._vente(), format="json").data["reference"]
        self.client.post(reverse("commande-gestion-annuler", args=[reference]))
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 5)

    def test_le_retrait_en_boutique_se_paie_en_especes_sans_frais_ni_adresse(self):
        self.client.force_authenticate(self.gerante)
        reponse = self.client.post(
            self.url,
            self._vente(zone="retrait", ville="", adresse="", moyen_paiement="esp"),
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reponse.data["frais_livraison"], 0)
        self.assertEqual(reponse.data["total"], 20000)

    def test_les_especes_ne_se_choisissent_pas_en_ligne(self):
        reponse = self.client.post(
            reverse("commande-list"),
            commande_type(self.variante, moyen_paiement="esp"),
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_la_remise_accordee_et_le_rattachement_au_compte(self):
        cliente = Utilisateur.objects.create_user(
            email="awa@test.sn", nom="Awa Ndiaye", password="motdepasse123",
            telephone="+221 77 555 44 33",
        )
        self.client.force_authenticate(self.gerante)
        devis = self.client.post(
            reverse("commande-gestion-devis"),
            {"lignes": [{"variante": self.variante.pk, "quantite": 2}], "zone": "dakar",
             "telephone": "775554433", "remise": 1500},
            format="json",
        ).data
        self.assertEqual((devis["remise"], devis["total"]), (1500, 20500))
        self.assertEqual(devis["cliente_nom"], "Awa Ndiaye")

        reponse = self.client.post(self.url, self._vente(remise=1500), format="json")
        self.assertEqual(reponse.data["cliente"], cliente.pk)
        self.assertEqual(reponse.data["total"], 20500)

    def test_une_livraison_demande_une_adresse(self):
        self.client.force_authenticate(self.gerante)
        reponse = self.client.post(self.url, self._vente(ville="", adresse=""), format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("adresse", reponse.data)

