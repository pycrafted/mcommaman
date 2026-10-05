"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";
import { useCart } from "./cart-context";
import { IconBag, IconHeart, IconPackage, IconUser } from "./icons";

/* Le dock : il remplace la barre du haut. Une colonne de boutons ronds
   (une rangée au doigt), collée en bas à droite de l'écran, qui suit la cliente de page en page :
   l'accueil, les favoris, les commandes, le compte et le panier. Il ne monte
   jamais jusqu'en haut ; le reste de l'écran est à la page.

   Il arrive en glissant depuis le bas, chaque bouton grossit sous le curseur
   et s'enfonce au clic ; la pastille du panier saute à chaque ajout. Le
   back-office a sa propre barre, le dock s'y efface. */

const ENTREES = [
  { href: "/favoris", label: "Mes favoris", Icone: IconHeart },
  { href: "/commandes", label: "Mes commandes", Icone: IconPackage },
];

const BOUTON =
  "group/b relative grid h-12 w-12 place-items-center rounded-full transition-[transform,background-color,color,box-shadow] duration-300 ease-back hover:scale-110 active:scale-95";

export function Dock() {
  const pathname = usePathname();
  const { count, pulse, openDrawer } = useCart();
  const { account } = useAuth();

  if (pathname.startsWith("/admin")) return null;

  const initiales = account
    ? account.name.split(" ").filter(Boolean).map((m) => m[0]).slice(0, 2).join("").toUpperCase()
    : null;

  const classe = (actif: boolean) =>
    `${BOUTON} ${actif ? "bg-[#e24f88] text-white shadow-[0_10px_22px_-12px_rgba(226,79,136,.9)]" : "text-ink/75 hover:bg-blush hover:text-[#e24f88]"}`;

  return (
    <nav
      aria-label="Navigation"
      className="anim-fade-up fixed bottom-4 right-4 z-90 flex flex-row items-center gap-1 rounded-full border border-line bg-white/95 p-1.5 shadow-[0_24px_50px_-24px_rgba(36,26,32,.45)] backdrop-blur sm:bottom-6 sm:right-6 sm:flex-col"
    >
      {/* Le « M » de la marque, en haut du dock : il ramène à l'accueil. */}
      <Link
        href="/"
        aria-label="M comme Maman, accueil"
        title="Accueil"
        className={`${classe(pathname === "/")} font-serif text-[22px] font-semibold italic`}
      >
        M
      </Link>

      <span aria-hidden className="mx-0.5 h-6 w-px bg-line sm:mx-0 sm:my-0.5 sm:h-px sm:w-6" />

      {ENTREES.map(({ href, label, Icone }) => (
        <Link key={href} href={href} aria-label={label} title={label} className={classe(pathname.startsWith(href))}>
          <Icone className="h-5 w-5" />
        </Link>
      ))}

      <Link
        href={account ? "/compte" : "/compte/connexion"}
        aria-label={account ? "Mon espace client" : "Se connecter"}
        title={account ? account.name : "Se connecter"}
        className={classe(pathname.startsWith("/compte"))}
      >
        {initiales ? (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e24f88] text-[11.5px] font-extrabold text-white">
            {initiales}
          </span>
        ) : (
          <IconUser className="h-5 w-5" />
        )}
      </Link>

      <button
        type="button"
        onClick={openDrawer}
        aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
        title="Mon panier"
        className={`${BOUTON} bg-ink text-white hover:bg-[#e24f88]`}
      >
        <IconBag className="h-5 w-5" />
        {count > 0 && (
          <span
            key={pulse}
            className="anim-pop absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e24f88] px-1 text-[10.5px] font-bold tabular-nums text-white ring-2 ring-white"
          >
            {count}
          </span>
        )}
      </button>
    </nav>
  );
}
