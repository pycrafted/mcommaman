"use client";

import Link from "next/link";
import { formatXOF } from "@/lib/format";
import { zoneLabel } from "@/lib/livraison";
import { AccountHeader } from "./account-header";
import { ORDER_STEPS, useOrders } from "./orders-context";
import { OrderStatusBadge } from "./order-status-badge";
import { IconArrow, IconPackage, IconTruck } from "./icons";

const SHELL = "mx-auto w-full max-w-[1180px] px-5 md:px-8 lg:px-10";

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

export function OrdersList() {
  const { orders, hydrated } = useOrders();

  return (
    <div className={`${SHELL} pb-22 pt-10`}>
      <AccountHeader />

      <div className="mb-8">
        <span className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">Suivi</span>
        <h2 className="mt-3 text-[clamp(1.55rem,3.4vw,2.1rem)] font-extrabold leading-[1.08] tracking-[-.035em]">
          Mes commandes
        </h2>
        <p className="mt-2.5 max-w-[52ch] text-[14.5px] leading-relaxed text-muted text-pretty">
          Chaque commande passée depuis ce navigateur, avec l&apos;avancement de son colis.
        </p>
      </div>


      {/* Le stockage local n'est relu qu'après le premier rendu. */}
      {!hydrated && (
        <div className="flex flex-col gap-5">
          {[0, 1].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-3xl bg-mist" />
          ))}
        </div>
      )}

      {hydrated && orders.length === 0 && (
        <div className="mx-auto max-w-xl rounded-3xl border border-line bg-white px-8 py-14 text-center">
          <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-mist">
            <IconPackage className="h-7 w-7 text-rose" />
          </span>
          <h2 className="text-xl font-extrabold tracking-tight">Aucune commande pour l&apos;instant</h2>
          <p className="mx-auto mt-3 max-w-[44ch] text-[14px] leading-relaxed text-muted text-pretty">
            Vos commandes apparaîtront ici avec leur suivi, dès la première validation.
          </p>
          <Link
            href="/boutique"
            className="shine mt-7 inline-block rounded-full bg-rose px-8 py-3.5 text-[14px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
          >
            Voir la sélection
          </Link>
        </div>
      )}

      {hydrated && orders.length > 0 && (
        <div className="flex flex-col gap-5">
          {orders.map((commande) => {
            const etape = ORDER_STEPS.findIndex((s) => s.value === commande.status);
            const pieces = commande.lines.reduce((somme, l) => somme + l.quantity, 0);

            return (
              <article key={commande.ref} className="rounded-3xl border border-line bg-white p-6 sm:p-7">
                <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight tabular-nums">{commande.ref}</h2>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {dateLongue(commande.createdAt)} · {pieces} article{pieces > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <OrderStatusBadge status={commande.status} />
                    <span className="text-[15px] font-extrabold tabular-nums">
                      {formatXOF(commande.total)}
                    </span>
                  </div>
                </header>

                <div className="mb-5 flex flex-wrap gap-2">
                  {commande.lines.slice(0, 5).map((ligne, i) => (
                    <span
                      key={`${ligne.productId}-${ligne.option}-${i}`}
                      title={ligne.name}
                      className="relative h-16 w-16 overflow-hidden rounded-xl bg-stone bg-cover bg-center"
                      style={{ backgroundImage: `url(${ligne.image})` }}
                    >
                      {ligne.quantity > 1 && (
                        <span className="absolute right-0 top-0 grid h-5 w-5 place-items-center rounded-bl-lg bg-ink text-[10.5px] font-bold text-white">
                          {ligne.quantity}
                        </span>
                      )}
                    </span>
                  ))}
                  {commande.lines.length > 5 && (
                    <span className="grid h-16 w-16 place-items-center rounded-xl bg-mist text-[13px] font-semibold text-muted">
                      +{commande.lines.length - 5}
                    </span>
                  )}
                </div>

                {commande.status !== "annulee" && (
                  <div className="mb-5 flex items-center gap-1.5">
                    {ORDER_STEPS.map((s, i) => (
                      <span
                        key={s.value}
                        title={s.label}
                        className={`h-1.5 flex-1 rounded-full ${i <= etape ? "bg-rose" : "bg-stone"}`}
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-[13px] text-muted">
                    <IconTruck className="h-4 w-4 shrink-0 text-rose" />
                    {commande.delivery.city} · {zoneLabel(commande.delivery.zone)}
                  </p>
                  <Link
                    href={`/commandes/${commande.ref}`}
                    className="group inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#e5d9de] px-5 py-2.5 text-[13.5px] font-semibold transition-colors duration-300 hover:border-rose hover:text-rose"
                  >
                    Voir le détail
                    <IconArrow className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
