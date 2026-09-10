"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatXOF, waLink } from "@/lib/format";
import { lireProduitsParIds } from "@/lib/catalogue";
import { type Product } from "@/lib/products";
import { zoneLabel } from "@/lib/livraison";
import { useAuth } from "./auth-context";
import { useCart } from "./cart-context";
import { useOrders } from "./orders-context";
import { useFavorites } from "./favorites-context";
import { OrderStatusBadge } from "./order-status-badge";
import { AccountHeader } from "./account-header";
import { useReglages } from "./reglages-context";
import {
  IconArrow,
  IconHeart,
  IconPin,
  IconUser,
  IconWhatsApp,
} from "./icons";

const SHELL = "mx-auto w-full max-w-[1180px] px-5 md:px-8 lg:px-10";

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

export function AccountDashboard() {
  const router = useRouter();
  const { account, hydrated } = useAuth();
  const { lignes, count, subtotal } = useCart();
  const { orders } = useOrders();
  const { ids: favorisIds, count: favoris } = useFavorites();
  const reglages = useReglages();

  /* `sortie` évite un aller-retour : après « Se déconnecter », le compte
     disparaît et l'effet de garde renverrait vers la page de connexion avant
     que le `replace("/")` n'ait eu lieu. */
  const [sortie, setSortie] = useState(false);

  useEffect(() => {
    if (hydrated && !account && !sortie) router.replace("/compte/connexion?suite=/compte");
  }, [hydrated, account, sortie, router]);

  /* Quatre pièces suffisent à reconnaître sa liste ; le reste est sur /favoris.
     Les fiches viennent du serveur : un article dépublié n'en revient pas et
     n'apparaît donc plus, sans que la page en souffre. */
  const [envies, setEnvies] = useState<Product[]>([]);
  useEffect(() => {
    let vivant = true;
    void lireProduitsParIds(favorisIds.slice(0, 4)).then((fiches) => {
      if (vivant) setEnvies(fiches);
    });
    return () => {
      vivant = false;
    };
  }, [favorisIds]);

  /* Avant l'hydratation on ne sait pas encore qui est là : on rend la même
     ossature que le serveur, en attente. */
  if (!hydrated || !account) {
    return (
      <div className={`${SHELL} pb-22 pt-10`}>
        <div className="h-52 animate-pulse rounded-[30px] bg-mist" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_.75fr]">
          <div className="h-64 animate-pulse rounded-3xl bg-mist" />
          <div className="h-64 animate-pulse rounded-3xl bg-mist" />
        </div>
      </div>
    );
  }

  const parDefaut = account.addresses.find((a) => a.isDefault) ?? account.addresses[0] ?? null;
  const tailles = account.preferences.sizes;

  const derniere = orders[0] ?? null;


  return (
    <div className={`${SHELL} pb-22 pt-8`}>
      <AccountHeader avantSortie={() => setSortie(true)} />

      <div className="grid gap-5 lg:grid-cols-[1.55fr_.75fr] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* --------------------------------------------- dernière commande */}
          <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">Suivi</p>
                <h2 className="mt-1 text-base font-extrabold tracking-tight">Dernière commande</h2>
              </div>
              {orders.length > 0 && (
                <Link
                  href="/commandes"
                  className="group inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-rose"
                >
                  Toutes mes commandes
                  <IconArrow className="h-3.5 w-3.5 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
                </Link>
              )}
            </header>

            {derniere ? (
              <Link
                href={`/commandes/${derniere.ref}`}
                className="group flex flex-wrap items-center gap-5 rounded-2xl bg-mist p-4 transition-colors duration-300 hover:bg-stone sm:flex-nowrap sm:p-5"
              >
                <div className="flex -space-x-2.5">
                  {derniere.lines.slice(0, 3).map((ligne) => (
                    <span
                      key={ligne.id}
                      className="h-16 w-14 rounded-xl border-2 border-white bg-stone bg-cover bg-center"
                      style={{ backgroundImage: `url(${ligne.image})` }}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-extrabold tabular-nums">{derniere.ref}</p>
                    <OrderStatusBadge status={derniere.status} />
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {dateLongue(derniere.createdAt)} · {derniere.lines.length} article
                    {derniere.lines.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <strong className="text-[14px] font-extrabold tabular-nums">
                    {formatXOF(derniere.total)}
                  </strong>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-white transition-transform duration-300 ease-soft group-hover:translate-x-1">
                    <IconArrow className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ) : (
              <div className="rounded-2xl border border-dashed border-line px-6 py-9 text-center">
                <p className="text-[13.5px] text-muted">
                  Vous n&apos;avez encore passé aucune commande.
                </p>
                <Link
                  href="/boutique"
                  className="mt-4 inline-block rounded-full border-[1.5px] border-[#e5d9de] px-6 py-3 text-[13.5px] font-semibold transition-colors duration-300 hover:border-rose hover:text-rose"
                >
                  Découvrir la boutique
                </Link>
              </div>
            )}
          </section>

          {/* ------------------------------------------------ panier en cours */}
          <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">En cours</p>
                <h2 className="mt-1 text-base font-extrabold tracking-tight">Mon panier</h2>
              </div>
              {lignes.length > 0 && (
                <Link
                  href="/panier"
                  className="group inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-rose"
                >
                  Voir le panier
                  <IconArrow className="h-3.5 w-3.5 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
                </Link>
              )}
            </header>

            {lignes.length > 0 ? (
              <>
                <ul className="flex flex-col gap-4">
                  {lignes.slice(0, 3).map((l) => (
                    <li key={l.id} className="flex gap-3.5">
                      <Link
                        href={`/p/${l.slug}`}
                        className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-stone bg-cover bg-center"
                        style={{ backgroundImage: `url(${l.image})` }}
                        aria-label={l.nom}
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/p/${l.slug}`}
                          className="line-clamp-1 text-[13.5px] font-bold transition-colors hover:text-rose"
                        >
                          {l.nom}
                        </Link>
                        <p className="mt-1 text-[12.5px] text-muted">
                          {l.option} · ×{l.quantite}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums">
                        {formatXOF(l.sous_total)}
                      </span>
                    </li>
                  ))}
                </ul>

                {lignes.length > 3 && (
                  <p className="mt-3.5 text-[12.5px] text-muted">
                    et {lignes.length - 3} autre{lignes.length - 3 > 1 ? "s" : ""} article
                    {lignes.length - 3 > 1 ? "s" : ""}.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="text-[13px] text-muted">
                    Sous-total{" "}
                    <strong className="text-[15px] font-extrabold tabular-nums text-ink">
                      {formatXOF(subtotal)}
                    </strong>
                  </span>
                  <Link
                    href="/commande"
                    className="shine rounded-full bg-rose px-6 py-3 text-[13.5px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
                  >
                    Finaliser ma commande
                  </Link>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-line px-6 py-9 text-center">
                <p className="text-[13.5px] text-muted">Votre panier est vide pour le moment.</p>
                <Link
                  href="/boutique"
                  className="mt-4 inline-block rounded-full bg-ink px-6 py-3 text-[13.5px] font-semibold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
                >
                  Voir la sélection
                </Link>
              </div>
            )}
          </section>

          {/* ---------------------------------------------------- mes envies */}
          <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">Sélection</p>
                <h2 className="mt-1 text-base font-extrabold tracking-tight">Mes envies</h2>
              </div>
              {favoris > 0 && (
                <Link
                  href="/favoris"
                  className="group inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-rose"
                >
                  Tous mes favoris
                  <IconArrow className="h-3.5 w-3.5 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
                </Link>
              )}
            </header>

            {envies.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                  {envies.map((p) => (
                    <Link key={p.id} href={`/p/${p.slug}`} className="group">
                      <div className="aspect-3/4 overflow-hidden rounded-2xl bg-stone">
                        <div
                          className="h-full w-full bg-cover bg-center transition-transform duration-700 ease-soft group-hover:scale-105"
                          style={{ backgroundImage: `url(${p.image})` }}
                        />
                      </div>
                      <p className="mt-2 line-clamp-1 text-[12.5px] font-bold transition-colors group-hover:text-rose">
                        {p.name}
                      </p>
                      <p className="mt-0.5 text-[12px] tabular-nums text-muted">
                        {formatXOF(p.price)}
                      </p>
                    </Link>
                  ))}
                </div>

                {favoris > envies.length && (
                  <p className="mt-3.5 text-[12.5px] text-muted">
                    et {favoris - envies.length} autre{favoris - envies.length > 1 ? "s" : ""} pièce
                    {favoris - envies.length > 1 ? "s" : ""} mise
                    {favoris - envies.length > 1 ? "s" : ""} de côté.
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-4 rounded-2xl bg-mist p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-soft">
                  <IconHeart className="h-4 w-4 text-rose" />
                </span>
                <p className="text-[13.5px] leading-relaxed text-muted">
                  Touchez le cœur sur un article pour le retrouver ici.
                </p>
              </div>
            )}
          </section>

          {/* -------------------------------------------- adresse par défaut */}
          <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">Livraison</p>
                <h2 className="mt-1 text-base font-extrabold tracking-tight">Adresse par défaut</h2>
              </div>
              <Link
                href="/compte/profil"
                className="text-[12.5px] font-semibold text-muted transition-colors hover:text-rose"
              >
                Gérer mes adresses
              </Link>
            </header>

            {parDefaut ? (
              <div className="flex gap-4 rounded-2xl bg-mist p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-soft">
                  <IconPin className="h-4 w-4 text-rose" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold">{parDefaut.label}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    {parDefaut.address} — {parDefaut.city} · {zoneLabel(parDefaut.zone)}
                  </p>
                  {parDefaut.notes && (
                    <p className="mt-1 text-[12px] italic text-muted">«&nbsp;{parDefaut.notes}&nbsp;»</p>
                  )}
                  <p className="mt-2.5 text-[12px] text-[#3f8a5f]">
                    Proposée automatiquement au moment de commander.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line px-6 py-9 text-center">
                <p className="text-[13.5px] text-muted">
                  Aucune adresse enregistrée. La saisir une fois évite de la retaper à chaque
                  commande.
                </p>
                <Link
                  href="/compte/profil"
                  className="mt-4 inline-block rounded-full border-[1.5px] border-[#e5d9de] px-6 py-3 text-[13.5px] font-semibold transition-colors duration-300 hover:border-rose hover:text-rose"
                >
                  Ajouter une adresse
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------------ aside */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-[104px]">
          <section className="rounded-3xl bg-mist p-6">
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-soft">
                <IconUser className="h-5 w-5 text-rose" />
              </span>
              <Link
                href="/compte/profil"
                aria-label="Modifier mon profil"
                className="grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-[#e5d9de] bg-white transition-colors duration-300 hover:border-rose hover:text-rose"
              >
                <IconArrow className="h-4 w-4" />
              </Link>
            </div>

            <h2 className="mt-5 text-base font-extrabold tracking-tight">Mes informations</h2>

            <dl className="mt-5 flex flex-col gap-4 text-[13.5px]">
              <div>
                <dt className="text-[12px] text-muted">Téléphone</dt>
                <dd className="mt-0.5 font-bold">{account.phone || "À compléter"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Ville ou quartier</dt>
                <dd className="mt-0.5 font-bold">{account.city || "À compléter"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Tailles suivies</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {tailles.length ? (
                    tailles.map((t) => (
                      <span key={t} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="font-bold">À compléter</span>
                  )}
                </dd>
              </div>
            </dl>

            <Link
              href="/compte/profil"
              className="mt-6 block rounded-full bg-ink px-5 py-3 text-center text-[13.5px] font-semibold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
            >
              Compléter mon profil
            </Link>
          </section>

          <section className="rounded-3xl border border-line bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">Besoin d&apos;aide ?</p>
            <h2 className="mt-2 text-base font-extrabold tracking-tight">Une question sur une commande ?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Du lundi au samedi, 9 h – 19 h. Une vraie personne répond.
            </p>
            <a
              href={waLink("Bonjour, j'ai une question sur mon compte", reglages.telephone)}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-rose px-5 py-3 text-[13.5px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
            >
              <IconWhatsApp className="h-4 w-4" />
              Écrire sur WhatsApp
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
