"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";
import { useCart } from "./cart-context";
import { IconBag, IconPlus, IconUser } from "./icons";
import { AccountAccessDrawer } from "./account-access-drawer";

const EditionPiece = dynamic(() => import("./edition-piece").then((m) => m.EditionPiece), { ssr: false });

/* Le dock : il remplace la barre du haut. Une colonne de boutons ronds
   (une rangée au doigt), collée en bas à droite de l'écran, qui suit la cliente de page en page :
   l'accueil, le compte et le panier, et pour l'équipe un « + » qui crée
   une pièce. Il ne monte
   jamais jusqu'en haut ; le reste de l'écran est à la page.

   Il arrive en glissant depuis le bas, chaque bouton grossit sous le curseur
   et s'enfonce au clic ; la pastille du panier saute à chaque ajout. Le
   back-office a sa propre barre, le dock s'y efface. */

/* « Mes commandes » est caché pour l'instant : le paiement depuis la
   plateforme n'est pas encore en service, la commande passe par WhatsApp.
   Remettre l'entrée `/commandes` (icône colis) ici quand ce sera le cas. */
const ENTREES: { href: string; label: string; Icone: typeof IconUser }[] = [];

const BOUTON =
  "group/b relative grid h-12 w-12 place-items-center rounded-full transition-[transform,background-color,color,box-shadow] duration-300 ease-back hover:scale-110 active:scale-95";

export function Dock() {
  const pathname = usePathname();
  const { count, pulse, openDrawer } = useCart();
  const { account } = useAuth();
  const [creation, setCreation] = useState(false);
  const [authMode, setAuthMode] = useState<"connexion" | "inscription" | "oubli" | null>(null);
  const fermerCompte = useCallback(() => setAuthMode(null), []);

  useEffect(() => {
    const ouvrir = () => setAuthMode("connexion");
    window.addEventListener("mcm:ouvrir-connexion", ouvrir);

    const parametres = new URLSearchParams(window.location.search);
    const accesDemande = parametres.get("ouvrirCompte");
    if (accesDemande === "connexion" || accesDemande === "inscription" || accesDemande === "oubli") {
      setAuthMode(accesDemande);
      parametres.delete("ouvrirCompte");
      const recherche = parametres.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${recherche ? `?${recherche}` : ""}${window.location.hash}`,
      );
    }

    return () => window.removeEventListener("mcm:ouvrir-connexion", ouvrir);
  }, [pathname]);

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
      {/* Le logo garde ses couleurs sur fond blanc et ramène à l'accueil. */}
      <Link
        href="/"
        aria-label="M comme Maman, accueil"
        aria-current={pathname === "/" ? "page" : undefined}
        title="Accueil"
        className="relative grid h-10 w-14 shrink-0 place-items-center rounded-full bg-white p-1 transition-transform duration-300 ease-back hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Image
          src="/images/logo-m-comme-maman.png"
          alt=""
          width={182}
          height={105}
          unoptimized
          priority
          className="h-auto w-12 rounded-md object-contain"
        />
      </Link>

      <span aria-hidden className="mx-0.5 h-6 w-px bg-line sm:mx-0 sm:my-0.5 sm:h-px sm:w-6" />

      {ENTREES.map(({ href, label, Icone }) => (
        <Link key={href} href={href} aria-label={label} title={label} className={classe(pathname.startsWith(href))}>
          <Icone className="h-5 w-5" />
        </Link>
      ))}

      {account ? (
        <Link
          href="/compte"
          aria-label="Mon espace client"
          title={account.name}
          className={classe(pathname.startsWith("/compte"))}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e24f88] text-[11.5px] font-extrabold text-white">
            {initiales}
          </span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setAuthMode("connexion")}
          aria-label="Se connecter"
          title="Se connecter"
          className={classe(false)}
        >
          <IconUser className="h-5 w-5" />
        </button>
      )}

      {/* L'équipe crée une pièce d'ici, comme chez Golden Pousso : le même
          formulaire que le back-office, dans une fenêtre. */}
      {account?.equipe && (
        <button
          type="button"
          onClick={() => setCreation(true)}
          aria-label="Créer une pièce"
          title="Créer une pièce"
          className={`${BOUTON} bg-[#fbe6ef] text-[#b3306a] hover:bg-[#e24f88] hover:text-white`}
        >
          <IconPlus className="h-5 w-5" />
        </button>
      )}
      {creation && <EditionPiece onClose={() => setCreation(false)} />}
      {authMode && <AccountAccessDrawer mode={authMode} onModeChange={setAuthMode} onClose={fermerCompte} />}

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
