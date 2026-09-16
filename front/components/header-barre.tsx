"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO, type Product } from "@/lib/products";
import { formatXOF } from "@/lib/format";
import type { BrancheRayon, LienRayon } from "@/lib/catalogue";
import { ScrollProgress } from "./motion";
import { useAuth } from "./auth-context";
import { useCart } from "./cart-context";
import { useFavorites } from "./favorites-context";
import { SearchOverlay } from "./search-overlay";
import {
  IconArrow,
  IconBag,
  IconChevron,
  IconClose,
  IconHeart,
  IconMenu,
  IconPackage,
  IconSearch,
  IconUser,
} from "./icons";

/* La barre est reprise de la maquette boty : le logo au tiers gauche, les
   rayons au centre, les cinq actions à droite. À la place du bandeau
   d'annonce, la jauge de lecture court sous la barre et se remplit au
   défilement — elle sert aussi de trait de séparation. */

/* La barre ne nomme plus de rayon choisi à la main — ils changent au gré du
   catalogue, et chaque univers déplie les siens dans son panneau. Restent les
   deux univers, qui eux ne bougent pas : « /boutique » est celui des enfants,
   « /coin-maman » celui des mamans.

   Le premier s'affiche « Catalogue » et non « Enfants » : c'est la porte
   d'entrée de la boutique, et une cliente qui cherche à parcourir les pièces
   lit ce mot-là en premier.

   Il n'y a plus d'entrée « Boutique » distincte : elle menait à « /boutique »
   comme « Catalogue », et deux libellés pour une seule page faisaient hésiter
   pour rien. C'est « Catalogue » qui porte désormais le panneau. */
type EntreeNav = {
  href: string;
  label: string;
  /** Renseigné quand l'entrée déplie ses rayons au survol. */
  univers?: "enfant" | "maman";
};

const NAV: EntreeNav[] = [
  { href: "/boutique", label: "Catalogue", univers: "enfant" },
  { href: "/coin-maman", label: "Coin Maman", univers: "maman" },
  { href: "/avis", label: "Avis" },
  { href: "/contact", label: "Contact" },
];

/* Les trois raccourcis de compte de boty, partagés par la barre du haut et le
   menu au doigt. Celui du compte change de destination une fois la cliente
   connectée : il est recalculé au rendu. */
const COMPTE = [
  { href: "/favoris", label: "Mes favoris", Icone: IconHeart },
  { href: "/commandes", label: "Mes commandes", Icone: IconPackage },
  { href: "/compte/connexion", label: "Se connecter", Icone: IconUser },
];

/* Longueur d'une colonne quand le panneau n'a qu'une catégorie à montrer et
   liste donc ses sous-catégories directement. Au-delà, la liste reprend dans
   la colonne d'à côté — une colonne de trente rayons sortirait de l'écran.
   Sept entrées font une colonne qui se lit d'un regard. */
const PAR_COLONNE = 7;

/** Ce qu'un univers donne à son panneau. */
export type RayonsUnivers = {
  /** Les catégories de premier niveau, chacune avec ses sous-catégories. */
  branches: BrancheRayon[];
  /** Les fiches publiées dans cet univers. Zéro tant que rien n'est en ligne. */
  nombre: number;
  /** La dernière arrivée, quand il y en a une. */
  derniere: Product | null;
};

/** Un bloc du menu : une catégorie et ce qu'elle contient. */
type BlocRayons = {
  cle: string;
  titre: string;
  /** Les sous-catégories à lister — ou les catégories feuilles, regroupées. */
  entrees: LienRayon[];
  /** Le décompte de la catégorie. Zéro pour le bloc de regroupement. */
  nombre: number;
  /** Le nom de la catégorie, quand le titre en est une et mène quelque part. */
  categorie: string | null;
};

/**
 * Les blocs d'un univers, dans l'ordre du back-office.
 *
 * Une catégorie qui a des sous-catégories fait son bloc. Celles qui n'en ont
 * aucune portent leurs fiches elles-mêmes : elles se regroupent en un seul
 * bloc de fin, sinon chacune ouvrirait un bloc d'une ligne sous son propre
 * titre — le nom serait écrit deux fois et le classement deviendrait illisible
 * sur un catalogue à plat.
 *
 * Le panneau du grand écran et le tiroir au doigt partagent ce calcul : deux
 * découpages différents donneraient deux menus différents.
 */
function blocsDe(branches: BrancheRayon[]): BlocRayons[] {
  const groupes = branches.filter((b) => b.enfants.length > 0);
  const seules = branches.filter((b) => b.enfants.length === 0);

  const blocs: BlocRayons[] = groupes.map((b) => ({
    cle: b.slug,
    titre: b.nom,
    entrees: b.enfants,
    nombre: b.nombre,
    categorie: b.nom,
  }));

  if (seules.length > 0) {
    blocs.push({
      cle: "rayons-sans-sous-categorie",
      titre: groupes.length > 0 ? "Autres rayons" : "Rayons",
      entrees: seules,
      nombre: 0,
      categorie: null,
    });
  }
  return blocs;
}

/** Une sous-catégorie du panneau : son nom, son décompte, sa flèche au survol. */
function LigneRayon({ href, nom, nombre }: { href: string; nom: string; nombre: number }) {
  return (
    <Link
      href={href}
      className="group/l flex items-center gap-2 rounded-lg py-[5px] pl-2 pr-2 -ml-2 text-[13.5px] font-medium text-ink/80 transition-colors hover:bg-mist hover:text-rose"
    >
      <span className="truncate">{nom}</span>
      {/* Un « 0 » n'apprend rien et fait douter du rayon : le décompte ne
          s'affiche que lorsqu'il y a quelque chose à compter. */}
      {nombre > 0 && (
        <span className="text-[11px] tabular-nums text-muted transition-colors group-hover/l:text-rose/70">
          {nombre}
        </span>
      )}
      <IconArrow className="ml-auto h-3.5 w-3.5 shrink-0 -translate-x-1 opacity-0 transition-all duration-300 group-hover/l:translate-x-0 group-hover/l:opacity-100" />
    </Link>
  );
}

/**
 * Un département du panneau : la catégorie en titre, ses sous-catégories
 * dessous, en colonnes de `PAR_COLONNE` au plus.
 *
 * Le découpage en colonnes se fait bloc par bloc et non sur le panneau entier :
 * une catégorie doit rester d'un seul tenant, sinon ses sous-catégories se
 * retrouvent à cheval sur deux colonnes et le classement ne se lit plus.
 */
function BlocRayon({
  titre,
  href,
  entrees,
  nombre,
  lien,
}: {
  titre: string;
  /** Où mène le titre. Vide pour un bloc qui n'est pas une vraie catégorie. */
  href: string | null;
  entrees: LienRayon[];
  nombre: number;
  lien: (nom: string) => string;
}) {
  const rangs = Math.min(PAR_COLONNE, Math.max(entrees.length, 1));
  const titreClasses =
    "truncate text-[11px] font-extrabold uppercase tracking-[.14em] text-ink";

  return (
    <div className="min-w-[9.5rem]">
      {href ? (
        <Link href={href} className="group/t flex items-baseline gap-2 border-b border-line pb-2">
          <span className={`${titreClasses} transition-colors group-hover/t:text-rose`}>
            {titre}
          </span>
          {nombre > 0 && <span className="text-[11px] tabular-nums text-muted">{nombre}</span>}
        </Link>
      ) : (
        <div className="border-b border-line pb-2">
          <span className={titreClasses}>{titre}</span>
        </div>
      )}

      <div
        className="mt-2 grid grid-flow-col justify-start gap-x-8"
        style={{ gridTemplateRows: `repeat(${rangs}, auto)` }}
      >
        {entrees.map((e) => (
          <LigneRayon key={e.slug} href={lien(e.nom)} nom={e.nom} nombre={e.nombre} />
        ))}
      </div>
    </div>
  );
}

/**
 * Le panneau d'un univers : son classement, déplié sur deux étages.
 *
 * Un bloc par catégorie de premier niveau, ses sous-catégories dessous. Les
 * catégories qui n'en ont aucune portent leurs fiches elles-mêmes : elles se
 * regroupent en fin de panneau plutôt que d'ouvrir chacune un bloc d'une
 * ligne — c'est ce qui rendrait illisible un catalogue à plat.
 *
 * Le panneau se dimensionne sur son contenu (`w-max` côté appelant) : cinq
 * rayons ne doivent pas ouvrir une carte de mille pixels aux trois quarts
 * vide. C'est aussi pourquoi les blocs sont en `flex-wrap` et non en grille à
 * colonnes fixes — une grille réserverait la place de trois colonnes même
 * quand il n'y a qu'un bloc.
 *
 * Le titre d'un bloc mène à `?cat=<son nom>`. La page « /boutique » sait
 * déplier une catégorie en ses sous-catégories (`components/catalogue.tsx`) ;
 * « /coin-maman » ne filtre que sur les feuilles, un nom de parente y
 * retomberait sur « Tout ». D'où `filtrable` : sans lui le titre mène à la
 * page entière, ce qui est de toute façon ce que « toute la catégorie » veut
 * dire quand il n'y en a qu'une.
 */
function PanneauRayons({
  href,
  rayons,
  filtrable,
}: {
  /** La page de l'univers — celle que les liens filtrent. */
  href: string;
  rayons: RayonsUnivers;
  /** Vrai quand la page sait filtrer sur le nom d'une catégorie parente. */
  filtrable: boolean;
}) {
  const { branches, nombre, derniere } = rayons;
  const lien = (nom: string) => `${href}?cat=${encodeURIComponent(nom)}`;

  return (
    <div className="overflow-hidden rounded-[26px] border border-line bg-cream shadow-[0_44px_90px_-44px_rgba(36,26,32,.5)]">
      <div className="flex flex-col gap-7 p-7 lg:flex-row lg:gap-9">
        {/* ------------------------------------------------ le classement */}
        <div className="flex flex-wrap gap-x-11 gap-y-7">
          {blocsDe(branches).map((b) => (
            <BlocRayon
              key={b.cle}
              titre={b.titre}
              href={b.categorie ? (filtrable ? lien(b.categorie) : href) : null}
              entrees={b.entrees}
              nombre={b.nombre}
              lien={lien}
            />
          ))}
        </div>

        {/* ------------------------------------------------------ la colonne
            de droite : la dernière arrivée, puis l'entrée sans filtre. La
            vignette ne coûte aucune requête — `lireEnTeteCatalogue` la ramène
            avec le décompte, dans le même appel. */}
        <div className="flex w-full shrink-0 flex-col gap-3.5 border-line lg:ml-auto lg:w-[13.5rem] lg:border-l lg:pl-9">
          {derniere && (
            <Link href={`/p/${derniere.slug}`} className="group/n block">
              <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-stone">
                {derniere.image && (
                  <Image
                    src={derniere.image}
                    alt={derniere.name}
                    fill
                    sizes="216px"
                    className="object-cover transition-transform duration-700 ease-soft group-hover/n:scale-105"
                  />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-cream/95 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[.12em] text-rose">
                  Dernière arrivée
                </span>
              </div>
              <div className="mt-2.5 truncate text-[13.5px] font-semibold transition-colors group-hover/n:text-rose">
                {derniere.name}
              </div>
              <div className="text-[13px] tabular-nums text-muted">{formatXOF(derniere.price)}</div>
            </Link>
          )}

          <Link
            href={href}
            className="group/v mt-auto flex items-center gap-1.5 text-[13px] font-bold text-rose"
          >
            {nombre > 0 ? `Voir les ${nombre} pièces` : "Voir tout le rayon"}
            <IconArrow className="h-3.5 w-3.5 transition-transform duration-300 group-hover/v:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * La barre du haut, telle qu'elle se dessine.
 *
 * Les rayons et le décompte lui sont donnés : c'est `components/header.tsx`
 * qui va les chercher sur le serveur. Ici on n'écrit aucune catégorie à la
 * main — elles viennent toutes du back-office.
 */

export function HeaderBarre({
  enfant,
  maman,
}: {
  /** Le vestiaire enfant : son classement, son décompte, sa dernière arrivée. */
  enfant: RayonsUnivers;
  /** Le Coin Maman — même découpage, l'autre univers. */
  maman: RayonsUnivers;
}) {
  const parUnivers = { enfant, maman };
  /* Un univers sans rayon connu — serveur endormi, boutique qui ouvre — n'ouvre
     pas de panneau vide : l'entrée reste un lien simple vers sa page. Seule
     « /boutique » sait filtrer sur le nom d'une catégorie parente, d'où
     `filtrable` (voir `PanneauRayons`). */
  const nombrePieces = enfant.nombre;
  const { count, pulse, openDrawer } = useCart();
  const { account } = useAuth();
  const { count: favoris } = useFavorites();

  /* Avant l'hydratation, `account` vaut `null` des deux côtés : le premier rendu
     montre l'icône neutre, les initiales prennent sa place ensuite. */
  const initiales = account
    ? account.name
        .split(" ")
        .filter(Boolean)
        .map((mot) => mot[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;
  /* Une fois connectée, la cliente va droit à son espace plutôt qu'au
     formulaire de connexion. */
  const raccourcis = COMPTE.map((r) =>
    r.href === "/compte/connexion" && account
      ? { ...r, href: "/compte", label: "Mon espace client" }
      : r
  );

  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  /* L'entrée du menu au doigt dont les rayons sont dépliés — une seule à la
     fois, sinon le tiroir dépasse l'écran et la liste ne se lit plus. */
  const [replie, setReplie] = useState<string | null>(null);

  /* Raccourcis : Ctrl/Cmd+K partout, « / » quand on n'est pas en train d'écrire. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const cible = event.target as HTMLElement | null;
      const saisie =
        cible?.tagName === "INPUT" || cible?.tagName === "TEXTAREA" || cible?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "/" && !saisie) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Changer de page referme le menu — sinon il reste ouvert par-dessus. Le
     repli suit : rouvrir le tiroir sur une section dépliée d'une page
     précédente n'aurait pas de sens. */
  useEffect(() => {
    setMenuOpen(false);
    setReplie(null);
  }, [pathname]);

  const actif = (href: string) => pathname === href.split("?")[0] && !href.includes("?");
  const lien = (href: string) =>
    `whitespace-nowrap text-[13.5px] font-medium transition-colors hover:text-rose ${
      actif(href) ? "text-rose" : "text-ink/75"
    }`;

  return (
    <>
      {/* La barre reste en haut de l'écran au défilement. */}
      <header className="sticky top-0 z-50">
        {/* La jauge de lecture ferme le haut de la barre : posée dessous, elle
            se confondait avec la bordure. */}
        <ScrollProgress />

        <div className="border-b border-line bg-white shadow-[0_1px_12px_rgba(36,26,32,.04)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* La colonne du logo est figée à 132 px comme chez boty : au-delà,
                elle poussait les rayons contre le champ de recherche. */}
            <div className="relative flex h-16 items-center justify-between gap-4 lg:grid lg:h-[4.75rem] lg:grid-cols-[132px_1fr_auto] lg:gap-x-8">
              {/* ------------------------------------------- menu au doigt */}
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                aria-expanded={menuOpen}
                className="-ml-2 grid h-11 w-11 place-items-center text-ink/75 transition-colors hover:text-rose lg:hidden"
              >
                {menuOpen ? <IconClose /> : <IconMenu />}
              </button>

              {/* ------------------------------------------------- le logo */}
              <Link href="/" aria-label="M comme Maman — accueil" className="shrink-0">
                <Image
                  src={LOGO}
                  alt="M comme Maman"
                  width={180}
                  height={52}
                  priority
                  className="h-9 w-auto object-contain md:h-11"
                />
              </Link>

              {/* --------------------------------- navigation, grand écran */}
              <nav className="hidden items-center justify-center gap-7 lg:flex xl:gap-9">
                {NAV.map((n) => {
                  const rayons = n.univers ? parUnivers[n.univers] : null;
                  /* Un univers dont on ne connaît aucun rayon — serveur
                     endormi, boutique qui ouvre — ne déplie rien : l'entrée
                     reste un lien simple plutôt qu'un panneau vide. */
                  const deplie = rayons !== null && rayons.branches.length > 0;

                  if (!deplie) {
                    return (
                      <Link key={n.label} href={n.href} className={lien(n.href)}>
                        {n.label}
                      </Link>
                    );
                  }

                  return (
                    /* Le panneau s'ouvre au survol et au clavier
                       (focus-within), jamais au clic seul : le lien doit
                       rester un lien. */
                    <div key={n.label} className="group">
                      <Link
                        href={n.href}
                        className={`flex items-center gap-1.5 ${lien(n.href)}`}
                        aria-haspopup="true"
                      >
                        {n.label}
                        <IconChevron className="h-3 w-3 transition-transform duration-300 group-hover:rotate-180" />
                      </Link>

                      {/* Le panneau se cale sur la rangée d'en-tête, pas sur le
                          lien : centré sur celui-ci, il sortait du cadre par la
                          gauche dès 1280 px. `-mt-8 pt-8` ménage une bande
                          transparente entre le lien et la carte — sans elle, la
                          souris quitte le survol en descendant et le panneau se
                          referme au milieu du trajet. */}
                      <div className="pointer-events-none absolute left-1/2 top-full z-40 -mt-8 w-max max-w-[calc(100vw-3rem)] -translate-x-1/2 translate-y-2 pt-8 opacity-0 transition-[opacity,transform] duration-300 ease-soft group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                        <PanneauRayons
                          href={n.href}
                          rayons={rayons}
                          filtrable={n.href === "/boutique"}
                        />
                      </div>
                    </div>
                  );
                })}
              </nav>

              {/* -------------------------------------- actions, à droite */}
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:justify-self-end">
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Rechercher"
                  className="grid h-11 w-11 place-items-center text-ink/70 transition-colors hover:text-rose xl:hidden"
                >
                  <IconSearch />
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Rechercher"
                  className="hidden items-center gap-2.5 rounded-full border border-line bg-white px-4 py-2.5 text-[13px] text-muted transition-colors hover:border-rose/40 hover:text-ink xl:flex"
                >
                  <IconSearch className="h-4 w-4" />
                  <span>Rechercher</span>
                  <kbd className="rounded border border-line px-1.5 text-[10.5px] leading-4 text-muted">/</kbd>
                </button>

                {/* Favoris, commandes, compte : les trois raccourcis de boty.
                    Au doigt la place manque : le menu déplié les reprend. */}
                <Link
                  href="/favoris"
                  aria-label={
                    favoris > 0 ? `Mes favoris, ${favoris} article${favoris > 1 ? "s" : ""}` : "Mes favoris"
                  }
                  title="Mes favoris"
                  className="relative hidden h-11 w-11 place-items-center text-ink/75 transition-colors hover:text-rose sm:grid"
                >
                  <IconHeart />
                  {favoris > 0 && (
                    <span className="anim-pop absolute right-1 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose px-1 text-[10.5px] font-bold tabular-nums text-white">
                      {favoris}
                    </span>
                  )}
                </Link>

                <Link
                  href="/commandes"
                  aria-label="Mes commandes"
                  title="Suivre mes commandes"
                  className="hidden h-11 w-11 place-items-center text-ink/75 transition-colors hover:text-rose sm:grid"
                >
                  <IconPackage />
                </Link>

                <Link
                  href={account ? "/compte" : "/compte/connexion"}
                  aria-label={account ? "Mon espace client" : "Se connecter"}
                  title={account ? account.name : "Se connecter"}
                  className="hidden h-11 w-11 place-items-center text-ink/75 transition-colors hover:text-rose sm:grid"
                >
                  {initiales ? (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-rose text-[11.5px] font-extrabold text-white">
                      {initiales}
                    </span>
                  ) : (
                    <IconUser />
                  )}
                </Link>

                <button
                  type="button"
                  onClick={openDrawer}
                  aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
                  className="relative grid h-11 w-11 place-items-center text-ink/75 transition-colors hover:text-rose"
                >
                  <IconBag />
                  {count > 0 && (
                    <span
                      key={pulse}
                      className="anim-pop absolute right-1 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose px-1 text-[10.5px] font-bold tabular-nums text-white"
                    >
                      {count}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ------------------------------------------ menu au doigt, déplié */}
            {/* Le tiroir défile plutôt que de tronquer : une section dépliée
                dépasse largement la hauteur d'un téléphone, et les entrées du
                bas — compte, commandes — deviendraient inatteignables.
                `overscroll-contain` empêche le défilement de se propager à la
                page une fois la liste au bout. */}
            <div
              className={`transition-[max-height] duration-400 ease-soft lg:hidden ${
                menuOpen ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
              }`}
              /* La hauteur est une mesure, pas une décoration : elle dépend de
                 l'écran, et une classe utilitaire la figerait. En ligne, elle
                 reste animable et le tiroir ne dépasse jamais la fenêtre. */
              style={{ maxHeight: menuOpen ? "80vh" : 0 }}
            >
              <div className="flex flex-col border-t border-line py-2">
                <Link
                  href="/boutique"
                  className="py-3 text-[15px] font-semibold transition-colors hover:text-rose"
                >
                  Toute la boutique{nombrePieces > 0 ? ` · ${nombrePieces} pièces` : ""}
                </Link>
                {/* Au doigt, le classement se déplie sur place : l'entrée
                    reste un lien vers sa page, et le chevron à côté ouvre ses
                    rayons. Deux gestes distincts, parce qu'ils veulent dire
                    deux choses — « emmène-moi au rayon » et « montre-moi ce
                    qu'il contient ». */}
                {NAV.map((n) => {
                  const rayons = n.univers ? parUnivers[n.univers] : null;
                  const deplie = rayons !== null && rayons.branches.length > 0;
                  const blocs = rayons ? blocsDe(rayons.branches) : [];
                  const ouvert = replie === n.label;

                  return (
                    <div key={n.label} className={deplie ? "border-b border-line/70" : ""}>
                      <div className="flex items-center">
                        <Link
                          href={n.href}
                          className="flex-1 py-3 text-[15px] font-medium text-ink/80 transition-colors hover:text-rose"
                        >
                          {n.label}
                        </Link>
                        {deplie && (
                          <button
                            type="button"
                            onClick={() => setReplie(ouvert ? null : n.label)}
                            aria-expanded={ouvert}
                            aria-label={`${ouvert ? "Replier" : "Déplier"} les rayons — ${n.label}`}
                            className="grid h-11 w-11 place-items-center text-ink/60 transition-colors hover:text-rose"
                          >
                            <IconChevron
                              className={`h-3.5 w-3.5 transition-transform duration-300 ${
                                ouvert ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {deplie && (
                        <div
                          className={`overflow-hidden transition-[max-height,opacity] duration-400 ease-soft ${
                            ouvert ? "opacity-100" : "opacity-0"
                          }`}
                          /* Même raison : le repli doit pouvoir s'ouvrir sur
                             une liste de trente rayons comme sur une de deux.
                             Le tiroir qui l'englobe se charge de défiler. */
                          style={{ maxHeight: ouvert ? "200vh" : 0 }}
                        >
                          <div className="flex flex-col gap-4 pb-4 pl-1">
                            {blocs.map((b) => (
                              <div key={b.cle}>
                                {/* Le titre ne se répète pas quand il n'y a
                                    qu'un bloc : l'entrée juste au-dessus le
                                    nomme déjà. */}
                                {blocs.length > 1 && (
                                  <div className="text-[11px] font-bold uppercase tracking-[.14em] text-muted">
                                    {b.titre}
                                  </div>
                                )}
                                <div
                                  className={`flex flex-wrap gap-2 ${blocs.length > 1 ? "mt-2.5" : ""}`}
                                >
                                  {b.entrees.map((r) => (
                                    <Link
                                      key={r.slug}
                                      href={`${n.href}?cat=${encodeURIComponent(r.nom)}`}
                                      className="rounded-full bg-stone px-3.5 py-1.5 text-[13px] font-medium"
                                    >
                                      {r.nom}
                                      {r.nombre > 0 && (
                                        <span className="ml-1.5 text-[11px] tabular-nums text-muted">
                                          {r.nombre}
                                        </span>
                                      )}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Les mêmes raccourcis qu'à droite de la barre, qui n'y tiennent
                    pas au doigt. */}
                <div className="mt-2 flex flex-col border-t border-line pt-2">
                  {raccourcis.map(({ href, label, Icone }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 py-3 text-[15px] font-medium text-ink/80 transition-colors hover:text-rose"
                    >
                      <Icone className="h-4 w-4" />
                      {label}
                      {href === "/favoris" && favoris > 0 && (
                        <span className="text-[13px] text-muted">({favoris})</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
