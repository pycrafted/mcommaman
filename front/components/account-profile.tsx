"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatXOF } from "@/lib/format";
import { ZONES } from "@/lib/livraison";
import { useAuth, type ZoneKey } from "./auth-context";
import { useOrders } from "./orders-context";
import { OrderStatusBadge } from "./order-status-badge";
import { AccountHeader } from "./account-header";
import { PasswordField, SectionCard, TextField } from "./form-kit";
import { IconArrow, IconCheck, IconClose, IconLock, IconMail, IconPackage, IconPhone, IconPin, IconPlus, IconStar, IconTrash, IconUser } from "./icons";

const SHELL = "mx-auto w-full max-w-[1180px] px-5 md:px-8 lg:px-10";

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/* De la naissance à l'adolescence, comme le catalogue. Les tailles suivies ne
   servent qu'à repérer les nouveautés : la liste peut rester large. */
const TAILLES = [
  "0-3 m",
  "3-6 m",
  "6-12 m",
  "2 ans",
  "4 ans",
  "6 ans",
  "8 ans",
  "10 ans",
  "12 ans",
  "14 ans",
];

const SELECT =
  "w-full rounded-2xl border-[1.5px] border-[#ece3e7] bg-white px-4 py-3.5 text-sm outline-none transition-colors focus:border-rose";

export function AccountProfile() {
  const router = useRouter();
  const {
    account,
    hydrated,
    updateProfile,
    updatePreferences,
    addAddress,
    removeAddress,
    setDefaultAddress,
    changePassword,
    deleteAccount,
  } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [enregistre, setEnregistre] = useState(false);

  const [formulaireAdresse, setFormulaireAdresse] = useState(false);
  const [label, setLabel] = useState("");
  const [zone, setZone] = useState<ZoneKey>("dakar");
  const [ville, setVille] = useState("");
  const [ligne, setLigne] = useState("");
  const [notes, setNotes] = useState("");

  const [motDePasseActuel, setMotDePasseActuel] = useState("");
  const [motDePasseSuivant, setMotDePasseSuivant] = useState("");
  const [messageMotDePasse, setMessageMotDePasse] = useState<{ ok: boolean; texte: string } | null>(null);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  const [sortie, setSortie] = useState(false);

  const { orders } = useOrders();

  useEffect(() => {
    if (hydrated && !account && !sortie) router.replace("/compte/connexion?suite=/compte/profil");
  }, [hydrated, account, sortie, router]);

  /* Les champs partent de la valeur enregistrée, et s'y remettent quand celle-ci
     bouge — enregistrement, ou connexion dans un autre onglet. On dépend des
     trois valeurs et non de l'objet : sinon cocher une taille, qui réécrit le
     compte, effacerait une saisie en cours dans ces champs-là. */
  useEffect(() => {
    if (!account) return;
    setName(account.name);
    setPhone(account.phone);
    setCity(account.city);
  }, [account?.name, account?.phone, account?.city]);

  if (!hydrated || !account) {
    return (
      <div className={`${SHELL} pb-22 pt-10`}>
        <div className="h-10 w-52 animate-pulse rounded-full bg-mist" />
        <div className="mt-6 h-72 animate-pulse rounded-3xl bg-mist" />
      </div>
    );
  }

  const modifie = name !== account.name || phone !== account.phone || city !== account.city;

  const enregistrerInfos = () => {
    updateProfile({ name: name.trim(), phone: phone.trim(), city: city.trim() });
    setEnregistre(true);
    window.setTimeout(() => setEnregistre(false), 2200);
  };

  const envoyerAdresse = (e: React.FormEvent) => {
    e.preventDefault();
    if (ville.trim().length < 2 || ligne.trim().length < 5) return;
    addAddress({
      label: label.trim() || "Adresse",
      zone,
      city: ville.trim(),
      address: ligne.trim(),
      notes: notes.trim(),
    });
    setLabel("");
    setVille("");
    setLigne("");
    setNotes("");
    setFormulaireAdresse(false);
  };

  const basculerTaille = (taille: string) => {
    const actuelles = account.preferences.sizes;
    updatePreferences({
      sizes: actuelles.includes(taille)
        ? actuelles.filter((t) => t !== taille)
        : [...actuelles, taille],
    });
  };

  const envoyerMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessageMotDePasse(null);
    if (motDePasseSuivant.length < 8) {
      setMessageMotDePasse({ ok: false, texte: "Le nouveau mot de passe doit faire au moins 8 caractères." });
      return;
    }
    const resultat = await changePassword(motDePasseActuel, motDePasseSuivant);
    if (resultat.ok) {
      setMotDePasseActuel("");
      setMotDePasseSuivant("");
      setMessageMotDePasse({ ok: true, texte: "Mot de passe modifié." });
    } else {
      setMessageMotDePasse({ ok: false, texte: resultat.error ?? "La modification a échoué." });
    }
  };

  return (
    <div className={`${SHELL} pb-22 pt-10`}>
      <AccountHeader />

      <div className="mb-8">
        <span className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">Espace client</span>
        <h2 className="mt-3 text-[clamp(1.55rem,3.4vw,2.1rem)] font-extrabold leading-[1.08] tracking-[-.035em]">
          Mon profil
        </h2>
        <p className="mt-2.5 max-w-[52ch] text-[14.5px] leading-relaxed text-muted text-pretty">
          Vos informations, vos adresses de livraison et les tailles que vous suivez.
        </p>
      </div>


      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* --------------------------------------------- commandes */}
          <SectionCard
            title="Mes commandes"
            description="Les commandes passées depuis ce navigateur, de la plus récente à la plus ancienne."
          >
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-6 py-8 text-center">
                <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-mist">
                  <IconPackage className="h-5 w-5 text-rose" />
                </span>
                <p className="text-[13.5px] text-muted">Aucune commande pour le moment.</p>
                <Link
                  href="/boutique"
                  className="mt-4 inline-block rounded-full border-[1.5px] border-[#e5d9de] px-6 py-3 text-[13.5px] font-semibold transition-colors duration-300 hover:border-rose hover:text-rose"
                >
                  Découvrir la boutique
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex flex-col gap-2.5">
                  {orders.slice(0, 3).map((commande) => (
                    <li key={commande.ref}>
                      <Link
                        href={`/commandes/${commande.ref}`}
                        className="group flex flex-wrap items-center gap-4 rounded-2xl bg-mist p-4 transition-colors duration-300 hover:bg-stone"
                      >
                        <div className="flex -space-x-2">
                          {commande.lines.slice(0, 3).map((ligne) => (
                            <span
                              key={ligne.id}
                              className="h-12 w-11 rounded-lg border-2 border-white bg-stone bg-cover bg-center"
                              style={{ backgroundImage: `url(${ligne.image})` }}
                            />
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-extrabold tabular-nums">
                              {commande.ref}
                            </span>
                            <OrderStatusBadge status={commande.status} />
                          </div>
                          <p className="mt-0.5 text-[12.5px] text-muted">
                            {dateCourte(commande.createdAt)} · {formatXOF(commande.total)}
                          </p>
                        </div>
                        <IconArrow className="h-4 w-4 shrink-0 text-muted transition-transform duration-300 ease-soft group-hover:translate-x-1 group-hover:text-rose" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/commandes"
                  className="group mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-rose"
                >
                  Voir les {orders.length} commande{orders.length > 1 ? "s" : ""} et leur suivi
                  <IconArrow className="h-3.5 w-3.5 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
                </Link>
              </>
            )}
          </SectionCard>

          {/* ------------------------------------------ informations */}
          <SectionCard title="Informations personnelles">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nom et prénom"
                icon={IconUser}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <TextField
                label="Adresse e-mail"
                icon={IconMail}
                value={account.email}
                readOnly
                className="opacity-70"
                hint="L'adresse sert d'identifiant, elle ne se change pas ici."
              />
              <TextField
                label="Téléphone"
                icon={IconPhone}
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              <TextField
                label="Ville ou quartier"
                icon={IconPin}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enregistrerInfos}
                disabled={!modifie}
                className="inline-flex items-center gap-2 rounded-full bg-rose px-6 py-3 text-[13.5px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
              >
                <IconCheck className="h-4 w-4" />
                Enregistrer
              </button>
              {modifie && (
                <button
                  type="button"
                  onClick={() => {
                    setName(account.name);
                    setPhone(account.phone);
                    setCity(account.city);
                  }}
                  className="rounded-full px-4 py-3 text-[13.5px] font-semibold text-muted transition-colors hover:text-ink"
                >
                  Annuler les modifications
                </button>
              )}
              {enregistre && (
                <span className="anim-fade-up inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#3f8a5f]">
                  <IconCheck className="h-4 w-4" />
                  Enregistré
                </span>
              )}
            </div>
          </SectionCard>

          {/* -------------------------------------- carnet d'adresses */}
          <SectionCard
            title="Carnet d'adresses"
            description="L'adresse par défaut est proposée automatiquement au moment de commander."
          >
            {account.addresses.length === 0 && !formulaireAdresse && (
              <p className="mb-4 rounded-2xl bg-mist px-4 py-3.5 text-[13px] text-muted">
                Aucune adresse enregistrée pour le moment.
              </p>
            )}

            <ul className="flex flex-col gap-3">
              {account.addresses.map((entree) => (
                <li
                  key={entree.id}
                  className={`rounded-2xl border-[1.5px] p-4 transition-colors ${
                    entree.isDefault ? "border-rose bg-rose-soft/60" : "border-line"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13.5px] font-bold">
                        <IconPin className="h-4 w-4 shrink-0 text-rose" />
                        {entree.label}
                        {entree.isDefault && (
                          <span className="rounded-full bg-rose px-2 py-0.5 text-[10.5px] font-bold text-white">
                            par défaut
                          </span>
                        )}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                        {entree.address} — {entree.city} ·{" "}
                        {ZONES.find((z) => z.key === entree.zone)?.t ?? ZONES[0].t}
                      </p>
                      {entree.notes && (
                        <p className="mt-1 text-[12px] italic text-muted">«&nbsp;{entree.notes}&nbsp;»</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {!entree.isDefault && (
                        <button
                          type="button"
                          onClick={() => setDefaultAddress(entree.id)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:text-rose"
                        >
                          <IconStar className="h-3.5 w-3.5" />
                          Par défaut
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAddress(entree.id)}
                        aria-label={`Supprimer l'adresse ${entree.label}`}
                        className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:text-rose-deep"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {formulaireAdresse ? (
              <form onSubmit={envoyerAdresse} className="anim-fade-up mt-4 rounded-2xl bg-mist p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[13.5px] font-bold">Nouvelle adresse</p>
                  <button
                    type="button"
                    onClick={() => setFormulaireAdresse(false)}
                    aria-label="Fermer le formulaire"
                    className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-ink"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Nom de l'adresse"
                    icon={IconStar}
                    placeholder="Maison, bureau…"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                  <div>
                    <label htmlFor="zone-adresse" className="mb-2 block text-[12.5px] font-bold">
                      Zone de livraison
                    </label>
                    <select
                      id="zone-adresse"
                      value={zone}
                      onChange={(e) => setZone(e.target.value as ZoneKey)}
                      className={SELECT}
                    >
                      {ZONES.map((z) => (
                        <option key={z.key} value={z.key}>
                          {z.t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <TextField
                    label={zone === "dakar" ? "Quartier ou commune" : "Ville"}
                    placeholder={zone === "dakar" ? "Sacré-Cœur 3" : "Thiès"}
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                  />
                  <TextField
                    label="Adresse ou point de repère"
                    icon={IconPin}
                    placeholder="Villa 42, en face de la pharmacie"
                    value={ligne}
                    onChange={(e) => setLigne(e.target.value)}
                  />
                </div>

                <TextField
                  label="Instructions pour le livreur"
                  optional
                  placeholder="Appeler en arrivant, portail bleu"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-4"
                />

                <button
                  type="submit"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose px-6 py-3.5 text-[13.5px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
                >
                  <IconCheck className="h-4 w-4" />
                  Enregistrer l&apos;adresse
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setFormulaireAdresse(true)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-dashed border-[#e0d3d9] px-6 py-3.5 text-[13.5px] font-semibold text-muted transition-colors duration-300 hover:border-rose hover:text-rose"
              >
                <IconPlus className="h-4 w-4" />
                Ajouter une adresse
              </button>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-[104px]">
          {/* ------------------------------------------- préférences */}
          <SectionCard
            title="Préférences"
            description="Les tailles suivies servent à vous signaler les bonnes nouveautés."
          >
            <span className="mb-3 block text-[12.5px] font-bold">Tailles de mes enfants</span>
            <div className="flex flex-wrap gap-2">
              {TAILLES.map((taille) => {
                const actif = account.preferences.sizes.includes(taille);
                return (
                  <button
                    key={taille}
                    type="button"
                    onClick={() => basculerTaille(taille)}
                    aria-pressed={actif}
                    className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-300 ${
                      actif
                        ? "bg-ink text-white"
                        : "border-[1.5px] border-[#e5d9de] bg-white hover:border-rose hover:text-rose"
                    }`}
                  >
                    {taille}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* ---------------------------------------------- sécurité */}
          <SectionCard title="Sécurité">
            <form onSubmit={envoyerMotDePasse} className="flex flex-col gap-4">
              <PasswordField
                label="Mot de passe actuel"
                icon={IconLock}
                value={motDePasseActuel}
                onChange={setMotDePasseActuel}
                autoComplete="current-password"
              />
              <PasswordField
                label="Nouveau mot de passe"
                icon={IconLock}
                value={motDePasseSuivant}
                onChange={setMotDePasseSuivant}
                autoComplete="new-password"
                hint="Au moins 8 caractères."
              />

              {messageMotDePasse && (
                <p
                  className={`text-[12.5px] font-semibold ${
                    messageMotDePasse.ok ? "text-[#3f8a5f]" : "text-rose-deep"
                  }`}
                >
                  {messageMotDePasse.texte}
                </p>
              )}

              <button
                type="submit"
                className="rounded-full border-[1.5px] border-[#e5d9de] px-6 py-3.5 text-[13.5px] font-semibold transition-colors duration-300 hover:border-rose hover:text-rose"
              >
                Modifier le mot de passe
              </button>
            </form>

            <div className="mt-6 border-t border-line pt-5">
              {confirmeSuppression ? (
                <div className="flex flex-col gap-3">
                  {/* Dire ce qui se passe vraiment : le compte porte l'historique
                      des commandes, il ne s'efface pas d'un clic. */}
                  <p className="rounded-2xl bg-rose-soft px-4 py-3 text-[12.5px] leading-relaxed text-rose-deep">
                    Votre compte porte l&apos;historique de vos commandes&nbsp;: il ne s&apos;efface
                    pas depuis cette page. Écrivez-nous et nous le supprimons, avec vos adresses,
                    sous quelques jours. En attendant, ce bouton ferme simplement votre session.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/#contact"
                      className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-rose-deep/30 px-5 py-3 text-[13.5px] font-bold text-rose-deep transition-colors duration-300 hover:bg-rose-soft"
                    >
                      <IconTrash className="h-4 w-4" />
                      Demander la suppression
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setSortie(true);
                        deleteAccount();
                        router.replace("/");
                      }}
                      className="rounded-full px-5 py-3 text-[13.5px] font-semibold text-muted transition-colors hover:text-ink"
                    >
                      Fermer ma session
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmeSuppression(false)}
                      className="rounded-full px-5 py-3 text-[13.5px] font-semibold text-muted transition-colors hover:text-ink"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmeSuppression(true)}
                  className="text-[13px] text-muted underline underline-offset-4 transition-colors hover:text-rose-deep"
                >
                  Supprimer mon compte
                </button>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
