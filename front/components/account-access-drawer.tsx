"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IconClose } from "./icons";
import { LoginForm, SignupForm } from "./account-auth";
import { ForgotPasswordForm } from "./password-reset";

type ModeConnexion = "connexion" | "inscription" | "oubli";

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
      <section
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-label="Accès au compte"
        tabIndex={-1}
        className="anim-fade-up masquer-barre-defilement relative z-10 max-h-[calc(100dvh-24px)] w-full max-w-[400px] overflow-y-auto overscroll-contain rounded-[24px] border border-line bg-white p-5 shadow-[0_24px_70px_-20px_rgba(36,26,32,.4)] outline-none sm:max-h-[min(760px,calc(100dvh-48px))] sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fenêtre de connexion"
          className="absolute right-4 top-4 z-20 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:bg-blush hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-5 sm:top-5"
        >
          <IconClose className="h-4 w-4" />
        </button>

        {mode === "connexion" ? (
          <LoginForm compact onClose={onClose} onModeChange={onModeChange} onSuccess={accueil} />
        ) : mode === "inscription" ? (
          <SignupForm compact onModeChange={onModeChange} onSuccess={accueil} />
        ) : (
          <ForgotPasswordForm compact onModeChange={onModeChange} />
        )}
      </section>
    </div>,
    document.body,
  );
}
