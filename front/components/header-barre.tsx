"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO, type Product } from "@/lib/products";
import type { LienRayon } from "@/lib/catalogue";
import { formatXOF } from "@/lib/format";
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

/* La barre ne nomme plus trois rayons choisis à la main — ils changent au gré
   du catalogue, et le panneau « Boutique » les liste déjà tous. Restent les
   deux univers, qui eux ne bougent pas : « /boutique » est celui des enfants,
   « /coin-maman » celui des mamans. */
const NAV = [
  { href: "/boutique", label: "Enfants" },
  { href: "/coin-maman", label: "Coin Maman" },
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

/**
 * La barre du haut, telle qu'elle se dessine.
 *
 * Les rayons et le décompte lui sont donnés : c'est `components/header.tsx`
 * qui va les chercher sur le serveur. Ici on n'écrit aucune catégorie à la
 * main — elles viennent toutes du back-office.
 */
export function HeaderBarre({
  rayons,
  nombrePieces,
  vedette = null,
}: {
  /** Les catégories cliquables du vestiaire enfant, dans l'ordre du back-office. */
  rayons: LienRayon[];
  /** Les fiches publiées de ce même univers. Zéro tant que rien n'est en ligne. */
  nombrePieces: number;
  /** La dernière pièce publiée, mise en avant dans le menu. */
  vedette?: Product | null;
}) {
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

  /* Changer de page referme le menu — sinon il reste ouvert par-dessus. */
  useEffect(() => setMenuOpen(false), [pathname]);

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
                {/* « Boutique » ouvre le rayon complet ; le panneau s'ouvre au
                    survol et au clavier (focus-within), jamais au clic seul. */}
                <div className="group">
                  <Link
                    href="/boutique"
                    className={`flex items-center gap-1.5 ${lien("/boutique")} ${
                      pathname === "/boutique" ? "text-rose" : ""
                    }`}
                  >
                    Boutique
                    <IconChevron className="h-3 w-3 transition-transform duration-300 group-hover:rotate-180" />
                  </Link>

                  {/* Le panneau se cale sur la rangée d'en-tête, pas sur
                      « Boutique » : centré sur le lien, il sortait du cadre par
                      la gauche dès 1280 px. `-mt-8 pt-8` ménage une bande
                      transparente entre le lien et la carte — sans elle, la
                      souris quitte le survol en descendant et le panneau se
                      referme au milieu du trajet. */}
                  <div className="pointer-events-none absolute left-1/2 top-full z-40 -mt-8 w-[min(820px,calc(100vw-3rem))] -translate-x-1/2 translate-y-2 pt-8 opacity-0 transition-[opacity,transform] duration-300 ease-soft group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                    {/* Sans rayon connu — serveur endormi, boutique qui ouvre —
                        la colonne disparaît au lieu de laisser un titre seul. */}
                    <div
                      className={`grid gap-8 rounded-[24px] border border-line bg-cream p-6 shadow-[0_40px_80px_-40px_rgba(36,26,32,.45)] ${
                        rayons.length > 0 ? "grid-cols-[1fr_1fr_1.15fr]" : "grid-cols-[1fr_1.15fr]"
                      }`}
                    >
                      {rayons.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[.14em] text-muted">
                            Les rayons
                          </div>
                          <div className="mt-3 flex flex-col">
                            {rayons.map((r) => (
                              <Link
                                key={r.slug}
                                href={`/boutique?cat=${encodeURIComponent(r.nom)}`}
                                className="group/l flex items-center justify-between rounded-lg py-1.5 pr-2 text-[13.5px] font-medium transition-colors hover:text-rose"
                              >
                                {r.nom}
                                <IconArrow className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover/l:translate-x-0 group-hover/l:opacity-100" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[.14em] text-muted">
                          Les univers
                        </div>
                        <div className="mt-3 flex flex-col gap-1">
                          <Link href="/boutique" className="rounded-xl px-3 py-2 text-[13.5px] font-semibold transition-colors hover:bg-stone">
                            Enfants
                          </Link>
                          <Link href="/coin-maman" className="rounded-xl px-3 py-2 text-[13.5px] font-semibold transition-colors hover:bg-stone">
                            Coin Maman
                          </Link>
                        </div>
                        <Link
                          href="/boutique"
                          className="mt-3 flex items-center gap-1.5 px-3 text-[13px] font-bold text-rose"
                        >
                          {nombrePieces > 0 ? `Les ${nombrePieces} pièces` : "Toute la boutique"}
                          <IconArrow className="h-3.5 w-3.5" />
                        </Link>
                      </div>

                      {vedette && (
                        <Link href={`/p/${vedette.slug}`} className="group/v block">
                          {/* Les pièces sont photographiées sur cintre, en
                              portrait : un cadre paysage n'en montrerait que
                              l'ourlet. Carré, calé sur le haut du vêtement. */}
                          <div className="relative aspect-square overflow-hidden rounded-[18px] bg-stone">
                            <div
                              className="absolute inset-0 bg-cover transition-transform duration-700 ease-soft group-hover/v:scale-105"
                              style={{ backgroundImage: `url(${vedette.image})`, backgroundPosition: "50% 22%" }}
                            />
                            <span className="absolute left-3 top-3 rounded-full bg-cream/95 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
                              Dernière arrivée
                            </span>
                          </div>
                          <div className="mt-2.5 text-[13.5px] font-semibold leading-snug transition-colors group-hover/v:text-rose">
                            {vedette.name}
                          </div>
                          <div className="mt-0.5 text-[13px] font-extrabold tabular-nums">
                            {formatXOF(vedette.price)}
                          </div>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {NAV.map((n) => (
                  <Link key={n.label} href={n.href} className={lien(n.href)}>
                    {n.label}
                  </Link>
                ))}
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
            <div
              className={`overflow-hidden transition-[max-height] duration-400 ease-soft lg:hidden ${
                menuOpen ? "max-h-[44rem]" : "max-h-0"
              }`}
            >
              <div className="flex flex-col border-t border-line py-2">
                <Link
                  href="/boutique"
                  className="py-3 text-[15px] font-semibold transition-colors hover:text-rose"
                >
                  Toute la boutique{nombrePieces > 0 ? ` · ${nombrePieces} pièces` : ""}
                </Link>
                {NAV.map((n) => (
                  <Link
                    key={n.label}
                    href={n.href}
                    className="py-3 text-[15px] font-medium text-ink/80 transition-colors hover:text-rose"
                  >
                    {n.label}
                  </Link>
                ))}
                {rayons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-4">
                    {rayons.map((r) => (
                      <Link
                        key={r.slug}
                        href={`/boutique?cat=${encodeURIComponent(r.nom)}`}
                        className="rounded-full bg-stone px-3.5 py-1.5 text-[13px] font-medium"
                      >
                        {r.nom}
                      </Link>
                    ))}
                  </div>
                )}

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
