# mcommaman — refonte

Vitrine **Next.js 15 (App Router) + TypeScript + Tailwind CSS 4**, sans autre dépendance.
Reprend à l'identique la maquette `Refonte mcommaman.dc.html`.

---

## Démarrer

```bash
cd front
npm install     # rétablit aussi les routes dynamiques (voir plus bas)
npm run dev
```

→ http://localhost:3000

> **Il faut le serveur.** La vitrine lit tout dans `back` : sans lui elle s'affiche, mais vide.
> `cd back && docker compose up -d && .venv\Scripts\python.exe manage.py runserver`.

> **Routes dynamiques.** L'export ne peut pas contenir de crochets dans les noms de dossier :
> `app/p/[slug]` est livré sous `app/p/-slug-`. Le script `scripts/fix-routes.mjs` les renomme,
> et il tourne automatiquement au `npm install`. Si besoin : `npm run fix-routes`.

---

## Routes

| Route | Fichier | Contenu |
|---|---|---|
| `/` | `app/page.tsx` → `components/home.tsx` | Bandeau d'accueil en arche (`components/hero.tsx`), bandeau défilant, réassurance, bento des âges, carrousel à onglets, compte à rebours, sélecteur d'univers en pile, histoire en défilement bloqué, le Coin Maman, le mot des mamans, section « Nous contacter » (`#contact`) avec l'adresse et le plan du magasin |
| `/boutique` | `app/boutique/page.tsx` → `components/catalogue.tsx` | Toute la boutique, ou une catégorie avec `?cat=<slug>` (Filles, Garçons, Coin Maman…) . Tout vit dans l'adresse (`sous`, `taille`, `prix_min`, `prix_max`, `tri`, `page`) et le serveur filtre, trie et pagine : la page ne reçoit que ses 24 articles, et les filtres leurs décomptes (`/api/catalogue/produits/facettes/`) |
| `/p/[slug]` | `app/p/[slug]/page.tsx` | Galerie, variantes couleur / taille, accordéons, recommandations, avis de l'article, JSON-LD Product |
| `/panier` | `app/panier/page.tsx` | Tunnel à l'étape 1 |
| `/commande` | `app/commande/page.tsx` | Tunnel à l'étape 2 : livraison validée → paiement → commande enregistrée |
| `/commandes` | `app/commandes/page.tsx` → `components/orders-list.tsx` | Historique et avancement de chaque colis |
| `/commandes/[ref]` | `app/commandes/[ref]/page.tsx` → `components/order-detail.tsx` | Suivi détaillé, frise en quatre temps, recommander, annuler |
| `/favoris` | `app/favoris/page.tsx` → `components/favorites-page.tsx` | Pièces mises de côté, tout ajouter au panier, vider la liste |
| `/compte` | `app/compte/page.tsx` → `components/account-dashboard.tsx` | Tableau de bord : dernière commande, panier en cours, mes envies, adresse par défaut |
| `/compte/connexion` | `app/compte/connexion/page.tsx` → `components/account-auth.tsx` | Connexion, redirection `?suite=` |
| `/compte/inscription` | `app/compte/inscription/page.tsx` → `components/account-auth.tsx` | Création de compte, six règles de validation, jauge de mot de passe |
| `/compte/profil` | `app/compte/profil/page.tsx` → `components/account-profile.tsx` | Informations, carnet d'adresses, tailles suivies, mot de passe, suppression |
| `/infos/[slug]` | `app/infos/[slug]/page.tsx` | CGV, mentions légales, confidentialité, retours, livraison, FAQ |
| `/admin/connexion` | `app/admin/connexion/page.tsx` | Entrée du back-office, identifiants de démonstration affichés |
| `/admin` | `app/admin/(espace)/page.tsx` | Tableau de bord : huit tuiles de rubrique, chacune avec son chiffre |
| `/admin/statistiques` | `app/admin/(espace)/statistiques/page.tsx` | Indicateurs comparés, ventes jour par jour, rayons, paiements, villes, fiches sans vente, journal |
| `/admin/commandes` | `app/admin/(espace)/commandes/page.tsx` | Liste filtrable, détail en fenêtre, avancement du statut |
| `/admin/produits` | `app/admin/(espace)/produits/page.tsx` | Catalogue paginé par le serveur (20 lignes), recherche et onglets de statut ; publier / dépublier / dupliquer / supprimer. Le back-office ne charge plus tout le catalogue : les chiffres viennent de `compteurs/`, les fiches de `lib/admin/produits.ts` |
| `/admin/produits/nouveau`, `/admin/produits/[id]` | `components/product-form.tsx` | Éditeur de fiche : identité, photothèque, prix, variantes, aperçu live, cinq conditions de publication |
| `/admin/categories` | `app/admin/(espace)/categories/page.tsx` | Catégories, visuel, renvois symétriques, visibilité |
| `/admin/promotions` | `app/admin/(espace)/promotions/page.tsx` | Campagnes en bons de réduction, onglets par statut, avancement, tiroir de saisie |
| `/admin/clients` | `app/admin/(espace)/clients/page.tsx` | Fichier clientes, segments déduits, commandes de chacune |
| `/admin/configuration` | `app/admin/(espace)/configuration/page.tsx` | Tailles, coloris, matières, photothèque |
| `/admin/reglages` | `app/admin/(espace)/reglages/page.tsx` | Identité, livraison, bandeau, photos d'accueil, remise à zéro |
| 404 | `app/not-found.tsx` | Page introuvable |

---

## Ce que la vitrine lit sur le serveur

**Plus rien du catalogue n'est écrit dans le code.** Tout ce que la boutique affiche vient de
`back` par HTTP, et le passage entre les deux vocabulaires tient dans `lib/api.ts`,
`lib/catalogue.ts` et `lib/reglages.ts`.

| Ce qui s'affiche | D'où ça vient |
|---|---|
| Fiches, prix, stock, photos | `/api/catalogue/produits/` — `lireCatalogue`, `lireFiche`, `lireSimilaires` |
| Rayons du menu, des filtres, des tuiles d'accueil, du pied de page | `/api/catalogue/rayons/` — `lireRayonsNavigables` |
| Frais de livraison, franco, téléphone, courriel, bandeau d'annonce, caisse ouverte | `/api/vitrine/reglages/` — `lireReglages` |
| Photos du bandeau d'accueil | `/api/vitrine/bandeau/` — `lireBandeau` |
| Campagne annoncée et son compte à rebours | `/api/campagnes/` — `lireCampagnes` |
| Panier, favoris | `/api/compte/panier/`, `/api/compte/favoris/` |
| Devis, commandes, suivi, annulation | `/api/devis/`, `/api/commandes/` |
| Avis, résumé, « ce qu'il reste à noter » | `/api/avis/` |

`lib/products.ts` ne garde que **la forme** d'une fiche (le type `Product`, que tous les
composants attendent) et les deux vidéos du bandeau livrées avec le site. Il ne contient plus
ni catalogue, ni rayons, ni tailles, ni coloris, ni date de promotion.

Les réglages sont lus **une seule fois**, par `app/layout.tsx`, et posés dans
`components/reglages-context.tsx` : le tunnel, le pied de page et l'accueil les
trouvent là sans refaire l'appel chacun de leur côté.

**Pas de recherche dans la vitrine**, à la demande de la cliente : la barre du haut nomme
« Boutique » puis chaque catégorie du back-office, en liens simples, sans panneau déroulant.
Le Coin Maman est une catégorie comme les autres et n'a plus de page à lui. Le serveur garde
sa recherche (`catalogue/recherche.py`, `?q=`) pour le back-office. Il n'y a plus non plus de
pages `/avis` ni `/contact` : les avis se déposent sur la fiche de l'article, les coordonnées
sont en bas de l'accueil (`/#contact`).

**Quand le serveur ne répond pas**, chaque lecture retombe sur une valeur vide ou sur les
valeurs par défaut du modèle Django : la boutique reste consultable, elle n'affiche jamais un
prix ou des frais inventés.

### Espace client

**`components/auth-context.tsx`** parle au serveur : inscription, connexion, profil, carnet
d'adresses, tailles suivies, changement de mot de passe, mot de passe oublié, suppression —
tout passe par `/api/compte/`. Les mots de passe sont hachés en Argon2 par Django, la session
voyage dans un cookie que le JavaScript ne peut pas lire, et les écritures portent un jeton
CSRF que `lib/api.ts` renouvelle tout seul quand il tourne.

Reste à faire côté serveur : la vérification de l'adresse e-mail.

Ce que le compte change ailleurs : l'en-tête montre les initiales et mène à `/compte` ; l'étape
Livraison du tunnel se pré-remplit depuis l'adresse par défaut, et propose de se connecter
sinon. Les trois zones de livraison — leur nom et leur délai — sont partagées entre le tunnel et
le carnet d'adresses dans **`lib/livraison.ts`** ; **leurs montants n'y sont pas**, ils viennent
des réglages de la boutique, et le total d'une commande est chiffré par le serveur.

### Favoris

**`components/favorites-context.tsx`** tient la liste : le dernier cœur touché passe en tête.
Hors session elle reste dans le navigateur (`mcm-favoris-v1`) ; connectée, elle vient de
`/api/compte/favoris/` et suit d'un appareil à l'autre. Le cœur
lui-même est un seul composant, **`components/favorite-button.tsx`** — posé sur une carte, il
intercepte le clic pour ne pas partir sur la fiche ; il se dessine vide tant que le stockage n'a
pas été relu, sinon le premier rendu ne serait pas le même côté serveur et client.

Le même cœur sert partout : carte de la boutique, aperçu rapide, fiche produit, et sur
`/favoris` où il fait office de retrait. La page reprend les cartes de la boutique plutôt qu'un
gabarit à part, ajoute une barre de tête (nombre d'articles, total, **Tout ajouter au panier**,
**Vider la liste** en deux temps) et signale les identifiants qui ne correspondent plus à aucun
article du catalogue au lieu de tomber dessus — les fiches sont demandées au serveur par leurs
identifiants, une pièce dépubliée n'en revient tout simplement pas.

**La liste du navigateur se fond dans celle du compte à la connexion**
(`POST /api/compte/favoris/fusionner/`) : une cliente qui met des pièces de côté avant de créer
son compte ne les perd pas en le créant.

### Commandes et suivi

**`components/orders-context.tsx`** ne garde plus rien : la commande est écrite en base par
`POST /api/commandes/`. Le serveur refait les prix, retire le stock, numérote (`MCM-10241`) et
répond ce qu'il a retenu — **aucun montant n'est envoyé**, les accepter reviendrait à laisser
le navigateur fixer ses prix.

Deux régimes, comme le panier. **Connectée**, ses commandes viennent de `/api/mes-commandes/`
et la suivent d'un appareil à l'autre. **Sans compte**, la commande existe tout aussi bien en
base ; seul le lien vers elle manque, alors le navigateur retient la référence et le téléphone
(`mcm-suivis-v1`) — c'est ce couple que le serveur exige pour la montrer. Une page de suivi
ouverte ailleurs propose donc de saisir ce téléphone plutôt que de dire « introuvable ».

**Le statut est piloté par la boutique**, depuis son back-office. Le bouton « J'ai reçu ma
commande » a disparu : la cliente ne déclare plus sa propre livraison, et c'est le passage en
« Livrée » par la boutique qui ouvre le droit à l'avis. Reste l'annulation par la cliente
(`POST /api/commandes/<ref>/annuler/`), possible tant que rien n'est parti en préparation :
elle remet le stock, et le refus au-delà est expliqué.

Le tunnel (`components/checkout.tsx`) valide toujours la saisie — nom, téléphone, quartier et
point de repère obligatoires, e-mail facultatif mais vérifié, messages au `blur` — mais **il
ne calcule plus rien**. Chaque changement de panier ou de zone appelle `POST /api/devis/` :
c'est le serveur qui annonce les frais, la remise et le total. **Il n'y a pas de code de
réduction** : une campagne s'applique d'elle-même, et le récapitulatif la nomme
(`remise_libelle`) quand elle retire quelque chose. La caisse se ferme
d'elle-même quand la gérante décoche « accepter les commandes » pendant ses congés.

### Panier

**`components/cart-context.tsx`** parle au serveur. Ce qu'on met dans le panier est une
**variante** — un produit dans une taille et un coloris — et non un produit : deux tailles du
même article n'ont ni le même stock ni la même disponibilité, et c'est la variante que la
commande achètera. La fiche (`components/product-detail.tsx`) et l'aperçu rapide n'offrent donc
plus les tailles de référence mais celles que le serveur déclare, et une taille absente du
coloris choisi se barre au lieu de se proposer.

Deux régimes, comme les favoris. Hors session le panier reste dans le navigateur
(`mcm-panier-v2` — nouvelle clé : l'ancienne gardait des indices de couleur et de taille qui ne
veulent plus rien dire). À la connexion il remonte par `POST /api/compte/panier/fusionner/`,
qui garde **la plus grande des deux quantités et non leur somme** : se reconnecter sur le même
appareil ne doit pas doubler le panier.

C'est le serveur qui arbitre le stock — `add`, `setQuantity` et `remove` adoptent sa réponse
plutôt que de la deviner. Une ligne devenue inservable (rupture, fiche dépubliée) **reste
visible et se signale** au lieu de disparaître, et `complet` ferme la caisse tant qu'elle est
là : un panier qui maigrit tout seul est incompréhensible.

**Le statut ne bouge pas tout seul.** Rien ne le fait avancer côté client — c'est le
back-office qui le pilotera. En ligne, il faudra aussi : commande écrite en base, référence
tirée d'une séquence serveur, et validation du paiement par le webhook signé du prestataire,
jamais par le retour du navigateur.

### Avis

**`components/reviews-context.tsx`** ne tient plus rien : les avis sont en base et modérés.
Rien n'est chargé d'avance — une fiche demande les avis de son article (`useAvis`), l'accueil
et la page d'avis ceux de la boutique. Le cache est partagé, si bien que la liste et le
formulaire d'une même page lisent la même chose et se remettent à jour ensemble.

**Le droit d'écrire ne se déclare plus, il se prouve.** C'est le serveur qui dit ce qu'il reste
à noter (`/api/avis/a-noter/`) : une commande **livrée**, la sienne, contenant l'article. Le
formulaire ne s'ouvre que pour ce que cette liste autorise, et il envoie l'identifiant de
commande que le serveur lui a donné.

**Un avis paraît après relecture.** Il part en `en_attente` — le message le dit — et n'apparaît
publiquement qu'une fois publié depuis le back-office. Son autrice, elle, le voit dans tous ses
états : sans ça il disparaîtrait sous ses yeux, et elle ne comprendrait pas pourquoi elle ne
peut pas en écrire un second sur le même achat (un seul par achat, tenu en base).

La note affichée vient de `/api/avis/resume/`, qui ne compte que les avis publiés. La fiche,
l'accueil et le bandeau annoncent donc « aucun avis » — ou n'affichent rien du tout — tant que
personne n'a écrit, au lieu d'inventer un 4,8 sur 126 avis. La référence de commande n'est plus
affichée sous les avis : sous chacun, elle donnerait le compte des ventes à qui sait lire.

### Back-office

Il était une maquette : `components/admin.tsx` affichait des tableaux écrits en dur, et
`lib/admin/{types,seed,store}.ts(x)` — 1 300 lignes déjà à la bonne forme — n'était importé par
personne. Le magasin est maintenant branché, et la maquette a été supprimée.

**`lib/admin/store.tsx`** tient tout le back-office dans une seule clé (`mcm-admin-v1`) :
produits, commandes, clientes, rayons, promotions, bibliothèque, réglages, bandeau d'accueil et
journal des actions. Il expose une vingtaine de mutations et, à côté, les fonctions dérivées —
`computePeriod`, `buildDailySeries`, `computeProductPerformance`, `computeCustomerStats`. Aucun
chiffre n'est écrit dans une page : tout se recalcule à partir des commandes.

**`migrer()` accompagne chaque changement de forme.** Un navigateur qui a déjà l'ancien format
lit `undefined` et la page tombe ; toute modification de `AdminState` doit ajouter son entrée.

**La navigation reprend celle de 3001** — mêmes libellés, même ordre — pour qu'on passe de l'un à
l'autre sans se réapprendre le menu. La palette de commandes (Ctrl/⌘ + K) cherche dans les pages,
les fiches, les commandes et les clientes ; Entrée ouvre le premier résultat.

**Les promotions** sont la page la plus travaillée, reprise trait pour trait de 3001 : campagnes
en bons de réduction (talon, encoches, pointillé), onglets Toutes / En cours / Programmées /
Terminées avec leurs compteurs, barre d'avancement et « N j restants », portée résumée en une
phrase, et un tiroir latéral pour la saisie — durées proposées, pastilles de choix expliquées,
et la cascade rayon → article plutôt qu'une liste de tout le catalogue.

**La pagination est dans la primitive**, pas dans les pages : `usePagination` découpe une liste et
`Pagination` dessine la barre ; `Table` s'en sert tout seul, avec `pageSize` et le nom de ce qu'on
compte (« 1–20 sur 243 commandes »). Les deux grilles de cartes — promotions et catégories — les
appellent directement. Un changement de filtre ou de recherche ramène en page 1, et la page
courante se recale d'elle-même quand une suppression raccourcit la liste.

L'interface tient en deux fichiers de base : **`components/admin/ui.tsx`** (tableau en grille CSS,
pastilles de statut, champs, fenêtre modale, suppression en deux temps, barres dessinées à la
main) et **`components/admin/shell.tsx`** (le portier et la chrome). Les icônes ont leur propre
jeu, `components/admin/icons.tsx`, séparé de celui de la vitrine.

Le fournisseur ne descend que sur `/admin` (`app/admin/layout.tsx`) : la vitrine n'a pas à porter
un état qu'elle n'ouvre jamais. Le groupe `(espace)` porte le portier et la chrome ;
`/admin/connexion` reste en dehors, sinon la page de connexion serait elle-même protégée.

**Le portier n'est pas une sécurité.** Il regarde une clé du navigateur, et les identifiants de
démonstration sont écrits en clair dans la page de connexion
(`ousseynou@mcommemaman.sn` / `mcm2026`). Tant que le back-office ne modifie qu'un état local,
c'est sans conséquence. Dès qu'il écrit en base, il faut un vrai compte administrateur, une
session en cookie signé, et la vérification du rôle sur le serveur à **chaque** écriture.

**Les deux ponts sont posés.** Les commandes, les comptes et les avis de la vitrine sont en base
et se lisent ici ; et ce qu'on modifie ici redescend sur la vitrine — rayons, fiches, réglages,
bandeau, campagnes. Le tableau de bord compte à partir du **vrai jour** : la date de démonstration
figée au 15 août 2026 a disparu avec la graine locale.

### Publication d'un produit

`components/product-form.tsx` est le seul éditeur : sans `product` il crée, avec il modifie, et il
écrit dans le magasin. Les coloris, tailles et matières ne s'y saisissent pas — ils viennent de la
bibliothèque, ce qui évite « rose poudré » d'un côté et « Rose Poudre » de l'autre. Il applique le
garde-fou de l'audit : cinq conditions avant publication —
nom commercial de 4 caractères minimum, au moins une photo, prix supérieur à zéro, description de
20 caractères minimum, référence interne renseignée. Tant qu'il en manque une, seul
« Enregistrer en brouillon » est actif et le panneau latéral liste ce qui manque.

**À reproduire côté serveur.** Le contrôle est aujourd'hui dans le composant : un appel direct à
l'API le contournerait. La règle doit vivre dans la couche de validation avant l'écriture en base.

Trois points repris de l'audit et déjà tenus dans le code :

- **Prix en entiers** (`price: 12000`), jamais de `Float` — `lib/format.ts` gère l'affichage.
- **Compte à rebours piloté par une date** (`PROMO_END`) : `components/countdown.tsx` ne rend
  rien quand l'échéance est passée, au lieu d'afficher 00:00:00:00.
- **Référence interne séparée du nom** : `sku` est affiché en petit sur la fiche, jamais en titre.

---

## Animations

Toujours aucune bibliothèque. Les keyframes vivent dans `app/globals.css`, les primitives
réutilisables dans `components/motion.tsx` et `components/reveal.tsx`.

| Effet | Où |
|---|---|
| Rail produits qui défile seul en boucle, tiré à la souris, flèches et barre d'avancement | `<Carousel speed={46}>` |
| Pile verticale des univers, visuels latéraux qui se substituent | `components/universes.tsx` |
| Arche du bandeau d'accueil qui monte à l'ouverture | `.anim-arch` |
| Trait dessiné sous le mot d'accent | `.anim-draw` + `--len` sur le `<path>` |
| Révélation au défilement, 5 variantes (`up`, `blur`, `scale`, `left`, `right`) | `<Reveal variant="…">` |
| Cascade des enfants d'une grille | `<Reveal stagger={90}>` → classe `.stagger` |
| Titre d'accueil mot à mot, derrière un masque | `<SplitText>` + `.word-mask` |
| Chiffres qui comptent à l'apparition | `<CountUp>` (rAF, `easeOut`) |
| Travelling lent sur la photo d'accueil | `.anim-ken` |
| Points cliquables posés sur une photo | `.hotspot` (libre d'emploi) |
| Halos colorés qui dérivent en fond | `.aurora` |
| Bandeau défilant en boucle, dans les deux sens | `<Marquee>`, `.marquee-rev` |
| Étiquette « Voir » qui suit le curseur sur un visuel | `<CursorTag>` |
| Lueur et inclinaison 3D suivant le curseur | `<GlowCard tilt={5}>`, `useSpotlight` |
| Bouton attiré par le curseur | `<Magnetic>` |
| Photo qui traîne derrière le défilement | `<Parallax speed={26}>` |
| Barre de lecture sous le header | `<ScrollProgress>` |
| Pastille glissante sous l'onglet actif | mesure des boutons dans `components/home.tsx` |
| Reflet qui traverse un bouton au survol | `.shine` |
| Zoom image au survol des cartes | `group-hover:scale-108` sur `components/product-card.tsx` |
| Impulsion de la pastille panier | `anim-pop` + `key={pulse}` dans `components/header.tsx` |
| Bascule des secondes, rotation du bandeau d'annonce | `anim-tick` + `key` sur la valeur |
| Ouverture du panier / modale | `anim-slide-in`, `anim-fade-up` |

Deux règles tenues partout :

- **`animation-fill-mode: backwards`, jamais `forwards`.** Une animation remplie vers l'avant garde
  son dernier keyframe en priorité sur les déclarations normales : `transform: none` neutraliserait
  définitivement les `hover:-translate-y` et les inclinaisons des cartes.
- **Un bloc `prefers-reduced-motion`** en fin de `globals.css` coupe animations, transitions et
  inclinaisons. Les hooks JS (`Parallax`, `useSpotlight`, `Magnetic`, `CountUp`) testent la même
  media query avant de poser le moindre écouteur.

`CountUp` rend la valeur finale côté serveur et la remet à zéro en `useLayoutEffect` : sans
JavaScript, le chiffre affiché reste juste.

**Le carrousel est toujours rendu**, jamais monté à l'apparition : les douze pièces doivent être
dans le HTML servi, pour les moteurs comme pour un navigateur sans JavaScript. C'est sa `key` qui
change quand la section entre à l'écran — les cartes sont recréées et la cascade rejoue au bon
moment. Une traînée de plus de 4 px avale le clic de fin de geste, sinon déplacer le rail
finirait par ouvrir une fiche produit.

**Le défilement automatique** avance à 46 px par seconde. La piste est doublée côté client
seulement — le HTML servi ne contient qu'un exemplaire de chaque pièce, la copie est `inert` et
`aria-hidden` pour ne pas être annoncée deux fois. Arrivé au bout de la première piste, on
retranche sa largeur : le saut tombe sur une image identique et ne se voit pas.

Il s'arrête dès que quelqu'un s'en occupe — survol, traînée, molette, doigt, flèches, focus
clavier — et reprend 2,6 s après. Il ne démarre pas du tout quand l'onglet est en arrière-plan,
quand le mouvement réduit est demandé, ou quand les pièces filtrées tiennent déjà dans la largeur
(l'onglet « Bébé » et ses deux pièces retrouvent alors un rail simple, avec aimantation).

La position est tenue en flottant dans une ref plutôt que lue depuis `scrollLeft` : les
sous-pixels seraient perdus d'une image à l'autre et le défilement avancerait par à-coups.

---

## Images

Elles pointent encore vers le CDN Shopify actuel (`mcommaman.com/cdn/shop/files/…`), autorisé
dans `next.config.ts`. C'est provisoire : la phase 0 de l'audit prévoit une séance photo homogène.
Le bloc « Notre histoire » de l'accueil affiche volontairement un aplat rayé légendé
« photo à réaliser » plutôt qu'une photo produit détournée.

Le catalogue de démonstration compte **12 pièces réellement photographiées** sur les 19 références
de la boutique. Les noms, catégories et descriptions correspondent à ce qui est dans le cadre.

### Une seule photo d'ambiance

Le CDN a été sondé. Trois fichiers seulement sont exploitables en grand :
`8wy1hz0j.png` (924 × 1109, une enfant en robe fleurie sur fond clair), `enf1.jpg`
(1600 × 1073, deux enfants sur fond jaune) et `0804-Couverture.jpg`, inutilisable.
`enf2.jpg` ne fait que 236 × 319. Tout le reste, ce sont des pièces sur cintre sur
fond dégradé.

C'est ce qui dicte la construction du bandeau d'accueil : **une** photo, et une
forme qui la met en valeur au lieu d'en réclamer d'autres. `8wy1hz0j.png` est
cadrée en arche (`rounded-t-[999px]`), posée sur un lavis ivoire, et la robe
qu'elle porte est justement au catalogue — la pastille « Sur elle » renvoie à sa
fiche. `enf1` et `enf2` ne servent plus qu'en vignettes de 44 px sous les avis,
où leur définition suffit.

Le sujet doit rester **centré et sur fond calme** : la courbe de l'arche rogne les
angles hauts, une photo cadrée serré y perdrait une tête. Le cadrage est réglé par
`object-[50%_35%]` dans `components/hero.tsx`.

**Après la séance photo**, rien à toucher dans le code : le bandeau se règle depuis le
back-office (`/api/vitrine/bandeau/`). Tant qu'aucune photo n'y est active, la vitrine fait
défiler les deux vidéos livrées avec le site (`HERO_VIDEOS`, `lib/products.ts`) — la page
d'accueil n'est jamais nue.

---

## À faire avant la mise en ligne

Ce qui est fait — la vitrine ne fabrique plus rien qu'elle ne tienne du serveur :

- catalogue, rayons, tailles et coloris lus en base ; plus une seule liste écrite dans le code
- panier et favoris rattachés au compte, avec fusion à la connexion
- commandes écrites en base : prix refaits par le serveur, stock retiré, référence numérotée,
  suivi piloté par le back-office, annulation par la cliente tant que rien n'est préparé
- avis vérifiés côté serveur — commande livrée, la sienne, un seul par achat — et modérés
- frais de livraison, franco, coordonnées, bandeau d'annonce et ouverture de la caisse réglés
  depuis le back-office
- recherche faite en base, avec accents et synonymes

Ce qui reste :

1. Séance photo homogène, puis remplacement des URL du CDN Shopify
2. PayDunya : webhook signé, identifiant de transaction en clé unique, idempotence — aujourd'hui
   la commande part « en attente de paiement » et la boutique rappelle pour confirmer
3. Resend pour les e-mails de confirmation
4. NINEA et registre du commerce à renseigner dans `lib/legal.ts`
5. Photothèque sur un stockage persistant (Cloudflare R2) : sur une instance sans disque, les
   images envoyées depuis le back-office disparaissent à chaque livraison
6. Renseigner les réglages de la boutique à la première ouverture du back-office — le franco de
   port et les frais par zone y font foi
7. Test sur vrai téléphone en 4G — la cible est mobile
