"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IconClose } from "./icons";
import { LoginForm, SignupForm } from "./account-auth";

type ModeConnexion = "connexion" | "inscription";
type FlecheCompte = { largeur: number; hauteur: number; courbe: string; pointe: string };

export function AccountAccessDrawer({
  mode,
  onModeChange,
  onClose,
}: {
  mode: ModeConnexion;
  onModeChange: (mode: ModeConnexion) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const panneau = useRef<HTMLElement>(null);
  const [monte, setMonte] = useState(false);
  const [fleche, setFleche] = useState<FlecheCompte | null>(null);

  useEffect(() => {
    setMonte(true);
  }, []);

  useEffect(() => {
    if (!monte) return;

    const focusAvant = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const defilementAvant = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const surTouche = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;

      const interactifs = panneau.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!interactifs?.length) {
        event.preventDefault();
        panneau.current?.focus();
        return;
      }

      const premier = interactifs[0];
      const dernier = interactifs[interactifs.length - 1];
      if (event.shiftKey && document.activeElement === premier) {
        event.preventDefault();
        dernier.focus();
      } else if (!event.shiftKey && document.activeElement === dernier) {
        event.preventDefault();
        premier.focus();
      }
    };

    window.addEventListener("keydown", surTouche);
    const premierChamp = panneau.current?.querySelector<HTMLElement>("input:not([type=checkbox])");
    if (premierChamp) premierChamp.focus();
    else panneau.current?.focus();

    return () => {
      document.body.style.overflow = defilementAvant;
      window.removeEventListener("keydown", surTouche);
      focusAvant?.focus();
    };
  }, [monte, onClose]);

  useEffect(() => {
    if (!monte) return;

    const mesurerFleche = () => {
      const rectPanneau = panneau.current?.getBoundingClientRect();
      const cible = document.getElementById("dock-account-trigger");
      const rectCible = cible?.getBoundingClientRect();

      if (!rectPanneau || !rectCible || window.innerWidth < 700) {
        setFleche(null);
        return;
      }

      const departX = rectPanneau.right - 1;
      const departY = rectPanneau.top + rectPanneau.height * 0.76;
      const arriveeX = rectCible.left + Math.min(4, rectCible.width * 0.08);
      const arriveeY = rectCible.top + rectCible.height / 2;
      const distanceX = arriveeX - departX;

      if (distanceX < 100) {
        setFleche(null);
        return;
      }

      const controle1X = departX + distanceX * 0.28;
      const controle1Y = departY + Math.max(24, (arriveeY - departY) * 0.1);
      const controle2X = arriveeX - distanceX * 0.24;
      const controle2Y = arriveeY - Math.max(24, (arriveeY - departY) * 0.12);
      const directionX = arriveeX - controle2X;
      const directionY = arriveeY - controle2Y;
      const longueur = Math.hypot(directionX, directionY) || 1;
      const uniteX = directionX / longueur;
      const uniteY = directionY / longueur;
      const baseX = arriveeX - uniteX * 18;
      const baseY = arriveeY - uniteY * 18;
      const perpendiculaireX = -uniteY * 7;
      const perpendiculaireY = uniteX * 7;

      setFleche({
        largeur: window.innerWidth,
        hauteur: window.innerHeight,
        courbe: `M ${departX} ${departY} C ${controle1X} ${controle1Y}, ${controle2X} ${controle2Y}, ${arriveeX} ${arriveeY}`,
        pointe: `M ${arriveeX} ${arriveeY} L ${baseX + perpendiculaireX} ${baseY + perpendiculaireY} L ${baseX - perpendiculaireX} ${baseY - perpendiculaireY} Z`,
      });
    };

    mesurerFleche();
    const panneauObserve = panneau.current;
    const cibleObservee = document.getElementById("dock-account-trigger");
    const observateur = new ResizeObserver(mesurerFleche);
    if (panneauObserve) observateur.observe(panneauObserve);
    if (cibleObservee) observateur.observe(cibleObservee);
    window.addEventListener("resize", mesurerFleche);

    return () => {
      observateur.disconnect();
      window.removeEventListener("resize", mesurerFleche);
    };
  }, [monte]);

  const accueil = () => {
    onClose();
    router.replace("/");
  };

  if (!monte) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-start bg-ink/25 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {fleche && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full overflow-visible sm:block"
          viewBox={`0 0 ${fleche.largeur} ${fleche.hauteur}`}
          preserveAspectRatio="none"
        >
          <path d={fleche.courbe} fill="none" stroke="white" strokeLinecap="round" strokeWidth="8" />
          <path d={fleche.courbe} fill="none" stroke="#e24f88" strokeLinecap="round" strokeWidth="4" />
          <path d={fleche.pointe} fill="#e24f88" stroke="white" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      )}
      <section
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compte-titre"
        tabIndex={-1}
        className="anim-fade-up relative z-10 max-h-[calc(100dvh-24px)] w-full max-w-[400px] overflow-y-auto overscroll-contain rounded-[24px] border border-line bg-white p-5 shadow-[0_24px_70px_-20px_rgba(36,26,32,.4)] outline-none sm:max-h-[min(760px,calc(100dvh-48px))] sm:p-6"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 id="compte-titre" className="text-[14px] font-extrabold">Mon compte</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre de connexion"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:bg-blush hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </header>

        {mode === "connexion" ? (
          <LoginForm compact onClose={onClose} onModeChange={onModeChange} onSuccess={accueil} />
        ) : (
          <SignupForm compact onModeChange={onModeChange} onSuccess={accueil} />
        )}
      </section>
    </div>,
    document.body,
  );
}
