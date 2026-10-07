"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./reveal";
import { Magnetic, ParallaxFond } from "./motion";
import { Hero } from "./hero";
import { BoutiqueAccueil, type EtatInitialBoutique } from "./boutique-accueil";
import {
  IconArrow,
} from "./icons";
import { Countdown } from "./countdown";
import type { BandeauApi, CampagneApi } from "@/lib/api";
import { lienCategorie, type BrancheRayon } from "@/lib/catalogue";
import { formatXOF, jusquAu } from "@/lib/format";
import { useReglages } from "./reglages-context";

/* ---------------------------------------------------------------- la boutique
   La page d'accueil vend, et c'est à peu près tout ce qu'elle fait : le
   bandeau, puis un onglet par catégorie et une grille de cartes où l'on ajoute
   au panier sans quitter la page — la composition de King Crêperie. Chaque
   onglet porte ses propres pièces, lues sur le serveur par `app/page.tsx`.
   Suivent seulement la campagne en cours, quand il y en a une, et le contact. */

const SHELL = "mx-auto w-full max-w-[1400px] px-5 md:px-8 lg:px-10";


export function Home({
  boutique,
  bandeau = [],
  categories = [],
  campagnes = [],
}: {
  /** La sélection « Tout » et ses facettes, lues sur le serveur. */
  boutique: EtatInitialBoutique;
  /** Les photos du bandeau d'accueil réglées dans le back-office. */
  bandeau?: BandeauApi[];
  /** Les catégories du back-office, chacune avec ses sous-catégories. */
  categories?: BrancheRayon[];
  /** Les campagnes qui courent aujourd'hui. Vide, la section promo disparaît. */
  campagnes?: CampagneApi[];
}) {
  const reglages = useReglages();

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

  return (
    <>
      <Hero bandeau={bandeau} />

      {/* ========================================================= boutique */}
      {/* La boutique entière, filtres à gauche et pièces à droite. */}
      <BoutiqueAccueil categories={categories} initial={boutique} />

      {/* ============================================================ promo */}
      {/* Bande pleine largeur, deux plans à deux vitesses : la photo traîne
          derrière le défilement, le texte ne bouge pas. C'est cet écart qui
          creuse la profondeur. */}
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
        <div aria-hidden className="absolute inset-0 bg-ink/35" />

        <Reveal className={`${SHELL} relative py-10 text-center md:py-12`} variant="blur">
          <span className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-gold">
            <span aria-hidden className="h-px w-9 bg-gold/50" />
            Offre à durée limitée
            <span aria-hidden className="h-px w-9 bg-gold/50" />
          </span>

          {/* Le nom de la campagne, sa remise, sa portée et sa date de fin
              viennent du back-office. Rien n'est écrit ici : une campagne qui
              s'arrête emporte la section avec elle. */}
          <h2 className="mx-auto mt-4 max-w-[16ch] font-serif text-[clamp(2rem,5.4vw,3.2rem)] font-semibold leading-[1.05] tracking-[-.02em] text-balance">
            {campagne.libelle}
            <span className="mt-1 block italic text-gold">
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
                className="shine group flex items-center gap-2.5 rounded-xl bg-accent px-8 py-4 text-[14.5px] font-bold text-white shadow-[0_18px_42px_-16px_rgba(224,65,127,.9)] transition-colors duration-300 hover:bg-accent-deep"
              >
                Voir la sélection
                <IconArrow className="h-4 w-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <span className="text-[12.5px] text-white/65">
              Jusqu&apos;au {jusquAu(campagne.date_fin)}, dans la limite des stocks.
            </span>
          </div>
        </Reveal>
      </section>
      )}

    </>
  );
}
