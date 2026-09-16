"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOGO } from "@/lib/products";
import { lienCategorie } from "@/lib/catalogue";
import { ScrollProgress } from "./motion";
import { useAuth } from "./auth-context";
import { useCart } from "./cart-context";
import { useFavorites } from "./favorites-context";
import { IconBag, IconClose, IconHeart, IconMenu, IconPackage, IconUser } from "./icons";

/* La barre est reprise de la maquette boty : le logo au tiers gauche, la
   navigation au centre, les actions à droite. À la place du bandeau
   d'annonce, la jauge de lecture court sous la barre et se remplit au
   défilement — elle sert aussi de trait de séparation.

   Au centre : « Boutique », qui ouvre tout le catalogue, puis chaque catégorie
   du back-office. Le Coin Maman en est une comme les autres — il n'a plus de
   page à lui. Pas de panneau déroulant : un clic mène à la catégorie, et c'est
   la boutique qui propose ses sous-catégories en filtres. */

/* Les trois raccourcis de compte de boty, partagés par la barre du haut et le
   menu au doigt. Celui du compte change de destination une fois la cliente
   connectée : il est recalculé au rendu. */
const COMPTE = [
  { href: "/favoris", label: "Mes favoris", Icone: IconHeart },
  { href: "/commandes", label: "Mes commandes", Icone: IconPackage },
  { href: "/compte/connexion", label: "Se connecter", Icone: IconUser },
];

/** Une catégorie de premier niveau, telle que la barre la nomme. */
export type CategorieNav = { nom: string; slug: string };

type EntreeNav = { cle: string; href: string; label: string };

function entreesDe(categories: CategorieNav[]): EntreeNav[] {
  return [
    { cle: "", href: "/boutique", label: "Boutique" },
    ...categories.map((c) => ({ cle: c.slug, href: lienCategorie(c.slug), label: c.nom })),
  ];
}

/**
 * Les liens de la barre, avec l'entrée active soulignée de rose.
 *
 * L'entrée active se lit dans `?cat=` : c'est la seule partie du composant qui
 * dépend de l'adresse complète, d'où ce morceau à part, rendu sous `Suspense`
 * — `useSearchParams` l'exige pour que les pages restent servies statiques.
 */
function LiensNav({
  entrees,
  className,
  lienClasse,
}: {
  entrees: EntreeNav[];
  className: string;
  lienClasse: (actif: boolean) => string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const cat = params.get("cat") ?? "";
  return (
    <LiensStatiques
      entrees={entrees}
      className={className}
      lienClasse={lienClasse}
      actif={(e) => pathname === "/boutique" && e.cle === cat}
    />
  );
}

function LiensStatiques({
  entrees,
  className,
  lienClasse,
  actif = () => false,
}: {
  entrees: EntreeNav[];
  className: string;
  lienClasse: (actif: boolean) => string;
  actif?: (e: EntreeNav) => boolean;
}) {
  return (
    <nav className={className}>
      {entrees.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          aria-current={actif(e) ? "page" : undefined}
          className={lienClasse(actif(e))}
        >
          {e.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * La barre du haut, telle qu'elle se dessine.
 *
 * Les catégories et le décompte lui sont donnés : c'est `components/header.tsx`
 * qui va les chercher sur le serveur.
 */
export function HeaderBarre({
  categories,
  nombre: nombrePieces,
}: {
  /** Les catégories de premier niveau, dans l'ordre du back-office. */
  categories: CategorieNav[];
  /** Les pièces en ligne. Zéro tant que rien n'est publié. */
  nombre: number;
}) {
  const entrees = entreesDe(categories);
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

  /* Changer de page referme le menu — sinon il reste ouvert par-dessus. */
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const lienBarre = (actif: boolean) =>
    `whitespace-nowrap text-[13.5px] font-medium transition-colors hover:text-rose ${
      actif ? "text-rose" : "text-ink/75"
    }`;
  const navBarre = "hidden items-center justify-center gap-7 lg:flex xl:gap-9";

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
                elle poussait la navigation contre les actions. */}
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
              <Suspense
                fallback={<LiensStatiques entrees={entrees} className={navBarre} lienClasse={lienBarre} />}
              >
                <LiensNav entrees={entrees} className={navBarre} lienClasse={lienBarre} />
              </Suspense>

              {/* -------------------------------------- actions, à droite */}
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:justify-self-end">
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
                {entrees.map((e) => (
                  <Link
                    key={e.href}
                    href={e.href}
                    className="py-3 text-[15px] font-medium text-ink/80 transition-colors hover:text-rose"
                  >
                    {e.cle === "" && nombrePieces > 0
                      ? `Toute la boutique · ${nombrePieces} pièces`
                      : e.cle === ""
                        ? "Toute la boutique"
                        : e.label}
                  </Link>
                ))}

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

    </>
  );
}
