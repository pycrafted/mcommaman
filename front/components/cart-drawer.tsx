"use client";

import Link from "next/link";
import { formatXOF, waLink } from "@/lib/format";
import { useCart } from "./cart-context";
import { useReglages } from "./reglages-context";
import { useAuth } from "./auth-context";
import { messageCommande, useOrigine } from "@/lib/whatsapp";

export function CartDrawer() {
  const { drawerOpen, closeDrawer, lignes, subtotal, complet, bump, erreur } = useCart();
  const reglages = useReglages();
  const { account, defaultAddress } = useAuth();
  const origine = useOrigine();

  if (!drawerOpen) return null;

  const message = messageCommande(
    lignes.map((l) => ({
      nom: l.nom,
      option: l.option,
      quantite: l.quantite,
      prixUnitaire: l.prix_unitaire,
      lien: origine ? `${origine}/p/${l.slug}` : undefined,
    })),
    { compte: account, adresse: defaultAddress },
  );

  return (
    <div onClick={closeDrawer} className="fixed inset-0 z-95 flex justify-end bg-ink/45">
      <aside
        onClick={(e) => e.stopPropagation()}
        className="anim-slide-in flex h-full w-[420px] max-w-full flex-col bg-cream"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="text-lg font-extrabold tracking-tight">Votre panier</span>
          <button onClick={closeDrawer} aria-label="Fermer" className="text-xl text-muted">
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4.5 overflow-auto px-6 py-5">
          {lignes.length === 0 && (
            <p className="py-16 text-center text-sm text-muted">Votre panier est vide.</p>
          )}
          {lignes.map((l) => (
            <div key={l.id} className="flex gap-3.5">
              <div
                className="h-23 w-[74px] shrink-0 rounded-xl bg-stone bg-cover bg-center"
                style={{ backgroundImage: `url(${l.image})` }}
              />
              <div className="flex-1">
                <Link href={`/p/${l.slug}`} onClick={closeDrawer} className="text-sm font-bold">
                  {l.nom}
                </Link>
                <div className="mt-1 text-[12.5px] text-muted">{l.option}</div>

                {/* Une ligne devenue inservable reste visible et se signale : un
                    panier qui maigrit tout seul est incompréhensible. */}
                {!l.disponible && (
                  <div className="mt-1.5 text-[12px] font-semibold text-rose-deep">
                    {l.stock_restant > 0
                      ? `Il n'en reste que ${l.stock_restant}`
                      : "Épuisé pour le moment"}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-3.5 rounded-full border-[1.5px] border-[#e5d9de] px-3 py-1 text-[13px] font-semibold">
                    <button onClick={() => bump(l.id, -1)} aria-label="Retirer un">−</button>
                    <span className="tabular-nums">{l.quantite}</span>
                    <button onClick={() => bump(l.id, 1)} aria-label="Ajouter un">+</button>
                  </span>
                  <span className="text-sm font-extrabold">{formatXOF(l.sous_total)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-6 py-5">
          {erreur && (
            <p className="mb-3 rounded-2xl bg-rose-soft px-4 py-2.5 text-[12.5px] text-rose-deep">
              {erreur}
            </p>
          )}
          <div className="flex justify-between text-lg font-extrabold">
            <span>Total</span>
            <span className="tabular-nums">{formatXOF(subtotal)}</span>
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">Livraison offerte à Dakar dès 25 000 F.</p>
          {!complet && (
            <p className="mt-2 text-[12.5px] font-semibold text-rose-deep">
              Un article n&apos;est plus servable : ajustez avant de commander.
            </p>
          )}
          <Link
            href="/commande"
            onClick={closeDrawer}
            className="mt-4 block rounded-full bg-rose py-4 text-center text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Commander
          </Link>
          <a
            href={waLink(message, reglages.telephone)}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 block rounded-full border-[1.5px] border-[#e5d9de] py-3.5 text-center text-[14.5px] font-bold"
          >
            Commander sur WhatsApp
          </a>
        </div>
      </aside>
    </div>
  );
}
