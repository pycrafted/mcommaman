"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { IconLock, IconMail, IconPhone, IconPin, IconUser } from "./icons";
import { Alert, AuthShell, Checkbox, PasswordField, PasswordMeter, SubmitButton, TextField } from "./form-kit";

type ModeConnexion = "connexion" | "inscription";

type AuthFormProps = {
  compact?: boolean;
  onClose?: () => void;
  onModeChange?: (mode: ModeConnexion) => void;
  onSuccess?: () => void;
};

/* ------------------------------------------------------------------ connexion */

export function LoginForm({ compact = false, onClose, onModeChange, onSuccess }: AuthFormProps = {}) {
  const router = useRouter();
  const { login, account, hydrated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  /* Déjà connectée : cette page n'a plus lieu d'être. */
  useEffect(() => {
    if (hydrated && account) router.replace("/");
  }, [hydrated, account, router]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (!email.trim() || !password) {
      setErreur("Renseignez votre adresse e-mail et votre mot de passe.");
      return;
    }

    setEnvoi(true);
    const resultat = await login(email, password);
    setEnvoi(false);

    if (!resultat.ok) {
      setErreur(resultat.error ?? "La connexion a échoué.");
      return;
    }
    if (onSuccess) onSuccess();
    else router.replace("/");
  };

  return (
    <AuthShell
      eyebrow="Espace client"
      title="Bon retour parmi nous"
      image="/images/portes/filles.webp"
      compact={compact}
      footer={
        <span className="text-muted">
          Pas encore de compte ?{" "}
          {compact && onModeChange ? (
            <button type="button" onClick={() => onModeChange("inscription")} className="font-bold text-accent underline underline-offset-4">
              Créer un compte
            </button>
          ) : (
            <Link href="/compte/inscription" className="font-bold text-accent underline underline-offset-4">
              Créer un compte
            </Link>
          )}
        </span>
      }
    >
      <form onSubmit={envoyer} className={`flex flex-col ${compact ? "gap-4" : "gap-5"}`} noValidate>
        {erreur && <Alert>{erreur}</Alert>}

        <TextField
          label="Adresse e-mail"
          icon={IconMail}
          type="email"
          placeholder="aminata@exemple.sn"
          autoComplete="email"
          autoFocus={compact}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <PasswordField
            label="Mot de passe"
            icon={IconLock}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <p className="mt-2 text-right text-[12px]">
            <Link
              href="/compte/mot-de-passe-oublie"
              onClick={onClose}
              className="font-semibold text-accent underline underline-offset-4"
            >
              Mot de passe oublié ?
            </Link>
          </p>
        </div>

        <SubmitButton pending={envoi} pendingLabel="Connexion…">
          Se connecter
        </SubmitButton>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-bold uppercase tracking-[.16em] text-muted">ou</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <Link
          href="/"
          className="rounded-full border-[1.5px] border-[#e5d9de] bg-white px-8 py-3.5 text-center text-sm font-semibold transition-colors duration-300 hover:border-accent hover:text-accent"
        >
          Continuer sans compte
        </Link>
      </form>
    </AuthShell>
  );
}

/* ---------------------------------------------------------------- inscription */

type Champ = "name" | "email" | "phone" | "password" | "confirm" | "terms";

export function SignupForm({ compact = false, onModeChange, onSuccess }: AuthFormProps = {}) {
  const router = useRouter();
  const { register, account, hydrated } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [conditions, setConditions] = useState(false);
  const [touches, setTouches] = useState<Set<Champ>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (hydrated && account) router.replace("/");
  }, [hydrated, account, router]);

  const erreurs = useMemo(() => {
    const liste: Partial<Record<Champ, string>> = {};
    if (name.trim().length < 3) liste.name = "Indiquez votre nom complet.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) liste.email = "Cette adresse ne semble pas valide.";
    if (!/^[0-9+\s().-]{9,}$/.test(phone.trim())) liste.phone = "Un numéro joignable, par exemple 77 123 45 67.";
    if (password.length < 8) liste.password = "Au moins 8 caractères.";
    if (confirm !== password) liste.confirm = "Les deux mots de passe diffèrent.";
    if (!conditions) liste.terms = "Merci d'accepter les conditions générales.";
    return liste;
  }, [name, email, phone, password, confirm, conditions]);

  /* Un message n'apparaît qu'une fois le champ quitté : on ne gronde pas
     pendant la frappe. */
  const toucher = (champ: Champ) => setTouches((s) => new Set(s).add(champ));
  const erreurDe = (champ: Champ) => (touches.has(champ) ? erreurs[champ] : undefined);
  const valideDe = (champ: Champ) => touches.has(champ) && !erreurs[champ];

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouches(new Set<Champ>(["name", "email", "phone", "password", "confirm", "terms"]));
    setErreur(null);
    if (Object.keys(erreurs).length > 0) return;

    setEnvoi(true);
    const resultat = await register({ name, email, phone, city, password });
    setEnvoi(false);

    if (!resultat.ok) {
      setErreur(resultat.error ?? "La création du compte a échoué.");
      return;
    }
    if (onSuccess) onSuccess();
    else router.replace("/");
  };

  return (
    <AuthShell
      eyebrow="Nouvelle cliente"
      title="Créer mon compte"
      description="Vos commandes et vos adresses, retrouvées à chaque visite."
      image="/images/portes/bebes.webp"
      compact={compact}
      footer={
        <span className="text-muted">
          Vous avez déjà un compte ?{" "}
          {compact && onModeChange ? (
            <button type="button" onClick={() => onModeChange("connexion")} className="font-bold text-accent underline underline-offset-4">
              Se connecter
            </button>
          ) : (
            <Link href="/compte/connexion" className="font-bold text-accent underline underline-offset-4">
              Se connecter
            </Link>
          )}
        </span>
      }
    >
      <form onSubmit={envoyer} className={`flex flex-col ${compact ? "gap-4" : "gap-7"}`} noValidate>
        {erreur && <Alert>{erreur}</Alert>}

        <div className="flex flex-col gap-4">
          {!compact && <span className="text-[11px] font-bold uppercase tracking-[.16em] text-accent">Vous</span>}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nom et prénom"
              icon={IconUser}
              placeholder="Aminata Fall"
              autoComplete="name"
              autoFocus={compact}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => toucher("name")}
              error={erreurDe("name")}
              valid={valideDe("name")}
            />
            <TextField
              label="Téléphone"
              icon={IconPhone}
              inputMode="tel"
              placeholder="77 123 45 67"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => toucher("phone")}
              error={erreurDe("phone")}
              valid={valideDe("phone")}
            />
          </div>

          <TextField
            label="Adresse e-mail"
            icon={IconMail}
            type="email"
            placeholder="aminata@exemple.sn"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => toucher("email")}
            error={erreurDe("email")}
            valid={valideDe("email")}
          />

          {!compact && (
            <TextField
              label="Ville ou quartier"
              icon={IconPin}
              optional
              placeholder="Sacré-Cœur 3, Dakar"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          {!compact && <span className="text-[11px] font-bold uppercase tracking-[.16em] text-accent">Sécurité</span>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <PasswordField
                label="Mot de passe"
                icon={IconLock}
                value={password}
                onChange={setPassword}
                onBlur={() => toucher("password")}
                autoComplete="new-password"
                error={erreurDe("password")}
              />
              {!compact && <PasswordMeter password={password} />}
            </div>

            <PasswordField
              label="Confirmer le mot de passe"
              icon={IconLock}
              value={confirm}
              onChange={setConfirm}
              onBlur={() => toucher("confirm")}
              autoComplete="new-password"
              error={erreurDe("confirm")}
              valid={Boolean(confirm) && confirm === password}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Checkbox
            checked={conditions}
            onChange={(v) => {
              setConditions(v);
              toucher("terms");
            }}
            error={erreurDe("terms")}
          >
            J&apos;accepte les conditions générales et la politique de confidentialité.
          </Checkbox>

          {/* Les liens vivent hors de la case : un lien dans un `<label>` se
              disputerait le clic avec la case elle-même. */}
          <p className="pl-8 text-[11.5px] text-muted">
            <Link href="/infos/cgv" className="font-semibold text-accent underline underline-offset-2">
              Lire les CGV
            </Link>
            {" · "}
            <Link
              href="/infos/confidentialite"
              className="font-semibold text-accent underline underline-offset-2"
            >
              Politique de confidentialité
            </Link>
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SubmitButton pending={envoi} pendingLabel="Création du compte…">
            Créer mon compte
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
