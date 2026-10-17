"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ErreurApi, envoyer } from "@/lib/api";
import { useAuth } from "./auth-context";
import { IconLock, IconMail } from "./icons";
import { Alert, AuthShell, PasswordField, PasswordMeter, SubmitButton, TextField } from "./form-kit";

/**
 * Changer son mot de passe sans être connectée.
 *
 * Deux chemins, et le premier suffit presque toujours :
 *
 * — **On connaît l'actuel.** C'est la même preuve que pour se connecter, alors
 *   on s'en sert : on ouvre la session, on change le mot de passe, et la
 *   personne se retrouve chez elle. Aucun courriel n'entre en jeu.
 *
 * — **On l'a vraiment oublié.** Là il faut un lien envoyé par courriel, donc un
 *   service d'envoi. Le second formulaire est replié : il ne sert qu'à ça.
 */

const raison = (cause: unknown, repli: string) =>
  cause instanceof ErreurApi ? cause.message : repli;

/* ------------------------------------------------- l'actuel, puis le nouveau */

export function ChangePasswordForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  const [oubliOuvert, setOubliOuvert] = useState(false);

  const changer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (!email.trim() || !actuel) {
      setErreur("Indiquez votre adresse e-mail et votre mot de passe actuel.");
      return;
    }
    // La confirmation ne quitte jamais la page : c'est ici qu'on la compare.
    if (!nouveau) {
      setErreur("Choisissez un nouveau mot de passe.");
      return;
    }
    if (nouveau !== confirmation) {
      setErreur("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (nouveau === actuel) {
      setErreur("Le nouveau mot de passe est identique à l'ancien.");
      return;
    }

    setEnvoi(true);

    /* Connaître le mot de passe actuel, c'est exactement la preuve qu'exige la
       connexion : on ouvre la session avec, puis on change. Pas besoin d'une
       route de plus, ni d'un courriel. */
    const entree = await login(email.trim(), actuel);
    if (!entree.ok) {
      setEnvoi(false);
      setErreur(entree.error ?? "Adresse ou mot de passe incorrect.");
      return;
    }

    try {
      await envoyer("/api/compte/mot-de-passe/", "POST", { actuel, nouveau });
      setFait(true);
      // La session est déjà ouverte : autant l'emmener chez elle.
      window.setTimeout(() => router.push("/compte"), 1600);
    } catch (cause) {
      setErreur(raison(cause, "Le changement n'a pas abouti."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Espace client"
      title="Changer mon mot de passe"
      
      image="/images/portes/filles.webp"
      footer={
        <span className="text-muted">
          Vous vous en souvenez&nbsp;?{" "}
          <Link href="/compte/connexion" className="font-bold text-accent underline underline-offset-4">
            Retour à la connexion
          </Link>
        </span>
      }
    >
      {fait ? (
        <p className="rounded-2xl bg-mist px-5 py-4 text-[13.5px] leading-relaxed">
          Mot de passe modifié. On vous emmène à votre espace…
        </p>
      ) : (
        <form onSubmit={changer} className="flex flex-col gap-5" noValidate>
          {erreur && <Alert>{erreur}</Alert>}

          <TextField
            label="Adresse e-mail"
            icon={IconMail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <PasswordField
            label="Mot de passe actuel"
            icon={IconLock}
            value={actuel}
            onChange={setActuel}
            autoComplete="current-password"
          />

          <div>
            <PasswordField
              label="Nouveau mot de passe"
              icon={IconLock}
              value={nouveau}
              onChange={setNouveau}
              autoComplete="new-password"
            />
            <PasswordMeter password={nouveau} />
          </div>

          <PasswordField
            label="Confirmer le nouveau mot de passe"
            icon={IconLock}
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />

          <SubmitButton pending={envoi} pendingLabel="Enregistrement…">
            Enregistrer le nouveau mot de passe
          </SubmitButton>
        </form>
      )}

      {/* Le cas où l'on ne connaît vraiment plus l'actuel : replié, parce qu'il
          dépend d'un courriel et que c'est le chemin le plus long. */}
      <div className="mt-7 border-t border-line pt-5">
        {oubliOuvert ? (
          <ForgotByEmail onFermer={() => setOubliOuvert(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setOubliOuvert(true)}
            className="text-[13px] font-semibold text-accent underline underline-offset-4"
          >
            Je ne connais plus mon mot de passe actuel
          </button>
        )}
      </div>
    </AuthShell>
  );
}

/* ------------------------------------------------------- le lien par courriel */

function ForgotByEmail({ onFermer }: { onFermer?: () => void } = {}) {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const demander = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (!email.trim()) {
      setErreur("Indiquez l'adresse e-mail de votre compte.");
      return;
    }

    setEnvoi(true);
    try {
      await envoyer("/api/compte/mot-de-passe/oubli/", "POST", { email: email.trim() });
      setEnvoye(true);
    } catch (cause) {
      setErreur(raison(cause, "La demande n'a pas abouti. Réessayez dans un instant."));
    } finally {
      setEnvoi(false);
    }
  };

  if (envoye) {
    return (
      <div>
        {/* Le message ne dit pas si l'adresse a un compte : le serveur répond la
            même chose dans les deux cas, l'écran doit en faire autant. */}
        <p className="rounded-2xl bg-mist px-4 py-3 text-[12.5px] leading-relaxed">
          Si un compte existe, un lien a été envoyé à <strong>{email.trim()}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={demander} className="flex flex-col gap-4" noValidate>
      {erreur && <Alert>{erreur}</Alert>}

      <TextField
        label="Adresse e-mail"
        icon={IconMail}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={envoi} pendingLabel="Envoi…">
          Recevoir le lien
        </SubmitButton>
        {onFermer && (
          <button
            type="button"
            onClick={onFermer}
            className="text-[13px] font-semibold text-muted underline underline-offset-4"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export function ForgotPasswordForm({
  compact = false,
  onModeChange,
}: {
  compact?: boolean;
  onModeChange: (mode: "connexion" | "inscription" | "oubli") => void;
}) {
  const [methode, setMethode] = useState<"actuel" | "email">("email");

  return (
    <div>
      <h2 className="text-[20px] font-extrabold tracking-tight">Mot de passe</h2>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-blush p-1" role="group" aria-label="Méthode de changement du mot de passe">
        <button
          type="button"
          aria-pressed={methode === "actuel"}
          onClick={() => setMethode("actuel")}
          className={`rounded-full px-2 py-2.5 text-[11px] font-bold transition-colors ${methode === "actuel" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          Mot de passe actuel
        </button>
        <button
          type="button"
          aria-pressed={methode === "email"}
          onClick={() => setMethode("email")}
          className={`rounded-full px-2 py-2.5 text-[11px] font-bold transition-colors ${methode === "email" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          Lien par e-mail
        </button>
      </div>

      <div className="mt-4">
        {methode === "actuel" ? <ChangeWithCurrentPassword compact={compact} /> : <ForgotByEmail />}
      </div>

      <p className="mt-4 text-center text-[12px]">
        <button
          type="button"
          onClick={() => onModeChange("connexion")}
          className="font-bold text-accent underline underline-offset-4"
        >
          Retour à la connexion
        </button>
      </p>
    </div>
  );
}

function ChangeWithCurrentPassword({ compact }: { compact: boolean }) {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  const changer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (!email.trim() || !actuel) {
      setErreur("E-mail et mot de passe actuel requis.");
      return;
    }
    if (!nouveau || nouveau !== confirmation) {
      setErreur("Vérifiez le nouveau mot de passe et sa confirmation.");
      return;
    }
    if (nouveau === actuel) {
      setErreur("Choisissez un mot de passe différent de l'actuel.");
      return;
    }

    setEnvoi(true);
    const entree = await login(email.trim(), actuel);
    if (!entree.ok) {
      setEnvoi(false);
      setErreur(entree.error ?? "Adresse ou mot de passe incorrect.");
      return;
    }

    try {
      await envoyer("/api/compte/mot-de-passe/", "POST", { actuel, nouveau });
      setFait(true);
      window.setTimeout(() => router.push("/compte"), 1600);
    } catch (cause) {
      setErreur(raison(cause, "Le changement n'a pas abouti."));
    } finally {
      setEnvoi(false);
    }
  };

  if (fait) {
    return <p className="rounded-2xl bg-mist px-4 py-3 text-[12.5px]">Mot de passe modifié.</p>;
  }

  return (
    <form onSubmit={changer} className="flex flex-col gap-4" noValidate>
      {erreur && <Alert>{erreur}</Alert>}

      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-4"}>
        <TextField
          label="Adresse e-mail"
          icon={IconMail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <PasswordField
          label="Mot de passe actuel"
          icon={IconLock}
          value={actuel}
          onChange={setActuel}
          autoComplete="current-password"
        />
      </div>

      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-4"}>
        <PasswordField
          label="Nouveau mot de passe"
          icon={IconLock}
          value={nouveau}
          onChange={setNouveau}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirmer"
          icon={IconLock}
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
        />
      </div>

      <SubmitButton pending={envoi} pendingLabel="Enregistrement…">
        Changer le mot de passe
      </SubmitButton>
    </form>
  );
}

/* --------------------------------------------------- le lien reçu par courriel */

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const uid = params.get("uid") ?? "";
  const jeton = params.get("jeton") ?? "";

  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  const lienIncomplet = !uid || !jeton;

  const poser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (!nouveau) {
      setErreur("Choisissez un nouveau mot de passe.");
      return;
    }
    if (nouveau !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setEnvoi(true);
    try {
      await envoyer("/api/compte/mot-de-passe/reinitialiser/", "POST", { uid, jeton, nouveau });
      setFait(true);
      // On ne connecte pas d'office : rien ne prouve que la personne devant
      // l'écran est celle qui a reçu le courriel.
      window.setTimeout(() => router.push("/compte/connexion"), 2200);
    } catch (cause) {
      setErreur(raison(cause, "Le changement n'a pas abouti."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Espace client"
      title="Nouveau mot de passe"
      description="Choisissez-en un que vous n'utilisez pas ailleurs."
      image="/images/portes/filles.webp"
      footer={
        <span className="text-muted">
          <Link href="/compte/connexion" className="font-bold text-accent underline underline-offset-4">
            Retour à la connexion
          </Link>
        </span>
      }
    >
      {lienIncomplet ? (
        <div className="flex flex-col gap-4">
          <Alert>
            Ce lien est incomplet. Ouvrez-le depuis le courriel reçu, sans le recopier à la main.
          </Alert>
          <Link
            href="/compte/mot-de-passe-oublie"
            className="self-start text-[13px] font-semibold text-accent underline underline-offset-4"
          >
            Changer mon mot de passe autrement
          </Link>
        </div>
      ) : fait ? (
        <p className="rounded-2xl bg-mist px-5 py-4 text-[13.5px] leading-relaxed">
          Mot de passe modifié. On vous emmène à la connexion…
        </p>
      ) : (
        <form onSubmit={poser} className="flex flex-col gap-5" noValidate>
          {erreur && <Alert>{erreur}</Alert>}

          <div>
            <PasswordField
              label="Nouveau mot de passe"
              icon={IconLock}
              value={nouveau}
              onChange={setNouveau}
              autoComplete="new-password"
            />
            <PasswordMeter password={nouveau} />
          </div>

          <PasswordField
            label="Confirmer le mot de passe"
            icon={IconLock}
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />

          <SubmitButton pending={envoi} pendingLabel="Enregistrement…">
            Enregistrer le mot de passe
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
