"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProductCard } from "./product-card";
import { QuickView } from "./quick-view";
import { PAR_PAGE, type Facettes, type Tri } from "@/lib/catalogue";
import { formatXOF } from "@/lib/format";
import type { Product } from "@/lib/products";

const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: "nouveautes", libelle: "Nouveautés" },
  { valeur: "prix-croissant", libelle: "Prix croissant" },
  { valeur: "prix-decroissant", libelle: "Prix décroissant" },
  { valeur: "nom", libelle: "A → Z" },
];

/** Le pas du curseur de prix, en francs. */
const PAS_PRIX = 500;

/** Ce que l'adresse décrit : la sélection en cours. */
export type EtatBoutique = {
  /** La catégorie ouverte, vide pour toute la boutique. */
  categorie: string;
  sous: string[];
  tailles: string[];
  prixMin?: number;
  prixMax?: number;
  tri: Tri;
  page: number;
};

type SousRayon = { nom: string; slug: string };
type Categorie = SousRayon & { enfants: SousRayon[]; nombre_produits: number };

/** L'adresse d'un état de la boutique. Les valeurs par défaut n'y figurent pas. */
function adresse(chemin: string, e: EtatBoutique): string {
  const params = new URLSearchParams();
  if (e.categorie) params.set("cat", e.categorie);
  if (e.sous.length) params.set("sous", e.sous.join(","));
  if (e.tailles.length) params.set("taille", e.tailles.join(","));
  if (e.prixMin !== undefined) params.set("prix_min", String(e.prixMin));
  if (e.prixMax !== undefined) params.set("prix_max", String(e.prixMax));
  if (e.tri !== "nouveautes") params.set("tri", e.tri);
  if (e.page > 1) params.set("page", String(e.page));
  const requete = params.toString();
  return requete ? `${chemin}?${requete}` : chemin;
}

/**
 * Une fourchette de prix à deux poignées.
 *
 * Deux `<input type="range">` superposés sur une même piste : le navigateur
 * garde le clavier, le glisser au doigt et l'accessibilité. Seules les
 * poignées reçoivent le pointeur (`.curseur-double` dans `globals.css`), sinon
 * le curseur du dessus masquerait celui du dessous. Les poignées ne se
 * croisent pas : chacune s'arrête à la valeur de l'autre.
 *
 * Le curseur bouge librement ; la boutique n'est relue qu'au lâcher
 * (`onValider`) — une requête par cran de glissé ne servirait à rien.
 */
function CurseurPrix({
  min,
  max,
  bas: basInitial,
  haut: hautInitial,
  onValider,
}: {
  min: number;
  max: number;
  bas: number;
  haut: number;
  onValider: (bas: number, haut: number) => void;
}) {
  const [bas, setBas] = useState(basInitial);
  const [haut, setHaut] = useState(hautInitial);
  const valeurs = useRef({ bas: basInitial, haut: hautInitial });

  useEffect(() => {
    setBas(basInitial);
    setHaut(hautInitial);
    valeurs.current = { bas: basInitial, haut: hautInitial };
  }, [basInitial, hautInitial]);

  const valider = () => {
    const { bas: b, haut: h } = valeurs.current;
    if (b !== basInitial || h !== hautInitial) onValider(b, h);
  };
  const lacher = { onPointerUp: valider, onKeyUp: valider };
  const position = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0);

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
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), haut);
            setBas(v);
            valeurs.current.bas = v;
          }}
          {...lacher}
          aria-label="Prix minimum"
          aria-valuetext={formatXOF(bas)}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={PAS_PRIX}
          value={haut}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), bas);
            setHaut(v);
            valeurs.current.haut = v;
          }}
          {...lacher}
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

/** Numéros affichés : les bords, les voisines de la page courante, et des points. */
function numeros(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const proches = new Set([1, pages, page - 1, page, page + 1]);
  const liste: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (proches.has(i)) liste.push(i);
    else if (liste[liste.length - 1] !== "…") liste.push("…");
  }
  return liste;
}

/**
 * La boutique : toutes les pièces, ou celles d'une catégorie.
 *
 * Filles, Garçons, Coin Maman… sont des catégories au même titre : « ?cat= »
 * en choisit une, et ses sous-catégories deviennent des filtres. Le composant
 * ne filtre rien lui-même : chaque choix change l'adresse, et la page relit
 * sur le serveur la seule page d'articles à afficher.
 */
export function Catalogue({
  produits,
  total,
  pages,
  facettes,
  rayons,
  etat,
}: {
  produits: Product[];
  total: number;
  pages: number;
  facettes: Facettes;
  /** Les catégories du serveur, chacune avec ses sous-catégories. */
  rayons: Categorie[];
  etat: EtatBoutique;
}) {
  const router = useRouter();
  const chemin = usePathname();
  const [enCours, demarrer] = useTransition();
  const [quick, setQuick] = useState<Product | null>(null);
  /* Au doigt, les filtres se replient sous un bouton : ouverts d'office, ils
     repoussaient les pièces sous la ligne de flottaison. */
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const haut = useRef<HTMLDivElement>(null);

  const categorie = rayons.find((r) => r.slug === etat.categorie) ?? null;

  /** Change la sélection. Tout changement de filtre repart de la page 1. */
  const aller = (patch: Partial<EtatBoutique>) => {
    const suivant = { ...etat, page: 1, ...patch };
    demarrer(() => router.push(adresse(chemin, suivant), { scroll: false }));
  };

  const bascule = (liste: string[], valeur: string) =>
    liste.includes(valeur) ? liste.filter((x) => x !== valeur) : [...liste, valeur];

  /* Les bornes du curseur, arrondies au pas : un curseur qui s'arrête à
     12 350 F se lit mal. */
  const prixMini = Math.floor(facettes.prixMin / PAS_PRIX) * PAS_PRIX;
  const prixMaxi = Math.ceil(facettes.prixMax / PAS_PRIX) * PAS_PRIX;
  const prixBas = etat.prixMin ?? prixMini;
  const prixHaut = etat.prixMax ?? prixMaxi;
  const prixFiltre = etat.prixMin !== undefined || etat.prixMax !== undefined;

  const nombreFiltres = etat.sous.length + etat.tailles.length + (prixFiltre ? 1 : 0);
  const filtre = nombreFiltres > 0;
  const nomSous = (slug: string) => categorie?.enfants.find((e) => e.slug === slug)?.nom ?? slug;
  const titre = categorie?.nom ?? "Boutique";
  const triCourant = TRIS.findIndex((t) => t.valeur === etat.tri);
  const titreFacette = "border-b border-line pb-3 text-[12.5px] font-extrabold uppercase tracking-[.06em]";
  const debut = (etat.page - 1) * PAR_PAGE;
  const pastille = "flex items-center gap-2.5 rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white";

  return (
    <div ref={haut} className="mx-auto max-w-[1400px] scroll-mt-24 px-5 pt-5 md:px-8 md:pt-8 lg:px-10">
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
            {total === 0
              ? filtre
                ? "Aucune pièce ne répond à cette sélection."
                : categorie
                  ? "Cette catégorie se remplit. Les premières pièces arrivent bientôt."
                  : "La boutique se remplit. Les premières pièces arrivent bientôt."
              : filtre
                ? `${total} pièce${total > 1 ? "s" : ""} correspondent à votre sélection.`
                : total > 1
                  ? `${total} pièces, toutes photographiées et décrites.`
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
                {nombreFiltres}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => aller({ tri: TRIS[(triCourant + 1) % TRIS.length].valeur })}
            className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-[#e5d9de] bg-white px-4 py-3 text-[13.5px] font-semibold md:flex-none md:px-4.5"
          >
            Trier : {TRIS[Math.max(0, triCourant)].libelle} <span className="text-rose">↓</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 pb-20 pt-5 lg:grid-cols-[240px_1fr] lg:gap-11 lg:pt-7">
        <aside
          className={`${
            filtresOuverts ? "block" : "hidden"
          } rounded-3xl border border-line bg-white p-5 lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0`}
        >
          {categorie
            ? categorie.enfants.length > 0 && (
                <div className="mb-6.5 last:mb-0">
                  <div className={titreFacette}>Sous-catégories</div>
                  <div className="flex flex-col pt-2">
                    {categorie.enfants.map((e) => {
                      const on = etat.sous.includes(e.slug);
                      return (
                        <button
                          key={e.slug}
                          type="button"
                          onClick={() => aller({ sous: bascule(etat.sous, e.slug) })}
                          aria-pressed={on}
                          className={`flex items-center gap-3 py-2 text-left text-sm ${on ? "font-bold" : "font-medium text-[#4a3a41]"}`}
                        >
                          <span
                            className={`h-4.5 w-4.5 shrink-0 rounded-md border-[1.5px] transition-colors ${
                              on ? "border-rose bg-rose" : "border-[#dfd3d8] bg-white"
                            }`}
                          />
                          <span className="flex-1">{e.nom}</span>
                          <span className="text-xs text-[#9c8d93]">
                            {facettes.sousCategories[e.slug] ?? 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            : rayons.length > 0 && (
                <div className="mb-6.5 last:mb-0">
                  <div className={titreFacette}>Catégories</div>
                  <div className="flex flex-col pt-2">
                    {rayons.map((c) => (
                      <Link
                        key={c.slug}
                        href={adresse(chemin, { ...etat, categorie: c.slug, sous: [], page: 1 })}
                        className="flex items-center gap-3 py-2 text-sm font-medium text-[#4a3a41] transition-colors hover:text-rose"
                      >
                        <span className="flex-1">{c.nom}</span>
                        <span className="text-xs text-[#9c8d93]">{c.nombre_produits}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

          {facettes.tailles.length > 0 && (
            <div className="mb-6.5 last:mb-0">
              <div className={titreFacette}>Taille</div>
              <div className="flex flex-wrap gap-2 pt-4">
                {facettes.tailles.map(({ valeur, nombre }) => {
                  const on = etat.tailles.includes(valeur);
                  return (
                    <button
                      key={valeur}
                      type="button"
                      onClick={() => aller({ tailles: bascule(etat.tailles, valeur) })}
                      aria-pressed={on}
                      title={`${nombre} pièce${nombre > 1 ? "s" : ""}`}
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
                bas={prixBas}
                haut={prixHaut}
                onValider={(bas, hautPrix) =>
                  aller({
                    prixMin: bas > prixMini ? bas : undefined,
                    prixMax: hautPrix < prixMaxi ? hautPrix : undefined,
                  })
                }
              />
            </div>
          )}
        </aside>

        <div className={`transition-opacity duration-300 ${enCours ? "opacity-50" : ""}`} aria-busy={enCours}>
          {filtre && (
            <div className="flex flex-wrap items-center gap-2 pb-5">
              {etat.sous.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => aller({ sous: bascule(etat.sous, slug) })}
                  className={pastille}
                >
                  {nomSous(slug)} <span className="opacity-55">×</span>
                </button>
              ))}
              {etat.tailles.map((valeur) => (
                <button
                  key={`taille-${valeur}`}
                  type="button"
                  onClick={() => aller({ tailles: bascule(etat.tailles, valeur) })}
                  className={pastille}
                >
                  Taille {valeur} <span className="opacity-55">×</span>
                </button>
              ))}
              {prixFiltre && (
                <button
                  type="button"
                  onClick={() => aller({ prixMin: undefined, prixMax: undefined })}
                  className={pastille}
                >
                  {formatXOF(prixBas)} – {formatXOF(prixHaut)} <span className="opacity-55">×</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  aller({ sous: [], tailles: [], prixMin: undefined, prixMax: undefined })
                }
                className="pl-1.5 text-[13px] font-semibold text-muted"
              >
                Tout effacer
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-5.5">
            {produits.map((p, i) => (
              <ProductCard key={p.id} product={p} onQuickView={setQuick} delay={i * 45} />
            ))}
          </div>

          {produits.length === 0 && (
            <p className="py-12 text-center text-[14px] text-muted sm:py-16 sm:text-[14.5px]">
              {filtre
                ? "Aucune pièce ne répond à cette combinaison. Retirez un filtre pour élargir."
                : "Aucune pièce en ligne pour le moment — elles seront disponibles bientôt."}
            </p>
          )}

          {/* La pagination : des liens, pour qu'une page se partage et s'ouvre
              dans un nouvel onglet. */}
          {pages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex flex-col items-center gap-3 pt-11 sm:flex-row sm:justify-between"
            >
              <p className="text-[13px] text-muted">
                {debut + 1}–{debut + produits.length} sur{" "}
                <span className="font-bold text-ink">{total}</span> pièces
              </p>
              <div className="flex items-center gap-1.5">
                {etat.page > 1 && (
                  <Link
                    href={adresse(chemin, { ...etat, page: etat.page - 1 })}
                    onClick={() => haut.current?.scrollIntoView({ behavior: "smooth" })}
                    className="grid h-10 place-items-center rounded-full border-[1.5px] border-[#e5d9de] bg-white px-4 text-[13px] font-semibold hover:border-rose hover:text-rose"
                  >
                    ← Précédente
                  </Link>
                )}
                {numeros(etat.page, pages).map((n, i) =>
                  n === "…" ? (
                    <span key={`trou-${i}`} className="px-1 text-muted">…</span>
                  ) : (
                    <Link
                      key={n}
                      href={adresse(chemin, { ...etat, page: n })}
                      onClick={() => haut.current?.scrollIntoView({ behavior: "smooth" })}
                      aria-current={n === etat.page ? "page" : undefined}
                      className={`hidden h-10 min-w-10 place-items-center rounded-full px-2 text-[13px] font-semibold sm:grid ${
                        n === etat.page
                          ? "bg-ink text-white"
                          : "border-[1.5px] border-[#e5d9de] bg-white hover:border-rose hover:text-rose"
                      }`}
                    >
                      {n}
                    </Link>
                  ),
                )}
                <span className="px-2 text-[13px] font-semibold sm:hidden">
                  {etat.page} / {pages}
                </span>
                {etat.page < pages && (
                  <Link
                    href={adresse(chemin, { ...etat, page: etat.page + 1 })}
                    onClick={() => haut.current?.scrollIntoView({ behavior: "smooth" })}
                    className="grid h-10 place-items-center rounded-full bg-rose px-4 text-[13px] font-semibold text-white"
                  >
                    Suivante →
                  </Link>
                )}
              </div>
            </nav>
          )}
        </div>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
