"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "./product-card";
import { QuickView } from "./quick-view";
import { lienCategorie } from "@/lib/catalogue";
import { formatXOF } from "@/lib/format";
import type { Product } from "@/lib/products";

const SORTS = ["Nouveautés", "Prix croissant", "Prix décroissant", "A → Z"] as const;

/** Le pas du curseur de prix, en francs. */
const PAS_PRIX = 500;

/**
 * Une fourchette de prix à deux poignées.
 *
 * Deux `<input type="range">` superposés sur une même piste : le navigateur
 * garde le clavier, le glisser au doigt et l'accessibilité. Seules les
 * poignées reçoivent le pointeur (`.curseur-double` dans `globals.css`), sinon
 * le curseur du dessus masquerait celui du dessous. Les poignées ne se
 * croisent pas : chacune s'arrête à la valeur de l'autre.
 */
function CurseurPrix({
  min,
  max,
  bas,
  haut,
  onChange,
}: {
  min: number;
  max: number;
  bas: number;
  haut: number;
  onChange: (bas: number, haut: number) => void;
}) {
  const position = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div className="pt-5">
      <div className="curseur-double relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#eee2e7]" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-rose"
          style={{ left: `${position(bas)}%`, right: `${100 - position(haut)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={PAS_PRIX}
          value={bas}
          onChange={(e) => onChange(Math.min(Number(e.target.value), haut), haut)}
          aria-label="Prix minimum"
          aria-valuetext={formatXOF(bas)}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={PAS_PRIX}
          value={haut}
          onChange={(e) => onChange(bas, Math.max(Number(e.target.value), bas))}
          aria-label="Prix maximum"
          aria-valuetext={formatXOF(haut)}
        />
      </div>
      <div className="mt-3 flex justify-between text-[13px] font-semibold tabular-nums">
        <span>{formatXOF(bas)}</span>
        <span>{formatXOF(haut)}</span>
      </div>
    </div>
  );
}

type SousRayon = { nom: string; slug: string };
type Categorie = SousRayon & { enfants: SousRayon[] };

/**
 * La boutique : toutes les pièces, ou celles d'une catégorie.
 *
 * Filles, Garçons, Coin Maman… sont des catégories au même titre : « ?cat= »
 * en choisit une, et ses sous-catégories deviennent les filtres de gauche.
 * Une ancienne adresse qui nomme directement une sous-catégorie ouvre sa
 * catégorie avec ce filtre déjà coché.
 */
export function Catalogue({
  produits = [],
  rayons = [],
}: {
  produits?: Product[];
  /** Les catégories du serveur, chacune avec ses sous-catégories. */
  rayons?: Categorie[];
}) {
  const params = useSearchParams();

  /* La catégorie et la sous-catégorie demandées par l'adresse. */
  const { categorie, sousInitiales } = useMemo(() => {
    const cat = params.get("cat") ?? "";
    const sous = params.get("sous");
    const racine = rayons.find((r) => r.slug === cat);
    if (racine) {
      const valide = sous && racine.enfants.some((e) => e.slug === sous);
      return { categorie: racine, sousInitiales: valide ? [sous as string] : [] };
    }
    const parente = rayons.find((r) => r.enfants.some((e) => e.slug === cat));
    return parente
      ? { categorie: parente, sousInitiales: [cat] }
      : { categorie: null, sousInitiales: [] as string[] };
  }, [params, rayons]);

  const [sous, setSous] = useState<string[]>(sousInitiales);
  const [tailles, setTailles] = useState<string[]>([]);
  const [sort, setSort] = useState(0);
  /* Au doigt, les filtres se replient sous un bouton : ouverts d'office, ils
     repoussaient les pièces sous la ligne de flottaison. */
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);

  /* On peut arriver ici depuis le menu alors qu'on y est déjà : l'URL change
     sans que le composant soit remonté, il faut resynchroniser à la main. */
  useEffect(() => {
    setSous(sousInitiales);
    setTailles([]);
  }, [sousInitiales]);

  /* Les pièces de la catégorie : celles rangées dans la catégorie elle-même
     ou dans l'une de ses sous-catégories. */
  const portee = useMemo(() => {
    if (!categorie) return produits;
    const slugs = new Set([categorie.slug, ...categorie.enfants.map((e) => e.slug)]);
    return produits.filter((p) => p.categorySlug && slugs.has(p.categorySlug));
  }, [categorie, produits]);

  /* Les bornes du curseur, arrondies au pas : un curseur qui s'arrête à
     12 350 F se lit mal. */
  const prixPortee = portee.map((p) => p.price);
  const prixMini = prixPortee.length ? Math.floor(Math.min(...prixPortee) / PAS_PRIX) * PAS_PRIX : 0;
  const prixMaxi = prixPortee.length ? Math.ceil(Math.max(...prixPortee) / PAS_PRIX) * PAS_PRIX : 0;
  const [prixMin, setPrixMin] = useState(prixMini);
  const [prixMax, setPrixMax] = useState(prixMaxi);
  /* Changer de catégorie remet la fourchette sur ses propres prix. */
  useEffect(() => {
    setPrixMin(prixMini);
    setPrixMax(prixMaxi);
  }, [prixMini, prixMaxi]);

  const toggle = (slug: string) =>
    setSous((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  const toggleTaille = (valeur: string) =>
    setTailles((t) => (t.includes(valeur) ? t.filter((x) => x !== valeur) : [...t, valeur]));

  /* Une pièce répond à une taille quand elle l'a encore en stock : proposer
     un 6 ans épuisé ne rendrait service à personne. */
  const aLaTaille = (p: Product, valeur: string) =>
    (p.tailles ?? []).some((t) => t.valeur === valeur && t.disponible);

  /* Les tailles proposées : celles des pièces de la catégorie, dans l'ordre
     du guide des tailles. */
  const taillesPortee = useMemo(() => {
    const vues = new Map<string, number>();
    for (const p of portee) {
      for (const t of p.tailles ?? []) {
        if (t.disponible && !vues.has(t.valeur)) vues.set(t.valeur, t.ordre);
      }
    }
    return [...vues.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "fr", { numeric: true }))
      .map(([valeur]) => valeur);
  }, [portee]);

  /* Plusieurs cases cochées dans un même filtre s'additionnent : « Robes » et
     « Jupes » montre les deux, « 4 » et « 6 » aussi. Les filtres entre eux se
     combinent. */
  const list = useMemo(() => {
    const out = portee.filter(
      (p) =>
        (sous.length === 0 || (p.categorySlug !== undefined && sous.includes(p.categorySlug))) &&
        (tailles.length === 0 || tailles.some((t) => aLaTaille(p, t))) &&
        p.price >= prixMin &&
        p.price <= prixMax,
    );
    if (sort === 1) return [...out].sort((a, b) => a.price - b.price);
    if (sort === 2) return [...out].sort((a, b) => b.price - a.price);
    if (sort === 3) return [...out].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return out;
  }, [portee, prixMax, prixMin, sort, sous, tailles]);

  const nomSous = (slug: string) => categorie?.enfants.find((e) => e.slug === slug)?.nom ?? slug;
  const compteSous = (slug: string) => portee.filter((p) => p.categorySlug === slug).length;
  const compteCategorie = (c: Categorie) => {
    const slugs = new Set([c.slug, ...c.enfants.map((e) => e.slug)]);
    return produits.filter((p) => p.categorySlug && slugs.has(p.categorySlug)).length;
  };

  const prixFiltre = prixMin > prixMini || prixMax < prixMaxi;
  const titre = categorie?.nom ?? "Boutique";
  const filtre = sous.length > 0 || tailles.length > 0 || prixFiltre;
  const toutEffacer = () => {
    setSous([]);
    setTailles([]);
    setPrixMin(prixMini);
    setPrixMax(prixMaxi);
  };
  const titreFacette = "border-b border-line pb-3 text-[12.5px] font-extrabold uppercase tracking-[.06em]";

  return (
    <div className="mx-auto max-w-[1400px] px-5 pt-5 md:px-8 md:pt-8 lg:px-10">
      <div className="text-[12.5px] text-muted">
        <Link href="/" className="hover:text-rose">Accueil</Link>
        {" · "}
        {categorie ? (
          <>
            <Link href="/boutique" className="hover:text-rose">Boutique</Link>
            {" · "}
            {categorie.nom}
          </>
        ) : (
          "Boutique"
        )}
      </div>

      <div className="mt-3 md:mt-3.5 md:flex md:items-end md:justify-between md:gap-6">
        <div>
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-.035em] sm:text-[42px] lg:text-5xl">
            {titre}
          </h1>
          <p className="mt-2 text-[13.5px] text-muted sm:text-[14.5px]">
            {portee.length === 0
              ? categorie
                ? "Cette catégorie se remplit. Les premières pièces arrivent bientôt."
                : "La boutique se remplit. Les premières pièces arrivent bientôt."
              : filtre
                ? `${list.length} pièce${list.length > 1 ? "s" : ""} correspondent à votre sélection.`
                : portee.length > 1
                  ? `${portee.length} pièces, toutes photographiées et décrites.`
                  : "1 pièce, photographiée et décrite."}
          </p>
        </div>
        <div className="mt-4 flex gap-2 md:mt-0 md:shrink-0">
          <button
            type="button"
            onClick={() => setFiltresOuverts((o) => !o)}
            aria-expanded={filtresOuverts}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#e5d9de] bg-white px-4 py-3 text-[13.5px] font-semibold lg:hidden"
          >
            Filtres
            {filtre && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[11px] font-bold text-white">
                {sous.length + tailles.length + (prixFiltre ? 1 : 0)}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSort((s) => (s + 1) % SORTS.length)}
            className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-[#e5d9de] bg-white px-4 py-3 text-[13.5px] font-semibold md:flex-none md:px-4.5"
          >
            Trier : {SORTS[sort]} <span className="text-rose">↓</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 pb-20 pt-5 lg:grid-cols-[240px_1fr] lg:gap-11 lg:pt-7">
        <aside
          className={`${
            filtresOuverts ? "block" : "hidden"
          } rounded-3xl border border-line bg-white p-5 lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0`}
        >
          {categorie ? (
            categorie.enfants.length > 0 && (
              <div className="mb-6.5 last:mb-0">
                <div className={titreFacette}>Sous-catégories</div>
                <div className="flex flex-col pt-2">
                  {categorie.enfants.map((e) => {
                    const on = sous.includes(e.slug);
                    return (
                      <button
                        key={e.slug}
                        onClick={() => toggle(e.slug)}
                        className={`flex items-center gap-3 py-2 text-left text-sm ${on ? "font-bold" : "font-medium text-[#4a3a41]"}`}
                      >
                        <span
                          className={`h-4.5 w-4.5 shrink-0 rounded-md border-[1.5px] transition-colors ${
                            on ? "border-rose bg-rose" : "border-[#dfd3d8] bg-white"
                          }`}
                        />
                        <span className="flex-1">{e.nom}</span>
                        <span className="text-xs text-[#9c8d93]">{compteSous(e.slug)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            rayons.length > 0 && (
              <div className="mb-6.5 last:mb-0">
                <div className={titreFacette}>Catégories</div>
                <div className="flex flex-col pt-2">
                  {rayons.map((c) => (
                    <Link
                      key={c.slug}
                      href={lienCategorie(c.slug)}
                      className="flex items-center gap-3 py-2 text-sm font-medium text-[#4a3a41] transition-colors hover:text-rose"
                    >
                      <span className="flex-1">{c.nom}</span>
                      <span className="text-xs text-[#9c8d93]">{compteCategorie(c)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          )}

          {taillesPortee.length > 0 && (
            <div className="mb-6.5 last:mb-0">
              <div className={titreFacette}>Taille</div>
              <div className="flex flex-wrap gap-2 pt-4">
                {taillesPortee.map((valeur) => {
                  const on = tailles.includes(valeur);
                  return (
                    <button
                      key={valeur}
                      type="button"
                      onClick={() => toggleTaille(valeur)}
                      aria-pressed={on}
                      className={`min-w-11 rounded-xl border-[1.5px] px-3 py-2 text-[13px] font-semibold transition-colors ${
                        on
                          ? "border-ink bg-ink text-white"
                          : "border-[#e5d9de] bg-white text-[#4a3a41] hover:border-rose hover:text-rose"
                      }`}
                    >
                      {valeur}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {prixMaxi > prixMini && (
            <div>
              <div className={titreFacette}>Prix</div>
              <CurseurPrix
                min={prixMini}
                max={prixMaxi}
                bas={prixMin}
                haut={prixMax}
                onChange={(bas, haut) => {
                  setPrixMin(bas);
                  setPrixMax(haut);
                }}
              />
            </div>
          )}
        </aside>

        <div>
          {filtre && (
            <div className="flex flex-wrap items-center gap-2 pb-5">
              {sous.map((slug) => (
                <button
                  key={slug}
                  onClick={() => toggle(slug)}
                  className="flex items-center gap-2.5 rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white"
                >
                  {nomSous(slug)} <span className="opacity-55">×</span>
                </button>
              ))}
              {tailles.map((valeur) => (
                <button
                  key={`taille-${valeur}`}
                  onClick={() => toggleTaille(valeur)}
                  className="flex items-center gap-2.5 rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white"
                >
                  Taille {valeur} <span className="opacity-55">×</span>
                </button>
              ))}
              {prixFiltre && (
                <button
                  onClick={() => {
                    setPrixMin(prixMini);
                    setPrixMax(prixMaxi);
                  }}
                  className="flex items-center gap-2.5 rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white"
                >
                  {formatXOF(prixMin)} – {formatXOF(prixMax)} <span className="opacity-55">×</span>
                </button>
              )}
              <button onClick={toutEffacer} className="pl-1.5 text-[13px] font-semibold text-muted">
                Tout effacer
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-5.5">
            {list.map((p, i) => (
              <ProductCard key={p.id} product={p} onQuickView={setQuick} delay={i * 45} />
            ))}
          </div>

          {list.length === 0 && (
            <p className="py-12 text-center text-[14px] text-muted sm:py-16 sm:text-[14.5px]">
              {portee.length === 0
                ? "Aucune pièce en ligne pour le moment — elles seront disponibles bientôt."
                : "Aucune pièce ne répond à cette combinaison. Retirez un filtre pour élargir."}
            </p>
          )}

          {portee.length > 0 && list.length > 0 && (
            <p className="pt-11 text-center text-[13.5px] text-muted">
              {filtre
                ? `Fin des résultats. Retirez un filtre pour revoir les ${portee.length} pièces.`
                : portee.length > 1
                  ? `Vous avez vu les ${portee.length} pièces.`
                  : "Vous avez vu toute la sélection."}
            </p>
          )}
        </div>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
