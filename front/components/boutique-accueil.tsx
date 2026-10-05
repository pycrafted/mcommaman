"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { ProductCard } from "./product-card";
import { CurseurPrix } from "./catalogue";
import { Reveal } from "./reveal";
import { IconCheck, IconChevron, IconClose, IconRefresh } from "./icons";
import {
  lireFacettes,
  lirePageCatalogue,
  type BrancheRayon,
  type Facettes,
  type Tri,
} from "@/lib/catalogue";
import type { Product } from "@/lib/products";
import { formatXOF } from "@/lib/format";

/* ------------------------------------------------------------- la boutique
   Toute la boutique sur l'accueil : les filtres à gauche, dans une carte
   blanche, les pièces à droite. Catégorie, sous-catégories, prix, tri,
   taille et couleur — tout est appliqué par le serveur, qui renvoie aussi
   les facettes (les décomptes et les bornes) pour que les filtres se
   dessinent avec des chiffres justes. Rien ne passe par l'adresse : la page
   reste `/`, l'état est local.

   Chaque filtre a sa forme, pour qu'on les distingue d'un coup d'oeil :
   - la catégorie : des pastilles, une seule allumée, en rose ;
   - les sous-catégories : des pastilles cernées, plusieurs à la fois, une
     coche apparaît quand on en prend une ;
   - le prix : un curseur à deux poignées ;
   - le tri : un sélecteur à glissière, un seul choix, le curseur rose glisse ;
   - la taille et la couleur : des menus déroulants, cases à cocher dedans.

   Le premier rendu vient du serveur (`app/page.tsx` lit la sélection « Tout »
   et ses facettes) : les 159 pièces sont dans le HTML servi. Chaque changement
   de filtre demande ensuite la nouvelle page et ses facettes, en parallèle.
   Tout le mouvement est en CSS. */

/** Le plafond de l'API : assez pour tout montrer d'un coup. */
const TOUTES = 500;
/** Combien de cartes entrent en cascade ; au-delà, elles sont déjà là. */
const CASCADE = 18;

/** Les tris proposés, dans l'ordre. */
const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: "nouveautes", libelle: "Nouveautés" },
  { valeur: "promotion", libelle: "Promotions" },
];

/* Le rose des boutons : celui du bandeau. */
const ROSE = "bg-[#e24f88] text-white shadow-[0_10px_22px_-12px_rgba(226,79,136,.9)]";
const ROSE_SURVOL = "hover:bg-[#d4467c]";

export type EtatInitialBoutique = {
  produits: Product[];
  total: number;
  facettes: Facettes;
};

type Etat = {
  /** La catégorie de premier niveau choisie, vide pour toute la boutique. */
  categorie: string;
  sous: string[];
  tailles: string[];
  coloris: string[];
  prixMin?: number;
  prixMax?: number;
  tri: Tri;
};

const VIDE: Etat = { categorie: "", sous: [], tailles: [], coloris: [], tri: "nouveautes" };

const bascule = (liste: string[], valeur: string) =>
  liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

/** Le titre d'un bloc de la carte, avec un petit trait rose devant. */
function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-muted">
      <span aria-hidden className="h-3 w-1 rounded-full bg-[#e24f88]" />
      {children}
    </h3>
  );
}

/**
 * Une pastille : un choix parmi d'autres. Pleine et rose quand elle est
 * prise, cernée sinon. Elle se soulève sous le curseur et s'enfonce au clic ;
 * avec `coche`, une coche surgit quand on la prend (pour les choix multiples).
 */
function Pastille({
  actif,
  label,
  onClick,
  coche = false,
}: {
  actif: boolean;
  label: string;
  onClick: () => void;
  coche?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-[transform,background-color,color,border-color,box-shadow] duration-300 ease-back hover:-translate-y-0.5 active:scale-95 ${
        actif
          ? `border-transparent ${ROSE} ${ROSE_SURVOL}`
          : "border-line bg-white text-ink/80 hover:border-[#e24f88] hover:text-[#e24f88]"
      }`}
    >
      {coche && actif && <IconCheck className="anim-pop h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

/**
 * Un sélecteur à glissière : une seule option, et un curseur rose qui glisse
 * de l'une à l'autre au lieu de sauter. On mesure le bouton actif, on déplace
 * le curseur derrière lui.
 */
function Glissiere({
  options,
  active,
  onChoisir,
}: {
  options: { valeur: string; libelle: string }[];
  active: string;
  onChoisir: (valeur: string) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [curseur, setCurseur] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = rail.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (el) setCurseur({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
  }, [active, options.length]);

  return (
    <div ref={rail} className="relative grid grid-cols-2 gap-1 rounded-2xl bg-blush p-1">
      <span
        aria-hidden
        className={`absolute left-0 top-0 rounded-xl ${ROSE} transition-[transform,width,height] duration-450 ease-back`}
        style={{
          transform: `translate(${curseur.left}px, ${curseur.top}px)`,
          width: curseur.width,
          height: curseur.height,
          opacity: curseur.width ? 1 : 0,
        }}
      />
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          onClick={() => onChoisir(o.valeur)}
          aria-pressed={active === o.valeur}
          className={`relative z-10 rounded-xl px-2 py-2 text-[12.5px] font-bold transition-colors duration-300 active:scale-95 ${
            active === o.valeur ? "text-white" : "text-ink/70 hover:text-ink"
          }`}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

/**
 * Une ligne à cocher dans un menu : la case, le libellé, le décompte. La case
 * grossit, une onde en part quand on la coche.
 */
function Case({
  actif,
  label,
  nombre,
  onClick,
  teinte,
}: {
  actif: boolean;
  label: string;
  nombre?: number;
  onClick: () => void;
  /** Une couleur à montrer dans la case, pour les coloris. */
  teinte?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`group/l flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] transition-[transform,background-color,color] duration-300 ease-back hover:translate-x-1 active:scale-[.97] ${
        actif ? "bg-[#fbe6ef] font-semibold text-ink" : "text-ink/80 hover:bg-blush hover:text-ink"
      }`}
    >
      <span
        aria-hidden
        className={`relative grid h-[18px] w-[18px] shrink-0 place-items-center border-[1.5px] transition-[transform,border-color,background-color] duration-300 ease-back group-hover/l:scale-110 ${
          teinte ? "rounded-full" : "rounded-[6px]"
        } ${actif ? "scale-110 border-[#e24f88]" : "border-line group-hover/l:border-[#e24f88]"} ${
          teinte ? "" : actif ? "bg-[#e24f88]" : "bg-white"
        }`}
        style={teinte ? { background: teinte } : undefined}
      >
        {actif && (
          <>
            <span className={`anim-onde absolute inset-0 border-2 border-[#e24f88] ${teinte ? "rounded-full" : "rounded-[6px]"}`} />
            {!teinte && <IconCheck className="anim-pop h-3 w-3 text-white" />}
          </>
        )}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {nombre !== undefined && <span className="text-[12px] tabular-nums text-muted">{nombre}</span>}
    </button>
  );
}

/**
 * Un menu déroulant : une ligne qui s'ouvre sur sa liste, fermée au départ.
 * Le panneau arrive d'un souffle, la flèche se retourne dans un rond qui
 * passe en rose, et la ligne dit combien sont choisis même menu fermé.
 */
function Deroulant({
  titre,
  tout,
  resume,
  ouvert,
  onToggle,
  vide = false,
  children,
}: {
  titre: string;
  /** Ce que dit la ligne quand rien n'est choisi : « Toutes les tailles ». */
  tout: string;
  /** Combien sont choisis, en un mot : « 2 choisies ». */
  resume?: string;
  ouvert: boolean;
  onToggle: () => void;
  /** Rien à proposer pour la sélection en cours : le menu le dit et ne s'ouvre pas. */
  vide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Titre>{titre}</Titre>
      {vide ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-2.5 text-[13px] font-semibold text-muted/70">
          Aucune pour cette sélection
        </div>
      ) : (
        /* Même habit que les pastilles : blanc cerné au repos, rose quand on
           s'en approche ou qu'il est ouvert. */
        <div
          className={`rounded-2xl border bg-white transition-[border-color,box-shadow] duration-300 ${
            ouvert
              ? "border-[#e24f88] shadow-[0_14px_30px_-22px_rgba(226,79,136,.7)]"
              : "border-line hover:border-[#e24f88]"
          }`}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={ouvert}
            className={`group/d flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] font-semibold transition-colors ${
              ouvert ? "text-[#e24f88]" : "text-ink/80 hover:text-[#e24f88]"
            }`}
          >
            <span className="flex items-center gap-2">
              {resume ? (
                <span key={resume} className={`anim-pop-in inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${ROSE}`}>
                  {resume}
                </span>
              ) : (
                tout
              )}
            </span>
            <span
              className={`grid h-6 w-6 place-items-center rounded-full transition-[transform,background-color,color] duration-400 ease-back ${
                ouvert ? `rotate-180 ${ROSE}` : "bg-blush text-muted group-hover/d:text-[#e24f88]"
              }`}
            >
              <IconChevron className="h-3.5 w-3.5" />
            </span>
          </button>
          {ouvert && <div className="anim-pop-in border-t border-line px-2 py-2">{children}</div>}
        </div>
      )}
    </div>
  );
}

export function BoutiqueAccueil({
  categories,
  initial,
}: {
  /** Les catégories du back-office, chacune avec ses sous-catégories. */
  categories: BrancheRayon[];
  /** La sélection « Tout », lue sur le serveur : ce que la page montre à l'ouverture. */
  initial: EtatInitialBoutique;
}) {
  const [etat, setEtat] = useState<Etat>(VIDE);
  const [produits, setProduits] = useState(initial.produits);
  const [facettes, setFacettes] = useState(initial.facettes);
  const [enAttente, demarrer] = useTransition();
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [taillesOuvertes, setTaillesOuvertes] = useState(false);
  const [colorisOuverts, setColorisOuverts] = useState(false);
  /* Le numéro de la sélection affichée : la grille le prend pour clé, et
     rejoue sa cascade à chaque nouvelle sélection. */
  const [generation, setGeneration] = useState(0);

  /* À chaque changement d'état (sauf le premier rendu, déjà servi), la
     sélection et ses facettes sont relues ensemble. Une réponse en retard sur
     une plus récente est ignorée : le numéro de requête fait foi. */
  const premier = useRef(true);
  const requete = useRef(0);
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    const numero = ++requete.current;
    const filtres = {
      rayon: etat.categorie || undefined,
      sous: etat.sous,
      tailles: etat.tailles,
      coloris: etat.coloris,
      prixMin: etat.prixMin,
      prixMax: etat.prixMax,
      tri: etat.tri,
    };
    demarrer(async () => {
      const [page, f] = await Promise.all([
        lirePageCatalogue({ ...filtres, parPage: TOUTES }),
        lireFacettes(filtres),
      ]);
      if (numero !== requete.current) return;
      setProduits(page.produits);
      setFacettes(f);
      setGeneration(numero);
    });
  }, [etat]);

  const categorie = categories.find((c) => c.slug === etat.categorie) ?? null;
  /* Les sous-catégories n'apparaissent qu'une fois une catégorie choisie :
     ce sont les siennes, et seulement celles qui ont des pièces. */
  const sousCategories = (categorie ? categorie.enfants : []).filter(
    (s) => (facettes.sousCategories[s.slug] ?? 0) > 0 || etat.sous.includes(s.slug),
  );

  const prixFiltre = etat.prixMin !== undefined || etat.prixMax !== undefined;
  const nombreFiltres =
    (etat.categorie ? 1 : 0) + etat.sous.length + etat.tailles.length + etat.coloris.length + (prixFiltre ? 1 : 0);

  /* Changer de catégorie efface les sous-catégories : celles de l'ancienne
     n'auraient plus de sens. */
  const choisirCategorie = (slug: string) =>
    setEtat((e) => ({ ...e, categorie: e.categorie === slug ? "" : slug, sous: [] }));
  const effacer = () => setEtat({ ...VIDE, tri: etat.tri });

  /* Les pastilles des filtres actifs, au-dessus de la grille : on voit ce
     qui restreint, on le retire d'un geste. */
  const actifs: { cle: string; label: string; retirer: () => void }[] = [
    ...(etat.categorie && categorie ? [{ cle: "cat", label: categorie.nom, retirer: () => choisirCategorie(etat.categorie) }] : []),
    ...etat.sous.map((slug) => ({
      cle: `sous-${slug}`,
      label: sousCategories.find((s) => s.slug === slug)?.nom ?? slug,
      retirer: () => setEtat((e) => ({ ...e, sous: bascule(e.sous, slug) })),
    })),
    ...etat.tailles.map((t) => ({ cle: `taille-${t}`, label: `Taille ${t}`, retirer: () => setEtat((e) => ({ ...e, tailles: bascule(e.tailles, t) })) })),
    ...etat.coloris.map((n) => ({ cle: `coloris-${n}`, label: n, retirer: () => setEtat((e) => ({ ...e, coloris: bascule(e.coloris, n) })) })),
    ...(prixFiltre ? [{ cle: "prix", label: `${formatXOF(etat.prixMin ?? facettes.prixMin)} à ${formatXOF(etat.prixMax ?? facettes.prixMax)}`, retirer: () => setEtat((e) => ({ ...e, prixMin: undefined, prixMax: undefined })) }] : []),
  ];

  const carte = (
    <Reveal
      stagger={70}
      className="flex flex-col gap-6 rounded-3xl border border-line bg-white p-5 shadow-[0_24px_50px_-36px_rgba(36,26,32,.35)]"
    >
      {/* ------------------------------------------------------- en-tête */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[22px] font-semibold tracking-tight">Filtres</h2>
        {nombreFiltres > 0 && (
          <button
            type="button"
            onClick={effacer}
            className="anim-pop-in group/r inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#e24f88] transition-colors hover:text-[#d4467c]"
          >
            <IconRefresh className="h-3.5 w-3.5 transition-transform duration-500 ease-back group-hover/r:rotate-180" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* ------------------------------------------------------ catégorie */}
      <div>
        <Titre>Catégorie</Titre>
        <div className="flex flex-wrap gap-2">
          <Pastille actif={!etat.categorie} label="Tout" onClick={() => choisirCategorie("")} />
          {categories.map((c) => (
            <Pastille key={c.slug} actif={etat.categorie === c.slug} label={c.nom} onClick={() => choisirCategorie(c.slug)} />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------- sous-catégories
          Elles se déplient quand une catégorie est choisie, en cascade. */}
      {sousCategories.length > 0 && (
        <div key={categorie?.slug} className="anim-fade-up">
          <Titre>Dans {categorie?.nom}</Titre>
          <div className="stagger flex flex-wrap gap-2" style={{ "--step": "40ms" } as React.CSSProperties}>
            {sousCategories.map((s) => (
              <Pastille
                key={s.slug}
                coche
                actif={etat.sous.includes(s.slug)}
                label={s.nom}
                onClick={() => setEtat((e) => ({ ...e, sous: bascule(e.sous, s.slug) }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ tri */}
      <div>
        <Titre>Trier</Titre>
        <Glissiere options={TRIS} active={etat.tri} onChoisir={(v) => setEtat((e) => ({ ...e, tri: v as Tri }))} />
      </div>

      {/* ----------------------------------------------------------- prix */}
      {facettes.prixMax > facettes.prixMin && (
        <div>
          <Titre>Prix</Titre>
          <CurseurPrix
            min={facettes.prixMin}
            max={facettes.prixMax}
            bas={etat.prixMin ?? facettes.prixMin}
            haut={etat.prixMax ?? facettes.prixMax}
            onValider={(bas, haut) =>
              setEtat((e) => ({
                ...e,
                prixMin: bas > facettes.prixMin ? bas : undefined,
                prixMax: haut < facettes.prixMax ? haut : undefined,
              }))
            }
          />
        </div>
      )}

      {/* ----------------------------------------------- taille et couleur
          Deux menus déroulants, fermés au départ. Ouverts, ils montrent tout
          d'un coup, sans barre de défilement : la carte s'allonge, et c'est
          la colonne qui défile si elle dépasse l'écran. */}
      <Deroulant
          titre="Taille"
          tout="Toutes les tailles"
          vide={facettes.tailles.length === 0 && etat.tailles.length === 0}
          resume={etat.tailles.length ? `${etat.tailles.length} choisie${etat.tailles.length > 1 ? "s" : ""}` : undefined}
          ouvert={taillesOuvertes}
          onToggle={() => setTaillesOuvertes((o) => !o)}
        >
          <div className="stagger" style={{ "--step": "30ms" } as React.CSSProperties}>
            {facettes.tailles.map(({ valeur, nombre }) => (
              <Case
                key={valeur}
                actif={etat.tailles.includes(valeur)}
                label={valeur}
                nombre={nombre}
                onClick={() => setEtat((e) => ({ ...e, tailles: bascule(e.tailles, valeur) }))}
              />
            ))}
          </div>
        </Deroulant>

      <Deroulant
          titre="Couleur"
          tout="Toutes les couleurs"
          vide={facettes.coloris.length === 0 && etat.coloris.length === 0}
          resume={etat.coloris.length ? `${etat.coloris.length} choisie${etat.coloris.length > 1 ? "s" : ""}` : undefined}
          ouvert={colorisOuverts}
          onToggle={() => setColorisOuverts((o) => !o)}
        >
          <div className="stagger" style={{ "--step": "30ms" } as React.CSSProperties}>
            {facettes.coloris.map(({ nom, hexa, nombre }) => (
              <Case
                key={nom}
                teinte={hexa || "#ddd"}
                actif={etat.coloris.includes(nom)}
                label={nom}
                nombre={nombre}
                onClick={() => setEtat((e) => ({ ...e, coloris: bascule(e.coloris, nom) }))}
              />
            ))}
          </div>
        </Deroulant>

      {/* --------------------------------------------- le bouton du bas :
          plein et rose, il ramène tout à zéro et n'apparaît qu'en cas de
          besoin, en sautant. */}
      {nombreFiltres > 0 && (
        <button
          type="button"
          onClick={effacer}
          className={`shine anim-pop-in inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13.5px] font-bold transition-[transform,background-color] duration-300 ease-back hover:-translate-y-0.5 active:scale-95 ${ROSE} ${ROSE_SURVOL}`}
        >
          <IconClose className="h-3.5 w-3.5" />
          Tout effacer
        </button>
      )}
    </Reveal>
  );

  return (
    <section id="boutique" className="scroll-mt-20 pt-8 md:pt-12">
      <div className="mx-auto w-full max-w-[1400px] px-5 md:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[290px_1fr] lg:gap-10">
          {/* ------------------------------------------------- les filtres
              Une carte blanche à gauche sur grand écran, collée sous la barre
              du haut. Au doigt, repliée derrière un bouton qui dit combien
              sont actifs. */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <button
              type="button"
              onClick={() => setFiltresOuverts((o) => !o)}
              aria-expanded={filtresOuverts}
              className="mb-4 flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-[13.5px] font-bold transition-colors active:bg-blush lg:hidden"
            >
              <span>
                Filtres
                {nombreFiltres > 0 && (
                  <span key={nombreFiltres} className={`anim-pop ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] ${ROSE}`}>
                    {nombreFiltres}
                  </span>
                )}
              </span>
              <IconChevron className={`h-4 w-4 text-muted transition-transform duration-400 ease-back ${filtresOuverts ? "rotate-180" : ""}`} />
            </button>
            <div className={`${filtresOuverts ? "anim-fade-up block" : "hidden"} lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1`}>
              {carte}
            </div>
          </aside>

          {/* ------------------------------------------------- les pièces */}
          <div className="min-w-0">
            {actifs.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {actifs.map((a) => (
                  <button
                    key={a.cle}
                    type="button"
                    onClick={a.retirer}
                    className="anim-pop-in group/p inline-flex items-center gap-1.5 rounded-full bg-[#fbe6ef] px-3 py-1.5 text-[12.5px] font-semibold text-[#b3306a] transition-all duration-300 ease-soft hover:-translate-y-0.5 hover:bg-[#e24f88] hover:text-white"
                  >
                    {a.label}
                    <IconClose className="h-3 w-3 transition-transform duration-300 group-hover/p:rotate-90" />
                  </button>
                ))}
              </div>
            )}

            {produits.length === 0 ? (
              <div className="anim-fade-up rounded-3xl border border-line bg-white px-8 py-14 text-center">
                <h3 className="font-serif text-2xl font-semibold tracking-tight">Aucune pièce ne correspond</h3>
                <p className="mx-auto mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
                  Essayez avec moins de filtres, ou effacez-les tous.
                </p>
                <button
                  type="button"
                  onClick={effacer}
                  className={`shine mt-6 rounded-full px-6 py-3 text-[13.5px] font-bold transition-transform hover:-translate-y-0.5 ${ROSE} ${ROSE_SURVOL}`}
                >
                  Tout effacer
                </button>
              </div>
            ) : (
              /* La clé change avec la sélection : les cartes sont recréées et
                 la cascade rejoue. Pendant la lecture, la grille pâlit un peu. */
              <div
                key={generation}
                className={`grid grid-cols-2 gap-3 transition-[opacity,transform] duration-300 sm:gap-4 md:grid-cols-3 lg:gap-5 ${
                  enAttente ? "scale-[.995] opacity-50" : ""
                }`}
                aria-busy={enAttente}
              >
                {produits.map((p, i) => (
                  <ProductCard key={p.id} product={p} delay={i < CASCADE ? i * 45 : 0} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
