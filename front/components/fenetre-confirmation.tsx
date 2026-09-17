"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Une fenêtre qui demande de confirmer un geste sans retour.
 *
 * Échap et un clic sur le fond referment sans rien faire ; le fond ne défile
 * pas tant qu'elle est ouverte. Le bouton de confirmation reçoit le focus :
 * c'est celui qu'on vient chercher.
 */
export function FenetreConfirmation({
  ouverte,
  titre,
  children,
  confirmer,
  renoncer = "Revenir",
  enCours = false,
  onConfirmer,
  onFermer,
}: {
  ouverte: boolean;
  titre: string;
  children?: ReactNode;
  /** Le libellé du bouton qui engage l'action. */
  confirmer: string;
  /** Le libellé du bouton qui renonce. */
  renoncer?: string;
  enCours?: boolean;
  onConfirmer: () => void;
  onFermer: () => void;
}) {
  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = avant;
    };
  }, [ouverte, onFermer]);

  if (!ouverte || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onFermer}
      className="fixed inset-0 z-100 flex items-end justify-center bg-ink/45 p-4 backdrop-blur-[3px] sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={titre}
        className="anim-fade-up w-full max-w-[420px] rounded-[26px] bg-cream p-6 shadow-[0_30px_70px_-30px_rgba(36,26,32,.55)] sm:p-7"
      >
        <h2 className="text-[19px] font-extrabold tracking-[-.02em]">{titre}</h2>
        {children && (
          <div className="mt-2.5 text-[14px] leading-relaxed text-muted">{children}</div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onFermer}
            className="rounded-full px-5 py-3 text-[14px] font-semibold text-muted transition-colors hover:text-ink"
          >
            {renoncer}
          </button>
          <button
            type="button"
            autoFocus
            disabled={enCours}
            onClick={onConfirmer}
            className="rounded-full bg-rose-deep px-6 py-3 text-[14px] font-bold text-white transition-transform duration-300 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
          >
            {enCours ? "Un instant…" : confirmer}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
