"""
Ce que les comptes et les sessions doivent garantir.

Les tests portent sur les règles, pas sur le code : chacun décrit un
comportement qu'on ne veut pas perdre, indépendamment de la façon dont il est
écrit aujourd'hui.

    python manage.py test
"""

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.db.utils import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Adresse

Utilisateur = get_user_model()


class ModeleUtilisateurTest(TestCase):
    def test_l_adresse_electronique_est_normalisee(self):
        """Deux graphies de la même adresse ne font qu'un seul compte."""
        utilisateur = Utilisateur.objects.create_user(
            email="Fatou.NDIAYE@Example.SN", nom="Fatou Ndiaye", password="motdepasse123"
        )
        self.assertEqual(utilisateur.email, "fatou.ndiaye@example.sn")

    def test_le_mot_de_passe_n_est_jamais_stocke_en_clair(self):
        utilisateur = Utilisateur.objects.create_user(
            email="a@example.sn", nom="A", password="motdepasse123"
        )
        self.assertNotEqual(utilisateur.password, "motdepasse123")
        self.assertTrue(utilisateur.check_password("motdepasse123"))

    def test_une_cliente_n_est_pas_de_l_equipe(self):
        cliente = Utilisateur.objects.create_user(
            email="c@example.sn", nom="C", password="motdepasse123"
        )
        gerante = Utilisateur.objects.create_superuser(
            email="g@example.sn", nom="G", password="motdepasse123"
        )
        self.assertFalse(cliente.est_equipe)
        self.assertTrue(gerante.est_equipe)

    def test_une_seule_adresse_par_defaut(self):
        """La base refuse la deuxième, sans qu'on ait à y penser dans le code."""
        cliente = Utilisateur.objects.create_user(
            email="d@example.sn", nom="D", password="motdepasse123"
        )
        Adresse.objects.create(
            cliente=cliente, libelle="Maison", ville="Dakar", adresse="rue 1", par_defaut=True
        )
        with self.assertRaises(IntegrityError):
            Adresse.objects.create(
                cliente=cliente, libelle="Bureau", ville="Dakar", adresse="rue 2", par_defaut=True
            )


class InscriptionTest(APITestCase):
    def test_l_inscription_ouvre_la_session(self):
        reponse = self.client.post(reverse("inscription"), {
            "email": "nouvelle@example.sn", "nom": "Nouvelle Cliente",
            "telephone": "+221 77 000 00 00", "ville": "Dakar",
            "mot_de_passe": "motdepasse123",
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        # La session est ouverte dans la foulée : pas de connexion à refaire.
        suite = self.client.get(reverse("moi"))
        self.assertEqual(suite.data["utilisateur"]["email"], "nouvelle@example.sn")

    def test_l_inscription_ne_renvoie_jamais_le_mot_de_passe(self):
        reponse = self.client.post(reverse("inscription"), {
            "email": "b@example.sn", "nom": "B", "mot_de_passe": "motdepasse123",
        }, format="json")
        self.assertNotIn("mot_de_passe", reponse.data)
        self.assertNotIn("password", reponse.data)

    def test_une_adresse_deja_prise_est_refusee(self):
        Utilisateur.objects.create_user(email="prise@example.sn", nom="P", password="motdepasse123")
        reponse = self.client.post(reverse("inscription"), {
            "email": "PRISE@example.sn", "nom": "Autre", "mot_de_passe": "motdepasse123",
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_un_mot_de_passe_trop_faible_est_refuse(self):
        reponse = self.client.post(reverse("inscription"), {
            "email": "faible@example.sn", "nom": "Faible", "mot_de_passe": "1234",
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_on_ne_peut_pas_se_declarer_gerante(self):
        """Le rôle n'est pas dans le formulaire : l'envoyer ne change rien."""
        self.client.post(reverse("inscription"), {
            "email": "maligne@example.sn", "nom": "Maligne",
            "mot_de_passe": "motdepasse123", "role": "gerante",
        }, format="json")
        utilisateur = Utilisateur.objects.get(email="maligne@example.sn")
        self.assertEqual(utilisateur.role, Utilisateur.Role.CLIENTE)


class ConnexionTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.cliente = Utilisateur.objects.create_user(
            email="cliente@example.sn", nom="Cliente", password="motdepasse123"
        )

    def test_connexion_puis_deconnexion(self):
        connexion = self.client.post(reverse("connexion"), {
            "email": "cliente@example.sn", "mot_de_passe": "motdepasse123",
        }, format="json")
        self.assertEqual(connexion.status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse("moi")).data["utilisateur"]["nom"], "Cliente")

        self.client.post(reverse("deconnexion"))
        self.assertIsNone(self.client.get(reverse("moi")).data["utilisateur"])

    def test_le_message_d_erreur_ne_dit_pas_si_l_adresse_existe(self):
        """Sinon on peut vérifier quelles adresses ont un compte."""
        inconnue = self.client.post(reverse("connexion"), {
            "email": "inconnue@example.sn", "mot_de_passe": "motdepasse123",
        }, format="json")
        mauvais = self.client.post(reverse("connexion"), {
            "email": "cliente@example.sn", "mot_de_passe": "faux",
        }, format="json")
        self.assertEqual(inconnue.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mauvais.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(inconnue.data["non_field_errors"][0]),
                         str(mauvais.data["non_field_errors"][0]))

    def test_un_compte_desactive_ne_se_connecte_pas(self):
        """
        Fermé, le compte le dit — mais seulement à qui connaît le mot de passe.

        Avec un mauvais mot de passe, un compte fermé répond comme un compte
        inconnu : sinon on saurait lesquels existent rien qu'en essayant.
        """
        self.cliente.is_active = False
        self.cliente.save()
        bon = self.client.post(reverse("connexion"), {
            "email": "cliente@example.sn", "mot_de_passe": "motdepasse123",
        }, format="json")
        self.assertEqual(bon.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(bon.data["non_field_errors"][0]), "Ce compte est désactivé.")

        faux = self.client.post(reverse("connexion"), {
            "email": "cliente@example.sn", "mot_de_passe": "pas-le-bon",
        }, format="json")
        self.assertEqual(str(faux.data["non_field_errors"][0]), "Adresse ou mot de passe incorrect.")

    def test_moi_repond_sans_erreur_a_un_visiteur_anonyme(self):
        """La vitrine appelle cette route à chaque chargement, connectée ou non."""
        reponse = self.client.get(reverse("moi"))
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertIsNone(reponse.data["utilisateur"])


class ProfilTest(APITestCase):
    def setUp(self):
        self.cliente = Utilisateur.objects.create_user(
            email="profil@example.sn", nom="Profil", password="motdepasse123"
        )
        self.client.force_authenticate(self.cliente)

    def test_modifier_son_profil(self):
        reponse = self.client.patch(reverse("moi"), {
            "nom": "Nouveau Nom", "ville": "Thiès", "tailles_suivies": ["4", "6"],
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.nom, "Nouveau Nom")
        self.assertEqual(self.cliente.ville, "Thiès")
        self.assertEqual(self.cliente.tailles_suivies, ["4", "6"])

    def test_on_ne_peut_pas_s_attribuer_un_role(self):
        self.client.patch(reverse("moi"), {"role": "gerante"}, format="json")
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.role, Utilisateur.Role.CLIENTE)

    def test_changer_de_mot_de_passe_garde_la_session(self):
        reponse = self.client.post(reverse("mot-de-passe"), {
            "actuel": "motdepasse123", "nouveau": "autremotdepasse456",
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password("autremotdepasse456"))
        # Toujours connectée : elle a fait ce qu'on lui demandait, on ne la punit pas.
        self.assertEqual(self.client.get(reverse("moi")).data["utilisateur"]["nom"], "Profil")

    def test_le_mauvais_mot_de_passe_actuel_bloque_le_changement(self):
        reponse = self.client.post(reverse("mot-de-passe"), {
            "actuel": "faux", "nouveau": "autremotdepasse456",
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


class CarnetAdressesTest(APITestCase):
    def setUp(self):
        self.cliente = Utilisateur.objects.create_user(
            email="carnet@example.sn", nom="Carnet", password="motdepasse123"
        )
        self.autre = Utilisateur.objects.create_user(
            email="autre@example.sn", nom="Autre", password="motdepasse123"
        )
        self.client.force_authenticate(self.cliente)

    def test_la_premiere_adresse_devient_la_principale(self):
        reponse = self.client.post(reverse("adresse-list"), {
            "libelle": "Maison", "zone": "dakar", "ville": "Dakar", "adresse": "rue 1",
        }, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertTrue(reponse.data["par_defaut"])

    def test_changer_d_adresse_par_defaut_libere_l_ancienne(self):
        premiere = self.client.post(reverse("adresse-list"), {
            "libelle": "Maison", "ville": "Dakar", "adresse": "rue 1",
        }, format="json").data
        seconde = self.client.post(reverse("adresse-list"), {
            "libelle": "Bureau", "ville": "Dakar", "adresse": "rue 2", "par_defaut": True,
        }, format="json")
        self.assertEqual(seconde.status_code, status.HTTP_201_CREATED)
        self.assertFalse(Adresse.objects.get(pk=premiere["id"]).par_defaut)
        self.assertTrue(Adresse.objects.get(pk=seconde.data["id"]).par_defaut)

    def test_on_ne_voit_que_ses_propres_adresses(self):
        Adresse.objects.create(
            cliente=self.autre, libelle="Chez elle", ville="Mbour", adresse="rue 9"
        )
        reponse = self.client.get(reverse("adresse-list"))
        self.assertEqual(len(reponse.data["results"]), 0)

    def test_on_ne_peut_pas_ouvrir_l_adresse_d_une_autre(self):
        adresse = Adresse.objects.create(
            cliente=self.autre, libelle="Chez elle", ville="Mbour", adresse="rue 9"
        )
        reponse = self.client.get(reverse("adresse-detail", args=[adresse.pk]))
        self.assertEqual(reponse.status_code, status.HTTP_404_NOT_FOUND)


class MotDePasseOublieTest(APITestCase):
    """
    Le parcours de réinitialisation.

    Deux règles y comptent plus que le reste : le formulaire ne doit rien
    apprendre sur qui a un compte ici, et un lien ne doit servir qu'une fois.
    """

    def setUp(self):
        # Le limiteur compte cinq demandes par heure, et son compteur vit dans le
        # cache : sans ce nettoyage, les derniers tests du fichier seraient
        # refuses par une limite posee par les premiers.
        cache.clear()
        self.cliente = Utilisateur.objects.create_user(
            email="oubli@example.sn", nom="Oubli", password="Ancien!2026xy"
        )

    def _lien(self):
        """Demande un lien et renvoie (uid, jeton) tels qu'ils voyagent."""
        import re

        mail.outbox = []
        self.client.post(reverse("mot-de-passe-oubli"), {"email": self.cliente.email}, format="json")
        adresse = re.search(r"http://\S+", mail.outbox[0].body).group(0)
        parametres = dict(re.findall(r"[?&]([a-z]+)=([^&\s]+)", adresse))
        return parametres["uid"], parametres["jeton"]

    def test_la_reponse_ne_dit_pas_si_le_compte_existe(self):
        """Sinon le formulaire devient un annuaire des adresses inscrites."""
        mail.outbox = []
        connue = self.client.post(
            reverse("mot-de-passe-oubli"), {"email": self.cliente.email}, format="json"
        )
        inconnue = self.client.post(
            reverse("mot-de-passe-oubli"), {"email": "personne@example.sn"}, format="json"
        )
        self.assertEqual(connue.status_code, status.HTTP_200_OK)
        self.assertEqual(inconnue.status_code, status.HTTP_200_OK)
        self.assertEqual(connue.data, inconnue.data)
        # Un seul courriel : celui de l'adresse qui a bien un compte.
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.cliente.email])

    def test_le_lien_permet_de_poser_un_nouveau_mot_de_passe(self):
        uid, jeton = self._lien()
        reponse = self.client.post(
            reverse("mot-de-passe-reinitialiser"),
            {"uid": uid, "jeton": jeton, "nouveau": "Nouveau!2026xy"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password("Nouveau!2026xy"))
        self.assertFalse(self.cliente.check_password("Ancien!2026xy"))

    def test_un_lien_ne_sert_qu_une_fois(self):
        """Le jeton porte l'empreinte du mot de passe : le changer l'invalide."""
        uid, jeton = self._lien()
        self.client.post(
            reverse("mot-de-passe-reinitialiser"),
            {"uid": uid, "jeton": jeton, "nouveau": "Nouveau!2026xy"},
            format="json",
        )
        rejoue = self.client.post(
            reverse("mot-de-passe-reinitialiser"),
            {"uid": uid, "jeton": jeton, "nouveau": "Encore!2026xy"},
            format="json",
        )
        self.assertEqual(rejoue.status_code, status.HTTP_400_BAD_REQUEST)
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password("Nouveau!2026xy"))

    def test_un_jeton_invente_est_refuse(self):
        uid, _ = self._lien()
        reponse = self.client.post(
            reverse("mot-de-passe-reinitialiser"),
            {"uid": uid, "jeton": "pas-le-bon", "nouveau": "Nouveau!2026xy"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password("Ancien!2026xy"))

    def test_le_nouveau_mot_de_passe_reste_soumis_aux_regles(self):
        """Passer par le lien ne dispense pas des validateurs."""
        uid, jeton = self._lien()
        reponse = self.client.post(
            reverse("mot-de-passe-reinitialiser"),
            {"uid": uid, "jeton": jeton, "nouveau": "1234"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nouveau", reponse.data)

    def test_la_reinitialisation_n_ouvre_pas_de_session(self):
        """Rien ne prouve que la personne devant l'écran a reçu le courriel."""
        uid, jeton = self._lien()
        self.client.post(
            reverse("mot-de-passe-reinitialiser"),
            {"uid": uid, "jeton": jeton, "nouveau": "Nouveau!2026xy"},
            format="json",
        )
        moi = self.client.get(reverse("moi"))
        self.assertIsNone(moi.data["utilisateur"])


class PermissionsTest(APITestCase):
    def test_le_carnet_est_ferme_aux_visiteurs(self):
        reponse = self.client.get(reverse("adresse-list"))
        self.assertIn(reponse.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})


class EquipeGestionTest(APITestCase):
    """
    Ce que la page « Utilisateurs » du back-office doit garantir.

    Une gérante en fait entrer une autre : c'est le seul rôle, et ouvrir un
    compte revient à partager le sien. Ce que la route ne doit jamais permettre,
    c'est de se fermer la porte sur soi-même, ni de fabriquer par ce chemin un
    compte qui n'entre pas dans le back-office.
    """

    def setUp(self):
        cache.clear()
        self.gerante = Utilisateur.objects.create_superuser(
            email="gerante@mcm.sn", nom="Mame Fatou", password="motdepasse123"
        )
        self.cliente = Utilisateur.objects.create_user(
            email="cliente@mcm.sn", nom="Awa", password="motdepasse123"
        )
        self.liste = reverse("equipe-gestion-list")
        self.client.force_authenticate(self.gerante)

    def _detail(self, utilisateur):
        return reverse("equipe-gestion-detail", args=[utilisateur.id])

    def test_la_liste_ne_montre_que_l_equipe(self):
        """Une cliente n'est pas une collegue : elle a son propre onglet."""
        reponse = self.client.get(self.liste)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        adresses = {ligne["email"] for ligne in reponse.data["results"]}
        self.assertIn("gerante@mcm.sn", adresses)
        self.assertNotIn("cliente@mcm.sn", adresses)

    def test_un_compte_cree_peut_se_connecter(self):
        """Le but de la page : donner un acces qui fonctionne vraiment."""
        reponse = self.client.post(
            self.liste,
            {
                "email": "  Nouvelle@MCM.SN ",
                "nom": "Nouvelle",
                "mot_de_passe": "Boutique-2026-Dakar",
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        # L'adresse est normalisee, comme partout ailleurs.
        self.assertEqual(reponse.data["email"], "nouvelle@mcm.sn")
        # Le mot de passe entre, il ne ressort pas.
        self.assertNotIn("mot_de_passe", reponse.data)

        membre = Utilisateur.objects.get(email="nouvelle@mcm.sn")
        self.assertTrue(membre.est_equipe)
        # Aucun role n'a ete demande : la route n'en fabrique qu'un.
        self.assertEqual(membre.role, "gerante")
        self.assertTrue(membre.check_password("Boutique-2026-Dakar"))
        # L'admin Django reste ferme : ce back-office suffit a l'equipe.
        self.assertFalse(membre.is_staff)

    def test_un_role_envoye_a_la_main_ne_change_rien(self):
        """
        La route ne fabrique que des gerantes.

        Un « role » glisse dans la requete — par curiosite ou par malice — ne
        doit ni passer, ni faire echouer la creation : il est simplement ignore.
        Sans cela, on ouvrirait par cette porte un compte que la page ne saurait
        plus relire.
        """
        reponse = self.client.post(
            self.liste,
            {"email": "x@mcm.sn", "nom": "X", "role": "cliente", "mot_de_passe": "Boutique-2026-Dakar"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Utilisateur.objects.get(email="x@mcm.sn").role, "gerante")

    def test_un_mot_de_passe_est_obligatoire_a_l_ouverture(self):
        reponse = self.client.post(
            self.liste, {"email": "y@mcm.sn", "nom": "Y", "role": "gerante"}, format="json"
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mot_de_passe", reponse.data)

    def test_un_mot_de_passe_faible_est_refuse(self):
        """Les regles de Django valent aussi pour un acces au back-office."""
        reponse = self.client.post(
            self.liste,
            {"email": "z@mcm.sn", "nom": "Z", "role": "gerante", "mot_de_passe": "1234"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_une_adresse_deja_prise_est_refusee(self):
        reponse = self.client.post(
            self.liste,
            {
                "email": "GERANTE@mcm.sn",
                "nom": "Doublon",
                "role": "gerante",
                "mot_de_passe": "Boutique-2026-Dakar",
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_on_ne_peut_pas_se_desactiver_soi_meme(self):
        """Le geste qui enfermerait dehors, et la boutique avec."""
        reponse = self.client.patch(self._detail(self.gerante), {"is_active": False}, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.gerante.refresh_from_db()
        self.assertTrue(self.gerante.is_active)

    def test_le_role_ne_se_modifie_pas_par_cette_route(self):
        """
        Le back-office n'a qu'un role : rien a promouvoir, rien a retrograder.

        Et surtout, rien qui permette de se retrograder en cliente — ce qui
        reviendrait a se fermer la porte par un autre chemin que `is_active`.
        """
        reponse = self.client.patch(
            self._detail(self.gerante), {"role": "cliente"}, format="json"
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.gerante.refresh_from_db()
        self.assertEqual(self.gerante.role, "gerante")

    def test_corriger_son_propre_nom_reste_permis(self):
        """Les garde-fous portent sur l'acces, pas sur l'etat civil."""
        reponse = self.client.patch(self._detail(self.gerante), {"nom": "Mame F. Diop"}, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

    def test_un_compte_ferme_ne_se_connecte_plus(self):
        collegue = Utilisateur.objects.create_user(
            email="collegue@mcm.sn", nom="Collegue", password="motdepasse123", role="gerante"
        )
        reponse = self.client.patch(self._detail(collegue), {"is_active": False}, format="json")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

        anonyme = APIClient()
        connexion = anonyme.post(
            reverse("connexion"),
            {"email": "collegue@mcm.sn", "mot_de_passe": "motdepasse123"},
            format="json",
        )
        self.assertEqual(connexion.status_code, status.HTTP_400_BAD_REQUEST)

    def test_un_compte_ne_se_supprime_pas(self):
        """Effacer une identite emporterait avec elle ce qu'elle a fait."""
        collegue = Utilisateur.objects.create_user(
            email="autre@mcm.sn", nom="Autre", password="motdepasse123", role="gerante"
        )
        reponse = self.client.delete(self._detail(collegue))
        self.assertEqual(reponse.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Utilisateur.objects.filter(pk=collegue.pk).exists())

    def test_une_cliente_n_entre_pas(self):
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get(self.liste).status_code, status.HTTP_403_FORBIDDEN)

    def test_un_visiteur_n_entre_pas(self):
        self.client.force_authenticate(None)
        reponse = self.client.get(self.liste)
        self.assertIn(reponse.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})


class ConnexionGestionTest(APITestCase):
    """
    La porte du back-office : elle ne s'ouvre qu'a l'equipe, et sans laisser
    de session derriere elle quand elle refuse.
    """

    def setUp(self):
        cache.clear()
        self.gerante = Utilisateur.objects.create_user(
            email="g@mcm.sn", nom="Gérante", password="motdepasse123", role="gerante"
        )
        self.cliente = Utilisateur.objects.create_user(
            email="c@mcm.sn", nom="Cliente", password="motdepasse123"
        )
        self.porte = reverse("connexion-gestion")

    def test_la_gerante_entre(self):
        reponse = self.client.post(
            self.porte, {"email": "g@mcm.sn", "mot_de_passe": "motdepasse123"}, format="json"
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertTrue(reponse.data["est_equipe"])
        self.assertEqual(self.client.get(reverse("moi")).data["utilisateur"]["email"], "g@mcm.sn")

    def test_une_cliente_est_refusee_sans_session(self):
        """Le refus n'ouvre rien : `/moi/` ne connait toujours personne."""
        reponse = self.client.post(
            self.porte, {"email": "c@mcm.sn", "mot_de_passe": "motdepasse123"}, format="json"
        )
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(self.client.get(reverse("moi")).data["utilisateur"])

    def test_un_mauvais_mot_de_passe_repond_comme_sur_la_vitrine(self):
        reponse = self.client.post(
            self.porte, {"email": "g@mcm.sn", "mot_de_passe": "faux"}, format="json"
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_une_gerante_fermee_sait_pourquoi(self):
        self.gerante.is_active = False
        self.gerante.save()
        reponse = self.client.post(
            self.porte, {"email": "g@mcm.sn", "mot_de_passe": "motdepasse123"}, format="json"
        )
        self.assertEqual(str(reponse.data["non_field_errors"][0]), "Ce compte est désactivé.")
