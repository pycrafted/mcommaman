"use client";

import { useState } from "react";
import Link from "next/link";
import { formatXOF } from "@/lib/format";
import { type Product } from "@/lib/products";
import { useCart } from "./cart-context";
import { FavoriteButton } from "./favorite-button";
import { useSpotlight } from "./motion";
import { IconBag, IconCheck, IconRuler } from "./icons";

/**
 * La carte produit, reprise de la carte de King Crêperie, et qui vit sous le
 * curseur : elle s'incline légèrement vers lui, une lueur rose le suit, la
 * photo s'approche et un reflet la traverse. Le bouton « Ajouter » met la
 * première taille disponible au panier sans quitter la page, puis dit
 * « Ajouté » le temps d'un souffle. Le cœur reste visible en permanence :
 * c'est le seul geste qui ne coûte rien, il ne se mérite pas au survol.
 *
 * Tout le mouvement est en CSS (`app/globals.css`), et s'arrête quand le
 * mouvement réduit est demandé — `useSpotlight` ne pose alors aucun écouteur.
 */
export function ProductCard({
  product,
  onQuickView,
  delay,
}: {
  product: Product;
  onQuickView?: (p: Product) => void;
  /** Sans `delay`, la carte n'anime pas son entrée : la grille s'en charge. */
  delay?: number;
}) {
  const { addBySlug } = useCart();
  const carte = useSpotlight<HTMLElement>(4);
  /* Trois temps sur le bouton : au repos, pendant l'aller-retour, puis une
     seconde de « Ajouté » avant de redevenir cliquable. */
  const [etat, setEtat] = useState<"repos" | "envoi" | "ajoute">("repos");

  const discount = product.compareAt
    ? Math.round((1 - product.price / product.compareAt) * 100)
    : 0;

  const ajouter = async () => {
    if (etat !== "repos") return;
    setEtat("envoi");
    const resultat = await addBySlug(product.slug);
    if (!resultat.ok) {
      setEtat("repos");
      return;
    }
    setEtat("ajoute");
    window.setTimeout(() => setEtat("repos"), 1400);
  };

  return (
    <article
      ref={carte}
      className="group spot tilt relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(36,26,32,.04)] transition-[box-shadow,border-color] duration-400 ease-soft hover:border-accent/30 hover:shadow-[0_28px_50px_-30px_rgba(224,65,127,.45)]"
      style={
        delay === undefined
          ? undefined
          : { animation: `rise-scale .65s ${delay}ms var(--ease-soft) backwards` }
      }
    >
      <div className="shine relative aspect-4/5 overflow-hidden bg-stone">
        {/* Toute la photo est cliquable. Les boutons posés dessus sont en z-20. */}
        <Link href={`/p/${product.slug}`} className="absolute inset-0 z-10" aria-label={product.name} />

        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[1100ms] ease-soft group-hover:scale-108"
          style={{ backgroundImage: `url(${product.image})` }}
        />

        <div className="absolute left-3 top-3 z-20 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-[10.5px] font-bold text-white shadow-sm group-hover:[animation:wobble_.5s_ease-in-out]">
              −{discount} %
            </span>
          )}
          {product.outOfStock && (
            <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[10.5px] font-bold text-white backdrop-blur">
              Épuisé
            </span>
          )}
        </div>

        <FavoriteButton
          productId={product.id}
          productName={product.name}
          className="absolute right-3 top-3 z-20"
        />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="text-[10.5px] font-bold uppercase tracking-[.12em] text-muted">
          {product.category}
        </div>

        <div className="mt-1.5 flex items-start justify-between gap-3">
          <Link
            href={`/p/${product.slug}`}
            className="font-serif text-[17px] font-semibold leading-snug tracking-tight text-ink transition-colors duration-300 group-hover:text-accent-deep"
          >
            {product.name}
          </Link>
          <span className="shrink-0 pt-0.5 font-serif text-[16px] font-semibold tabular-nums text-accent-deep transition-transform duration-400 ease-back group-hover:-translate-y-0.5 group-hover:scale-105">
            {formatXOF(product.price)}
          </span>
        </div>

        {product.compareAt && (
          <div className="mt-0.5 text-[12.5px] text-muted line-through">{formatXOF(product.compareAt)}</div>
        )}

        {product.description && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">{product.description}</p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          {onQuickView && !product.outOfStock && (
            <button
              type="button"
              onClick={() => onQuickView(product)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <IconRuler className="h-3.5 w-3.5" />
              Choisir la taille
            </button>
          )}

          <button
            type="button"
            onClick={ajouter}
            disabled={product.outOfStock || etat === "envoi"}
            aria-label={`Ajouter ${product.name} au panier`}
            className={`group/btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all duration-300 ease-soft active:scale-[.96] ${
              product.outOfStock
                ? "cursor-not-allowed bg-stone text-muted/70"
                : etat === "ajoute"
                  ? "bg-sage text-white"
                  : "bg-ink text-white hover:bg-accent hover:shadow-[0_12px_24px_-12px_rgba(224,65,127,.8)]"
            }`}
          >
            {etat === "ajoute" ? (
              <>
                <IconCheck className="anim-pop h-4 w-4" />
                Ajouté
              </>
            ) : (
              <>
                <IconBag className="h-4 w-4 transition-transform duration-300 ease-back group-hover/btn:-translate-y-0.5 group-hover/btn:rotate-[-8deg]" />
                {product.outOfStock ? "Épuisé" : etat === "envoi" ? "Ajout…" : "Ajouter"}
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
