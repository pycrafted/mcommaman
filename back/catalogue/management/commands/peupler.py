"""
Peuple la base avec les données de démonstration de la vitrine.

    python manage.py peupler
    python manage.py peupler --vider   # repart d'une base propre

Le catalogue est celui de `lib/products.ts` côté front, à l'identique : les
douze fiches, leurs prix et leurs photos. L'historique de commandes est engendré
à partir d'une graine fixe — deux exécutions donnent le même jeu, sinon les
chiffres du tableau de bord danseraient à chaque peuplement.
"""

import random
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from catalogue.models import (
    Coloris, Matiere, Media, Produit, PhotoProduit, Rayon, Taille, Univers, Variante,
)
from clientele.models import Adresse
from ventes.models import Avis, Campagne, Commande, LigneCommande
from vitrine.models import Bandeau, EntreeJournal, Reglages

Utilisateur = get_user_model()

# La date de référence de la démonstration. Tout l'historique se compte à partir
# d'elle, pour que le jeu ne vieillisse pas d'un jour à chaque exécution.
REFERENCE = timezone.datetime(2026, 8, 15, 10, 0, tzinfo=timezone.get_current_timezone())

CDN = "https://mcommaman.com/cdn/shop/files/"

# Deux catégories racines, et leurs sous-catégories. Le quatrième champ est la
# parente : vide pour une racine.
RAYONS = [
    ("Enfants", "Le vestiaire de 2 à 14 ans", Univers.ENFANT, None),
    ("Coin Maman", "Tissus et voiles, pour celles qui cousent", Univers.MAMAN, None),
    ("Ensembles", "Haut et bas assortis, prêts à enfiler le matin", Univers.ENFANT, "Enfants"),
    ("Robes & jupes", "Robes de tous les jours et tenues des grands jours", Univers.ENFANT, "Enfants"),
    ("Bas & jeans", "Pantalons, jeans et bas confortables", Univers.ENFANT, "Enfants"),
    ("T-shirts & hauts", "Hauts en coton pour bouger toute la journée", Univers.ENFANT, "Enfants"),
    ("Chaussures", "Des pieds bien chaussés pour grandir", Univers.ENFANT, "Enfants"),
    ("Tissus", "Coupons au mètre, choisis pour tomber juste", Univers.MAMAN, "Coin Maman"),
    ("Voiles", "Voiles et foulards, unis ou brodés", Univers.MAMAN, "Coin Maman"),
]

TAILLES = [
    ("3M", "0-3 mois"), ("6M", "3-6 mois"), ("9M", "6-9 mois"), ("12M", "9-12 mois"),
    ("18M", "12-18 mois"), ("2", "2 ans"), ("4", "4 ans"), ("6", "6 ans"),
    ("8", "8 ans"), ("10", "10 ans"), ("12", "12 ans"), ("14", "14 ans"),
    ("TU", "Taille unique"), ("S", ""), ("M", ""), ("L", ""),
    ("24", ""), ("26", ""), ("28", ""), ("30", ""),
]

COLORIS = [
    ("Rose poudré", "#e8b7c8"), ("Écru", "#efe6da"), ("Lilas", "#ded0f0"),
    ("Bleu nuit", "#39456b"), ("Rose", "#e0417f"), ("Marine", "#2f3a56"),
    ("Moutarde", "#f0c24a"), ("Sauge", "#8ca783"),
]

MATIERES = [
    "100 % coton", "Coton biologique", "Jersey de coton", "Popeline de coton",
    "Lin lavé", "Denim léger", "Maille tricot",
]

# Les douze fiches de la vitrine, mot pour mot.
PRODUITS = [
    ("robe-chasuble-rose-plumetis", "Robe chasuble rose à volant plumetis", "RBP-0040", 12000, None,
     "Robes & jupes", "fille", "2-10", "Ensemble_enfant-4.jpg?v=1785880792&width=800",
     "Chasuble en satin rose, rosette froncée à l'épaule, bas de jupe en plumetis duveteux. Doublure coton, fermeture pression au dos."),
    ("babies-vernies-bride", "Babies vernies à bride", "CHS-2210", 3000, None,
     "Chaussures", "fille", "2-10", "chass1.png?v=1784826770&width=800",
     "Vernis rose, nœud plat sur le dessus, bride réglable par pression. Semelle souple antidérapante, pointures 20 à 30."),
    ("ensemble-pyjama-illustration", "Ensemble pyjama à illustration", "PYJ-1380", 12000, 14000,
     "Ensembles", "fille", "2-10", "Ensemble_enfant-138.jpg?v=1785881597&width=800",
     "Haut écru à manches longues, col rouge côtelé et illustration imprimée sur la poitrine. Bas assorti à taille élastique. Jersey de coton."),
    ("ensemble-chemise-bermuda-safari", "Ensemble chemise et bermuda safari", "SAF-0300", 9000, None,
     "Ensembles", "garcon", "11-14", "Ensemble_enfant-30.jpg?v=1785526705&width=800",
     "Popeline de coton beige, chemise à manches courtes et deux poches poitrine, bermuda assorti à taille ajustable."),
    ("tshirt-raglan-rose-gris", "T-shirt raglan rose et gris", "TSH-0520", 5000, 6500,
     "T-shirts & hauts", "fille", "2-10", "Ensemble_enfant-52.jpg?v=1785881224&width=800",
     "Jersey de coton rose, manches raglan grises, col rond marine côtelé. Coupe droite."),
    ("ensemble-pyjama-rouge-vichy", "Ensemble pyjama rouge et vichy", "PYJ-0190", 8500, None,
     "Ensembles", "mixte", "2-10", "Ensembleenfant-19.jpg?v=1785860514&width=800",
     "Haut rouge uni à manches longues, pantalon vichy rouge et blanc. Taille élastiquée, coton doux."),
    ("ensemble-pyjama-ecru-motif", "Ensemble pyjama écru à motif", "PYJ-0150", 7500, None,
     "Ensembles", "mixte", "2-10", "Ensembleenfant-15.jpg?v=1785857761&width=800",
     "Haut écru à manches longues avec motif appliqué, bas vert imprimé assorti. Coton doux, poignets côtelés."),
    ("robe-fete-ecrue-plumetis", "Robe de fête écrue à jupe plumetis", "RBF-0110", 11000, None,
     "Robes & jupes", "fille", "2-10", "Ensemble_enfant-11.jpg?v=1785880838&width=800",
     "Robe sans manches en satin écru, jupe en plumetis, fermeture éclair invisible au dos. Doublure intégrale."),
    ("ensemble-pyjama-avions", "Ensemble pyjama imprimé avions", "PYJ-0570", 9500, None,
     "Ensembles", "garcon", "2-10", "Ensemble_enfant-57.jpg?v=1785881629&width=800",
     "Haut écru imprimé avions, bas bleu uni assorti. Poignets et chevilles côtelés, coton respirant."),
    ("jean-droit-denim", "Jean droit en denim", "JEA-0670", 13000, None,
     "Bas & jeans", "mixte", "11-14", "Ensemble_enfant-67.jpg?v=1785881797&width=800",
     "Denim bleu moyen, coupe droite cinq poches, taille réglable par bouton intérieur."),
    ("pantalon-rose-elastique", "Pantalon rose à taille élastiquée", "PAN-1870", 7000, None,
     "Bas & jeans", "fille", "2-10", "Ensemble_enfant-187.jpg?v=1785881825&width=800",
     "Coton stretch rose, taille entièrement élastiquée, coupe droite légèrement fuselée."),
    ("robe-ete-fleurie-bloomer", "Robe d'été fleurie et bloomer", "RBE-0070", 6000, None,
     "Robes & jupes", "fille", "2-10", "p7eexgrv.png?v=1784397830&width=800",
     "Robe à bretelles croisées imprimée fleurs, bloomer assorti. Coton léger, doublure jersey."),
]

# Le Coin Maman : du tissu au coupon et du voile, pour les mamans qui viennent
# habiller leurs enfants et repartent avec de quoi se coudre quelque chose.
PRODUITS_MAMAN = [
    ("coupon-bazin-riche-blanc", "Coupon bazin riche blanc", "TIS-0010", 18000,
     "Tissus", "Ensemble_enfant-121.jpg?width=800",
     "Bazin riche teinté à la main, vendu au coupon de cinq mètres. Tombé lourd, éclat qui tient au lavage."),
    ("coupon-wax-fleuri", "Coupon wax fleuri", "TIS-0020", 12000,
     "Tissus", "Ensemble_enfant-26.jpg?width=800",
     "Wax imprimé fleurs, coupon de six yards. Coton épais, couleurs franches qui ne passent pas."),
    ("voile-brode-ecru", "Voile brodé écru", "VOI-0010", 9000,
     "Voiles", "Ensembleenfant-153.jpg?width=800",
     "Voile léger brodé main sur les bords, deux mètres. Se porte sur l'épaule ou sur la tête."),
    ("foulard-soie-uni", "Foulard en soie uni", "VOI-0020", 6500,
     "Voiles", "Ensembleenfant-190.jpg?width=800",
     "Soie unie, ourlet roulotté à la main. Un carré qui se noue au cou comme dans les cheveux."),
]

TAILLES_PAR_AGE = {"2-10": ["2", "4", "6", "8", "10"], "11-14": ["12", "14"]}
# Le Coin Maman se vend au coupon ou à la pièce : une seule taille.
TAILLES_MAMAN = ["TU"]
POINTURES = ["24", "26", "28", "30"]

PRENOMS = ["Aïssatou", "Fatou", "Mariama", "Ndèye", "Sokhna", "Awa", "Bineta", "Khady",
           "Coumba", "Adama", "Rokhaya", "Seynabou", "Astou", "Yacine", "Oumou",
           "Dieynaba", "Nafissatou", "Aminata", "Marième", "Penda"]
NOMS = ["Diop", "Ndiaye", "Fall", "Sow", "Ba", "Sarr", "Gueye", "Faye", "Seck",
        "Mbaye", "Camara", "Diallo", "Sylla", "Thiam", "Cissé", "Diagne", "Kane"]
VILLES_DAKAR = ["Dakar", "Guédiawaye", "Pikine", "Rufisque"]
VILLES_AUTRES = [("thies", "Thiès"), ("thies", "Mbour"), ("regions", "Saint-Louis"),
                 ("regions", "Ziguinchor"), ("regions", "Touba"), ("regions", "Kaolack")]


class Command(BaseCommand):
    help = "Peuple la base avec le jeu de démonstration de la vitrine."

    def add_arguments(self, parser):
        parser.add_argument("--vider", action="store_true", help="Efface les données métier avant de peupler.")

    @transaction.atomic
    def handle(self, *args, **options):
        alea = random.Random(20260815)

        if options["vider"]:
            self._vider()

        self.stdout.write("Réglages…")
        Reglages.actuels()

        rayons = self._rayons()
        tailles = self._referentiels()
        produits = self._produits(rayons, tailles, alea)
        gerante, clientes = self._comptes(alea)
        commandes = self._commandes(produits, clientes, alea)
        self._campagnes()
        self._bandeau(produits)
        self._avis(commandes, alea)
        self._journal(gerante)

        self.stdout.write(self.style.SUCCESS(
            f"\nBase peuplée : {len(rayons)} rayons, {len(produits)} produits, "
            f"{Variante.objects.count()} variantes, {len(clientes)} clientes, "
            f"{len(commandes)} commandes."
        ))
        self.stdout.write("Gérante : gerante@mcommaman.com / motdepasse123")

    # ------------------------------------------------------------------ étapes

    def _vider(self):
        self.stdout.write(self.style.WARNING("Effacement des données métier…"))
        for modele in (Avis, LigneCommande, Commande, Campagne, Bandeau, EntreeJournal,
                       Variante, PhotoProduit, Produit, Media, Taille, Coloris,
                       Matiere, Adresse):
            modele.objects.all().delete()
        # Les sous-catégories d'abord : leur parente est protégée tant qu'elles
        # existent, et c'est très bien ainsi.
        # Les liaisons partent avec les lignes : plus de clé protégée, on
        # peut tout effacer d'un coup.
        Rayon.objects.all().delete()
        Utilisateur.objects.filter(is_superuser=False).delete()

    def _rayons(self):
        rayons = {}
        # Les racines d'abord : une sous-catégorie a besoin de sa parente.
        for ordre, (nom, description, univers, parent) in enumerate(RAYONS, start=1):
            rayon, _ = Rayon.objects.update_or_create(
                nom=nom,
                defaults={"slug": slugify(nom), "description": description,
                          "univers": univers, "ordre": ordre},
            )
            # La liaison se pose après coup : une relation multiple ne se
            # renseigne pas dans `defaults`.
            rayon.parents.set([rayons[parent]] if parent else [])
            rayons[nom] = rayon
        # Les liens sont symétriques : Django s'occupe du sens inverse.
        par_slug = {r.slug: r for r in rayons.values()}
        self.stdout.write(f"  {len(rayons)} rayons, dont 2 racines")
        return rayons

    def _referentiels(self):
        tailles = {}
        for ordre, (valeur, repere) in enumerate(TAILLES):
            taille, _ = Taille.objects.update_or_create(
                valeur=valeur, defaults={"repere": repere, "ordre": ordre}
            )
            tailles[valeur] = taille
        for nom, hexa in COLORIS:
            Coloris.objects.update_or_create(nom=nom, defaults={"hexa": hexa})
        for nom in MATIERES:
            Matiere.objects.get_or_create(nom=nom)
        self.stdout.write(f"  {len(tailles)} tailles, {len(COLORIS)} coloris, {len(MATIERES)} matières")
        return tailles

    def _produits(self, rayons, tailles, alea):
        coloris = list(Coloris.objects.all())
        produits = []

        for index, (slug, nom, sku, prix, prix_barre, rayon, genre, age, fichier, description) in enumerate(PRODUITS):
            media, _ = Media.objects.get_or_create(url=CDN + fichier, defaults={"nom": nom})
            # La dernière fiche reste en brouillon : le back-office doit avoir de
            # quoi montrer la différence.
            statut = Produit.Statut.BROUILLON if index == len(PRODUITS) - 1 else Produit.Statut.PUBLIE

            produit, _ = Produit.objects.update_or_create(
                slug=slug,
                defaults={
                    "nom": nom, "sku": sku, "prix": prix, "prix_barre": prix_barre,
                    "description": description, "rayon": rayons[rayon],
                    "statut": statut,
                },
            )
            produit.matieres.set([Matiere.objects.get(nom=alea.choice(MATIERES))])
            PhotoProduit.objects.get_or_create(produit=produit, media=media, defaults={"position": 0})

            valeurs = POINTURES if rayon == "Chaussures" else TAILLES_PAR_AGE[age]
            couleur = alea.choice(coloris)
            for rang, valeur in enumerate(valeurs):
                # La clé est la référence, pas le triplet produit/taille/coloris :
                # le coloris est tiré au hasard et changerait d'une exécution à
                # l'autre, ce qui rendrait le peuplement non rejouable.
                Variante.objects.update_or_create(
                    sku=f"{sku}-{valeur}",
                    defaults={
                        "produit": produit, "taille": tailles[valeur], "coloris": couleur,
                        # Une rupture volontaire, pour éprouver l'affichage.
                        "stock": 0 if (slug == "ensemble-pyjama-rouge-vichy" and rang == 0)
                                 else alea.randint(3, 28),
                    },
                )
            produits.append(produit)

        # Le Coin Maman : ni âge ni genre, une seule taille, une seule variante.
        taille_unique = tailles["TU"]
        for slug, nom, sku, prix, rayon, fichier, description in PRODUITS_MAMAN:
            media, _ = Media.objects.get_or_create(url=CDN + fichier, defaults={"nom": nom})
            produit, _ = Produit.objects.update_or_create(
                slug=slug,
                defaults={
                    "nom": nom, "sku": sku, "prix": prix, "description": description,
                    "rayon": rayons[rayon], "statut": Produit.Statut.PUBLIE,
                },
            )
            PhotoProduit.objects.get_or_create(produit=produit, media=media, defaults={"position": 0})
            Variante.objects.update_or_create(
                sku=f"{sku}-TU",
                defaults={"produit": produit, "taille": taille_unique, "coloris": None,
                          "stock": alea.randint(4, 20)},
            )
            produits.append(produit)

        self.stdout.write(f"  {len(produits)} produits, {Variante.objects.count()} variantes")
        return produits

    def _comptes(self, alea):
        gerante, cree = Utilisateur.objects.get_or_create(
            email="gerante@mcommaman.com",
            defaults={"nom": "Mame Fatou Diop", "role": Utilisateur.Role.GERANTE,
                      "is_staff": True, "is_superuser": True, "ville": "Dakar"},
        )
        if cree:
            gerante.set_password("motdepasse123")
            gerante.save()

        clientes = []
        vus = set()
        for i in range(48):
            nom = f"{alea.choice(PRENOMS)} {alea.choice(NOMS)}"
            garde = 0
            while nom in vus and garde < 40:
                nom = f"{alea.choice(PRENOMS)} {alea.choice(NOMS)}"
                garde += 1
            vus.add(nom)

            email = nom.lower().replace(" ", ".").replace("è", "e").replace("é", "e") \
                       .replace("ï", "i").replace("ë", "e") + "@example.sn"
            cliente, _ = Utilisateur.objects.get_or_create(
                email=email,
                defaults={
                    "nom": nom,
                    "telephone": f"+221 7{alea.randint(3, 8)} {alea.randint(100, 999)} {alea.randint(10, 99)} {alea.randint(10, 99)}",
                    "ville": alea.choice(VILLES_DAKAR),
                    "date_creation": REFERENCE - timedelta(days=alea.randint(2, 300)),
                },
            )
            clientes.append(cliente)

        self.stdout.write(f"  1 gérante, {len(clientes)} clientes")
        return gerante, clientes

    def _commandes(self, produits, clientes, alea):
        # Les commandes ne se rejouent pas : leurs références sont uniques, et
        # un second passage les dupliquerait. Pour repartir de zéro : --vider.
        existantes = list(Commande.objects.all())
        if existantes:
            self.stdout.write(f"  {len(existantes)} commandes déjà en base, laissées telles quelles")
            return existantes

        reglages = Reglages.actuels()
        variantes = list(Variante.objects.filter(produit__statut=Produit.Statut.PUBLIE).select_related("produit", "taille", "coloris"))
        commandes = []
        numero = 10_240

        # Six mois d'historique, avec une montée en charge et un pic le week-end.
        for jour in range(179, -1, -1):
            quand = REFERENCE - timedelta(days=jour)
            weekend = 1.6 if quand.weekday() >= 5 else 1.0
            croissance = 0.6 + (179 - jour) / 179
            for _ in range(int(alea.random() * 3 * weekend * croissance)):
                cliente = alea.choice(clientes)
                if alea.random() > 0.75:
                    zone, ville = alea.choice(VILLES_AUTRES)
                else:
                    zone, ville = "dakar", alea.choice(VILLES_DAKAR)

                choisies = alea.sample(variantes, 2 if alea.random() > 0.62 else 1)
                sous_total = 0
                lignes = []
                for variante in choisies:
                    quantite = 2 if alea.random() > 0.8 else 1
                    sous_total += variante.produit.prix * quantite
                    lignes.append((variante, quantite))

                frais = reglages.frais_pour(zone, sous_total)
                # Le paiement à la livraison n'existe que sur Dakar : la
                # contrainte de base le refuserait ailleurs.
                moyens = ["wave", "om", "cb", "cod"] if zone == "dakar" else ["wave", "om", "cb"]

                if jour > 12:
                    statut = Commande.Statut.LIVREE if alea.random() > 0.06 else Commande.Statut.ANNULEE
                elif jour > 6:
                    statut = alea.choice([Commande.Statut.LIVREE, Commande.Statut.EXPEDIEE,
                                          Commande.Statut.EXPEDIEE, Commande.Statut.ANNULEE])
                else:
                    etapes = [Commande.Statut.EN_ATTENTE, Commande.Statut.PAYEE,
                              Commande.Statut.PREPARATION, Commande.Statut.EXPEDIEE,
                              Commande.Statut.LIVREE]
                    statut = etapes[min(len(etapes) - 1, alea.randint(0, jour + 1))]

                numero += 1
                commande = Commande.objects.create(
                    reference=f"MCM-{numero}",
                    cliente=cliente,
                    nom_client=cliente.nom,
                    telephone=cliente.telephone,
                    email=cliente.email,
                    zone=zone, ville=ville,
                    adresse=f"{alea.randint(1, 90)} rue {alea.randint(1, 40)}, {ville}",
                    sous_total=sous_total,
                    frais_livraison=frais,
                    total=sous_total + frais,
                    moyen_paiement=alea.choice(moyens),
                    statut=statut,
                    creee_le=quand.replace(hour=alea.randint(8, 19)),
                )
                for variante, quantite in lignes:
                    photo = variante.produit.photo_principale
                    LigneCommande.objects.create(
                        commande=commande, variante=variante,
                        nom_produit=variante.produit.nom,
                        slug_produit=variante.produit.slug,
                        url_image=photo.media.url if photo else "",
                        libelle_option=variante.libelle_option,
                        prix_unitaire=variante.produit.prix,
                        quantite=quantite,
                    )
                commandes.append(commande)

        self.stdout.write(f"  {len(commandes)} commandes sur six mois")
        return commandes

    def _campagnes(self):
        Campagne.objects.update_or_create(
            libelle="Rentrée des classes",
            defaults={"type": Campagne.Type.POURCENTAGE, "valeur": 15,
                      "date_effet": date(2026, 8, 15), "duree_jours": 25,
                      "portee": Campagne.Portee.BOUTIQUE, "active": True,
                      "note": "Offre de rentrée sur la sélection signalée en boutique."},
        )
        Campagne.objects.update_or_create(
            libelle="Bienvenue — première commande",
            defaults={"type": Campagne.Type.MONTANT, "valeur": 2000,
                      "date_effet": date(2026, 8, 1), "duree_jours": 120,
                      "portee": Campagne.Portee.COMMANDE,
                      "condition": Campagne.Condition.PREMIERE, "active": True,
                      "note": "Remise accordée sur la première commande d'une cliente."},
        )
        self.stdout.write("  2 campagnes")

    def _bandeau(self, produits):
        par_slug = {p.slug: p for p in produits}
        photos = [
            ("/images/hero/fille-cour.webp", "Fillette en t-shirt gris et pantalon écru dans une cour à Dakar",
             "52% 42%", "Tous les jours", "tshirt-raglan-rose-gris"),
            ("/images/hero/robe-rouge.webp", "Fillette en robe de fête rouge à jupe de tulle",
             "50% 26%", "Les grands jours", "robe-fete-ecrue-plumetis"),
            ("/images/hero/garcon-cour.webp", "Garçon en t-shirt écru et pantalon cargo noir dans une cour à Dakar",
             "50% 42%", "Pour eux aussi", "ensemble-chemise-bermuda-safari"),
        ]
        for ordre, (url, alt, cadrage, etiquette, slug) in enumerate(photos):
            media, _ = Media.objects.get_or_create(url=url, defaults={"nom": etiquette})
            Bandeau.objects.update_or_create(
                etiquette=etiquette,
                defaults={"media": media, "texte_alternatif": alt, "cadrage": cadrage,
                          "produit_associe": par_slug.get(slug), "ordre": ordre, "active": True},
            )
        self.stdout.write("  3 photos de bandeau")

    def _avis(self, commandes, alea):
        """Seules les commandes livrées donnent droit à un avis — comme en vrai."""
        livrees = [c for c in commandes if c.statut == Commande.Statut.LIVREE][:40]
        textes = [
            "Commandé le matin, livré le lendemain. La taille correspond bien à l'âge, le tissu ne gratte pas.",
            "La jupe en plumetis fait vraiment son effet. Ma fille l'a portée pour la Tabaski.",
            "Très jolies et solides. J'aurais aimé une pointure de plus en stock.",
            "La taille réglable à l'intérieur change tout pour un enfant qui pousse.",
            "Reçue en une journée, emballage soigné. Je recommande.",
        ]
        poses = 0
        for commande in livrees:
            if alea.random() > 0.45:
                continue
            ligne = commande.lignes.first()
            if not ligne or not ligne.variante:
                continue
            _, cree = Avis.objects.get_or_create(
                auteur=commande.cliente, commande=commande, produit=ligne.variante.produit,
                defaults={"note": alea.choice([4, 5, 5, 5]), "commentaire": alea.choice(textes),
                          "etat": Avis.Etat.PUBLIE, "modere_le": commande.creee_le + timedelta(days=2)},
            )
            poses += 1 if cree else 0
        self.stdout.write(f"  {poses} avis")

    def _journal(self, gerante):
        entrees = [
            ("a préparé", "MCM-10412"),
            ("a modifié le prix de", "Jean droit en denim"),
            ("a publié", "Robe d'été fleurie et bloomer"),
            ("a réapprovisionné", "Babies vernies à bride"),
            ("a créé la campagne", "Rentrée des classes"),
        ]
        for action, cible in entrees:
            EntreeJournal.objects.get_or_create(
                nom_auteur=gerante.nom, action=action, cible=cible,
                defaults={"auteur": gerante},
            )
        self.stdout.write(f"  {len(entrees)} entrées de journal")
