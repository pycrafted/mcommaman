# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce dépôt

Un seul dépôt, trois dossiers. `back` et `front` forment la boutique ; `boty-e-commerce-template` est la maquette dont elle s'inspire, gardée pour référence.

| Dossier | Ce que c'est | Stack |
|---|---|---|
| `back/` | Le serveur : API de la boutique — catalogue, comptes, panier, ventes, réglages. | Django 5.2, DRF, PostgreSQL 17, Argon2 |
| `front/` | La vitrine `mcommaman.com` et son back-office. Zéro dépendance hors Next/React. | Next 15.4, React 19, Tailwind 4, aucune lib UI ni d'animation |
| `boty-e-commerce-template/` | Maquette de référence, tout en mémoire navigateur. On y lit des idées, on n'y corrige rien. | Next 16, React 19, shadcn/ui, Radix, Recharts |

`front` appelle `back` par HTTP, et rien d'autre ne les relie : le passage entre les deux vocabulaires tient dans `front/lib/api.ts` et `front/lib/admin/passage.ts`. Aucune adresse de serveur n'est écrite ailleurs.

**Toute la base est en français** — copie d'interface, commentaires, et une partie des identifiants et des types métier (`migrer`, `chercherProduits`, statuts `publie` / `en_attente` / `expediee`). Écrire le nouveau code dans la même langue et le même registre que le fichier modifié.

## Commandes

Le serveur écoute le **8000**, la vitrine le **3000**. Il faut les deux : sans le serveur, la boutique s'affiche vide.

```bash
# back/
docker compose up -d                         # PostgreSQL
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py peupler   # données de démonstration
.venv\Scripts\python.exe manage.py runserver
.venv\Scripts\python.exe manage.py test      # 152 tests, le vrai filet

# front/
npm install            # déclenche postinstall → fix-routes (obligatoire, voir ci-dessous)
npm run dev
npm run build
npx tsc --noEmit       # le seul contrôle de types réel — voir ci-dessous
```

- **Le back a des tests, le front n'en a pas.** Côté serveur, `manage.py test` décrit les règles métier et doit rester vert. Côté vitrine, vérifier une modification veut dire lancer `npm run dev` et regarder la page.
- Les identifiants de démonstration après peuplement : `gerante@mcommaman.com` / `motdepasse123`.
- **`npm run lint` (boty) échoue** : le script est `eslint .` mais ESLint n'est ni installé ni configuré. Ne pas s'appuyer dessus ; utiliser `npx tsc --noEmit`.
- **`next.config.mjs` de boty active `typescript.ignoreBuildErrors`** : `npm run build` passe même avec des erreurs de types. Lancer `npx tsc --noEmit` explicitement avant de considérer une modification comme terminée.
- Boty a `package-lock.json` **et** `pnpm-lock.yaml` ; le `.claude/launch.json` de chaque projet utilise npm — s'y tenir.
- `boty-e-commerce-template/.next-stale-20260815-1648/` est un reliquat de build, à ignorer.

### Routes dynamiques du projet Redesign

La maquette est livrée en export sans crochets dans les noms de dossier : `app/p/-slug-` au lieu de `app/p/[slug]`. `scripts/fix-routes.mjs` renomme récursivement `-slug-` → `[slug]` et tourne en `postinstall`. Si une route dynamique renvoie 404 après avoir récupéré une nouvelle copie du dossier, c'est ça — lancer `npm run fix-routes`.

## Architecture — boty-e-commerce-template (référence)

### Il n'y a pas de serveur

Pas de route API, pas de base, pas de session serveur. **Tout l'état persiste dans `localStorage`**, exposé par des contextes React. Les données de départ sont des tableaux statiques (`lib/products.ts` pour le catalogue, `lib/admin/seed.ts` pour le back-office).

Clés de stockage, une par domaine : `mcm-cart-v1`, `mcm-favorites-v1`, `mcm-orders-v1`, `mcm-reviews-v1`, `mcm-admin-state-v1`, `mcm-admin-session`.

### Deux arbres de providers

`app/layout.tsx` empile les contextes de la **vitrine** : `AuthProvider > FavoritesProvider > OrdersProvider > ReviewsProvider > CartProvider` (`components/boty/*-context.tsx`).

`app/admin/layout.tsx` monte séparément l'**administration** : `AdminProvider` (`lib/admin/store.tsx`, ~700 lignes, l'état complet du back-office en un seul contexte) enveloppé d'`AdminGate`. Le groupe de routes `app/admin/(espace)/` porte la chrome `AdminShell` ; `app/admin/connexion` reste en dehors.

### Le pont vitrine ↔ administration

La vitrine **lit directement l'état du back-office dans `localStorage`**, sans passer par `AdminProvider` : `components/boty/use-hero-config.ts` et `use-size-guide.ts` ouvrent la clé `mcm-admin-state-v1` à la main et écoutent l'événement `storage` pour suivre les changements faits dans un autre onglet. Le littéral de la clé est donc dupliqué dans ces hooks — le modifier dans `store.tsx` sans les mettre à jour casse silencieusement le bandeau d'accueil et le guide des tailles. Le couplage n'existe que dans un même navigateur : sur un poste où le back-office n'a jamais été ouvert, la vitrine retombe sur ses valeurs par défaut.

### Migration de l'état persisté

`migrer()` dans `lib/admin/store.tsx` remet un état enregistré par une version antérieure au format courant (catégorie sans `links`, promotion sans `durationDays`, taille encore stockée en chaîne…). **Toute modification de la forme de `AdminState` doit s'accompagner d'une entrée dans `migrer()`** : sans ça, un navigateur qui a déjà l'ancien format lit `undefined` et la page tombe.

### Convention d'hydratation

Chaque provider démarre sur ses valeurs par défaut, lit `localStorage` dans un `useEffect` de montage, puis expose un booléen `hydrated`. Le premier rendu doit rester identique côté serveur et client. Reprendre ce schéma pour tout nouvel état persistant, plutôt que de lire `window` pendant le rendu.

### Authentification

Purement décorative. `AdminGate` (`components/admin/shell.tsx`) vérifie la présence d'une clé `localStorage` ; les identifiants de démonstration sont en clair dans `app/admin/connexion/page.tsx`. Le commentaire du fichier le dit : ce n'est pas une sécurité. Ne pas construire dessus sans back-end réel.

### Organisation des composants

- `components/ui/` — shadcn/ui, style *new-york*, 57 fichiers générés (`components.json`). Ne pas les retoucher à la main sans raison précise.
- `components/boty/` — la vitrine (hero, panier, recherche, avis, tunnel de commande).
- `components/admin/` — le back-office. `ui.tsx` (~840 lignes) est son propre jeu de primitives, distinct de `components/ui/` ; `product-studio.tsx` et `hero-studio.tsx` sont les éditeurs.

### Style

Tailwind 4 via `@tailwindcss/postcss`, **sans `tailwind.config`** : les jetons de design sont des variables CSS dans `app/globals.css` (palette ivoire / corail / pêche / sauge / prune, thème clair et sombre). `styles/globals.css` est un reliquat de génération v0 — importé nulle part, ne pas y écrire.

### Règles métier

Les constantes commerciales vivent dans `lib/`, une source par sujet : `shipping.ts` (seuil de livraison offerte, zones, moyens de paiement), `promo.ts` (campagne en cours — mettre `promoCampaign` à `null` retire le bandeau, le compte à rebours lit `endsAt`, il n'y a pas d'horloge ailleurs), `search.ts` (recherche en mémoire, normalisation des accents et table de synonymes). Les prix sont des entiers en FCFA, formatés par `formatPrice` (`lib/products.ts`).

`docs/uml/` contient les cas d'utilisation en `.puml` avec leurs rendus `.png`/`.svg` commités — regénérer les deux si le diagramme change.

## Architecture — front

`README.md` du projet est détaillé et à jour : table des routes, inventaire des animations, contraintes photo, reste à faire avant mise en ligne. **Le lire avant de toucher à ce projet.** Points structurants :

- **Aucune dépendance hors Next/React/Tailwind.** Les animations sont écrites à la main : keyframes dans `app/globals.css`, primitives dans `components/motion.tsx` (`Carousel`, `Parallax`, `Magnetic`, `CountUp`, `SplitText`, `Marquee`, `GlowCard`) et `components/reveal.tsx`. Ne pas introduire de bibliothèque d'animation pour ajouter un effet.
- Deux règles tenues partout, expliquées dans le README : `animation-fill-mode: backwards` jamais `forwards` (sinon les `hover:` des cartes sont neutralisés), et un bloc `prefers-reduced-motion` que les hooks JS testent aussi avant de poser le moindre écouteur.
- **Plus rien n'est écrit en dur dans la vitrine.** Catalogue, rayons, tailles, coloris, frais de livraison, coordonnées, bandeau d'accueil, campagnes, commandes et avis viennent tous de `back`. `lib/products.ts` ne garde que le type `Product` et les deux vidéos du bandeau ; le tableau `README.md` § « Ce que la vitrine lit sur le serveur » liste chaque route.
- Les réglages de la boutique sont lus **une seule fois**, par `app/layout.tsx`, et posés dans `components/reglages-context.tsx` (`useReglages()`). Ne pas refaire l'appel ailleurs.
- `components/header.tsx` est un composant **serveur** qui va chercher rayons et décompte ; l'affichage est dans `header-barre.tsx` (client). Même découpage à reprendre si un autre composant partagé a besoin de données serveur.
- **Aucun montant ne se calcule dans le navigateur.** Le tunnel demande `POST /api/devis/` à chaque changement de panier, de zone ou de code, et la commande part sans le moindre prix : `ventes/tarification.py` refait tout. Un code de réduction se vérifie en base, jamais dans une table locale.
- `components/product-form.tsx` applique cinq conditions avant publication côté client ; `Produit.manque_pour_publier()` les réapplique côté serveur, et c'est celle-là qui est opposable.
- Les images pointent vers le CDN Shopify de production, autorisé dans `next.config.ts` (`remotePatterns`). Provisoire, en attente d'une séance photo.
