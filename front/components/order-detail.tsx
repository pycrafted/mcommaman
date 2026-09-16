"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatXOF, waLink } from "@/lib/format";
import { methodOf, zoneLabel } from "@/lib/livraison";
import { useCart } from "./cart-context";
import { useOrders } from "./orders-context";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderJourney } from "./order-journey";
import { IconCheck, IconChevron, IconPackage, IconPhone, IconPin, IconRefresh } from "./icons";
import { useReglages } from "./reglages-context";

const SHELL = "mx-auto w-full max-w-[1180px] px-5 md:px-8 lg:px-10";

const dateComplete = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function OrderDetail({ orderRef }: { orderRef: string }) {
  const params = useSearchParams();
  const nouvelle = params.get("nouvelle") === "1";
  const { getOrder, cancelOrder, trackOrder, hydrated } = useOrders();
  const { addBySlug } = useCart();
  const reglages = useReglages();
  const [confirmeAnnulation, setConfirmeAnnulation] = useState(false);
  const [recommandee, setRecommandee] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  /* Le suivi d'une commande passée ailleurs : la référence est dans l'adresse,
     le téléphone est demandé — seul il prouve que la commande est la sienne. */
  const [telephone, setTelephone] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [erreurSuivi, setErreurSuivi] = useState<string | null>(null);

  const commande = getOrder(orderRef);

  if (!hydrated) {
    return (
      <div className={`${SHELL} pb-22 pt-10`}>
        <div className="h-8 w-40 animate-pulse rounded-full bg-mist" />
        <div className="mt-6 h-64 animate-pulse rounded-[26px] bg-mist" />
        <div className="mt-5 h-72 animate-pulse rounded-3xl bg-mist" />
      </div>
    );
  }

  if (!commande) {
    return (
      <div className={`${SHELL} pb-22 pt-10`}>
        <div className="mx-auto max-w-xl rounded-3xl border border-line bg-white px-8 py-14 text-center">
          <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-mist">
            <IconPackage className="h-7 w-7 text-rose" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Suivre cette commande</h1>
          <p className="mx-auto mt-3 max-w-[46ch] text-[14px] leading-relaxed text-muted text-pretty">
            La commande{" "}
            <span className="font-bold text-ink tabular-nums">{orderRef}</span> n&apos;est pas
            rattachée à cet appareil. Indiquez le téléphone donné lors de la commande : une
            référence circule sur un ticket, elle ne prouve rien à elle seule.
          </p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setRecherche(true);
              setErreurSuivi(null);
              const resultat = await trackOrder(orderRef, telephone.trim());
              setRecherche(false);
              if (!resultat.ok) setErreurSuivi(resultat.error ?? "Commande introuvable.");
            }}
            className="mx-auto mt-6 flex max-w-sm gap-2"
          >
            <input
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              type="tel"
              inputMode="tel"
              placeholder="77 123 45 67"
              aria-label="Téléphone de la commande"
              className="w-full min-w-0 rounded-2xl border-[1.5px] border-[#ece3e7] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-rose"
            />
            <button
              type="submit"
              disabled={telephone.trim().length < 6 || recherche}
              className="shrink-0 rounded-2xl bg-rose px-5 text-[13.5px] font-bold text-white transition-transform duration-300 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
            >
              {recherche ? "…" : "Suivre"}
            </button>
          </form>
          {erreurSuivi && (
            <p className="mt-2.5 text-[12.5px] font-semibold text-rose-deep">{erreurSuivi}</p>
          )}

          <Link
            href="/commandes"
            className="mt-7 inline-block text-[13.5px] font-semibold text-muted underline underline-offset-2 transition-colors hover:text-ink"
          >
            Voir mes commandes
          </Link>
        </div>
      </div>
    );
  }

  const paiement = methodOf(commande.payment);
  const pieces = commande.lines.reduce((somme, l) => somme + l.quantity, 0);

  const recommander = () => {
    // On repasse par la fiche plutôt que par la variante d'origine : celle-ci
    // peut être épuisée depuis, et le serveur en propose une servable.
    for (const ligne of commande.lines) {
      for (let n = 0; n < ligne.quantity; n++) addBySlug(ligne.slug);
    }
    setRecommandee(true);
    window.setTimeout(() => setRecommandee(false), 2200);
  };

  return (
    <div className={`${SHELL} pb-22 pt-10`}>
      <Link
        href="/commandes"
        className="mb-7 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <IconChevron className="h-3.5 w-3.5 rotate-90" />
        Mes commandes
      </Link>

      {/* Juste après la validation. */}
      {nouvelle && (
        <div className="anim-fade-up mb-8 flex gap-4 rounded-3xl bg-[#eaf6ef] p-6 sm:p-7">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#2e7d52] text-white">
            <IconCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              Merci {commande.customer.name.split(" ")[0]} !
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#3d5a48]">
              Votre commande est enregistrée sous la référence{" "}
              <span className="font-bold tabular-nums">{commande.ref}</span>. Nous vous appelons au{" "}
              {commande.customer.phone} pour confirmer la livraison
              {commande.payment === "cod" ? " et le règlement à la remise du colis" : ""}.
            </p>
          </div>
        </div>
      )}

      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-rose tabular-nums">
            Commande {commande.ref}
          </p>
          <h1 className="mt-3 text-[clamp(2rem,4.6vw,2.9rem)] font-extrabold leading-[1.05] tracking-[-.035em]">
            Son voyage jusqu&apos;à vous
          </h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Passée le {dateComplete(commande.createdAt)} · {pieces} article{pieces > 1 ? "s" : ""}
          </p>
        </div>
        <OrderStatusBadge status={commande.status} />
      </div>

      <OrderJourney
        status={commande.status}
        createdAt={commande.createdAt}
        city={commande.delivery.city}
        zone={commande.delivery.zone}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* ---------------------------------------------------------- articles */}
        <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
          <h2 className="mb-5 text-base font-extrabold tracking-tight">Articles</h2>

          <ul className="flex flex-col gap-4">
            {commande.lines.map((ligne) => (
              <li key={ligne.id} className="flex items-center gap-4">
                <Link
                  href={`/p/${ligne.slug}`}
                  aria-label={ligne.name}
                  className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-stone bg-cover bg-center"
                  style={{ backgroundImage: `url(${ligne.image})` }}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/p/${ligne.slug}`}
                    className="line-clamp-1 text-[14px] font-bold transition-colors hover:text-rose"
                  >
                    {ligne.name}
                  </Link>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {ligne.option} · ×{ligne.quantity}
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-extrabold tabular-nums">
                  {formatXOF(ligne.price * ligne.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-6 flex flex-col gap-2.5 border-t border-line pt-5 text-[13.5px]">
            <div className="flex justify-between text-muted">
              <dt>Sous-total</dt>
              <dd className="tabular-nums">{formatXOF(commande.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-muted">
              <dt>Livraison</dt>
              <dd>{commande.shipping === 0 ? "Offerte" : formatXOF(commande.shipping)}</dd>
            </div>
            {commande.discount > 0 && (
              <div className="flex justify-between text-[#2e7d52]">
                <dt>Remise</dt>
                <dd className="tabular-nums">−{formatXOF(commande.discount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-line pt-3.5 text-lg font-extrabold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatXOF(commande.total)}</dd>
            </div>
          </dl>
        </section>

        {/* ------------------------------------------------------------- aside */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[104px]">
          <section className="rounded-3xl border border-line bg-white p-6">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[.16em] text-muted">
              Livraison
            </h2>
            <p className="text-[14px] font-bold">{commande.customer.name}</p>
            <p className="mt-2 flex gap-2 text-[13px] leading-relaxed text-muted">
              <IconPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {commande.delivery.address}
                <br />
                {commande.delivery.city} · {zoneLabel(commande.delivery.zone)}
              </span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-muted">
              <IconPhone className="h-4 w-4 shrink-0" />
              {commande.customer.phone}
            </p>
            {commande.customer.email && (
              <p className="mt-1 truncate pl-6 text-[13px] text-muted">{commande.customer.email}</p>
            )}
            {commande.delivery.notes && (
              <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-[12px] italic leading-relaxed text-muted">
                «&nbsp;{commande.delivery.notes}&nbsp;»
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-line bg-white p-6">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[.16em] text-muted">
              Paiement
            </h2>
            <p className="text-[14px] font-bold">{paiement.t}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{paiement.s}</p>
          </section>

          <div className="flex flex-col gap-2">
            {/* La réception n'est plus déclarée par la cliente : c'est la
                boutique qui fait avancer le suivi depuis son back-office, et
                c'est le passage en « Livrée » qui ouvre le droit à l'avis. */}
            {/* L'avis se dépose sur la fiche de la pièce reçue. */}
            {commande.status === "livree" && commande.lines.length > 0 && (
              <Link
                href={`/p/${commande.lines[0].slug}#avis`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[13.5px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
              >
                Donner mon avis
              </Link>
            )}

            <button
              type="button"
              onClick={recommander}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[13.5px] font-bold transition-all duration-400 ease-soft ${
                recommandee
                  ? "bg-[#eaf6ef] text-[#2e7d52]"
                  : "bg-rose text-white hover:-translate-y-0.5"
              }`}
            >
              {recommandee ? (
                <>
                  <IconCheck className="h-4 w-4" /> Articles remis au panier
                </>
              ) : (
                <>
                  <IconRefresh className="h-4 w-4" /> Commander à nouveau
                </>
              )}
            </button>

            {/* On n'annule que tant que rien n'est parti en préparation. */}
            {commande.status === "recue" &&
              (confirmeAnnulation ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setRefus(null);
                      const resultat = await cancelOrder(commande.ref);
                      setConfirmeAnnulation(false);
                      if (!resultat.ok) setRefus(resultat.error ?? "L'annulation n'a pas abouti.");
                    }}
                    className="flex-1 rounded-full border-[1.5px] border-rose-deep/30 px-4 py-3 text-[13.5px] font-bold text-rose-deep transition-colors duration-300 hover:bg-rose-soft"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmeAnnulation(false)}
                    className="flex-1 rounded-full px-4 py-3 text-[13.5px] font-semibold text-muted transition-colors hover:text-ink"
                  >
                    Revenir
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmeAnnulation(true)}
                  className="w-full rounded-full border-[1.5px] border-[#e5d9de] px-6 py-3.5 text-[13.5px] font-semibold text-muted transition-colors duration-300 hover:border-rose-deep hover:text-rose-deep"
                >
                  Annuler la commande
                </button>
              ))}

            <a
              href={waLink(`Bonjour, je souhaite suivre ma commande ${commande.ref}`, reglages.telephone)}
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-full border-[1.5px] border-[#e5d9de] px-6 py-3.5 text-center text-[13.5px] font-semibold transition-colors duration-300 hover:border-rose hover:text-rose"
            >
              Suivre sur WhatsApp
            </a>

            {/* Une commande déjà en préparation ne s'annule plus toute seule :
                le serveur le dit, on le répète ici plutôt que de laisser le
                bouton retomber sans rien expliquer. */}
            {refus && (
              <p className="text-center text-[12.5px] font-semibold text-rose-deep">{refus}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
