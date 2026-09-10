"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconClose, IconLock, IconMail } from "@/components/icons";
import { useAuth } from "@/components/auth-context";

/* La connexion passe par le contexte de session, le même que sur la vitrine,
   et par la porte réservée au back-office : le serveur vérifie le rôle avant
   d'ouvrir quoi que ce soit. Cette page ne refait plus d'appel à part entière
   — elle lit le compte là où tout le monde le lit, et n'a donc jamais sous les
   yeux une session que la déconnexion vient de fermer. */

export default function Page() {
  const router = useRouter();
  const { loginEquipe, account, hydrated } = useAuth();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  /* Déjà entrée : on ne redemande pas. */
  useEffect(() => {
    if (hydrated && account?.equipe) router.replace("/admin");
  }, [hydrated, account, router]);

  useEffect(() => {
    if (!erreur) return;
    const minuteur = window.setTimeout(() => setErreur(""), 4200);
    return () => window.clearTimeout(minuteur);
  }, [erreur]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    // Le serveur refuse un compte cliente avant d'ouvrir une session : plus
    // de connexion suivie d'une déconnexion pour le découvrir.
    const resultat = await loginEquipe(email.trim(), motDePasse);
    setEnvoi(false);
    if (!resultat.ok) {
      setErreur(resultat.error ?? "Le serveur ne répond pas. Réessayez.");
      return;
    }
    router.replace("/admin");
  };

  const champ =
    "w-full rounded-2xl border-[1.5px] border-[#ece3e7] bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-[#b3a5aa] focus:border-rose";

  return (
    <div className="grid min-h-screen place-items-center bg-[#faf8f9] px-5 py-12">
      <div className="w-full max-w-[420px]">
        {erreur && (
          <div className="fixed right-4 top-4 z-100 w-[min(24rem,calc(100vw-2rem))] anim-slide-in sm:right-6 sm:top-6">
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose/35 bg-white px-4 py-3.5 text-rose-deep shadow-[0_14px_40px_rgba(38,25,31,.18)]">
              <span className="min-w-0 flex-1 text-[13px] font-semibold leading-relaxed">{erreur}</span>
              <button type="button" onClick={() => setErreur("")} aria-label="Fermer la notification" className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-black/5">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <div className="mb-7 text-center">
          <span className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">
            Administration
          </span>
          <h1 className="mt-2.5 text-[28px] font-extrabold leading-tight tracking-[-.035em]">
            Back-office
          </h1>
        </div>

        <form
          onSubmit={envoyer}
          className="rounded-[24px] border border-line bg-white p-6 sm:p-7"
        >
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold">Adresse e-mail</span>
            <span className="relative block">
              <IconMail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErreur("");
                }}
                placeholder="vous@mcommemaman.sn"
                className={champ}
              />
            </span>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-[12.5px] font-bold">Mot de passe</span>
            <span className="relative block">
              <IconLock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
              <input
                type="password"
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => {
                  setMotDePasse(e.target.value);
                  setErreur("");
                }}
                placeholder="••••••••"
                className={champ}
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={envoi}
            className="mt-6 w-full rounded-full bg-rose py-3.5 text-[14px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
          >
            {envoi ? "Vérification…" : "Entrer"}
          </button>

          <p className="mt-5 text-center text-[12.5px]">
            <Link
              href="/compte/mot-de-passe-oublie"
              className="font-semibold text-rose underline underline-offset-4"
            >
              Mot de passe oublié ?
            </Link>
          </p>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-muted">
          <Link href="/" className="font-semibold transition-colors hover:text-rose">
            Retour à la boutique
          </Link>
        </p>
      </div>
    </div>
  );
}
