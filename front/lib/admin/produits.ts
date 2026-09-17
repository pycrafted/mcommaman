"use client";

/**
 * Les fiches du back-office, lues à la demande.
 *
 * Le back-office ne charge plus tout le catalogue à l'ouverture : chaque page
 * demande au serveur ce qu'elle affiche — une page de la liste, une fiche, les
 * articles d'un rayon. Les chiffres d'ensemble (onglets, tableau de bord)
 * viennent de `/api/gestion/produits/compteurs/`, lus par le store.
 *
 * `versionProduits`, exposé par le store, change à chaque écriture : les
 * listes s'en servent pour se relire après une publication ou une suppression.
 */

import { useEffect, useState } from "react";
import { envoyer, type Page } from "@/lib/api";
import { versProduit, type ProduitGestionApi } from "./passage";
import { useAdmin } from "./store";
import type { AdminProduct, ProductStatus } from "./types";

/** Une ligne de la liste : ce que `ProduitGestionListeSerializer` renvoie. */
export type ProduitLigneApi = {
  id: number;
  slug: string;
  nom: string;
  sku: string;
  prix: number;
  statut: ProductStatus;
  rayon: number;
  rayon_nom: string;
  image: string | null;
  stock_total: number;
  matieres_noms: string[];
  cree_le: string;
  modifie_le: string;
};

/** Une ligne mise à la forme des écrans. Galerie et variantes restent vides : la fiche les porte. */
export function versLigneProduit(brut: ProduitLigneApi): AdminProduct {
  return {
    id: String(brut.id),
    slug: brut.slug,
    name: brut.nom,
    sku: brut.sku,
    price: brut.prix,
    description: "",
    category: brut.rayon_nom,
    univers: "enfant",
    image: brut.image ?? "",
    gallery: [],
    stock: brut.stock_total,
    status: brut.statut,
    sizes: [],
    colors: [],
    materials: brut.matieres_noms ?? [],
    variants: [],
    createdAt: brut.cree_le,
    updatedAt: brut.modifie_le,
  };
}

export type FiltresProduits = {
  page?: number;
  taille?: number;
  q?: string;
  statut?: ProductStatus;
  rupture?: boolean;
  stockBas?: boolean;
  rayon?: string;
  /** Des fiches précises, par identifiant. */
  ids?: number[];
};

function requete(f: FiltresProduits): string {
  const params = new URLSearchParams();
  params.set("page", String(f.page ?? 1));
  params.set("page_size", String(f.taille ?? 20));
  if (f.q?.trim()) params.set("q", f.q.trim());
  if (f.statut) params.set("statut", f.statut);
  if (f.rupture) params.set("rupture", "1");
  if (f.stockBas) params.set("stock_bas", "1");
  if (f.rayon) params.set("rayon", f.rayon);
  if (f.ids?.length) params.set("ids", f.ids.join(","));
  return params.toString();
}

/** Une page de la liste. */
export async function lireProduits(
  filtres: FiltresProduits,
): Promise<{ produits: AdminProduct[]; total: number }> {
  const page = await envoyer<Page<ProduitLigneApi>>(`/api/gestion/produits/?${requete(filtres)}`);
  return { produits: page.results.map(versLigneProduit), total: page.count };
}

/** Une fiche complète, variantes et galerie comprises. */
export async function lireFicheProduit(id: string): Promise<AdminProduct | null> {
  if (!/^\d+$/.test(id)) return null;
  try {
    return versProduit(await envoyer<ProduitGestionApi>(`/api/gestion/produits/${id}/`));
  } catch {
    return null;
  }
}

/**
 * Toutes les fiches, page après page.
 *
 * Réservé aux analyses qui ont vraiment besoin de tout (statistiques) : une
 * liste qui s'affiche doit passer par `lireProduits`.
 */
export async function lireTousLesProduits(): Promise<AdminProduct[]> {
  const lignes: AdminProduct[] = [];
  for (let page = 1; ; page += 1) {
    const { produits, total } = await lireProduits({ page, taille: 200 });
    lignes.push(...produits);
    if (lignes.length >= total || produits.length === 0) return lignes;
  }
}

/**
 * La liste paginée, relue quand ses filtres changent ou qu'une fiche est écrite.
 *
 * La recherche attend un quart de seconde que la frappe s'arrête : une
 * requête par lettre ne sert à rien.
 */
export function useProduits(filtres: FiltresProduits) {
  const { versionProduits } = useAdmin();
  const [etat, setEtat] = useState<{ produits: AdminProduct[]; total: number; pret: boolean }>({
    produits: [],
    total: 0,
    pret: false,
  });
  const [erreur, setErreur] = useState("");
  const cle = requete(filtres);

  useEffect(() => {
    let vivant = true;
    const minuteur = window.setTimeout(
      () => {
        lireProduits(filtres)
          .then((r) => {
            if (!vivant) return;
            setEtat({ ...r, pret: true });
            setErreur("");
          })
          .catch((e: unknown) => {
            if (!vivant) return;
            setErreur(e instanceof Error ? e.message : "Lecture impossible.");
            setEtat((courant) => ({ ...courant, pret: true }));
          });
      },
      filtres.q ? 250 : 0,
    );
    return () => {
      vivant = false;
      window.clearTimeout(minuteur);
    };
    // `cle` résume les filtres : les lister un à un relancerait la lecture à
    // chaque rendu, l'objet étant recréé.
  }, [cle, versionProduits]);

  return { ...etat, erreur };
}

/** Une fiche, relue après chaque écriture. `undefined` tant qu'elle n'est pas arrivée. */
export function useFicheProduit(id: string) {
  const { versionProduits } = useAdmin();
  const [fiche, setFiche] = useState<AdminProduct | null | undefined>(undefined);

  useEffect(() => {
    let vivant = true;
    lireFicheProduit(id).then((f) => vivant && setFiche(f));
    return () => {
      vivant = false;
    };
  }, [id, versionProduits]);

  return fiche;
}
