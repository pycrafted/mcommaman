"use client";

import { useFavorites } from "./favorites-context";
import { IconHeart, IconHeartFull } from "./icons";

const TAILLES = {
  sm: { boite: "h-9 w-9", icone: "h-4 w-4" },
  md: { boite: "h-11 w-11", icone: "h-[18px] w-[18px]" },
  lg: { boite: "h-14 w-14", icone: "h-5 w-5" },
};

/* Deux fonds : posé sur une photo, ou aligné avec les boutons d'une fiche. */
const FONDS = {
  flottant: "bg-white/90 backdrop-blur",
  contour: "border-[1.5px] border-[#e5d9de] bg-white",
};

/**
 * Le cœur.
 *
 * Posé au-dessus du lien qui couvre une carte produit, il intercepte le clic
 * pour ne pas partir sur la fiche. Tant que le stockage n'a pas été relu il se
 * dessine vide : le premier rendu doit être le même côté serveur et client.
 */
export function FavoriteButton({
  productId,
  productName,
  size = "sm",
  variant = "flottant",
  className = "",
}: {
  productId: string;
  productName: string;
  size?: keyof typeof TAILLES;
  variant?: keyof typeof FONDS;
  className?: string;
}) {
  const { isFavorite, toggle, hydrated } = useFavorites();
  const aime = hydrated && isFavorite(productId);
  const t = TAILLES[size];

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      aria-pressed={aime}
      aria-label={aime ? `Retirer ${productName} des favoris` : `Ajouter ${productName} aux favoris`}
      title={aime ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`flex items-center justify-center rounded-full transition-all duration-300 ease-soft hover:scale-105 active:scale-90 ${
        t.boite
      } ${FONDS[variant]} ${aime ? "text-accent" : "text-ink/70 hover:text-accent"} ${className}`}
    >
      {/* Le cœur plein signale l'état ; l'animation ne joue qu'au moment du
          clic, pas à chaque rendu de la grille. */}
      {aime ? (
        <IconHeartFull className={`${t.icone} anim-pop`} />
      ) : (
        <IconHeart className={t.icone} />
      )}
    </button>
  );
}
