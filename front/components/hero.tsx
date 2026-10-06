"use client";

import { Magnetic, Parallax, SplitText } from "./motion";
import { IconArrow, IconHeart, IconInstagram, IconPin, IconStar, IconTikTok, IconWhatsApp } from "./icons";
import { ADRESSE, INSTAGRAM, INSTAGRAM_URL, MAPS_URL, TIKTOK, TIKTOK_URL, waLink } from "@/lib/format";
import { srcSetWeb } from "@/lib/images";
import { useReglages } from "./reglages-context";
import type { BandeauApi } from "@/lib/api";
import { HERO_VIDEOS } from "@/lib/products";

/* ------------------------------------------------------------------ la parole
   Le titre du bandeau et sa fin en couleur se règlent dans le back-office
   (`Reglages.hero_titre`, `Reglages.hero_accent`). */

/* Un bandeau qui sent la chambre d'enfant : le rose de la marque plein
   cadre (le reste du site garde son fond clair), des nuages qui glissent, des étoiles qui scintillent, des confettis
   qui tombent sans se presser. Le texte à gauche, en blanc, monte mot à mot ;
   la photo à droite vit dans une forme ronde qui respire, entourée de
   pastilles qui se balancent. Tout est écrit en CSS (`app/globals.css`), et
   tout s'arrête quand le mouvement réduit est demandé.

   La photo est celle du bandeau d'accueil réglé dans le back-office
   (`/api/vitrine/bandeau/`) : la première active, telle que la gérante l'a
   recadrée. Tant qu'il n'y en a pas, la photo livrée avec le site prend la
   place. */

/** La photo du bandeau, et ce qu'on en dit. */
type Photo = {
  image: string;
  alt: string;
  /** Recadrage CSS, quand le sujet n'est pas au centre. */
  pos: string;
};

const PHOTO_LIVREE: Photo = {
  image: HERO_VIDEOS[0].poster,
  alt: HERO_VIDEOS[0].alt,
  pos: HERO_VIDEOS[0].pos,
};

/* Les confettis : une position, un retard, une durée, une couleur — tirés une
   fois pour toutes, pour que le rendu serveur et le rendu client s'accordent.
   Les couleurs sont celles d'une boîte de craies : jaune, ciel, menthe, blanc. */
const CONFETTIS = [
  { x: 6, delai: 0, duree: 13, couleur: "#f0c24a", forme: "rond" },
  { x: 14, delai: 4, duree: 16, couleur: "#ffffff", forme: "carre" },
  { x: 23, delai: 9, duree: 12, couleur: "#9ad8f5", forme: "rond" },
  { x: 31, delai: 2, duree: 15, couleur: "#bfe8c6", forme: "carre" },
  { x: 40, delai: 7, duree: 14, couleur: "#f0c24a", forme: "carre" },
  { x: 48, delai: 11, duree: 17, couleur: "#ffffff", forme: "rond" },
  { x: 57, delai: 1, duree: 13, couleur: "#9ad8f5", forme: "carre" },
  { x: 66, delai: 6, duree: 15, couleur: "#f0c24a", forme: "rond" },
  { x: 74, delai: 10, duree: 12, couleur: "#bfe8c6", forme: "rond" },
  { x: 83, delai: 3, duree: 16, couleur: "#ffffff", forme: "carre" },
  { x: 91, delai: 8, duree: 14, couleur: "#9ad8f5", forme: "rond" },
  { x: 96, delai: 5, duree: 18, couleur: "#f0c24a", forme: "carre" },
] as const;

/* Les étoiles : posées à la main là où elles ne gênent pas la lecture. */
const ETOILES = [
  { x: "8%", y: "14%", taille: 18, delai: 0, duree: 3.2 },
  { x: "30%", y: "8%", taille: 12, delai: 1.1, duree: 2.6 },
  { x: "46%", y: "22%", taille: 22, delai: 0.6, duree: 3.8 },
  { x: "12%", y: "78%", taille: 14, delai: 2.0, duree: 3.1 },
  { x: "60%", y: "88%", taille: 16, delai: 1.5, duree: 2.9 },
  { x: "92%", y: "10%", taille: 20, delai: 0.3, duree: 3.5 },
  { x: "86%", y: "70%", taille: 12, delai: 2.4, duree: 2.7 },
] as const;

/** Un nuage de bande dessinée : trois bosses, une base plate. */
function Nuage({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 110" aria-hidden className={className} style={style} fill="currentColor">
      <path d="M48 104c-22 0-40-15-40-34 0-17 13-31 31-34C44 18 61 6 80 6c22 0 40 14 46 33 4-2 9-3 14-3 20 0 36 15 36 34s-16 34-36 34H48z" />
    </svg>
  );
}

export function Hero({
  bandeau = [],
}: {
  /** Les photos actives du bandeau, dans l'ordre du back-office. Seule la première sert. */
  bandeau?: BandeauApi[];
}) {
  const reglages = useReglages();
  /* `SplitText` coupe sur « \n » entouré d'espaces. */
  const titre = reglages.hero_titre.split("\n").map((l) => l.trim()).filter(Boolean).join(" \n ");

  const premiere = bandeau[0];
  const photo: Photo = premiere
    ? {
        image: premiere.url,
        alt: premiere.texte_alternatif || premiere.titre || "Le bandeau d'accueil M comme Maman",
        pos: premiere.cadrage || "50% 40%",
      }
    : PHOTO_LIVREE;

  const contacts = [
    { canal: "WhatsApp", valeur: reglages.telephone, href: waLink("Bonjour, j'ai une question", reglages.telephone), Icone: IconWhatsApp, pastille: "bg-[#25d366] text-white" },
    { canal: "TikTok", valeur: `@${TIKTOK}`, href: TIKTOK_URL, Icone: IconTikTok, pastille: "bg-ink text-white" },
    { canal: "Instagram", valeur: `@${INSTAGRAM}`, href: INSTAGRAM_URL, Icone: IconInstagram, pastille: "bg-accent text-white" },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-[#e24f88] text-white lg:min-h-[min(100svh,880px)]">
      {/* ------------------------------------------------------- le décor
          Derrière tout le reste, dans l'ordre : deux halos clairs, les
          nuages, les étoiles, les confettis. Rien n'attrape le pointeur. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora absolute -left-[12%] -top-[20%] h-[62%] w-[52%] rounded-full bg-white/15 blur-3xl" />
        <div className="aurora absolute -bottom-[25%] right-[2%] h-[60%] w-[46%] rounded-full bg-gold/25 blur-3xl [animation-delay:-11s]" />

        <Nuage className="anim-cloud absolute left-[2%] top-[9%] w-40 text-white/35 md:w-56" style={{ "--dur": "20s" } as React.CSSProperties} />
        <Nuage className="anim-cloud absolute right-[6%] top-[4%] w-28 text-white/25 md:w-40" style={{ "--dur": "26s", animationDelay: "-9s" } as React.CSSProperties} />
        <Nuage className="anim-cloud absolute bottom-[8%] left-[38%] w-32 text-white/20 md:w-48" style={{ "--dur": "23s", animationDelay: "-15s" } as React.CSSProperties} />

        {ETOILES.map((e, i) => (
          <span
            key={i}
            className="anim-twinkle absolute block text-gold"
            style={{ left: e.x, top: e.y, width: e.taille, height: e.taille, "--dur": `${e.duree}s`, "--delay": `${e.delai}s` } as React.CSSProperties}
          >
            <IconStar className="h-full w-full" />
          </span>
        ))}

        {CONFETTIS.map((c, i) => (
          <span
            key={i}
            className={`anim-confetti absolute top-0 block ${c.forme === "rond" ? "h-2.5 w-2.5 rounded-full" : "h-3 w-2 rounded-[2px]"}`}
            style={{ left: `${c.x}%`, background: c.couleur, "--dur": `${c.duree}s`, "--delay": `${c.delai}s` } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-10 px-5 pb-20 pt-10 md:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-6 lg:px-10 lg:py-16 lg:pr-28">
        {/* --------------------------------------------------------- le texte */}
        <div className="order-2 flex flex-col lg:order-1">
          <h1 className="max-w-[16ch] font-serif text-[clamp(2.35rem,5.6vw,4.6rem)] font-medium leading-[1.02] tracking-[-.02em] text-white">
            <SplitText key={titre} text={titre} delay={200} />
            <br />
            <SplitText
              key={`${titre}-${reglages.hero_accent}`}
              text={reglages.hero_accent}
              delay={720}
              className="font-medium italic text-gold"
            />
          </h1>

          {/* Le trait se dessine sous le titre, à main levée. Un bloc à part :
              le mot d'accent peut tenir sur deux lignes au doigt, un trait
              accroché au mot ne saurait pas où se mettre. */}
          <svg
            viewBox="0 0 320 14"
            preserveAspectRatio="none"
            aria-hidden
            className="mt-2 h-3 w-[min(60%,320px)]"
          >
            <path
              d="M3 10 C 60 2, 120 12, 180 6 S 290 3, 317 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              className="anim-draw text-white/90"
              style={{ "--len": 330 } as React.CSSProperties}
            />
          </svg>

          {/* Les trois façons de joindre la boutique, puis le magasin : à même le
              bandeau, sans légende. Chaque pastille arrive avec un temps de
              retard sur la précédente et remue quand on la touche. */}
          {/* L'entrée et le balancement au survol sont sur deux éléments
              différents : un survol qui remplaçait l'animation d'entrée la
              faisait rejouer depuis son délai, et la pastille disparaissait. */}
          <div id="contact" className="mt-9 flex flex-wrap gap-2.5 scroll-mt-24">
            {contacts.map((c, i) => (
              <span key={c.canal} className="anim-hero inline-flex" style={{ animationDelay: `${900 + i * 120}ms` }}>
              <a
                href={c.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${c.canal} : ${c.valeur}`}
                className="wobble flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[13.5px] font-semibold text-ink shadow-[0_10px_30px_-14px_rgba(36,26,32,.45)] transition-transform duration-400 ease-soft hover:-translate-y-1"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.pastille}`}>
                  <c.Icone className="h-4 w-4" />
                </span>
                {c.valeur}
              </a>
              </span>
            ))}
          </div>

          <a
            href={MAPS_URL}
            target="_blank"
            rel="noreferrer"
            className="group anim-hero mt-5 inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-white/90 [animation-delay:1300ms] hover:text-white"
          >
            <IconPin className="h-4 w-4 shrink-0 text-gold" />
            {ADRESSE}
            <IconArrow className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </a>

        </div>

        {/* --------------------------------------------------------- la photo
            Dans une forme ronde qui respire, cernée d'un trait blanc, posée
            sur son ombre. Elle arrive en grossissant, avec un petit rebond,
            puis traîne un peu derrière le défilement. Autour, deux pastilles
            se balancent : une étoile, un coeur. */}
        <div className="order-1 lg:order-2">
          <Parallax speed={18} className="relative mx-auto w-[76%] max-w-[520px] sm:w-full">
            <div className="anim-arrive relative aspect-[4/5]">
              {/* Le disque clair derrière la photo, décalé : il la détache du fond. */}
              <div aria-hidden className="anim-morph absolute -inset-3 bg-white/20 [animation-delay:-7s]" />

              <div className="anim-morph relative h-full w-full overflow-hidden border-[6px] border-white shadow-[0_40px_80px_-30px_rgba(36,26,32,.55)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.image}
                  srcSet={srcSetWeb(photo.image)}
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  alt={photo.alt}
                  fetchPriority="high"
                  style={{ objectPosition: photo.pos }}
                  className="anim-zoom h-full w-full object-cover"
                />
              </div>

              {/* Les pastilles. `Magnetic` les attire vers le pointeur ; au
                  repos elles se balancent chacune à son rythme. */}
              <Magnetic className="absolute -right-4 top-[6%] sm:-right-6">
                <div
                  className="anim-bob grid h-14 w-14 place-items-center rounded-full bg-gold text-ink shadow-[0_18px_40px_-18px_rgba(36,26,32,.5)]"
                  style={{ "--dur": "4.2s", "--delay": "-1.5s" } as React.CSSProperties}
                >
                  <IconStar className="h-6 w-6" />
                </div>
              </Magnetic>

              <Magnetic className="absolute -right-5 bottom-[10%] sm:-right-7">
                <div
                  className="anim-bob grid h-16 w-16 place-items-center rounded-full bg-white text-accent shadow-[0_18px_40px_-18px_rgba(36,26,32,.5)]"
                  style={{ "--dur": "6.3s", "--delay": "-3s" } as React.CSSProperties}
                >
                  <IconHeart className="anim-beat h-7 w-7" />
                </div>
              </Magnetic>
            </div>
          </Parallax>
        </div>
      </div>

    </section>
  );
}
