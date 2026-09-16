"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "./product-card";
import { QuickView } from "./quick-view";
import type { Product } from "@/lib/products";

const SORTS = ["Nouveautés", "Prix croissant", "Prix décroissant", "A → Z"] as const;

export function Catalogue({
  produits = [],
  rayons = [],
}: {
  produits?: Product[];
  /** Les catégories du serveur, chacune avec ses sous-catégories. */
  rayons?: { nom: string; slug: string; enfants: { nom: string; slug: string }[] }[];
}) {
  const params = useSearchParams();

  const initial = useMemo(() => {
    const f: string[] = [];
    if (params.get("cat")) f.push("cat:" + params.get("cat"));
    return f;
  }, [params]);

  const [filters, setFilters] = useState<string[]>(initial);
  const [sort, setSort] = useState(0);
  const [quick, setQuick] = useState<Product | null>(null);
  const prixCatalogue = produits.map((p) => p.price);
  const prixMini = prixCatalogue.length ? Math.min(...prixCatalogue) : 0;
  const prixMaxi = prixCatalogue.length ? Math.max(...prixCatalogue) : 0;
  const [prixMin, setPrixMin] = useState(prixMini);
  const [prixMax, setPrixMax] = useState(prixMaxi);

  /* La recherche du bandeau arrive par « ?q= ». On la recopie en état pour
     pouvoir la retirer d'un clic, comme un filtre. */
  const [recherche, setRecherche] = useState("");

  /* On peut arriver ici depuis le menu alors qu'on y est déjà : l'URL change
     sans que le composant soit remonté, il faut resynchroniser à la main. */
  useEffect(() => setFilters(initial), [initial]);
  useEffect(() => setRecherche(params.get("q")?.trim() ?? ""), [params]);

  const toggle = (key: string) =>
    setFilters((f) => (f.includes(key) ? f.filter((x) => x !== key) : [...f, key]));

  /* Une fiche est rangée dans la catégorie la plus fine : son `category` est
     toujours une feuille. Le menu, lui, propose aussi les parentes — cliquer
     sur « Vêtements » doit ramener robes, bas et t-shirts, pas une grille
     vide. D'où cette table, qui déplie un nom de parente en ceux de ses
     sous-catégories. Une catégorie sans enfant ne se couvre qu'elle-même. */
  const couverture = useMemo(() => {
    const table = new Map<string, string[]>();
    for (const r of rayons) {
      table.set(r.nom, r.enfants.length ? r.enfants.map((e) => e.nom) : [r.nom]);
    }
    return table;
  }, [rayons]);

  const matches = (p: Product, f: string) => {
    /* Le nom peut contenir un « : » — on ne coupe qu'au premier. */
    const value = f.slice(f.indexOf(":") + 1);
    const couverts = couverture.get(value);
    return couverts ? couverts.includes(p.category) : p.category === value;
  };

  const base = useMemo(
    () => {
      const q = recherche.toLocaleLowerCase("fr").trim();
      if (!q) return produits;
      return produits.filter((p) =>
        [p.name, p.category, p.description].some((valeur) =>
          valeur.toLocaleLowerCase("fr").includes(q),
        ),
      );
    },
    [produits, recherche],
  );

  const list = useMemo(() => {
    const out = base.filter(
      (p) => filters.every((f) => matches(p, f)) && p.price >= prixMin && p.price <= prixMax,
    );
    if (sort === 1) return [...out].sort((a, b) => a.price - b.price);
    if (sort === 2) return [...out].sort((a, b) => b.price - a.price);
    if (sort === 3) return [...out].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return out;
  }, [base, couverture, filters, prixMax, prixMin, sort]);

  const chipLabel = (f: string) => f.slice(f.indexOf(":") + 1);

  const countFor = (f: string) => base.filter((p) => matches(p, f)).length;

  /* Les catégories qui ont des sous-catégories font un groupe chacune ; celles
     qui n'en ont pas se retrouvent dans un seul groupe, en bas. */
  const groupes = rayons.filter((r) => r.enfants.length > 0);
  const seules = rayons.filter((r) => r.enfants.length === 0);

  const facet = (title: string, entries: { key: string; label: string }[], cle = title) => (
    <div className="mb-6.5" key={cle}>
      <div className="border-b border-line pb-3 text-[12.5px] font-extrabold uppercase tracking-[.06em]">
        {title}
      </div>
      <div className="flex flex-col pt-2">
        {entries.map((e) => {
          const on = filters.includes(e.key);
          return (
            <button
              key={e.key}
              onClick={() => toggle(e.key)}
              className={`flex items-center gap-3 py-2 text-left text-sm ${on ? "font-bold" : "font-medium text-[#4a3a41]"}`}
            >
              <span
                className={`h-4.5 w-4.5 shrink-0 rounded-md border-[1.5px] transition-colors ${
                  on ? "border-rose bg-rose" : "border-[#dfd3d8] bg-white"
                }`}
              />
              <span className="flex-1">{e.label}</span>
              <span className="text-xs text-[#9c8d93]">{countFor(e.key)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-10 pt-8">
      <div className="text-[12.5px] text-muted">Accueil · Catalogue</div>

      <div className="mt-3.5 flex items-end justify-between">
        <div>
          <h1 className="text-5xl font-extrabold tracking-[-.035em]">
            {recherche ? `« ${recherche} »` : "Catalogue"}
          </h1>
          <p className="mt-2 text-[14.5px] text-muted">
            {produits.length === 0
              ? "Le catalogue se remplit. Les premières pièces arrivent bientôt."
              : recherche || filters.length
                ? `${list.length} pièce${list.length > 1 ? "s" : ""} ${
                    recherche ? "pour cette recherche" : "correspondent à votre sélection"
                  }.`
                : `${produits.length} pièces, toutes photographiées et décrites. Tout tient sur une seule page.`}
          </p>
        </div>
        <button
          onClick={() => setSort((s) => (s + 1) % SORTS.length)}
          className="flex items-center gap-2.5 rounded-full border-[1.5px] border-[#e5d9de] bg-white px-4.5 py-3 text-[13.5px] font-semibold"
        >
          Trier : {SORTS[sort]} <span className="text-rose">↓</span>
        </button>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-11 pb-20 pt-7">
        <aside>
          {/* Les sous-catégories font les cases : cliquer sur « Tissus » est
              plus parlant que cliquer sur « Coin Maman », qui ne retirerait
              rien. La parente reste le titre du groupe.

              Une catégorie sans sous-catégorie porte ses fiches elle-même :
              elle rejoint le groupe du bas plutôt que de disparaître — c'est
              ce qui rendait invisible une catégorie tout juste créée. */}
          {groupes.map((racine) =>
            facet(
              racine.nom,
              racine.enfants.map((e) => ({ key: "cat:" + e.nom, label: e.nom })),
              racine.slug,
            ),
          )}
          {seules.length > 0 &&
            facet(
              "Catégorie",
              seules.map((r) => ({ key: "cat:" + r.nom, label: r.nom })),
              "racines-seules",
            )}
          <div>
            <div className="border-b border-line pb-3 text-[12.5px] font-extrabold uppercase tracking-[.06em]">
              Prix
            </div>
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
          {(filters.length > 0 || recherche) && (
            <div className="flex flex-wrap items-center gap-2 pb-5">
              {recherche && (
                <button
                  onClick={() => setRecherche("")}
                  className="flex items-center gap-2.5 rounded-full bg-rose px-3.5 py-2 text-[12.5px] font-semibold text-white"
                >
                  Recherche : {recherche} <span className="opacity-55">×</span>
                </button>
              )}
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => toggle(f)}
                  className="flex items-center gap-2.5 rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white"
                >
                  {chipLabel(f)} <span className="opacity-55">×</span>
                </button>
              ))}
              <button
                onClick={() => {
                  setFilters([]);
                  setRecherche("");
                }}
                className="pl-1.5 text-[13px] font-semibold text-muted"
              >
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
              {produits.length === 0
                ? "Aucune pièce en ligne pour le moment — elles seront disponibles bientôt."
                : "Aucune pièce ne répond à cette combinaison. Retirez une pastille pour élargir."}
            </p>
          )}

          {produits.length > 0 && (
            <p className="pt-11 text-center text-[13.5px] text-muted">
              {recherche || filters.length
                ? `Fin des résultats. Retirez une pastille pour revoir les ${produits.length} pièces.`
                : `Vous avez vu les ${produits.length} pièces. Pas de page 2 pour un catalogue de cette taille.`}
            </p>
          )}
        </div>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
