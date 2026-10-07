"use client";

import { usePathname } from "next/navigation";
import { formatXOF, waLink } from "@/lib/format";
import { messageCommande, useOrigine } from "@/lib/whatsapp";
import { useCart } from "./cart-context";
import { useReglages } from "./reglages-context";
import { IconBag, IconWhatsApp } from "./icons";

/* Les pages où la barre n'a pas sa place : le tunnel la répéterait, et le
   back-office n'y vend rien. */
const SANS_BARRE = ["/panier", "/commande", "/admin"];

/**
 * La barre de panier flottante, reprise de King Crêperie.
 *
 * Dès qu'un article est au panier, elle se pose en bas de l'écran avec le
 * total et un bouton « Commander » sur WhatsApp : on peut remplir son panier depuis la
 * page d'accueil et partir en caisse sans chercher l'icône en haut. Elle
 * s'efface quand le tiroir est ouvert — les deux montrent la même chose.
 */
export function BarrePanier() {
  const { count, subtotal, hydrated, drawerOpen, openDrawer, pulse, lignes } = useCart();
  const pathname = usePathname();
  const reglages = useReglages();
  const origine = useOrigine();

  /* `hydrated` : le serveur ne connaît pas le panier, le premier rendu doit
     rester vide des deux côtés. */
  if (!hydrated || count === 0 || drawerOpen) return null;
  if (SANS_BARRE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  /* Au doigt, la barre se pose au-dessus du dock, qui occupe le bas de
     l'écran ; sur grand écran, le dock est debout à droite et la barre
     revient au centre, en bas. */
  return (
    <div className="anim-fade-up fixed bottom-24 left-4 right-4 z-80 max-w-xl sm:bottom-6 sm:left-6 sm:right-24 lg:left-1/2 lg:right-auto lg:w-full lg:-translate-x-1/2">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink p-3 text-white shadow-[0_24px_50px_-20px_rgba(36,26,32,.7)] sm:p-4">
        <button type="button" onClick={openDrawer} className="flex min-w-0 items-center gap-3 text-left">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent">
            <IconBag className="h-5 w-5" />
            <span
              key={pulse}
              className="anim-pop absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold tabular-nums text-ink"
            >
              {count}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[.12em] text-white/55">
              Voir le panier
            </span>
            <span className="block truncate font-serif text-lg font-semibold tabular-nums">
              {formatXOF(subtotal)}
            </span>
          </span>
        </button>

        {/* Le tunnel (`/commande`) n'est pas encore en service : en attendant,
            la commande part sur WhatsApp, avec le détail du panier. */}
        <a
          href={waLink(
            messageCommande(
              lignes.map((l) => ({
                nom: l.nom,
                option: l.option,
                quantite: l.quantite,
                prixUnitaire: l.prix_unitaire,
                lien: origine ? `${origine}/p/${l.slug}` : undefined,
              })),
            ),
            reglages.telephone,
          )}
          target="_blank"
          rel="noreferrer"
          className="group flex shrink-0 items-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 text-sm font-bold transition-colors duration-300 hover:bg-[#1fb857]"
        >
          <IconWhatsApp className="h-4 w-4" />
          Commander
        </a>
      </div>
    </div>
  );
}
