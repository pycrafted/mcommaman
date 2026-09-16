/**
 * Le pont vers le serveur Django.
 *
 * Deux chemins, et il faut savoir lequel on emprunte :
 *
 * — **Depuis un composant serveur** (`lireCatalogue`, `lireFiche`…), l'appel
 *   part du serveur Next vers le serveur Django. Pas de cookie, pas de CSRF :
 *   on ne lit que du public. C'est ce chemin qui donne le rendu côté serveur,
 *   donc les pages remplies avant même que le JavaScript arrive.
 *
 * — **Depuis le navigateur** (`envoyer`), l'appel porte le cookie de session et
 *   le jeton CSRF. C'est le seul chemin pour tout ce qui écrit.
 *
 * Aucune adresse n'est écrite en dur ailleurs que dans ce fichier.
 */

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ErreurApi extends Error {
  constructor(
    message: string,
    readonly statut: number,
    readonly champs: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ErreurApi";
  }
}

/** Le message le plus utile que porte une réponse en erreur. */
function messageDe(corps: unknown, statut: number): string {
  if (corps && typeof corps === "object") {
    const objet = corps as Record<string, unknown>;
    if (typeof objet.detail === "string") return objet.detail;
    const premier = Object.values(objet)[0];
    if (Array.isArray(premier) && typeof premier[0] === "string") return premier[0];
  }
  if (statut >= 500) return "Le serveur ne répond pas correctement. Réessayez dans un instant.";
  return "La demande n'a pas abouti.";
}

/* ------------------------------------------------------------------ lecture */

type OptionsLecture = {
  /** Secondes de cache. 0 pour toujours redemander — les stocks bougent. */
  revalider?: number;
};

/**
 * Lecture publique, depuis le serveur Next ou le navigateur.
 *
 * Renvoie `null` plutôt que de lever quand la ressource n'existe pas : une
 * fiche supprimée doit donner une page « introuvable », pas une erreur 500.
 */
export async function lire<T>(
  chemin: string,
  { revalider = 60 }: OptionsLecture = {},
): Promise<T | null> {
  const reponse = await fetch(`${BASE}${chemin}`, {
    next: { revalidate: revalider },
    headers: { Accept: "application/json" },
  });

  if (reponse.status === 404) return null;
  if (!reponse.ok) {
    throw new ErreurApi(messageDe(await reponse.json().catch(() => null), reponse.status), reponse.status);
  }
  return reponse.json();
}

/* ------------------------------------------------------------------ écriture */

/**
 * Le jeton CSRF, gardé en mémoire.
 *
 * En développement, vitrine et serveur partagent `localhost` : le cookie posé
 * par Django est lisible ici, et c'est le repli. En ligne ils sont sur deux
 * domaines distincts — `document.cookie` ne montrera jamais celui du serveur.
 * D'où le jeton retenu tel que `/api/compte/csrf/` le renvoie dans son corps.
 * Le cookie, lui, continue de voyager avec la requête : c'est le serveur qui
 * compare les deux, pas nous.
 */
let jetonRetenu = "";

function jetonCsrf(): string {
  if (jetonRetenu) return jetonRetenu;
  const trouve = document.cookie
    .split("; ")
    .find((morceau) => morceau.startsWith("csrftoken="));
  return trouve ? decodeURIComponent(trouve.slice("csrftoken=".length)) : "";
}

let cookieDemande = false;

/**
 * S'assure qu'on a un jeton CSRF.
 *
 * Une seule fois par chargement, sauf après `oublierCsrf()` — la connexion
 * fait tourner le jeton côté serveur, et l'ancien devient bon à jeter.
 */
async function assurerCsrf(): Promise<void> {
  if (jetonCsrf() || cookieDemande) return;
  cookieDemande = true;
  try {
    const reponse = await fetch(`${BASE}/api/compte/csrf/`, { credentials: "include" });
    const donnees = (await reponse.json()) as { jetonCsrf?: string };
    jetonRetenu = donnees.jetonCsrf ?? "";
  } catch {
    // Sans jeton, la première écriture échouera avec un message clair : mieux
    // vaut ça qu'un plantage silencieux au chargement de la page.
    cookieDemande = false;
  }
}

/** Jette le jeton retenu, pour que le prochain envoi en redemande un neuf. */
function oublierCsrf(): void {
  jetonRetenu = "";
  cookieDemande = false;
}

type Methode = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Appel authentifié depuis le navigateur.
 *
 * `credentials: "include"` fait voyager le cookie de session, que le
 * JavaScript ne peut pas lire — c'est précisément ce qui le protège.
 */
export async function envoyer<T>(
  chemin: string,
  methode: Methode = "GET",
  corps?: unknown,
): Promise<T> {
  if (methode !== "GET") await assurerCsrf();

  const partir = () =>
    fetch(`${BASE}${chemin}`, {
      method: methode,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(corps ? { "Content-Type": "application/json" } : {}),
        ...(methode !== "GET" ? { "X-CSRFToken": jetonCsrf() } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
    });

  let reponse = await partir();

  // Se connecter fait tourner le jeton CSRF côté serveur : celui qu'on tenait
  // ne vaut plus rien et l'écriture suivante repart en 403. On en redemande un
  // et on rejoue une fois — la requête refusée n'a rien écrit, c'est sans
  // risque, et l'utilisateur ne voit pas passer un échec qui n'en est pas un.
  if (reponse.status === 403 && methode !== "GET") {
    oublierCsrf();
    await assurerCsrf();
    if (jetonCsrf()) reponse = await partir();
  }

  if (reponse.status === 204) return undefined as T;

  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const champs =
      donnees && typeof donnees === "object" && !Array.isArray(donnees)
        ? (donnees as Record<string, string[]>)
        : {};
    throw new ErreurApi(messageDe(donnees, reponse.status), reponse.status, champs);
  }
  return donnees as T;
}

/**
 * Envoi d'un fichier.
 *
 * Pas de `Content-Type` posé à la main : le navigateur doit composer lui-même
 * la frontière du multipart, et l'écraser casse la requête sans rien dire.
 */
export async function televerser<T>(chemin: string, forme: FormData): Promise<T> {
  await assurerCsrf();

  const partir = () =>
    fetch(`${BASE}${chemin}`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "X-CSRFToken": jetonCsrf() },
      body: forme,
    });

  let reponse = await partir();

  // Même raison que dans `envoyer` : le jeton a pu tourner sous nos pieds.
  if (reponse.status === 403) {
    oublierCsrf();
    await assurerCsrf();
    if (jetonCsrf()) reponse = await partir();
  }

  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const champs =
      donnees && typeof donnees === "object" && !Array.isArray(donnees)
        ? (donnees as Record<string, string[]>)
        : {};
    throw new ErreurApi(messageDe(donnees, reponse.status), reponse.status, champs);
  }
  return donnees as T;
}

/* ------------------------------------------------------------------ formes */

/** Ce que renvoie une liste paginée du serveur. */
export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/** Ce qu'on achète réellement : un produit dans une taille et un coloris. */
export type VarianteApi = {
  id: number;
  sku: string;
  taille_valeur: string;
  taille_repere: string;
  coloris_nom: string;
  coloris_hexa: string;
  stock: number;
  disponible: boolean;
};

/**
 * Un produit tel qu'une liste le renvoie : de quoi dessiner une carte.
 *
 * Les listes ne portent ni description, ni galerie, ni tailles — la fiche les
 * porte (`ProduitApi`). C'est ce qui garde les pages de la boutique légères.
 */
export type ProduitCarteApi = {
  id: number;
  slug: string;
  nom: string;
  /** Ce qu'on paie aujourd'hui : le prix de la fiche, remise en cours déduite. */
  prix_public: number;
  /** Le prix à barrer — celui d'avant la remise, ou le prix barré saisi. */
  prix_avant: number | null;
  /** La campagne qui s'applique, s'il y en a une. */
  promotion: {
    libelle: string;
    pourcentage: number;
    economie: number;
    jusquau: string;
  } | null;
  rayon_nom: string;
  rayon_slug: string;
  image: string;
  en_rupture: boolean;
};

/** Les filtres d'une catégorie, comptés par le serveur. */
export type FacettesApi = {
  total: number;
  prix_min: number;
  prix_max: number;
  /** Nombre d'articles par sous-catégorie, par slug. */
  sous_categories: Record<string, number>;
  /** Les tailles encore en stock, dans l'ordre du guide. */
  tailles: { valeur: string; nombre: number }[];
};

/** Un produit tel que sa fiche le décrit. */
export type ProduitApi = ProduitCarteApi & {
  prix: number;
  prix_barre: number | null;
  description: string;
  matiere: string;
  univers: "enfant" | "maman";
  genre: "fille" | "garcon" | "mixte" | "";
  age: "2-10" | "11-14" | "";
  image: string;
  photos: string[];
  tailles: { valeur: string; repere: string; disponible: boolean; ordre: number }[];
  coloris: { nom: string; hexa: string }[];
  en_rupture: boolean;
  variantes?: VarianteApi[];
};

export type SousRayonApi = {
  id: number;
  nom: string;
  slug: string;
  description: string;
  /** Le visuel choisi dans le back-office, vide tant qu'il n'y en a pas. */
  image_url: string;
  ordre: number;
  nombre_produits: number;
};

export type RayonApi = {
  id: number;
  nom: string;
  slug: string;
  /**
   * Les catégories qui la contiennent. Vide pour une catégorie de premier
   * niveau ; plusieurs quand elle se range à deux endroits.
   */
  parents: number[];
  parents_slugs: string[];
  parents_noms: string[];
  /** Les sous-catégories, déjà triées. */
  enfants: SousRayonApi[];
  univers: "enfant" | "maman";
  description: string;
  image_url: string;
  visible: boolean;
  ordre: number;
  nombre_produits: number;
  /** Back-office seulement : fiches rangées directement ici, et brouillons parmi elles. */
  fiches?: number;
  fiches_brouillons?: number;
};

/* ---------------------------------------------------------------- réglages */

/**
 * Les réglages publics de la boutique.
 *
 * L'identité, les frais de livraison et le bandeau d'annonce, tels que la
 * gérante les règle dans le back-office. Rien de tout cela n'est écrit dans le
 * code de la vitrine : changer un franco de port ne demande pas une livraison.
 */
export type ReglagesApi = {
  nom_boutique: string;
  signature: string;
  email_contact: string;
  telephone: string;
  devise: string;
  /** Montant à partir duquel la livraison sur Dakar ne coûte rien. */
  franco_dakar: number;
  frais_dakar: number;
  frais_thies: number;
  frais_regions: number;
  /** Faux pendant les congés : la boutique reste consultable, la caisse ferme. */
  accepte_commandes: boolean;
  affiche_bandeau_promo: boolean;
  texte_bandeau_promo: string;
};

/** Une photo du bandeau d'accueil, avec l'article qu'elle met en avant. */
export type BandeauApi = {
  id: number;
  titre: string;
  accroche: string;
  url: string;
  texte_alternatif: string;
  /** Recadrage CSS, quand le sujet n'est pas au centre : « 50% 40% ». */
  cadrage: string;
  etiquette: string;
  produit_slug: string;
  produit_nom: string;
  produit_prix: number;
  ordre: number;
};

/* ---------------------------------------------------------------- commandes */

/** Une ligne de commande, figée telle qu'elle a été achetée. */
export type LigneCommandeApi = {
  id: number;
  nom_produit: string;
  slug_produit: string;
  url_image: string;
  /** « Rose poudré · 4 ans », composé au moment de l'achat. */
  libelle_option: string;
  prix_unitaire: number;
  quantite: number;
  sous_total: number;
};

/**
 * Une commande, telle que la cliente la suit.
 *
 * `statut` est celui de la boutique — il distingue « en attente » de « payée » —
 * et `statut_cliente` sa traduction en suivi. C'est le second qui s'affiche.
 */
export type CommandeApi = {
  reference: string;
  creee_le: string;
  statut: "en_attente" | "payee" | "preparation" | "expediee" | "livree" | "annulee";
  statut_cliente: string;
  nom_client: string;
  telephone: string;
  email: string;
  zone: "dakar" | "thies" | "regions";
  ville: string;
  adresse: string;
  notes: string;
  sous_total: number;
  frais_livraison: number;
  remise: number;
  total: number;
  moyen_paiement: "wave" | "om" | "cb" | "cod";
  moyen_paiement_libelle: string;
  lignes: LigneCommandeApi[];
};

/** Le chiffrage d'un panier, refait par le serveur avant chaque affichage. */
export type DevisApi = {
  sous_total: number;
  frais_livraison: number;
  remise: number;
  /** Le nom de la campagne qui fait la remise, vide sans remise. */
  remise_libelle: string;
  total: number;
};

/* --------------------------------------------------------------- campagnes */

/**
 * Une campagne telle que la boutique l'annonce.
 *
 * Il n'y a pas de code à taper : une campagne s'applique d'elle-même.
 * `condition` ne compte que pour une remise de commande — première commande,
 * ou montant minimum.
 */
export type CampagneApi = {
  libelle: string;
  type: "pourcentage" | "montant";
  valeur: number;
  /** Dernier jour inclus. C'est la date que lit le compte à rebours. */
  date_fin: string;
  portee: "boutique" | "rayon" | "produit" | "commande";
  rayon_nom: string;
  produit_slug: string;
  condition: "premiere" | "montant_minimum";
  montant_minimum: number;
};

/* -------------------------------------------------------------------- avis */

export type AvisApi = {
  id: number;
  note: number;
  commentaire: string;
  auteur_nom: string;
  /** L'article noté, ou `null` pour un avis sur la boutique entière. */
  produit: number | null;
  produit_nom: string;
  produit_slug: string;
  /** Vrai pour l'autrice connectée : c'est ce qui ouvre modification et retrait. */
  est_le_mien: boolean;
  commande: number;
  /** Un avis n'apparaît publiquement qu'une fois relu. Son autrice, elle, le
      voit dans tous les états — sans quoi il disparaîtrait sous ses yeux. */
  etat: "en_attente" | "publie" | "refuse";
  ecrit_le: string;
};

/** Le résumé affiché sous une fiche : combien d'avis, quelle moyenne. */
export type AgregatAvisApi = {
  nombre: number;
  moyenne: number;
  /** Le nombre d'avis par note, de « 1 » à « 5 ». */
  repartition: Record<string, number>;
};

/** Ce qu'une cliente peut encore noter : ses achats livrés, non déjà notés. */
export type AvisPossibleApi = {
  /** L'identifiant de la commande : c'est lui qu'il faut renvoyer pour écrire. */
  commande: number;
  /** Sa référence, celle qu'on montre à la cliente. */
  commande_reference: string;
  livree_le: string;
  produit: number | null;
  nom_produit: string;
  slug_produit: string;
  image: string;
};

/* ------------------------------------------------------------------- panier */

/**
 * Une ligne de panier.
 *
 * Le serveur recopie ici le nom, le prix et l'image : la vignette se dessine
 * sans second appel, et le panier reste lisible même si la fiche bouge.
 */
export type LignePanierApi = {
  id: number;
  variante: number;
  produit: number;
  slug: string;
  nom: string;
  /** « Rose poudré · 4 ans », composé côté serveur. */
  option: string;
  image: string;
  prix_unitaire: number;
  quantite: number;
  sous_total: number;
  stock_restant: number;
  /** Faux quand la fiche est dépubliée ou le stock retombé sous la quantité. */
  disponible: boolean;
};

export type PanierApi = {
  id: number;
  lignes: LignePanierApi[];
  sous_total: number;
  nombre_articles: number;
  /** Faux dès qu'une ligne n'est plus servable — le tunnel le dit avant la caisse. */
  complet: boolean;
  modifie_le: string;
  /** Seulement en réponse à une fusion : les articles épuisés, laissés de côté. */
  ignorees?: string[];
};
