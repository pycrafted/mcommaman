"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CountUp, Magnetic, SplitText, useSpotlight } from "./motion";
import { IconArrow, IconWhatsApp } from "./icons";
import { formatXOF, waLink } from "@/lib/format";
import type { BandeauApi } from "@/lib/api";
import { HERO_VIDEOS, HERO_VIGNETTES, type Product } from "@/lib/products";

/* ------------------------------------------------------------------ la parole
   Tout le texte du bandeau tient ici : la pastille, trois lignes de titre dont
   la dernière porte l'accent, et le chapô. Changer l'accroche, c'est changer
   ces quatre constantes.

   Les séquences, elles, viennent du back-office : `/api/vitrine/bandeau/`.
   Tant qu'aucune photo n'y est active, la vitrine fait défiler les deux vidéos
   livrées avec le site (`HERO_VIDEOS`) — la page d'accueil n'est jamais nue.
   C'est exactement la règle que le modèle Django annonce de son côté. */

const EYEBROW = "Nouvelle collection · 2026";
const TITRE_HAUT = "Des looks \n qui suivent";
const TITRE_ACCENT = "leurs aventures.";
const CHAPO =
  "Des pièces joyeuses, faciles à vivre et choisies avec le regard exigeant d’une maman.";

/* Le titre ne bouge pas d'une séquence à l'autre : c'est la promesse de la
   boutique, pas une légende. Seuls la vidéo, son étiquette et la pièce
   proposée en dessous changent. */

/** Repli si la durée de la vidéo n'est pas encore connue : le minuteur et la
    barre de progression lisent tous les deux cette valeur. */
const DUREE = 6500;

/** Un halo par séquence : le fond se teinte de ce que l'image a de dominant. */
const HALOS = ["bg-gold-soft/85", "bg-rose-soft/85"];

/**
 * Une séquence du bandeau.
 *
 * `video` n'existe que pour les séquences livrées avec le site : une photo du
 * back-office n'en a pas, et l'arche montre alors l'image seule.
 */
type Sequence = {
  cle: string;
  video?: string;
  image: string;
  alt: string;
  /** Recadrage CSS, quand le sujet n'est pas au centre. */
  pos: string;
  tag: string;
};

const SEQUENCES_LIVREES: Sequence[] = HERO_VIDEOS.map((v) => ({
  cle: v.src,
  video: v.src,
  image: v.poster,
  alt: v.alt,
  pos: v.pos,
  tag: v.tag,
}));

export function Hero({
  pieces = [],
  bandeau = [],
  avis = { count: 0, average: 0 },
  telephone,
}: {
  /** Le catalogue publié : c'est lui qui défile dans la carte flottante. */
  pieces?: Product[];
  /** Le bandeau réglé dans le back-office. Vide, on garde les vidéos. */
  bandeau?: BandeauApi[];
  /** La note de la boutique, telle que les avis la donnent. */
  avis?: { count: number; average: number };
  /** Le numéro de la boutique, celui des réglages. */
  telephone?: string;
}) {
  const sequences: Sequence[] =
    bandeau.length > 0
      ? bandeau.map((b) => ({
          cle: String(b.id),
          image: b.url,
          alt: b.texte_alternatif,
          pos: b.cadrage || "50% 40%",
          tag: b.etiquette,
        }))
      : SEQUENCES_LIVREES;

  const [actif, setActif] = useState(0);
  const [pause, setPause] = useState(false);

  /* La carte flottante fait défiler tout le catalogue, une pièce à la fois,
     sans se caler sur la vidéo : les deux rythmes se superposent au lieu de se
     répéter. Elle s'arrête au survol et au focus — sinon la pièce change entre
     le moment où on la vise et celui où on clique, et le lien mène ailleurs. */
  const [piece, setPiece] = useState(0);
  const [pieceFigee, setPieceFigee] = useState(false);

  useEffect(() => {
    if (pieceFigee || pieces.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setPiece((p) => (p + 1) % pieces.length), 3400);
    return () => window.clearInterval(t);
  }, [pieceFigee, pieces.length]);

  /* Le catalogue peut avoir rétréci entre deux tours — une fiche dépubliée —
     et l'index rester au-delà : le modulo évite une carte vide. */
  const vedette = pieces.length > 0 ? pieces[piece % pieces.length] : undefined;

  /* L'inclinaison est portée par un calque au-dessus de l'arche : posée sur
     l'arche elle-même, elle se battrait avec l'animation d'entrée, qui écrit
     déjà dans `transform`. */
  const inclinaison = useSpotlight<HTMLDivElement>(5);

  /* La séquence dure ce que dure sa vidéo. Tant que le navigateur ne l'a pas
     annoncée, on retombe sur `DUREE` : le bandeau ne doit jamais se figer en
     attendant un fichier. */
  const [duree, setDuree] = useState(DUREE);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  /* Minuteur relancé à chaque changement : cliquer une barre redonne le temps
     de plein, au lieu d'enchaîner sur le reliquat du tour précédent. */
  useEffect(() => {
    if (pause) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (sequences.length < 2) return;
    const t = window.setTimeout(() => setActif((a) => (a + 1) % sequences.length), duree);
    return () => window.clearTimeout(t);
  }, [actif, pause, duree, sequences.length]);

  /* Une seule vidéo joue à la fois : les autres sont remises à zéro, sinon
     elles reprennent en plein milieu au tour suivant. Le survol met la lecture
     en pause en même temps que le minuteur. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i !== actif) {
        v.pause();
        v.currentTime = 0;
      } else if (pause) {
        v.pause();
      } else {
        /* Refusée par le navigateur — onglet en arrière-plan, économie de
           batterie — la lecture n'est pas une erreur : le poster reste. */
        void v.play().catch(() => {});
      }
    });
  }, [actif, pause]);

  return (
    <section className="hero-canvas relative isolate overflow-hidden">
      {/* Fond : une trame de points qui s'éteint sur les bords, deux halos très
          lents. Rien de tout cela ne doit se remarquer — seulement se sentir. */}
      <div aria-hidden className="hero-dots pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-rose/15 blur-[120px]" />
        <div className="aurora absolute -right-32 bottom-0 h-[440px] w-[440px] rounded-full bg-gold/25 blur-[110px] [animation-delay:-11s]" />
      </div>

      <div className="relative mx-auto grid max-w-[1400px] gap-12 px-5 pb-16 pt-12 md:px-8 md:pt-14 lg:min-h-[calc(100svh-118px)] lg:grid-cols-12 lg:items-center lg:gap-0 lg:px-10 lg:pb-0 lg:pt-0">
        {/* --------------------------------------------------------- le texte
            Les deux colonnes partagent la colonne 7 : le titre passe devant
            l'arche, et le bandeau gagne la profondeur qu'une grille sagement
            découpée n'a jamais. */}
        <div className="relative z-20 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:py-16">
          <span className="anim-hero inline-flex items-center gap-2.5 rounded-full border border-line bg-white/75 px-4 py-2 text-[11.5px] font-bold backdrop-blur-sm sm:text-xs">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose" />
            </span>
            {EYEBROW}
          </span>

          <h1 className="mt-6 max-w-[16ch] text-[clamp(2.4rem,5.6vw,4.6rem)] font-extrabold leading-[.94] tracking-[-.045em] sm:mt-7">
            <SplitText text={TITRE_HAUT} delay={120} />
            <br />
            {/* Le trait est posé hors du masque : `word-mask` coupe ce qui
                dépasse, il l'aurait avalé. */}
            <span className="relative inline-block">
              <span className="word-mask">
                <span
                  className="bg-linear-to-r from-rose via-[#ff7fae] to-gold bg-clip-text text-transparent"
                  style={{ animationDelay: "540ms" }}
                >
                  {TITRE_ACCENT}
                </span>
              </span>
              <svg
                viewBox="0 0 300 16"
                fill="none"
                aria-hidden
                className="pointer-events-none absolute -bottom-2.5 left-0 w-full sm:-bottom-4"
              >
                <defs>
                  <linearGradient id="trait-hero" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#e0417f" />
                    <stop offset="1" stopColor="#f0c24a" />
                  </linearGradient>
                </defs>
                <path
                  d="M4 11C50 4.2 108 3 154 6.4c44 3.2 92 4.6 142 1.4"
                  stroke="url(#trait-hero)"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  className="anim-draw"
                  style={{ "--len": 320 } as React.CSSProperties}
                />
              </svg>
            </span>
          </h1>

          {/* `mt-11` et non `mt-8` : le trait dessiné descend sous la dernière
              ligne du titre, il lui faut cet air-là. */}
          <p className="anim-hero mt-11 max-w-[46ch] text-[15px] leading-[1.7] text-muted text-pretty sm:text-base [animation-delay:760ms]">
            {CHAPO}
          </p>

          <div className="anim-hero mt-8 flex flex-col gap-3 sm:flex-row sm:items-center [animation-delay:820ms]">
            <Magnetic className="w-full sm:w-auto">
              <Link
                href="/boutique"
                className="shine group flex items-center justify-center gap-2.5 rounded-full bg-rose px-8 py-4 text-[14.5px] font-bold text-white shadow-[0_18px_42px_-16px_rgba(224,65,127,.85)]"
              >
                Découvrir la boutique
                <IconArrow className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <Magnetic strength={7} className="w-full sm:w-auto">
              <a
                href={waLink("Bonjour, je voudrais un conseil de taille", telephone)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2.5 rounded-full border border-ink/15 bg-white/70 px-7 py-4 text-[14.5px] font-bold backdrop-blur-sm transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-cream"
              >
                <IconWhatsApp className="h-[18px] w-[18px] text-[#25d366]" />
                Contactez-nous sur WhatsApp
              </a>
            </Magnetic>
          </div>

          {/* Ni le nombre d'avis ni la note ne sont écrits ici : ils viennent
              des avis déposés. Tant qu'aucune cliente n'a écrit, le bloc
              disparaît — même principe que le compte à rebours, qui s'efface
              plutôt que d'afficher 00:00:00. */}
          {avis.count > 0 && (
          <div className="anim-hero mt-9 flex flex-wrap items-center gap-x-4 gap-y-3 [animation-delay:900ms]">
            <div className="flex -space-x-3">
              {HERO_VIGNETTES.map((src, i) => (
                <span
                  key={src}
                  className="relative h-11 w-11 overflow-hidden rounded-full ring-3 ring-cream"
                  style={{ zIndex: HERO_VIGNETTES.length - i }}
                >
                  <Image src={src} alt="" fill sizes="44px" className="object-cover" />
                </span>
              ))}
            </div>
            <div>
              <div className="text-[13px] tracking-[3px] text-gold">
                {"★".repeat(Math.round(avis.average))}
                <span className="text-gold/25">{"★".repeat(5 - Math.round(avis.average))}</span>
              </div>
              <div className="mt-0.5 text-[12.5px] font-medium text-muted">
                <CountUp to={avis.count} /> avis de mamans ·{" "}
                {String(avis.average).replace(".", ",")} sur 5
              </div>
            </div>
          </div>
          )}
        </div>

        {/* --------------------------------------------------------- l'arche
            Une seule photo à la fois, cadrée en arche : la forme fait le
            travail que trois visuels empilés faisaient mal. Les photos se
            relaient toutes seules, et s'arrêtent dès qu'on s'en approche. */}
        <div
          className="relative z-10 lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:py-16"
          onPointerEnter={() => setPause(true)}
          onPointerLeave={() => setPause(false)}
          onFocusCapture={() => setPause(true)}
          onBlurCapture={() => setPause(false)}
        >
          <div className="relative mx-auto w-full max-w-[420px] lg:ml-auto lg:mr-0 lg:max-w-[480px]">
            <div
              aria-hidden
              className={`absolute -inset-5 rounded-t-full blur-2xl transition-colors duration-1000 ${
                HALOS[actif % HALOS.length]
              }`}
            />

            <div ref={inclinaison} className="tilt">
              <div className="anim-arch relative aspect-4/5 overflow-hidden rounded-t-[999px] rounded-b-[32px] bg-stone shadow-[0_60px_110px_-55px_rgba(36,26,32,.6)] ring-1 ring-ink/5">
                {/* Les vidéos restent empilées : un fondu enchaîné ne peut pas
                    se faire si l'ancienne est démontée avant la nouvelle. Muettes
                    et `playsInline`, seules conditions pour qu'un mobile accepte
                    de les lancer sans geste de l'utilisateur. */}
                {sequences.map((s, i) =>
                  s.video === undefined ? (
                    /* Une photo réglée dans le back-office : pas de vidéo à
                       lire, l'arche la montre telle quelle. `img` natif plutôt
                       que `next/image` — l'adresse vient de la photothèque et
                       peut pointer n'importe où. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={s.cle}
                      src={s.image}
                      alt={i === actif ? s.alt : ""}
                      aria-hidden={i !== actif}
                      style={{ objectPosition: s.pos }}
                      className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1400ms] ease-soft ${
                        i === actif ? "scale-100 opacity-100" : "scale-[1.06] opacity-0"
                      }`}
                    />
                  ) : (
                  <video
                    key={s.cle}
                    ref={(el) => {
                      videos.current[i] = el;
                    }}
                    src={s.video}
                    poster={s.image}
                    aria-label={i === actif ? s.alt : undefined}
                    aria-hidden={i !== actif}
                    muted
                    loop
                    playsInline
                    preload={i === 0 ? "auto" : "metadata"}
                    onLoadedMetadata={(e) => {
                      /* La séquence dure ce que dure sa vidéo, à la seconde près. */
                      if (i !== actif) return;
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d) && d > 0) setDuree(d * 1000);
                    }}
                    style={{ objectPosition: s.pos }}
                    className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1400ms] ease-soft ${
                      i === actif ? "scale-100 opacity-100" : "scale-[1.06] opacity-0"
                    }`}
                  />
                  ),
                )}

                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink/12 via-transparent to-transparent"
                />
              </div>
            </div>

            {/* Le sceau de la boutique, calé dans le bas de l'arche et débordant
                sur la droite. Il reste dans la hauteur de la photo : posé plus
                bas, il venait toucher les barres. */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-5 -right-5 z-20 hidden h-[112px] w-[112px] place-items-center rounded-full bg-ink text-cream shadow-[0_22px_46px_-20px_rgba(36,26,32,.75)] sm:grid lg:-right-7"
            >
              <svg viewBox="0 0 100 100" className="anim-seal absolute inset-0 h-full w-full">
                <defs>
                  <path
                    id="sceau-hero"
                    d="M50 50 m-39 0 a39 39 0 1 1 78 0 a39 39 0 1 1 -78 0"
                  />
                </defs>
                <text
                  className="fill-cream/75"
                  style={{ fontSize: 8.6, fontWeight: 700, letterSpacing: ".1em" }}
                >
                  <textPath href="#sceau-hero">
                    LIVRAISON 24 H · DAKAR · STOCK RÉEL ·
                  </textPath>
                </text>
              </svg>
              <span className="text-center text-[10px] font-extrabold uppercase leading-[1.15] tracking-[.08em]">
                24 h
                <span className="mt-0.5 block text-[8.5px] font-bold text-cream/60">
                  chez vous
                </span>
              </span>
            </div>

            {/* Le catalogue qui passe, une pièce à la fois. */}
            {vedette && (
              <div
                className="anim-float absolute -left-3 bottom-6 z-20 hidden sm:block lg:-left-16 lg:bottom-10"
                onPointerEnter={() => setPieceFigee(true)}
                onPointerLeave={() => setPieceFigee(false)}
                onFocusCapture={() => setPieceFigee(true)}
                onBlurCapture={() => setPieceFigee(false)}
              >
                <Link
                  key={vedette.id}
                  href={`/p/${vedette.slug}`}
                  className="anim-fade-up group flex w-[252px] items-center gap-3 rounded-2xl border border-line bg-cream/95 p-2.5 shadow-[0_30px_60px_-28px_rgba(36,26,32,.5)] backdrop-blur"
                >
                  <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-stone">
                    <Image src={vedette.image} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted">
                      Dans la boutique
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] font-semibold">
                      {vedette.name}
                    </span>
                    <span className="block text-[13px] font-extrabold text-rose">
                      {formatXOF(vedette.price)}
                    </span>
                  </span>
                  <IconArrow className="h-4 w-4 shrink-0 -translate-x-1 text-muted opacity-0 transition-all duration-300 ease-soft group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
