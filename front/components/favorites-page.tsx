"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatXOF } from "@/lib/format";
import { byId, type Product } from "@/lib/products";
import { useCart } from "./cart-context";
import { useFavorites } from "./favorites-context";
import { AccountHeader } from "./account-header";
import { ProductCard } from "./product-card";
import { QuickView } from "./quick-view";
import { IconArrow, IconBag, IconCheck, IconClose, IconHeart, IconTrash } from "./icons";

const SHELL = "mx-auto w-full max-w-[1400px] px-5 md:px-8 lg:px-10";

export function FavoritesPage() {
  const { ids, clear, hydrated } = useFavorites();
  const { addBySlug } = useCart();
  const [quick, setQuick] = useState<Product | null>(null);
  const [confirmeVidage, setConfirmeVidage] = useState(false);
  const [ajoutes, setAjoutes] = useState(false);

  /* Un article retiré du catalogue ne doit pas casser la page : on garde son
     identifiant en mémoire, on ne l'affiche simplement plus. */
  const favoris = useMemo(
    () => ids.map((id) => byId(id)).filter((p): p is Product => Boolean(p)),
    [ids]
  );

  const disponibles = favoris.filter((p) => !p.outOfStock);
  const total = favoris.reduce((somme, p) => somme + p.price, 0);

  const toutAjouter = () => {
    /* L'ajout ouvre déjà le tiroir : la confirmation du bouton sert quand on le referme. */
    for (const p of disponibles) addBySlug(p.slug);
    setAjoutes(true);
    window.setTimeout(() => setAjoutes(false), 2400);
  };

  return (
    <div className={`${SHELL} pb-22 pt-10`}>
      {/* L'en-tête garde la largeur des trois autres pages de l'espace : ici
          c'est la grille de pièces qui s'élargit, pas le bonjour. */}
      <div className="mx-auto w-full max-w-[1180px]">
        <AccountHeader />
      </div>

      {/* Aligné à gauche comme « Mes commandes » et « Mon profil » : un titre
          centré sous des pastilles alignées à gauche se voyait. */}
      <div className="mb-8">
        <span className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">
          Ma sélection
        </span>
        <h2 className="mt-3 text-[clamp(1.55rem,3.4vw,2.1rem)] font-extrabold leading-[1.08] tracking-[-.035em]">
          Mes favoris
        </h2>
        <p className="mt-2.5 max-w-[54ch] text-[14.5px] leading-relaxed text-muted text-pretty">
          Les pièces mises de côté en attendant la bonne taille ou le bon moment. Une fois
          connectée, elles vous suivent d&apos;un appareil à l&apos;autre.
        </p>
      </div>

      {/* Tant que le stockage n'est pas relu, on ne sait pas quoi montrer : trois
          cadres calmes valent mieux qu'un « aucun favori » démenti aussitôt. */}
      {!hydrated && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-3/4 rounded-[22px] bg-stone" />
              <div className="mt-3.5 h-3 w-2/3 rounded-full bg-stone" />
              <div className="mt-2 h-3 w-1/3 rounded-full bg-stone" />
            </div>
          ))}
        </div>
      )}

      {hydrated && favoris.length === 0 && (
        <div className="anim-fade-up mx-auto max-w-[560px] rounded-[26px] border border-line bg-white px-8 py-14 text-center">
          <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-rose-soft">
            <IconHeart className="h-6 w-6 text-rose" />
          </span>
          <h2 className="text-xl font-extrabold tracking-tight">
            Aucun favori pour l&apos;instant
          </h2>
          <p className="mx-auto mt-2.5 max-w-[42ch] text-[13.5px] leading-relaxed text-muted">
            Touchez le cœur sur un article pour le retrouver ici, sans refaire toute la boutique.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/boutique"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-rose px-7 py-3.5 text-[14px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
            >
              Parcourir la boutique
              <IconArrow className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
            </Link>
            <Link
              href="/boutique"
              className="inline-flex items-center justify-center rounded-full border-[1.5px] border-[#e5d9de] bg-white px-7 py-3.5 text-[14px] font-bold transition-colors duration-300 hover:border-rose hover:text-rose"
            >
              Voir le rayon bébé
            </Link>
          </div>
        </div>
      )}

      {hydrated && favoris.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
            <p className="text-[13.5px] text-muted">
              <strong className="font-extrabold text-ink tabular-nums">{favoris.length}</strong>{" "}
              article{favoris.length > 1 ? "s" : ""} ·{" "}
              <span className="tabular-nums">{formatXOF(total)}</span> au total
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {disponibles.length > 0 && (
                <button
                  type="button"
                  onClick={toutAjouter}
                  className="inline-flex items-center gap-2 rounded-full bg-rose px-5 py-2.5 text-[13.5px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
                >
                  {ajoutes ? <IconCheck className="h-4 w-4" /> : <IconBag className="h-4 w-4" />}
                  {ajoutes
                    ? "Ajouté au panier"
                    : `Tout ajouter${
                        disponibles.length < favoris.length ? ` (${disponibles.length})` : ""
                      }`}
                </button>
              )}

              {/* Vider est irréversible : on demande une fois. */}
              {confirmeVidage ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      clear();
                      setConfirmeVidage(false);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-rose-deep px-4 py-2.5 text-[13.5px] font-semibold text-rose-deep transition-colors duration-300 hover:bg-rose-soft"
                  >
                    <IconCheck className="h-4 w-4" />
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmeVidage(false)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[13.5px] font-semibold text-muted transition-colors duration-300 hover:text-ink"
                  >
                    <IconClose className="h-4 w-4" />
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmeVidage(true)}
                  className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#e5d9de] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-muted transition-colors duration-300 hover:border-rose/40 hover:text-ink"
                >
                  <IconTrash className="h-4 w-4" />
                  Vider la liste
                </button>
              )}
            </div>
          </div>

          {/* Les mêmes cartes que la boutique : le cœur y sert de retrait. */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {favoris.map((p, i) => (
              <ProductCard key={p.id} product={p} onQuickView={setQuick} delay={i * 45} />
            ))}
          </div>

          {ids.length > favoris.length && (
            <p className="mt-7 text-center text-[12.5px] text-muted">
              {ids.length - favoris.length} article
              {ids.length - favoris.length > 1 ? "s enregistrés ne figurent" : " enregistré ne figure"}{" "}
              plus au catalogue et n&apos;{ids.length - favoris.length > 1 ? "sont" : "est"} pas
              affiché{ids.length - favoris.length > 1 ? "s" : ""}.
            </p>
          )}
        </>
      )}

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
