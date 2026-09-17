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
      quote="Ça arrive à tout le monde."
      footer={
        <span className="text-muted">
          Vous vous en souvenez&nbsp;?{" "}
          <Link href="/compte/connexion" className="font-bold text-rose underline underline-offset-4">
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
            className="text-[13px] font-semibold text-rose underline underline-offset-4"
          >
            Je ne connais plus mon mot de passe actuel
          </button>
        )}
      </div>
    </AuthShell>
  );
}

/* ------------------------------------------------------- le lien par courriel */

function ForgotByEmail({ onFermer }: { onFermer: () => void }) {
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
      <div className="flex flex-col gap-3">
        {/* Le message ne dit pas si l'adresse a un compte : le serveur répond la
            même chose dans les deux cas, l'écran doit en faire autant. */}
        <p className="rounded-2xl bg-mist px-5 py-4 text-[13.5px] leading-relaxed">
          Si un compte existe pour <strong>{email.trim()}</strong>, un lien vient d&apos;y être
          envoyé. Il ne sert qu&apos;une fois.
        </p>
        <p className="text-[12.5px] leading-relaxed text-muted">
          Rien n&apos;arrive&nbsp;? Regardez dans les indésirables, puis écrivez-nous&nbsp;:{" "}
          <Link href="/#contact" className="font-semibold text-rose underline underline-offset-4">
            nous contacter
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={demander} className="flex flex-col gap-4" noValidate>
      <div>
        <p className="text-[13px] font-bold">Recevoir un lien par e-mail</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Nous vous envoyons un lien qui permet d&apos;en choisir un nouveau, sans connaître
          l&apos;actuel.
        </p>
      </div>

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
        <button
          type="button"
          onClick={onFermer}
          className="text-[13px] font-semibold text-muted underline underline-offset-4"
        >
          Annuler
        </button>
      </div>
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
      quote="Un lien, une fois, et c'est réglé."
      footer={
        <span className="text-muted">
          <Link href="/compte/connexion" className="font-bold text-rose underline underline-offset-4">
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
            className="self-start text-[13px] font-semibold text-rose underline underline-offset-4"
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
