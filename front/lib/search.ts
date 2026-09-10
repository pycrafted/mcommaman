/**
 * Ce qui reste de la recherche côté vitrine : la mise en forme.
 *
 * Le tri, lui, est fait par le serveur — `catalogue/recherche.py`, appelé par
 * `?q=`. Il connaît le catalogue entier, les accents et les synonymes ; le
 * navigateur ne connaissait que ce qu'on lui avait écrit.
 */

/** Minuscules, sans accent ni ponctuation : « Robe été » et « robe ete » se valent. */
export function normaliser(valeur: string): string {
  return valeur
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ce qu'une cliente tape, ramené au mot que porte la fiche. */
const SYNONYMES: Record<string, string> = {
  filles: "fille",
  garcons: "garcon",
  bebes: "bebe",
  nourrisson: "bebe",
  chaussure: "chaussures",
  basket: "chaussures",
  baskets: "chaussures",
  sandale: "chaussures",
  sandales: "chaussures",
  babies: "chaussures",
  chausson: "chaussures",
  chaussons: "chaussures",
  robes: "robe",
  jupes: "jupe",
  pantalons: "pantalon",
  jeans: "jean",
  denim: "jean",
  pyj: "pyjama",
  pyjamas: "pyjama",
  ensembles: "ensemble",
  tee: "shirt",
  tshirt: "shirt",
  haut: "hauts",
  soldes: "promo",
  solde: "promo",
  reduction: "promo",
  remise: "promo",
  nouveaute: "nouveau",
  nouveautes: "nouveau",
};

const mots = (valeur: string) =>
  normaliser(valeur)
    .split(" ")
    .filter(Boolean)
    .map((mot) => SYNONYMES[mot] ?? mot);

/* La recherche elle-même est passée au serveur.
   Elle vivait ici, sur un index construit au chargement du module à partir du
   tableau statique : elle ne pouvait connaître que les douze fiches écrites
   dans le code. `catalogue/recherche.py` la fait maintenant en base, avec les
   accents et la table de synonymes, et `?q=` la rend à la vitrine. Ce qui
   reste ici est ce qui s'affiche : la normalisation et le surlignage. */

/* La recherche de rayons vivait ici sur une liste figée. Elle est passée dans
   `components/search-overlay.tsx`, qui déduit les rayons des fiches renvoyées
   par le serveur : ce sont les catégories du back-office, à jour. */

/** Proposé quand le champ est vide. Ce que les clientes tapent le plus. */
export const RECHERCHES_FREQUENTES = [
  "robe",
  "pyjama",
  "chaussures",
  "ensemble",
  "bébé",
  "jean",
  "fille",
  "garçon",
];

export interface Fragment {
  texte: string;
  fort: boolean;
}

/**
 * Découpe un libellé pour mettre en gras les mots cherchés. La comparaison se
 * fait sans accent, mais on renvoie le texte d'origine : « été » reste « été »
 * à l'écran même si la cliente a tapé « ete ».
 */
export function surligner(texte: string, requete: string): Fragment[] {
  const termes = mots(requete).filter((terme) => terme.length > 1);
  if (termes.length === 0) return [{ texte, fort: false }];

  return texte.split(/(\s+)/).map((morceau) => {
    if (!morceau.trim()) return { texte: morceau, fort: false };
    // Un mot peut porter de la ponctuation (« T-shirt ») : on teste chacun de
    // ses fragments normalisés, pas seulement le mot entier.
    const bouts = normaliser(morceau).split(" ").filter(Boolean);
    return { texte: morceau, fort: bouts.some((bout) => termes.some((terme) => bout.startsWith(terme))) };
  });
}
