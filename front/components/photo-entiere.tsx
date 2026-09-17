import type { ReactNode } from "react";

/**
 * Une photo montrée en entier, quel que soit son format.
 *
 * Un cadre fixe coupait les photos qui n'avaient pas ses proportions — la tête
 * ou les pieds d'un enfant disparaissaient. Ici la photo tient entière dans le
 * cadre (`object-contain`), et les bandes qui restent sont comblées par la même
 * photo, agrandie et floutée : pas de marges vides, pas de pièce tronquée.
 *
 * Le cadre, lui, garde la taille que lui donne `className` : le composant le
 * remplit.
 */
export function PhotoEntiere({
  src,
  alt,
  className = "",
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Ce qui se pose par-dessus la photo : miniatures, pastilles… */
  children?: ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden bg-stone ${className}`}>
      {src && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-2xl"
            style={{ backgroundImage: `url(${src})` }}
          />
          {/* Un <img> simple : les photos viennent de plusieurs hôtes, et le
              cadre fixe déjà la taille. */}
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 h-full w-full object-contain"
            loading="lazy"
          />
        </>
      )}
      {children}
    </div>
  );
}
