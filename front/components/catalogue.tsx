"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "./product-card";
import { QuickView } from "./quick-view";
import { lienCategorie } from "@/lib/catalogue";
import type { Product } from "@/lib/products";

const SORTS = ["Nouveautés", "Prix croissant", "Prix décroissant", "A → Z"] as const;

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
  const [sort, setSort] = useState(0);
  const [quick, setQuick] = useState<Product | null>(null);

  /* On peut arriver ici depuis le menu alors qu'on y est déjà : l'URL change
     sans que le composant soit remonté, il faut resynchroniser à la main. */
  useEffect(() => setSous(sousInitiales), [sousInitiales]);

  /* Les pièces de la catégorie : celles rangées dans la catégorie elle-même
     ou dans l'une de ses sous-catégories. */
  const portee = useMemo(() => {
    if (!categorie) return produits;
    const slugs = new Set([categorie.slug, ...categorie.enfants.map((e) => e.slug)]);
    return produits.filter((p) => p.categorySlug && slugs.has(p.categorySlug));
  }, [categorie, produits]);

  const prixPortee = portee.map((p) => p.price);
  const prixMini = prixPortee.length ? Math.min(...prixPortee) : 0;
  const prixMaxi = prixPortee.length ? Math.max(...prixPortee) : 0;
  const [prixMin, setPrixMin] = useState(prixMini);
  const [prixMax, setPrixMax] = useState(prixMaxi);
  /* Changer de catégorie remet la fourchette sur ses propres prix. */
  useEffect(() => {
    setPrixMin(prixMini);
    setPrixMax(prixMaxi);
  }, [prixMini, prixMaxi]);

  const toggle = (slug: string) =>
    setSous((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  /* Plusieurs sous-catégories cochées s'additionnent : « Robes » et « Jupes »
     montre les deux, pas leur intersection vide. */
  const list = useMemo(() => {
    const out = portee.filter(
      (p) =>
        (sous.length === 0 || (p.categorySlug !== undefined && sous.includes(p.categorySlug))) &&
        p.price >= prixMin &&
        p.price <= prixMax,
    );
    if (sort === 1) return [...out].sort((a, b) => a.price - b.price);
    if (sort === 2) return [...out].sort((a, b) => b.price - a.price);
    if (sort === 3) return [...out].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return out;
  }, [portee, prixMax, prixMin, sort, sous]);

  const nomSous = (slug: string) => categorie?.enfants.find((e) => e.slug === slug)?.nom ?? slug;
  const compteSous = (slug: string) => portee.filter((p) => p.categorySlug === slug).length;
  const compteCategorie = (c: Categorie) => {
    const slugs = new Set([c.slug, ...c.enfants.map((e) => e.slug)]);
    return produits.filter((p) => p.categorySlug && slugs.has(p.categorySlug)).length;
  };

  const titre = categorie?.nom ?? "Boutique";
  const filtre = sous.length > 0;
  const titreFacette = "border-b border-line pb-3 text-[12.5px] font-extrabold uppercase tracking-[.06em]";

  return (
    <div className="mx-auto max-w-[1400px] px-10 pt-8">
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

      <div className="mt-3.5 flex items-end justify-between">
        <div>
          <h1 className="text-5xl font-extrabold tracking-[-.035em]">{titre}</h1>
          <p className="mt-2 text-[14.5px] text-muted">
            {portee.length === 0
              ? categorie
                ? "Cette catégorie se remplit. Les premières pièces arrivent bientôt."
                : "La boutique se remplit. Les premières pièces arrivent bientôt."
              : filtre
                ? `${list.length} pièce${list.length > 1 ? "s" : ""} correspondent à votre sélection.`
                : `${portee.length} pièce${portee.length > 1 ? "s" : ""}, toutes photographiées et décrites.`}
          </p>
        </div>
        <button
          onClick={() => setSort((s) => (s + 1) % SORTS.length)}
          className="flex items-center gap-2.5 rounded-full border-[1.5px] border-[#e5d9de] bg-white px-4.5 py-3 text-[13.5px] font-semibold"
        >
          Trier : {SORTS[sort]} <span className="text-rose">↓</span>
        </button>
      </div>

      {/* Les catégories, pour passer de l'une à l'autre sans remonter au menu. */}
      {rayons.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {[{ slug: "", nom: "Tout" }, ...rayons].map((c) => {
            const actif = (categorie?.slug ?? "") === c.slug;
            return (
              <Link
                key={c.slug || "tout"}
                href={c.slug ? lienCategorie(c.slug) : "/boutique"}
                aria-current={actif ? "page" : undefined}
                className={`rounded-full px-4.5 py-2.5 text-[13px] font-semibold transition-colors ${
                  actif ? "bg-ink text-white" : "border-[1.5px] border-[#e5d9de] bg-white hover:border-rose hover:text-rose"
                }`}
              >
                {c.nom}
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-[240px_1fr] gap-11 pb-20 pt-7">
        <aside>
          {categorie ? (
            categorie.enfants.length > 0 && (
              <div className="mb-6.5">
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
              <div className="mb-6.5">
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

          <div>
            <div className={titreFacette}>Prix</div>
            <div className="grid grid-cols-2 gap-2 pt-4">
              <label className="text-[11.5px] font-semibold text-muted">
                Minimum
                <input type="number" min={prixMini} max={prixMax} value={prixMin} onChange={(e) => setPrixMin(Math.min(Number(e.target.value) || 0, prixMax))} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink" />
              </label>
              <label className="text-[11.5px] font-semibold text-muted">
                Maximum
                <input type="number" min={prixMin} max={prixMaxi} value={prixMax} onChange={(e) => setPrixMax(Math.max(Number(e.target.value) || 0, prixMin))} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink" />
              </label>
            </div>
          </div>
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
              <button onClick={() => setSous([])} className="pl-1.5 text-[13px] font-semibold text-muted">
                Tout effacer
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-5.5">
            {list.map((p, i) => (
              <ProductCard key={p.id} product={p} onQuickView={setQuick} delay={i * 45} />
            ))}
          </div>

          {list.length === 0 && (
            <p className="py-16 text-center text-[14.5px] text-muted">
              {portee.length === 0
                ? "Aucune pièce en ligne pour le moment — elles seront disponibles bientôt."
                : "Aucune pièce ne répond à cette combinaison. Retirez un filtre pour élargir."}
            </p>
          )}

          {portee.length > 0 && list.length > 0 && (
            <p className="pt-11 text-center text-[13.5px] text-muted">
              {filtre
                ? `Fin des résultats. Retirez un filtre pour revoir les ${portee.length} pièces.`
                : `Vous avez vu les ${portee.length} pièces.`}
            </p>
          )}
        </div>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
