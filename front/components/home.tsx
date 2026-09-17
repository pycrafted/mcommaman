"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Reveal, useInView } from "./reveal";
import {
  Carousel,
  CountUp,
  GlowCard,
  Magnetic,
  Marquee,
  ParallaxFond,
} from "./motion";
import { Hero } from "./hero";
import { ProductCard } from "./product-card";
import {
  IconArrow,
  IconArrowUp,
  IconInstagram,
  IconLeaf,
  IconPin,
  IconQuote,
  IconRuler,
  IconShield,
  IconSmile,
  IconTikTok,
  IconWhatsApp,
} from "./icons";
import { EnMouvement } from "./en-mouvement";
import { QuickView } from "./quick-view";
import { useAvis } from "./reviews-context";
import { StarRow } from "./review-form";
import { Countdown } from "./countdown";
import {
  ADRESSE,
  INSTAGRAM,
  INSTAGRAM_URL,
  MAPS_EMBED,
  MAPS_URL,
  TIKTOK,
  TIKTOK_URL,
  waLink,
} from "@/lib/format";
import { HERO_VIGNETTES, type Product } from "@/lib/products";
import type { BandeauApi, CampagneApi, VideoAccueilApi } from "@/lib/api";
import { lienCategorie, type BrancheRayon, type LienRayon } from "@/lib/catalogue";
import { formatXOF, jusquAu } from "@/lib/format";
import { useReglages } from "./reglages-context";

const REASSURANCE = [
  { t: "Livraison 24 h", s: "Dakar et banlieue, appel avant passage" },
  { t: "Payez à la livraison", s: "Espèces ou Wave au livreur" },
  { t: "Échange 7 jours", s: "Mauvaise taille, on échange" },
  { t: "Une vraie personne", s: "WhatsApp répondu dans la journée" },
];

const TICKER = [
  "Livraison 24 h sur Dakar",
  "Paiement à la livraison",
  "Wave & Orange Money",
  "Échange sous 7 jours",
  "Conseils de taille sur WhatsApp",
];

/* La grille « Nos univers » : une grande tuile, quatre petites, la légende
   au-dessus du nom et la pastille qui arrive au survol.

   Ce ne sont pas des entrées écrites à la main : ce sont les catégories du
   back-office — Filles, Garçons, Coin Maman… — puis, pour remplir la grille,
   leurs sous-catégories. Une case sans visuel retombe sur l'une des photos
   livrées avec le site, dans l'ordre : la grille garde sa tenue même sur une
   boutique qui n'a pas encore fait ses photos. */
const PHOTOS_DE_SECOURS = [
  "/images/univers/short-fille-blanc-lisse.png",
  "/images/univers/Ensembleenfant-192-retouche.png",
  "/images/univers/chass1.png",
  "/images/univers/sac-dos.png",
  "/images/univers/Ensembleenfant-193-retouche.png",
];

const TUILES = 5;

function tuilesDe(categories: BrancheRayon[]) {
  const cases: { rayon: LienRayon; href: string }[] = [
    ...categories.map((c) => ({ rayon: c, href: lienCategorie(c.slug) })),
    ...categories.flatMap((c) =>
      c.enfants.map((e) => ({ rayon: e, href: lienCategorie(c.slug, e.slug) })),
    ),
  ].slice(0, TUILES);

  return cases.map(({ rayon, href }, index) => ({
    slug: rayon.slug,
    label: rayon.nom,
    caption: rayon.description || `${rayon.nombre} pièce${rayon.nombre > 1 ? "s" : ""}`,
    image: rayon.image || PHOTOS_DE_SECOURS[index % PHOTOS_DE_SECOURS.length],
    href,
    /* La première tuile tient deux colonnes et deux rangées : c'est elle qui
       porte la grille. */
    className: index === 0 ? "lg:col-span-2 lg:row-span-2" : "",
  }));
}

/* Le Coin Maman est une catégorie comme les autres ; l'accueil lui garde
   seulement une section. On la reconnaît à son slug. */
const SLUG_COIN_MAMAN = "coin-maman";

/* Les visuels du Coin Maman. Trois photos livrées avec le site, mais les
   libellés et les liens viennent des sous-catégories du back-office : ce qu'on
   annonce correspond à ce qu'on vend. */
const CDN = "https://mcommaman.com/cdn/shop/files/";

const PHOTOS_COIN_MAMAN = [
  `${CDN}Ensemble_enfant-121.jpg?width=600`,
  `${CDN}Ensembleenfant-153.jpg?width=600`,
  `${CDN}Ensemble_enfant-26.jpg?width=600`,
];

function vignettesMaman(coin: BrancheRayon) {
  return PHOTOS_COIN_MAMAN.map((src, index) => {
    /* Moins de sous-catégories que de photos : on repasse sur les mêmes
       plutôt que de laisser une case sans lien. */
    const sous = coin.enfants.length > 0 ? coin.enfants[index % coin.enfants.length] : null;
    return {
      src,
      href: lienCategorie(coin.slug, sous?.slug),
      libelle: sous?.nom ?? coin.nom,
      alt: `Voir « ${sous?.nom ?? coin.nom} »`,
    };
  });
}

/* Reprise de la section « Pourquoi M comme Maman » de la maquette boty :
   deux visuels décalés, la promesse, et quatre engagements. */
const PROMESSES = [
  { Icone: IconLeaf, t: "Matières saines", s: "Coton doux et respirant, testé pour les peaux fragiles." },
  { Icone: IconRuler, t: "Coupes bien pensées", s: "Des tailles justes qui laissent les enfants bouger librement." },
  { Icone: IconShield, t: "Fait pour durer", s: "Coutures renforcées qui résistent aux jeux et aux lavages." },
  { Icone: IconSmile, t: "Choisis avec amour", s: "Chaque pièce est sélectionnée par notre équipe de mamans." },
];

/* Le mot des mamans : trois avis, la note et la référence de commande qui les
   rendent vérifiables. Ceux-ci ne servent que tant qu'aucune cliente n'a écrit ;
   dès le premier avis publié, ce sont les vrais qui s'affichent. */
const REVIEWS = [
  {
    stars: 5,
    who: "Aminata Fall",
    ref: "CMD-2418",
    text: "Commandé le matin, livré le lendemain à Sacré-Cœur. La taille correspond vraiment à l'âge et le tissu ne gratte pas : mon fils l'a gardé toute la journée.",
  },
  {
    stars: 5,
    who: "Bineta Sarr",
    ref: "CMD-2402",
    text: "La robe en plumetis fait son effet. Ma fille l'a portée pour la Tabaski, tout le monde a demandé où je l'avais trouvée.",
  },
  {
    stars: 4,
    who: "Khady Ba",
    ref: "CMD-2391",
    text: "Babies très jolies et solides. Ma pointure manquait, mais on m'a prévenue du réassort sur WhatsApp et je l'ai eue trois jours après.",
  },
];

/* Les trois façons d'atteindre la boutique : une pour écrire, deux pour
   regarder. Le numéro est celui de `WHATSAPP`, écrit ici en clair parce qu'il
   s'affiche autant qu'il sert de lien. */
const CONTACT = [
  {
    canal: "WhatsApp",
    valeur: "+221 76 208 02 02",
    delai: "Réponse dans la journée",
    href: waLink("Bonjour, j'ai une question"),
    externe: true,
    Icone: IconWhatsApp,
    pastille: "bg-[#25d366] text-white",
  },
  {
    canal: "TikTok",
    valeur: `@${TIKTOK}`,
    delai: "Les pièces en vidéo",
    href: TIKTOK_URL,
    externe: true,
    Icone: IconTikTok,
    pastille: "bg-ink text-white",
  },
  {
    canal: "Instagram",
    valeur: `@${INSTAGRAM}`,
    delai: "Les arrivages en premier",
    href: INSTAGRAM_URL,
    externe: true,
    Icone: IconInstagram,
    pastille: "bg-ink text-white",
  },
];

const SHELL = "mx-auto w-full max-w-[1400px] px-5 md:px-8 lg:px-10";
const H2 = "text-[clamp(1.95rem,3.8vw,2.6rem)] font-extrabold tracking-[-.032em]";
const EYEBROW = "text-[11px] font-bold uppercase tracking-[.16em] text-rose";

export function Home({
  products,
  vedettes,
  videos = [],
  categories = [],
  bandeau = [],
  campagnes = [],
}: {
  products: Product[];
  /** Les pièces qui défilent dans le bandeau. Absentes : les nouveautés. */
  vedettes?: Product[];
  /** Les vidéos choisies dans la vidéothèque. Vide : celles du site. */
  videos?: VideoAccueilApi[];
  /** Les catégories du back-office, chacune avec ses sous-catégories. */
  categories?: BrancheRayon[];
  /** Le bandeau d'accueil réglé dans le back-office. */
  bandeau?: BandeauApi[];
  /** Les campagnes qui courent aujourd'hui. Vide, la section promo disparaît. */
  campagnes?: CampagneApi[];
}) {
  const [tab, setTab] = useState("tous");
  const [quick, setQuick] = useState<Product | null>(null);
  const reglages = useReglages();

  const tuiles = useMemo(() => tuilesDe(categories), [categories]);
  const coinMaman = categories.find((c) => c.slug === SLUG_COIN_MAMAN) ?? null;
  const vignettes = useMemo(() => (coinMaman ? vignettesMaman(coinMaman) : []), [coinMaman]);

  /* Une campagne de rayon mène à la catégorie qui porte ce nom — ou à celle
     qui l'abrite, quand c'est une sous-catégorie. */
  const lienRayon = (nom: string) => {
    for (const c of categories) {
      if (c.nom === nom) return lienCategorie(c.slug);
      const sous = c.enfants.find((e) => e.nom === nom);
      if (sous) return lienCategorie(c.slug, sous.slug);
    }
    return "/boutique";
  };

  /* La campagne annoncée n'est pas écrite dans la page : elle vient du
     back-office. On garde celle qui touche le plus de monde — la boutique
     entière avant un rayon, un rayon avant un article — et on laisse de côté
     les remises réservées à une première commande, qui ne concernent pas tout
     le monde. Aucune campagne, aucune section : la page ne fait pas semblant
     d'avoir une offre. */
  const campagne = useMemo(() => {
    const rang = { boutique: 0, rayon: 1, commande: 2, produit: 3 } as const;
    const annoncables = campagnes.filter(
      (c) => !(c.portee === "commande" && c.condition === "premiere"),
    );
    return [...annoncables].sort((a, b) => rang[a.portee] - rang[b.portee])[0] ?? null;
  }, [campagnes]);

  /* Le bandeau d'annonce de la gérante ouvre le défilé quand elle l'a activé —
     c'est là qu'elle écrit « livraison offerte dès… ». Le reste est la
     promesse de la boutique, qui ne change pas d'un jour à l'autre. */
  const ticker = useMemo(
    () =>
      reglages.affiche_bandeau_promo && reglages.texte_bandeau_promo
        ? [reglages.texte_bandeau_promo, ...TICKER]
        : TICKER,
    [reglages.affiche_bandeau_promo, reglages.texte_bandeau_promo],
  );

  /* Le téléphone affiché est celui des réglages : le changer ne demande pas
     une mise en production. */
  const contacts = useMemo(
    () =>
      CONTACT.map((c) =>
        c.canal === "WhatsApp"
          ? {
              ...c,
              valeur: reglages.telephone,
              href: waLink("Bonjour, j'ai une question", reglages.telephone),
            }
          : c,
      ),
    [reglages.telephone],
  );

  /* Les avis déposés par les clientes prennent la place des exemples dès qu'il
     y en a un. Avant l'hydratation la liste est vide : le premier rendu reste
     donc identique côté serveur et client. */
  const { avis: deposes, resume: noteBoutique, pret: avisPrets } = useAvis({ kind: "shop" });
  /* L'accueil cite des avis : une note sans commentaire n'a rien à citer. */
  const publies = deposes.filter((a) => a.state === "publie" && a.comment.trim());
  const avisReels = avisPrets && publies.length > 0;
  const avis = avisReels
    ? publies.slice(0, 3).map((a) => ({
        cle: String(a.id),
        stars: a.rating,
        who: a.authorName,
        text: a.comment,
      }))
    : REVIEWS.map((r) => ({ cle: r.ref, stars: r.stars, who: r.who, text: r.text }));

  /* Pastille glissante sous l'onglet actif : on mesure le bouton, on déplace la pastille. */
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const [railRef, railSeen] = useInView<HTMLDivElement>("0px 0px -15% 0px");

  useEffect(() => {
    const place = () => {
      const el = tabRefs.current[tab];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [tab]);

  const tabs = [
    { key: "tous", label: "Tous" },
    ...[...new Set(products.map((p) => p.category))]
      .slice(0, 3)
      .map((category) => ({ key: category, label: category })),
  ];
  const shown = products.filter((p) => tab === "tous" || p.category === tab);

  return (
    <>
      <Hero
        pieces={vedettes ?? products}
        bandeau={bandeau}
        avis={noteBoutique}
        telephone={reglages.telephone}
      />


      {/* ================================================== bandeau défilant */}
      <section className="w-full border-b border-line bg-mist">
        <div className="marquee-hold relative overflow-hidden py-4 text-[12.5px] font-semibold uppercase tracking-[.09em] text-muted">
          <Marquee items={ticker} duration={38} />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-linear-to-r from-mist to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-mist to-transparent" />
        </div>
      </section>

      {/* ======================================================= réassurance */}
      <section className={`${SHELL} pt-4`}>
        <Reveal className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4" stagger={80}>
          {REASSURANCE.map((r) => (
            /* Pas de <GlowCard> ici : sa lueur suit le curseur et teinte le
               fond. Ces quatre cartes gardent leur ivoire, elles se contentent
               de se soulever. */
            <div
              key={r.t}
              className="rounded-2xl bg-mist px-4 py-4 transition-transform duration-400 ease-soft hover:-translate-y-1 sm:px-5 sm:py-5"
            >
              <div className="text-[13.5px] font-bold">{r.t}</div>
              <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{r.s}</div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ========================================================== univers */}
      <section className={`${SHELL} pt-16 md:pt-20`}>
        <Reveal className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className={EYEBROW}>Nos univers</span>
            <h2 className={`${H2} mt-2.5 text-balance`}>Trouvez le style de chaque enfant</h2>
          </div>
          <Link
            href="/boutique"
            className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold transition-colors duration-300 ease-soft hover:text-rose"
          >
            Voir toute la boutique
            <IconArrowUp className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <Reveal
          className="grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:gap-4 lg:grid-cols-4"
          stagger={110}
        >
          {tuiles.map((tuile) => (
            <Link
              key={tuile.slug}
              href={tuile.href}
              className={`group relative overflow-hidden rounded-3xl bg-stone shadow-[0_18px_40px_-28px_rgba(36,26,32,.45)] ${tuile.className}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <Image
                  src={tuile.image}
                  alt={tuile.label}
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-[1100ms] ease-soft group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-transparent" />

              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <p className="text-xs text-white/80">{tuile.caption}</p>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                    {tuile.label}
                  </h3>
                  <span className="grid h-9 w-9 shrink-0 -translate-x-2 place-items-center rounded-full bg-white text-ink opacity-0 transition-all duration-400 ease-soft group-hover:translate-x-0 group-hover:opacity-100">
                    <IconArrowUp className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* ================================================ carrousel produits */}
      <section className={`${SHELL} pt-16 md:pt-20`}>
        <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className={EYEBROW}>La sélection</span>
            <h2 className={`${H2} mt-2.5`}>Ils vont adorer les porter</h2>
          </div>

          {/* Un seul onglet « Tous » sur un catalogue vide : on n'affiche rien. */}
          {products.length > 0 && (
            <div className="relative flex gap-1 rounded-full bg-stone p-1.5">
              <span
                aria-hidden
                className="absolute bottom-1.5 left-0 top-1.5 rounded-full bg-ink transition-[transform,width] duration-450 ease-back"
                style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: pill.width ? 1 : 0 }}
              />
              {tabs.map((t) => (
                <button
                  key={t.key}
                  ref={(el) => {
                    tabRefs.current[t.key] = el;
                  }}
                  onClick={() => setTab(t.key)}
                  aria-pressed={tab === t.key}
                  className={`relative z-10 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors duration-300 sm:px-4.5 ${
                    tab === t.key ? "text-white" : "text-[#6b5a61] hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </Reveal>

        {/* Catalogue vide (boutique qui ouvre, tout dépublié) : un mot d'attente
            plutôt qu'un blanc sous le titre.
            Sinon le rail est toujours rendu — les pièces doivent être dans le HTML
            servi. La clé change quand la section entre à l'écran et à chaque
            changement d'onglet : les cartes sont recréées et la cascade rejoue,
            jamais dans le vide pendant que la section est encore hors champ. */}
        {shown.length === 0 ? (
          <Reveal className="rounded-[26px] border border-line bg-white px-8 py-14 text-center">
            <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-rose-soft">
              <IconSmile className="h-6 w-6 text-rose" />
            </span>
            <h3 className="text-xl font-extrabold tracking-tight">
              Les pièces arrivent bientôt
            </h3>
            <p className="mx-auto mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
              Écrivez-nous sur WhatsApp pour être prévenue dès la mise en ligne.
            </p>
            <a
              href={waLink("Bonjour ! Je souhaite être prévenue dès l’arrivée des nouvelles pièces.", reglages.telephone)}
              target="_blank"
              rel="noreferrer"
              className="group mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-rose px-7 py-3.5 text-[14px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
            >
              Me prévenir sur WhatsApp
              <IconArrow className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
            </a>
          </Reveal>
        ) : (
          <div ref={railRef}>
            <Carousel label="Sélection de pièces" key={`${tab}-${railSeen}`}>
              {shown.map((p, i) => (
                <div key={p.id} className="w-[68vw] sm:w-[42vw] md:w-[30vw] lg:w-[280px] xl:w-[300px]">
                  <ProductCard
                    product={p}
                    onQuickView={setQuick}
                    delay={railSeen ? i * 70 : undefined}
                  />
                </div>
              ))}
            </Carousel>

            {/* Le rail ne montre qu'une poignée de pièces : de quoi voir le
                reste sans revenir chercher la barre du haut. */}
            <Reveal className="mt-9 flex justify-center">
              <Link
                href="/boutique"
                className="group inline-flex items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-6 py-3 text-[13.5px] font-bold transition-colors duration-300 hover:border-rose hover:text-rose"
              >
                Découvrir la boutique
                <IconArrow className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
        )}
      </section>

      {/* ==================================================== en mouvement */}
      {/* Une bande de séquences verticales sous le rail de pièces : la photo dit
          la coupe, la vidéo dit la tombée. Les tuiles ne jouent que ce qui est
          à l'écran, et le son ne part qu'à la demande. */}
      <section className={`${SHELL} pt-16 md:pt-20`}>
        <Reveal className="mb-9">
          <span className={EYEBROW}>En mouvement</span>
          <h2 className={`${H2} mt-2.5 text-balance`}>Nos pièces, filmées</h2>
        </Reveal>

        <Reveal variant="scale">
          <EnMouvement pieces={products} films={videos} />
        </Reveal>
      </section>

      {/* ============================================================ promo */}
      {/* Bande pleine largeur, deux plans à deux vitesses : la photo traîne
          derrière le défilement, le texte ne bouge pas. C'est cet écart qui
          creuse la profondeur — un fond qui glisse d'un bloc ne se voit même
          pas.
          La photo est affichée telle quelle : ni aplat sombre, ni voile, ni
          grain. La bande reste basse, à la hauteur d'un bandeau. */}
      {campagne && (
      <section className="relative isolate mt-16 overflow-hidden text-white md:mt-20">
        <ParallaxFond
          vitesse={0.42}
          zoom={0.09}
          marge={0.28}
          className="absolute inset-0 overflow-hidden"
        >
          <Image
            src="/images/hero/duo-pyjamas.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[50%_38%]"
          />
        </ParallaxFond>

        <Reveal className={`${SHELL} relative py-7 text-center md:py-8`} variant="blur">
          <span className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-gold">
            <span aria-hidden className="h-px w-9 bg-gold/50" />
            Offre à durée limitée
            <span aria-hidden className="h-px w-9 bg-gold/50" />
          </span>

          {/* Le nom de la campagne, sa remise, sa portée et sa date de fin
              viennent du back-office. Rien n'est écrit ici : une campagne qui
              s'arrête emporte la section avec elle. */}
          <h2 className="mx-auto mt-4 max-w-[16ch] text-[clamp(2rem,5.4vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-.035em] text-balance">
            {campagne.libelle}
            <span className="mt-1 block bg-linear-to-r from-white via-gold to-white bg-clip-text text-transparent">
              {campagne.type === "pourcentage"
                ? `−${campagne.valeur} %`
                : `−${formatXOF(campagne.valeur)}`}{" "}
              {campagne.portee === "rayon" && campagne.rayon_nom
                ? `sur ${campagne.rayon_nom}`
                : campagne.portee === "commande"
                  ? "sur votre commande"
                  : "sur la boutique"}
            </span>
          </h2>

          <div className="mt-6 flex justify-center">
            {/* Le compte à rebours lit le dernier jour inclus : la remise court
                jusqu'au bout de cette journée-là. */}
            <Countdown endsAt={`${campagne.date_fin}T23:59:59`} />
          </div>

          <div className="mt-7 flex flex-col items-center gap-3">
            <Magnetic>
              <Link
                href={
                  campagne.portee === "produit" && campagne.produit_slug
                    ? `/p/${campagne.produit_slug}`
                    : campagne.portee === "rayon" && campagne.rayon_nom
                      ? lienRayon(campagne.rayon_nom)
                      : "/boutique"
                }
                className="shine group flex items-center gap-2.5 rounded-full bg-rose px-8 py-4 text-[14.5px] font-bold text-white shadow-[0_18px_42px_-16px_rgba(224,65,127,.9)]"
              >
                Voir la sélection
                <IconArrow className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <span className="text-[12.5px] text-white/55">
              Jusqu&apos;au {jusquAu(campagne.date_fin)}, dans la limite des stocks.
            </span>
          </div>
        </Reveal>
      </section>
      )}

      {/* ============================================ pourquoi M comme Maman */}
      <section className={`${SHELL} pt-16 md:pt-20`}>
        <Reveal className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16" variant="blur">
          {/* Deux visuels décalés : le premier descend, la paire cesse d'être
              un bloc et devient une composition. Des enfants habillés, pas des
              vêtements sur cintre — la section raconte la maison, pas une
              pièce du catalogue. Les deux photos sortent du même décor et de
              la même lumière, sinon la paire se lit comme deux emprunts.
              `pos` recadre : les tuiles sont hautes, l'une des photos est
              large. */}
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
            {[
              { f: "/images/portes/filles.webp", pos: "50% 30%", décalage: "mt-8" },
              { f: "/images/portes/grands.webp", pos: "58% 28%", décalage: "" },
            ].map((v) => (
              <div
                key={v.f}
                className={`group relative aspect-3/4 overflow-hidden rounded-[24px] bg-stone ${v.décalage}`}
              >
                <div
                  className="absolute inset-0 bg-cover transition-transform duration-[1100ms] ease-soft group-hover:scale-105"
                  style={{ backgroundImage: `url(${v.f})`, backgroundPosition: v.pos }}
                />
              </div>
            ))}
          </div>

          <div>
            <span className={EYEBROW}>Pourquoi M comme Maman</span>
            <h2 className={`${H2} mt-2.5`}>Notre histoire</h2>
            <p className="mt-4 max-w-[46ch] text-[14.5px] leading-relaxed text-muted text-pretty">
              Nous choisissons chaque vêtement comme s&apos;il était pour nos propres enfants :
              doux au toucher, solide dans le temps et pensé pour le confort. C&apos;est notre
              promesse.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {PROMESSES.map(({ Icone, t, s }) => (
                <div key={t} className="flex items-center gap-3 rounded-2xl bg-mist p-3.5 sm:p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose/10 text-rose">
                    <Icone className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-bold leading-tight sm:text-[15px]">{t}</div>
                    <div className="mt-0.5 text-xs leading-snug text-muted">{s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ====================================================== Coin Maman */}
      {/* La boutique ne vend pas que des vêtements d'enfant : les mamans qui
          viennent habiller les petits repartent souvent avec de quoi se coudre
          quelque chose. Cette section leur ouvre une porte à elles. */}
      {coinMaman && (
      <section className={`${SHELL} pt-16 md:pt-20`}>
        <Reveal className="overflow-hidden rounded-[28px] border border-line bg-mist">
          <div className="grid gap-8 p-7 md:grid-cols-[1.1fr_1fr] md:items-center md:p-10">
            <div>
              <span className={EYEBROW}>Pour vous aussi</span>
              <h2 className={`${H2} mt-2.5 text-balance`}>
                Le Coin Maman : tissus et voiles
              </h2>
              <p className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-muted">
                Du bazin riche au coupon de wax, des voiles brodés et des foulards en soie.
                Choisis avec le même soin que les pièces d&apos;enfant, et vendus au coupon
                ou à la pièce.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Magnetic>
                  <Link
                    href={lienCategorie(coinMaman.slug)}
                    className="shine group flex items-center gap-2.5 rounded-full bg-ink px-6 py-3.5 text-[13.5px] font-bold text-white"
                  >
                    Découvrir le Coin Maman
                    <IconArrow className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
                  </Link>
                </Magnetic>
                {coinMaman.enfants[0] && (
                  <Link
                    href={lienCategorie(coinMaman.slug, coinMaman.enfants[0].slug)}
                    className="flex items-center gap-2.5 rounded-full border-[1.5px] border-[#e5d9de] bg-white px-6 py-3.5 text-[13.5px] font-bold transition-colors duration-300 hover:border-rose hover:text-rose"
                  >
                    Voir : {coinMaman.enfants[0].nom}
                  </Link>
                )}
              </div>

              <p className="mt-4 text-[12.5px] text-muted">
                Un métrage précis, une teinte à vérifier : demandez, on mesure avant d&apos;envoyer.
              </p>
            </div>

            {/* Trois visuels en quinconce : un aperçu, pas un catalogue. */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
              {vignettes.map((v, i) => (
                <Link
                  key={v.src}
                  href={v.href}
                  aria-label={v.alt}
                  className={`group relative aspect-square overflow-hidden rounded-[18px] bg-stone ${
                    i === 1 ? "translate-y-4" : ""
                  }`}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-[900ms] ease-soft group-hover:scale-105"
                    style={{ backgroundImage: `url(${v.src})` }}
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/70 to-transparent px-3 pb-2.5 pt-8 text-[11.5px] font-bold text-white opacity-0 transition-opacity duration-300 ease-soft group-hover:opacity-100">
                    {v.libelle}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
      )}

      {/* ============================================================= avis */}
      <section className={`${SHELL} pt-16 md:pt-20`}>
        <Reveal className="mb-7 text-center">
          <span className={EYEBROW}>Elles nous font confiance</span>
          <h2 className={`${H2} mt-2.5 text-balance`}>Le mot des mamans</h2>
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-muted">
            {avisReels ? (
              <>
                <StarRow rating={noteBoutique.average} />
                {String(noteBoutique.average).replace(".", ",")}/5 sur {noteBoutique.count} avis
              </>
            ) : (
              <>
                <StarRow rating={4.9} />
                4,9/5 sur <CountUp to={126} /> avis
              </>
            )}
          </p>
        </Reveal>

        {/* Trois cartes de même hauteur : le médaillon et la note en tête, la
            citation au milieu, la cliente en pied derrière un filet. Sous
            `sm`, elles défilent au doigt, une et demie à l'écran pour montrer
            qu'il y en a d'autres. */}
        <Reveal
          className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0"
          stagger={90}
        >
          {avis.map((r) => (
            <article
              key={r.cle}
              className="flex min-h-[210px] w-[82%] shrink-0 snap-start flex-col rounded-[22px] bg-mist p-5 transition-transform duration-400 ease-soft hover:-translate-y-1 sm:w-auto sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-soft">
                  <IconQuote className="h-4 w-4 text-rose" />
                </span>
                <StarRow rating={r.stars} />
              </div>

              <p className="flex-1 text-[14.5px] leading-[1.65] text-[#3d2f35] text-pretty">
                «&nbsp;{r.text}&nbsp;»
              </p>

              <div className="mt-5 border-t border-line pt-3.5">
                <div className="text-[13px] font-bold">{r.who}</div>
              </div>
            </article>
          ))}
        </Reveal>
      </section>

      {/* ================================================== nous contacter */}
      {/* Le trait qui sépare les avis du contact s'éteint avant les marges :
          un filet d'un bord à l'autre couperait la page en deux, alors qu'on
          veut seulement marquer un changement de sujet. */}
      <div className={`${SHELL} pt-16 md:pt-20`}>
        <div
          aria-hidden
          className="h-0.5 rounded-full bg-linear-to-r from-transparent via-rose/45 to-transparent"
        />
      </div>

      {/* Posé à même la page : ni panneau, ni aplat sombre. Les trois entrées
          sont les seuls objets dessinés, la lecture va droit au numéro. */}
      <div id="contact" className="scroll-mt-16">
      <Reveal className={`${SHELL} pt-16 text-center md:pt-20`} variant="scale">
        <span className={EYEBROW}>Une question ?</span>
        <h2 className={`${H2} mx-auto mt-2.5 text-balance`}>Nous contacter</h2>
        {/* Des comptes plutôt qu'un formulaire : la conversation reprend là
            où la cliente a déjà l'habitude d'écrire et de regarder. */}
        <div className="mx-auto mt-9 grid max-w-[1020px] gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => (
            <a
              key={c.canal}
              href={c.href}
              {...(c.externe ? { target: "_blank", rel: "noreferrer" } : null)}
              className="flex items-center gap-4 rounded-[22px] border border-line bg-cream p-5 text-left transition-all duration-400 ease-soft hover:-translate-y-1 hover:border-rose/40 hover:bg-white"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.pastille}`}
              >
                <c.Icone className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-bold uppercase tracking-[.1em] text-muted">
                  {c.canal}
                </span>
                <span className="mt-0.5 block truncate text-[14.5px] font-semibold">{c.valeur}</span>
                <span className="block text-xs text-muted">{c.delai}</span>
              </span>
            </a>
          ))}
        </div>

        {/* Le magasin : l'adresse et les horaires, puis le plan lui-même. Le
            plan est un <iframe> et non une image — la cliente zoome et fait
            glisser sans quitter la page. `loading="lazy"` : il est en bas de
            page, il ne doit pas retarder le reste. */}
        <div className="mx-auto mt-3.5 grid max-w-[1020px] overflow-hidden rounded-[22px] border border-line bg-cream text-left md:grid-cols-[.8fr_1.2fr]">
          <div className="flex flex-col p-6 md:p-7">
            <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.1em] text-rose">
              <IconPin className="h-4 w-4" />
              Le magasin
            </span>
            <span className="mt-2.5 text-[17px] font-bold leading-snug">{ADRESSE}</span>
            <span className="mt-4 text-[12px] font-bold uppercase tracking-[.1em] text-muted">
              Horaires
            </span>
            <span className="mt-1 text-[14.5px] font-semibold">Lundi au samedi, 9 h – 19 h</span>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="group mt-5 inline-flex items-center gap-2 self-start text-[13px] font-bold text-rose md:mt-auto md:pt-5"
            >
              Ouvrir dans Google Maps
              <IconArrow className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>
          <div className="min-h-[240px] border-t border-line bg-mist md:border-l md:border-t-0">
            <iframe
              src={MAPS_EMBED}
              title={`Plan d'accès — ${ADRESSE}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="block h-full min-h-[240px] w-full border-0"
            />
          </div>
        </div>
      </Reveal>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </>
  );
}
