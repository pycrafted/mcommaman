/**
 * Le catalogue, lu sur le serveur.
 *
 * Ce fichier remplace `lib/products.ts` comme source : les composants gardent
 * exactement le même type `Product`, seule la provenance change. C'était le but
 * de la forme donnée au tableau statique dès le départ.
 *
 * `lib/products.ts` reste en place pour les visuels du bandeau, les tailles et
 * les coloris de référence, qui ne dépendent pas encore du serveur.
 */

import { lire, type Page, type ProduitApi, type RayonApi } from "./api";
import type { Product, Univers } from "./products";

/** Un produit du serveur, mis à la forme que les composants connaissent déjà. */
export function versProduit(brut: ProduitApi): Product {
  return {
    id: String(brut.id),
    slug: brut.slug,
    name: brut.nom,
    sku: "",
    /* Le prix affiché est celui que la caisse retiendra : c'est le serveur qui
       décide, remises en cours comprises. */
    price: brut.prix_public ?? brut.prix,
    compareAt: brut.prix_avant ?? undefined,
    promotion: brut.promotion ?? undefined,
    category: brut.rayon_nom,
    univers: brut.univers as Univers,
    image: brut.image,
    description: brut.description,
    outOfStock: brut.en_rupture,
  };
}

export type FiltresCatalogue = {
  univers?: Univers;
  rayon?: string;
  taille?: string;
  promo?: boolean;
  q?: string;
  tri?: "nouveautes" | "prix-croissant" | "prix-decroissant" | "nom";
};

function requete(filtres: FiltresCatalogue): string {
  const params = new URLSearchParams();
  if (filtres.univers) params.set("univers", filtres.univers);
  if (filtres.rayon) params.set("rayon", filtres.rayon);
  if (filtres.taille) params.set("taille", filtres.taille);
  if (filtres.promo) params.set("promo", "1");
  if (filtres.q) params.set("q", filtres.q);
  if (filtres.tri) params.set("tri", filtres.tri);
  // Le catalogue tient sur une page : la boutique n'a pas de pagination.
  params.set("page_size", "100");
  return params.toString();
}

/** Les fiches publiées d'un univers. Vide plutôt qu'une erreur si le serveur dort. */
export async function lireCatalogue(filtres: FiltresCatalogue = {}): Promise<Product[]> {
  try {
    const page = await lire<Page<ProduitApi>>(`/api/catalogue/produits/?${requete(filtres)}`, {
      // Le stock bouge : une minute de cache suffit à absorber les rafales sans
      // afficher une rupture d'il y a une heure.
      revalider: 60,
    });
    return (page?.results ?? []).map(versProduit);
  } catch {
    // Le serveur peut être éteint en développement. La boutique doit rester
    // consultable plutôt que de rendre une page d'erreur.
    return [];
  }
}

/**
 * Quelques fiches désignées par leur identifiant.
 *
 * Sert les favoris, qui ne connaissent que des identifiants et traversent les
 * deux univers. L'ordre demandé est rendu : c'est celui de la mise de côté, la
 * dernière en tête.
 */
export async function lireProduitsParIds(ids: string[]): Promise<Product[]> {
  const voulus = ids.filter((id) => /^\d+$/.test(id));
  if (voulus.length === 0) return [];
  try {
    const page = await lire<Page<ProduitApi>>(
      `/api/catalogue/produits/?ids=${voulus.join(",")}&page_size=100`,
      { revalider: 60 },
    );
    const fiches = new Map((page?.results ?? []).map((brut) => [String(brut.id), versProduit(brut)]));
    return voulus.map((id) => fiches.get(id)).filter((p): p is Product => Boolean(p));
  } catch {
    return [];
  }
}

/** Une fiche complète, variantes comprises. `null` si elle n'existe pas. */
export async function lireFiche(slug: string): Promise<{ produit: Product; brut: ProduitApi } | null> {
  try {
    const brut = await lire<ProduitApi>(`/api/catalogue/produits/${slug}/`, { revalider: 60 });
    return brut ? { produit: versProduit(brut), brut } : null;
  } catch {
    return null;
  }
}

/** Les quatre voisines de rayon, proposées sous une fiche. */
export async function lireSimilaires(slug: string): Promise<Product[]> {
  try {
    const liste = await lire<ProduitApi[]>(`/api/catalogue/produits/${slug}/similaires/`, {
      revalider: 300,
    });
    return (liste ?? []).map(versProduit);
  } catch {
    return [];
  }
}

/**
 * Les rayons visibles d'un univers.
 *
 * Le serveur ne renvoie que le premier niveau ; chaque catégorie porte ses
 * sous-catégories dans `enfants`. Le menu affiche les racines, les filtres
 * déplient.
 */
export async function lireRayons(univers?: Univers): Promise<RayonApi[]> {
  try {
    const chemin = univers
      ? `/api/catalogue/rayons/?univers=${univers}`
      : "/api/catalogue/rayons/";
    // Les rayons changent rarement : un quart d'heure de cache est large.
    return (await lire<RayonApi[]>(chemin, { revalider: 900 })) ?? [];
  } catch {
    return [];
  }
}

/** Un rayon tel que le menu, le pied de page et les tuiles l'affichent. */
export type LienRayon = {
  nom: string;
  slug: string;
  nombre: number;
  description: string;
  /** Le visuel réglé dans le back-office, vide tant qu'il n'y en a pas. */
  image: string;
};

/**
 * Les rayons sur lesquels cliquer veut dire quelque chose.
 *
 * Une fiche est rangée dans une seule catégorie, la plus fine : filtrer sur
 * « Enfants » ne retirerait rien, ce sont ses sous-catégories qui font des
 * liens utiles. Une catégorie qui n'a pas de sous-catégorie se propose telle
 * quelle — c'est elle qui porte les fiches.
 *
 * Le passage par les slugs déjà vus n'est pas une précaution de style : une
 * sous-catégorie rangée sous deux parentes reviendrait deux fois.
 */
export function rayonsNavigables(rayons: RayonApi[]): LienRayon[] {
  const vus = new Set<string>();
  const liste: LienRayon[] = [];
  for (const racine of rayons) {
    const entrees: LienRayon[] = racine.enfants.length
      ? racine.enfants.map((e) => ({
          nom: e.nom,
          slug: e.slug,
          nombre: e.nombre_produits,
          description: e.description,
          image: e.image_url,
        }))
      : [
          {
            nom: racine.nom,
            slug: racine.slug,
            nombre: racine.nombre_produits,
            description: racine.description,
            image: racine.image_url,
          },
        ];
    for (const entree of entrees) {
      if (vus.has(entree.slug)) continue;
      vus.add(entree.slug);
      liste.push(entree);
    }
  }
  return liste;
}

/** Les rayons cliquables d'un univers, en un appel. */
export async function lireRayonsNavigables(univers?: Univers): Promise<LienRayon[]> {
  return rayonsNavigables(await lireRayons(univers));
}

/** Une catégorie de premier niveau, avec ce qu'elle contient. */
export type BrancheRayon = LienRayon & { enfants: LienRayon[] };

/**
 * Le catalogue tel qu'il se déplie, sur deux étages.
 *
 * `rayonsNavigables` aplatit l'arborescence — c'est ce que veulent le pied de
 * page et les pastilles de filtre, qui n'ont qu'un niveau à offrir. Le menu,
 * lui, a la place de montrer le classement : une catégorie, ses
 * sous-catégories dessous. D'où cette seconde lecture des mêmes données.
 *
 * Le nombre porté par une catégorie compte ses sous-catégories (c'est le
 * serveur qui l'établit, voir `RayonSerializer.get_nombre_produits`) : les
 * additionner ici compterait deux fois une sous-catégorie rangée à deux
 * endroits.
 */
export function arborescenceRayons(rayons: RayonApi[]): BrancheRayon[] {
  return rayons.map((racine) => ({
    nom: racine.nom,
    slug: racine.slug,
    nombre: racine.nombre_produits,
    description: racine.description,
    image: racine.image_url,
    enfants: racine.enfants.map((enfant) => ({
      nom: enfant.nom,
      slug: enfant.slug,
      nombre: enfant.nombre_produits,
      description: enfant.description,
      image: enfant.image_url,
    })),
  }));
}

/** L'arborescence d'un univers, en un appel. */
export async function lireArborescence(univers?: Univers): Promise<BrancheRayon[]> {
  return arborescenceRayons(await lireRayons(univers));
}

/**
 * Ce que la barre du haut a besoin de savoir : combien de pièces sont en ligne,
 * et quelle est la dernière arrivée.
 *
 * Une page d'un seul article rend les deux d'un coup — `count` pour le nombre,
 * `results[0]` pour la fiche. La barre s'affiche sur chaque page : elle ne peut
 * pas tirer cent fiches pour un nombre et une vignette.
 */
export async function lireEnTeteCatalogue(
  univers: Univers = "enfant",
): Promise<{ nombre: number; derniere: Product | null }> {
  try {
    const page = await lire<Page<ProduitApi>>(
      `/api/catalogue/produits/?univers=${univers}&tri=nouveautes&page_size=1`,
      { revalider: 300 },
    );
    const brut = page?.results?.[0];
    return { nombre: page?.count ?? 0, derniere: brut ? versProduit(brut) : null };
  } catch {
    return { nombre: 0, derniere: null };
  }
}
