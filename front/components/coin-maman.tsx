"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Reveal } from "./reveal";
import { ProductCard } from "./product-card";
import { QuickView } from "./quick-view";
import { IconArrow } from "./icons";
import type { Product } from "@/lib/products";
import type { LienRayon } from "@/lib/catalogue";

const SHELL = "mx-auto w-full max-w-[1400px] px-5 md:px-8 lg:px-10";

/* Ni âge ni genre ici : un coupon de bazin n'en a pas. Le seul tri qui compte
   est celui du rayon — tissu, voile, ce que la boutique range là —, et il tient
   en quelques pastilles. Elles ne sont plus écrites ici : ce sont les
   sous-catégories du Coin Maman, telles que le back-office les tient. */

export function CoinMaman({
  produits = [],
  rayons = [],
  rayonInitial = "Tout",
}: {
  produits?: Product[];
  /** Les catégories du Coin Maman, dans l'ordre du back-office. */
  rayons?: LienRayon[];
  /** La pastille ouverte à l'arrivée, quand un lien en a demandé une. */
  rayonInitial?: string;
}) {
  const pastilles = ["Tout", ...rayons.map((r) => r.nom)];
  const [rayon, setRayon] = useState<string>(rayonInitial);
  const [quick, setQuick] = useState<Product | null>(null);

  /* On peut arriver ici depuis l'accueil alors qu'on y est déjà : l'adresse
     change sans que le composant soit remonté, il faut resynchroniser. */
  useEffect(() => setRayon(rayonInitial), [rayonInitial]);

  const visibles =
    rayon === "Tout" ? produits : produits.filter((p) => p.category === rayon);

  return (
    <>
      <section className={`${SHELL} pt-10 md:pt-14`}>
        <Reveal>
          <span className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">
            Pas seulement les enfants
          </span>
          <h1 className="mt-2.5 text-[clamp(2rem,4.6vw,3rem)] font-extrabold leading-[1.04] tracking-[-.035em] text-balance">
            Le Coin Maman
          </h1>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-muted">
            Vous venez habiller les petits, vous repartez avec de quoi vous coudre quelque chose.
            Des coupons choisis un par un, et des voiles qui tombent bien — au mètre ou à la pièce.
          </p>
        </Reveal>

        <Reveal className="mt-7 flex flex-wrap gap-2">
          {pastilles.map((nom) => {
            const actif = rayon === nom;
            return (
              <button
                key={nom}
                type="button"
                onClick={() => setRayon(nom)}
                aria-pressed={actif}
                className={`rounded-full border-[1.5px] px-4.5 py-2.5 text-[13.5px] font-semibold transition-colors duration-300 ${
                  actif
                    ? "border-ink bg-ink text-white"
                    : "border-[#e5d9de] bg-white text-ink hover:border-rose hover:text-rose"
                }`}
              >
                {nom}
              </button>
            );
          })}
        </Reveal>
      </section>

      <section className={`${SHELL} pb-20 pt-8`}>
        <Reveal
          key={rayon}
          className="grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-4"
          stagger={70}
        >
          {visibles.map((produit, i) => (
            <ProductCard key={produit.id} product={produit} onQuickView={setQuick} delay={i * 60} />
          ))}
        </Reveal>

        <Reveal className="mt-12 rounded-[24px] border border-line bg-mist p-7 md:p-9">
          <h2 className="text-[20px] font-extrabold tracking-[-.02em]">
            Une coupe précise, une couleur qu&apos;on ne voit pas en photo ?
          </h2>
          <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-muted">
            Les tissus se choisissent mieux en main qu&apos;à l&apos;écran. Écrivez-nous : on vous
            envoie des photos à la lumière du jour, et on garde le coupon de côté.
          </p>
          <Link
            href="/contact"
            className="group mt-5 inline-flex items-center gap-2.5 rounded-full bg-rose px-6 py-3.5 text-[13.5px] font-bold text-white transition-transform duration-300 hover:-translate-y-0.5"
          >
            Nous écrire
            <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </>
  );
}
