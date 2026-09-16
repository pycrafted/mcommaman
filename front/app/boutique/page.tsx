import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { Catalogue, type EtatBoutique } from "@/components/catalogue";
import {
  lireFacettes,
  lirePageCatalogue,
  lireRayons,
  type FiltresCatalogue,
  type Tri,
} from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Toute la boutique M comme Maman : vêtements pour filles et garçons de 2 à 14 ans, tissus et voiles du Coin Maman. Livraison 24 h sur Dakar.",
};

const TRIS: Tri[] = ["nouveautes", "prix-croissant", "prix-decroissant", "nom"];

type Parametres = Record<string, string | string[] | undefined>;

const texte = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const liste = (v: string | string[] | undefined) =>
  texte(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const entier = (v: string | string[] | undefined) => {
  const n = Number.parseInt(texte(v), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/*
 * Une seule page pour toute la boutique et pour chaque catégorie. Tout ce que
 * la cliente choisit vit dans l'adresse — catégorie, sous-catégories, tailles,
 * fourchette de prix, tri, page — : une sélection se partage, se recharge et
 * revient avec le bouton « précédent ».
 *
 * La page ne lit que ce qu'elle affiche : une page d'articles, les décomptes
 * des filtres et la liste des catégories. Le serveur filtre, trie et découpe.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Parametres> }) {
  const [params, rayons] = await Promise.all([searchParams, lireRayons()]);

  /* La catégorie demandée. Une ancienne adresse peut nommer directement une
     sous-catégorie : on ouvre sa parente, ce filtre coché. */
  const cat = texte(params.cat);
  let categorie = rayons.find((r) => r.slug === cat) ?? null;
  let sous = liste(params.sous);
  if (!categorie && cat) {
    const parente = rayons.find((r) => r.enfants.some((e) => e.slug === cat));
    if (parente) {
      categorie = parente;
      sous = [cat];
    }
  }
  if (categorie) {
    const connues = new Set(categorie.enfants.map((e) => e.slug));
    sous = sous.filter((s) => connues.has(s));
  } else {
    sous = [];
  }

  const triDemande = texte(params.tri) as Tri;
  const etat: EtatBoutique = {
    categorie: categorie?.slug ?? "",
    sous,
    tailles: liste(params.taille),
    prixMin: entier(params.prix_min),
    prixMax: entier(params.prix_max),
    tri: TRIS.includes(triDemande) ? triDemande : "nouveautes",
    page: Math.max(1, entier(params.page) ?? 1),
  };

  const filtres: FiltresCatalogue = {
    rayon: etat.categorie || undefined,
    sous: etat.sous,
    tailles: etat.tailles,
    prixMin: etat.prixMin,
    prixMax: etat.prixMax,
  };

  let [resultat, facettes] = await Promise.all([
    lirePageCatalogue({ ...filtres, tri: etat.tri, page: etat.page }),
    lireFacettes(filtres),
  ]);
  /* Une page au-delà de la dernière — après avoir resserré un filtre, par
     exemple — retombe sur la première plutôt que sur une grille vide. */
  if (resultat.produits.length === 0 && etat.page > 1) {
    etat.page = 1;
    resultat = await lirePageCatalogue({ ...filtres, tri: etat.tri, page: 1 });
  }

  return (
    <>
      <Header />
      <main>
        <Catalogue
          produits={resultat.produits}
          total={resultat.total}
          pages={resultat.pages}
          facettes={facettes}
          rayons={rayons}
          etat={etat}
        />
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
