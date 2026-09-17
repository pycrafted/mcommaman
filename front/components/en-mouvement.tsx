"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import type { VideoAccueilApi } from "@/lib/api";
import { formatXOF } from "@/lib/format";
import { useReducedMotion } from "./reveal";
import { IconArrow, IconMuet, IconSon } from "./icons";

/* Les séquences filmées, dans l'ordre de la bande. La vidéo montre, la carte
   vend — et la pièce vendue vient du catalogue publié, plus d'un identifiant
   écrit ici : une fiche dépubliée ne doit pas laisser une carte vide.

   Il n'existe que deux séquences pour l'instant, servies deux fois. Elles
   alternent pour que deux tuiles voisines ne montrent jamais le même plan, et
   chacune démarre à un instant différent : côte à côte, deux lectures
   synchronisées se lisent immédiatement comme une copie. */
type Tuile = {
  cle: string;
  video: string;
  poster?: string;
  depart: number;
  titre?: string;
  /** La pièce montrée sous la vidéo, quand la vidéothèque en désigne une. */
  piece?: { slug: string; name: string; price: number; image: string };
};

const BANDE: Tuile[] = [
  { cle: "livree-1", video: "/videos/hero-1.mp4", poster: "/images/hero/fille-cour.webp", depart: 0 },
  { cle: "livree-2", video: "/videos/hero-2.mp4", poster: "/images/hero/robe-rouge.webp", depart: 0 },
  { cle: "livree-3", video: "/videos/hero-1.mp4", poster: "/images/hero/garcon-cour.webp", depart: 5 },
  { cle: "livree-4", video: "/videos/hero-2.mp4", poster: "/images/hero/duo-pyjamas.webp", depart: 4 },
];

/* Les vidéos de la vidéothèque remplacent celles du site dès qu'il y en a une
   à l'accueil. Sans affiche, le navigateur montre la première image : le
   fragment `#t=0.1` l'y oblige, sinon certains mobiles laissent une tuile
   noire jusqu'à la lecture. */
const versTuiles = (videos: VideoAccueilApi[]): Tuile[] =>
  videos.map((v) => ({
    cle: `video-${v.id}`,
    video: `${v.url}#t=0.1`,
    depart: 0,
    titre: v.titre,
    piece: v.produit
      ? { slug: v.produit.slug, name: v.produit.nom, price: v.produit.prix, image: v.produit.image }
      : undefined,
  }));

/**
 * Bande de séquences verticales, à la façon d'un banc de montage : les tuiles
 * ne sont pas alignées, une sur deux descend d'un cran.
 *
 * Les vidéos ne jouent que ce qui est à l'écran — une bande de quatre lecteurs
 * qui tournent en fond coûte cher en batterie pour rien. Le son est coupé
 * d'office, c'est la seule façon qu'un navigateur accepte de lancer une vidéo
 * sans clic ; un bouton par tuile le rend, une tuile à la fois.
 */
export function EnMouvement({
  pieces = [],
  films = [],
}: {
  pieces?: Product[];
  /** Les vidéos de la vidéothèque choisies pour l'accueil. */
  films?: VideoAccueilApi[];
}) {
  const bande = films.length > 0 ? versTuiles(films) : BANDE;
  const reduced = useReducedMotion();
  const [son, setSon] = useState<number | null>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  /* Une seule bande son à la fois : ouvrir la deuxième referme la première. */
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (v) v.muted = son !== i;
    });
  }, [son]);

  /* Lecture pilotée par la visibilité, tuile par tuile. `IntersectionObserver`
     plutôt qu'un écouteur de défilement : le navigateur ne réveille le fil
     principal que lorsqu'une tuile passe le seuil. */
  useEffect(() => {
    if (reduced) return;

    const io = new IntersectionObserver(
      (entrees) => {
        entrees.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            /* Refus du navigateur (onglet caché, économie d'énergie) : le
               poster reste, ce n'est pas une erreur à remonter. */
            void v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.45 }
    );

    videos.current.forEach((v) => v && io.observe(v));
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div className="bande -mx-5 px-5 pb-2 md:-mx-8 md:px-8 lg:mx-0 lg:px-0">
      {bande.map((item, i) => {
        /* Une tuile sur deux descend : la bande cesse d'être une rangée et
           devient une composition. */
        const decalage = i % 2 === 1 ? "lg:mt-12" : "";
        const cadre = `relative w-[68vw] overflow-hidden rounded-[24px] bg-stone sm:w-[46vw] ${decalage}`;

        /* Une pièce par tuile, prise dans le catalogue publié. Moins de
           pièces que de tuiles : on repasse sur les mêmes plutôt que de
           laisser une vignette sans article. */
        /* La pièce choisie avec la vidéo ; à défaut, une du catalogue. */
        const piece =
          item.piece ?? (films.length === 0 && pieces.length > 0 ? pieces[i % pieces.length] : undefined);

        return (
          <div key={item.cle} className={`group ${cadre}`}>
            <div className="relative aspect-9/16 overflow-hidden">
              <video
                ref={(el) => {
                  videos.current[i] = el;
                }}
                src={item.video}
                poster={item.poster}
                aria-label={item.titre}
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (item.depart && v.duration > item.depart) v.currentTime = item.depart;
                }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-soft group-hover:scale-105"
              />

              {/* Deux voiles : le haut porte le bouton de son, le bas la carte
                  produit. Sans eux, ni l'un ni l'autre ne se lit sur une image
                  claire. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-ink/45 to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-ink/85 via-ink/25 to-transparent"
              />

              <button
                type="button"
                onClick={() => setSon((s) => (s === i ? null : i))}
                aria-pressed={son === i}
                aria-label={son === i ? "Couper le son" : "Écouter cette séquence"}
                className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink backdrop-blur transition-colors duration-300 hover:bg-rose hover:text-white"
              >
                {son === i ? <IconSon className="h-4 w-4" /> : <IconMuet className="h-4 w-4" />}
              </button>

              {piece && (
                <Link
                  href={`/p/${piece.slug}`}
                  className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-2.5 rounded-2xl border border-white/15 bg-ink/45 p-2 text-white backdrop-blur-md transition-all duration-400 ease-soft hover:border-white/40 hover:bg-ink/65"
                >
                  <span className="relative h-11 w-9 shrink-0 overflow-hidden rounded-lg bg-stone">
                    <Image src={piece.image} alt="" fill sizes="36px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold leading-snug">
                      {piece.name}
                    </span>
                    <span className="block text-[12.5px] font-extrabold tabular-nums text-gold">
                      {formatXOF(piece.price)}
                    </span>
                  </span>
                  <IconArrow className="h-4 w-4 shrink-0 -translate-x-1 opacity-0 transition-all duration-300 ease-soft group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
