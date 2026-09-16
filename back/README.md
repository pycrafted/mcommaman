# Serveur M comme Maman

API Django de la boutique. Le front — la vitrine Next et son back-office — vit
dans un dépôt séparé et consomme ce serveur.

## Démarrer

```bash
# 1. PostgreSQL
docker compose up -d

# 2. Environnement Python
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt

# 3. Configuration
copy .env.example .env      # puis remplacer SECRET_KEY

# 4. Schéma et données de démonstration
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py peupler

# 5. Serveur
.venv\Scripts\python.exe manage.py runserver
```

L'admin Django est sur <http://localhost:8000/admin/> —
`gerante@mcommaman.com` / `motdepasse123` après peuplement.

## Organisation

Quatre applications, découpées par domaine métier et non par couche technique :

| Application | Ce qu'elle porte |
|---|---|
| `clientele` | Utilisateurs (clientes **et** équipe), adresses, favoris, panier |
| `catalogue` | Rayons, tailles, coloris, matières, photothèque, produits, variantes, mouvements de stock |
| `ventes` | Commandes, lignes, paiements, campagnes de remise, avis |
| `vitrine` | Réglages de la boutique, bandeau d'accueil, journal d'activité |

## Décisions structurantes

**Un seul modèle d'utilisateur**, `clientele.Utilisateur`, pour les clientes et
l'équipe, distingués par `role`. Il est en place dès la première migration :
changer de modèle d'utilisateur après coup coûte une reprise complète du schéma.
L'identifiant est l'adresse électronique, il n'y a pas de pseudo.

**Les prix sont des entiers** en francs CFA. Le franc CFA n'a pas de centime :
un décimal n'apporterait que des arrondis à surveiller.

**La variante, pas le produit, est ce qu'on achète.** Deux tailles du même
article n'ont ni le même stock ni la même disponibilité. Le panier et les lignes
de commande pointent donc vers `Variante`.

**Les lignes de commande recopient** le nom, le prix et le libellé d'option au
lieu de les référencer. Si le catalogue change de prix ou si un coloris
disparaît, la commande garde ce qui a réellement été acheté.

**Les six statuts de commande du back-office font foi.** Le front en portait
deux jeux incompatibles — cinq côté vitrine, six côté administration. La vitrine
n'en montre que quatre à la cliente : `Commande.Statut.pour_la_cliente()` fait
la correspondance. Une cliente n'a pas besoin de distinguer « en attente » de
« payée » ; la gérante, si.

**Les frais de livraison sont en base**, dans `vitrine.Reglages`, et non dans
`settings.py` : ce sont des valeurs commerciales, elles changent sans mise en
production. `Reglages.frais_pour(zone, sous_total)` est la seule source qui
fasse foi.

**Chaque requête est une transaction** (`ATOMIC_REQUESTS`). Une commande qui
échoue à mi-course ne laisse ni ligne orpheline ni stock décrémenté pour rien.

## Ce que la base fait respecter

Les règles suivantes sont des contraintes de schéma, pas des vérifications
applicatives — elles tiennent même si un jour on écrit dans la base autrement
que par Django :

- une seule adresse par défaut par cliente ;
- un prix barré toujours supérieur au prix ;
- le paiement à la livraison réservé à la zone Dakar ;
- une note d'avis entre 1 et 5, et un seul avis par produit et par commande ;
- un pourcentage de remise plafonné à 100 ;
- unicité du couple produit × taille × coloris, du slug et de la référence.

`Produit.manque_pour_publier()` reprend les cinq conditions de publication
affichées dans le back-office. Côté serveur, elles deviennent opposables.

## L'API

Trois préfixes, et la séparation n'est pas cosmétique : un oubli de permission
dans l'un n'expose jamais les autres.

| Préfixe | Qui y accède | Ce qu'on y trouve |
|---|---|---|
| `/api/compte/` | tout le monde, puis la personne connectée | inscription, connexion, déconnexion, profil, mot de passe, carnet d'adresses, favoris, panier |
| `/api/catalogue/`, `/api/vitrine/` | tout le monde, en lecture seule | produits publiés, rayons visibles, référentiels, réglages, bandeau |
| `/api/gestion/` | l'équipe seule | fiches (brouillons compris), variantes et stock, photothèque, rayons, réglages, journal, commandes, campagnes |
| `/api/commandes/`, `/api/devis/` | tout le monde | chiffrage d'un panier, passage de commande, suivi |
| `/api/avis/` | lecture ouverte, écriture après livraison | avis publiés, résumé, dépôt, « ce que je peux noter » |

Les sessions passent par un cookie signé, jamais lisible en JavaScript. Le front
appelle d'abord `GET /api/compte/csrf/`, puis toutes ses requêtes avec
`credentials: "include"`.

## Tests

```bash
.venv\Scripts\python.exe manage.py test
```

Cent cinquante-deux tests, qui décrivent des règles et non du code : un brouillon reste
invisible même en connaissant son adresse, une fiche incomplète ne se publie pas
— y compris en passant par `PATCH` plutôt que par l'action dédiée —, une
cliente ne voit pas le carnet d'adresses d'une autre, le message d'erreur de
connexion ne révèle pas quelles adresses ont un compte, un ajustement de stock
laisse toujours une trace, un total envoyé par le navigateur n'est jamais lu,
une campagne expirée ne remise rien, et une annulation remet le stock.

## Les listes

Une liste ne renvoie que ce qu'elle affiche. Le catalogue public est paginé
(24 par défaut, `page_size` jusqu'à 500), filtré et trié en base : catégorie
et sous-catégories, tailles en stock, prix du jour (`prix_effectif`, remise
comprise, calculé en SQL par `ventes.remises.annoter_prix_effectif`). Une
carte ne porte que dix champs ; la photo et la disponibilité sont des
sous-requêtes, si bien que le nombre de requêtes ne dépend pas de la taille de
la page. `produits/facettes/` rend les décomptes des filtres sans charger un
article.

Côté gestion, `produits/` renvoie des lignes allégées (sans variantes ni
galerie, que la fiche garde), `produits/compteurs/` les chiffres des onglets et
du tableau de bord, `produits/disponibilite/` la première référence libre pour
un nom. Rayons, tailles et coloris portent leur nombre de fiches.

## Les remises

La boutique n'a **pas de code de réduction**. Une campagne de portée boutique,
rayon ou produit baisse le prix affiché tant qu'elle court (`ventes/remises.py`).
Une campagne « sur la commande » s'applique à la caisse dès que sa condition est
remplie (`ventes/tarification.py`) : montant minimum atteint, ou première
commande d'une cliente connectée. Plusieurs campagnes ne se cumulent pas — la
cliente garde la plus avantageuse. Un `code_promo` envoyé par un ancien client
n'est même pas lu.

## Les commandes

Aucun montant envoyé par le navigateur n'est retenu — ni le prix d'un article,
ni les frais, ni la remise, ni le total. `ventes/tarification.py` refait tout
depuis la base, et c'est le seul endroit où un prix se décide.

Passer commande fait trois choses **dans une seule transaction** : le prix est
refait, le stock est décrémenté avec une trace, la commande est écrite. Si l'une
échoue, les trois sont annulées — jamais de stock retiré pour une commande
absente. Les variantes sont verrouillées le temps de l'opération : deux commandes
simultanées sur le dernier article ne peuvent pas le vendre deux fois.

Le paiement en ligne n'existe pas encore : une commande naît « en attente » et
la gérante la fait avancer, étape par étape, sans saut possible. Une annulation
remet le stock. Sur Dakar, le paiement à la livraison suffit à ouvrir.

Une commande passée sans compte se suit avec sa référence **et** le téléphone :
la référence seule circule sur un ticket, elle ne prouve rien.

## Favoris et avis

Les favoris d'une visiteuse non connectée restent dans son navigateur : lui
demander un compte pour cliquer sur un cœur ferait perdre le geste. Ils
remontent à la connexion par `POST /api/compte/favoris/fusionner/`, qui ajoute
sans jamais effacer.

**Le droit d'écrire un avis se prouve, il ne se déclare pas.** Il faut une
commande livrée, qui appartienne à l'autrice, et qui contienne l'article noté.
Un avis sur la boutique elle-même demande simplement une commande livrée. Un
seul avis par article et par commande — la base le garantit.

Tout avis attend la modération : il ne paraît qu'une fois approuvé, et le résumé
affiché sous une fiche ne compte que les avis publiés.

`GET /api/avis/a-noter/` renvoie ce qu'une cliente peut encore noter : ses
commandes livrées moins ce qu'elle a déjà commenté. C'est cette liste qui
alimente l'invitation de l'espace client.

## Le panier

Il n'existe que pour une cliente connectée. Tant qu'elle ne l'est pas, son panier
reste dans son navigateur : écrire en base à chaque clic sur « ajouter » coûterait
un aller-retour pour rien, et lui demander un compte avant de remplir son panier
lui ferait fermer l'onglet.

À la connexion, `POST /api/compte/panier/fusionner/` fait remonter le panier
local. Sur un article présent des deux côtés, **on garde la plus grande des deux
quantités, jamais leur somme** : additionner ferait doubler le panier d'une
cliente qui se reconnecte sur le même appareil, ce qu'elle n'a pas demandé. Les
quantités sont plafonnées au stock, et un article épuisé est signalé dans
`ignorees` sans faire échouer toute la fusion.

Une ligne devenue inservable — rupture, fiche dépubliée — **reste visible et
signalée** plutôt que retirée en silence : un panier qui maigrit tout seul est
incompréhensible. `complet` passe à faux, et le tunnel peut le dire avant la
caisse.

## Reste à faire

Les paiements en ligne, bloqués sur le choix de l'agrégateur, et les
notifications.
