"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatXOF } from "@/lib/format";
import { envoyer, type DevisApi } from "@/lib/api";
import {
  METHODS,
  ZONES,
  descriptionZone,
  fraisDeZone,
  francoDeZone,
  zoneIndex,
  type MethodKey,
} from "@/lib/livraison";
import { useAuth } from "./auth-context";
import { useCart } from "./cart-context";
import { useOrders } from "./orders-context";
import { useReglages } from "./reglages-context";
import { TextField } from "./form-kit";
import { IconCheck, IconLock, IconMail, IconPhone, IconPin, IconUser } from "./icons";

type Champ = "nom" | "tel" | "email" | "ville" | "repere";

export function Checkout({ startAt = 1 }: { startAt?: number }) {
  const router = useRouter();
  const { lignes, subtotal, complet, bump, remove, clear } = useCart();
  const { account, defaultAddress } = useAuth();
  const { placeOrder } = useOrders();
  const reglages = useReglages();

  const [step, setStep] = useState(startAt);
  const [zone, setZone] = useState(0);
  const [method, setMethod] = useState<MethodKey>("wave");

  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [ville, setVille] = useState("");
  const [repere, setRepere] = useState("");
  const [instructions, setInstructions] = useState("");

  const [touches, setTouches] = useState<Set<Champ>>(new Set());
  const [tente, setTente] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const [erreurCaisse, setErreurCaisse] = useState<string | null>(null);

  /* Le chiffrage vient de `/api/devis/`. Tant qu'il n'est pas revenu — premier
     rendu, changement de zone — on annonce l'estimation locale faite avec les
     réglages : la même règle, mais sans autorité. Le serveur tranche. */
  const [devis, setDevis] = useState<DevisApi | null>(null);

  /* Ce que le compte sait déjà remplit le formulaire, sans jamais écraser une
     saisie en cours : `(v) => v || …` ne pose la valeur que si le champ est
     encore vide. */
  useEffect(() => {
    if (!account) return;
    setNom((v) => v || account.name);
    setTel((v) => v || account.phone);
    setEmail((v) => v || account.email);

    if (defaultAddress) {
      setZone(zoneIndex(defaultAddress.zone));
      setVille((v) => v || defaultAddress.city);
      setRepere((v) => v || defaultAddress.address);
      setInstructions((v) => v || defaultAddress.notes);
    } else {
      setVille((v) => v || account.city);
    }
  }, [account, defaultAddress]);

  const z = ZONES[zone];

  /* Le paiement à la livraison ne vaut que pour Dakar : hors zone, on le retire
     et on repasse sur Wave plutôt que de laisser un choix impossible. */
  const codDisponible = z.key === "dakar";
  useEffect(() => {
    if (!codDisponible && method === "cod") setMethod("wave");
  }, [codDisponible, method]);

  /* L'estimation locale, le temps que le serveur réponde. Elle applique la
     même règle que `Reglages.frais_pour`, mais n'engage rien : aucune remise
     n'y figure, seul le serveur les connaît. */
  const estimation = useMemo<DevisApi>(() => {
    const frais = subtotal >= francoDeZone(reglages, z.key) ? 0 : fraisDeZone(reglages, z.key);
    return {
      sous_total: subtotal,
      frais_livraison: subtotal > 0 ? frais : 0,
      remise: 0,
      remise_libelle: "",
      total: Math.max(0, subtotal + (subtotal > 0 ? frais : 0)),
    };
  }, [reglages, subtotal, z.key]);

  const chiffrage = devis ?? estimation;
  const shipping = chiffrage.frais_livraison;
  const discount = chiffrage.remise;
  const total = chiffrage.total;

  /* Le panier envoyé à la caisse : une variante, une quantité. Jamais un prix. */
  const lignesDemandees = useMemo(
    () => lignes.map((l) => ({ variante: l.variante, quantite: l.quantite })),
    [lignes],
  );

  /**
   * Demande le chiffrage au serveur.
   *
   * Rejoué à chaque changement de panier ou de zone. Le nettoyage
   * écarte les réponses arrivées dans le désordre : sans lui, un vieux devis
   * pouvait recouvrir le bon et afficher les frais de la zone précédente.
   */
  useEffect(() => {
    if (lignesDemandees.length === 0) {
      setDevis(null);
      return;
    }
    let vivant = true;
    void (async () => {
      try {
        const reponse = await envoyer<DevisApi>("/api/devis/", "POST", {
          lignes: lignesDemandees,
          zone: z.key,
        });
        if (vivant) setDevis(reponse);
      } catch {
        /* Le serveur refusera de nouveau à la validation, avec son message.
           Ici on retombe sur l'estimation plutôt que d'effacer le total. */
        if (vivant) setDevis(null);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [lignesDemandees, z.key]);

  const erreurs = useMemo(() => {
    const liste: Partial<Record<Champ, string>> = {};
    if (nom.trim().length < 3) liste.nom = "Le nom qui figurera sur le colis.";
    if (!/^[0-9+\s().-]{9,}$/.test(tel.trim())) liste.tel = "Un numéro joignable, par exemple 77 123 45 67.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      liste.email = "Cette adresse ne semble pas valide.";
    if (ville.trim().length < 2) liste.ville = z.key === "dakar" ? "Quartier ou commune." : "Ville de livraison.";
    if (repere.trim().length < 5) liste.repere = "Un repère aide beaucoup le livreur.";
    return liste;
  }, [nom, tel, email, ville, repere, z.key]);

  /* Comme sur les pages compte : le message n'apparaît qu'une fois le champ
     quitté, ou dès qu'on a tenté de passer à la suite. */
  const toucher = (champ: Champ) => setTouches((s) => new Set(s).add(champ));
  const erreurDe = (champ: Champ) => (tente || touches.has(champ) ? erreurs[champ] : undefined);
  const valideDe = (champ: Champ) => (tente || touches.has(champ)) && !erreurs[champ];

  const valider = async () => {
    if (lignes.length === 0) return;

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setTente(true);
      if (Object.keys(erreurs).length > 0) return;
      setStep(3);
      return;
    }

    /* On peut atteindre le paiement en cliquant directement sur la puce « 3 » :
       la livraison est donc revérifiée ici, et on y renvoie s'il manque quelque
       chose. Sans ça, une commande partait avec un nom et une adresse vides. */
    setTente(true);
    if (Object.keys(erreurs).length > 0) {
      setStep(2);
      return;
    }

    /* La commande part au serveur : c'est lui qui refait les prix, retire le
       stock et numérote. Aucun montant n'est envoyé — les accepter reviendrait
       à laisser le navigateur fixer ses prix.

       En ligne, ce bouton lancera le paiement et c'est le webhook signé du
       prestataire qui validera — jamais ce retour-ci. */
    setEnvoi(true);
    setErreurCaisse(null);

    const resultat = await placeOrder({
      lignes: lignesDemandees,
      nom_client: nom.trim(),
      telephone: tel.trim(),
      email: email.trim(),
      zone: z.key,
      ville: ville.trim(),
      adresse: repere.trim(),
      notes: instructions.trim(),
      moyen_paiement: method,
    });

    if (!resultat.ok || !resultat.order) {
      /* Rupture pendant la saisie, caisse fermée : le
         panier est laissé intact et le refus est dit tel que le serveur l'a
         formulé. Le vider ici ferait perdre la sélection pour rien. */
      setEnvoi(false);
      setErreurCaisse(resultat.error ?? "La commande n'a pas pu être enregistrée.");
      return;
    }

    await clear();
    router.push(`/commandes/${resultat.order.ref}?nouvelle=1`);
  };

  /* Les congés se déclarent dans le back-office : la boutique reste
     consultable, la caisse seule ferme. */
  const caisseFermee = !reglages.accepte_commandes;

  const cta = caisseFermee
    ? "Commandes suspendues"
    : ["Passer à la livraison", "Passer au paiement", `Payer ${formatXOF(total)}`][step - 1];

  if (envoi) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-32 text-center md:px-10">
        <span className="mx-auto grid h-14 w-14 animate-pulse place-items-center rounded-full bg-rose-soft">
          <IconCheck className="h-6 w-6 text-rose" />
        </span>
        <p className="mt-5 text-[15px] font-semibold">Enregistrement de votre commande…</p>
        <p className="mt-1.5 text-[13px] text-muted">
          Le serveur revérifie les prix et le stock avant de la retenir.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-22 pt-8 md:px-8 lg:px-10">
      <div className="mb-7 flex flex-wrap items-center gap-3.5">
        {[
          { t: "Panier", i: 1 },
          { t: "Livraison", i: 2 },
          { t: "Paiement", i: 3 },
        ].map((s, idx, arr) => (
          <div key={s.i} className="flex items-center gap-3.5">
            <button
              onClick={() => setStep(s.i)}
              className={`flex items-center gap-2.5 text-[13.5px] font-bold ${step >= s.i ? "" : "text-[#9c8d93]"}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  step >= s.i ? "bg-rose text-white" : "bg-line text-[#9c8d93]"
                }`}
              >
                {s.i}
              </span>
              {s.t}
            </button>
            {idx < arr.length - 1 && <span className="h-px w-8 bg-[#e5d9de]" />}
          </div>
        ))}
      </div>

      <div className="grid items-start gap-9 lg:grid-cols-[1fr_380px]">
        <div>
          {/* ============================================================ panier */}
          {step === 1 && (
            <>
              <h1 className="text-[clamp(1.9rem,4.4vw,2.15rem)] font-extrabold tracking-[-.03em]">
                Votre panier
              </h1>
              <p className="mb-6 mt-1.5 text-sm text-muted">Commande possible sans créer de compte.</p>

              {lignes.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#e5d9de] p-14 text-center">
                  <div className="text-base font-bold">Votre panier est vide</div>
                  <p className="mt-2 text-sm text-muted">Tout est en français, y compris les états vides.</p>
                  <Link
                    href="/boutique"
                    className="mt-5 inline-block rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-white"
                  >
                    Voir le catalogue
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {lignes.map((l) => (
                    <div
                      key={l.id}
                      className="flex gap-4.5 rounded-[20px] border border-line p-4"
                    >
                      <div
                        className="h-28 w-23 shrink-0 rounded-2xl bg-stone bg-cover bg-center"
                        style={{ backgroundImage: `url(${l.image})` }}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between gap-4">
                          <div>
                            <div className="text-[15px] font-bold">{l.nom}</div>
                            <div className="mt-1 text-[13px] text-muted">{l.option}</div>
                            {/* Une ligne devenue inservable se signale plutôt que
                                de disparaître : la caisse la refuserait sans dire pourquoi. */}
                            {!l.disponible && (
                              <div className="mt-1.5 text-[12.5px] font-semibold text-rose-deep">
                                {l.stock_restant > 0
                                  ? `Il n'en reste que ${l.stock_restant}`
                                  : "Épuisé pour le moment"}
                              </div>
                            )}
                          </div>
                          <button onClick={() => remove(l.id)} className="text-[13px] text-[#9c8d93]">
                            Retirer
                          </button>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="flex items-center gap-4 rounded-full border-[1.5px] border-[#e5d9de] px-3.5 py-1.5 text-sm font-semibold">
                            <button onClick={() => bump(l.id, -1)} aria-label="Retirer un">−</button>
                            <span className="tabular-nums">{l.quantite}</span>
                            <button onClick={() => bump(l.id, 1)} aria-label="Ajouter un">+</button>
                          </span>
                          <span className="text-base font-extrabold">{formatXOF(l.sous_total)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ========================================================= livraison */}
          {step === 2 && (
            <>
              <h1 className="text-[clamp(1.9rem,4.4vw,2.15rem)] font-extrabold tracking-[-.03em]">
                Livraison
              </h1>
              <p className="mb-6 mt-1.5 text-sm text-muted">
                L&apos;adressage se fait au quartier et au point de repère, pas au numéro de rue.
              </p>

              {!account && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mist px-5 py-4">
                  <p className="text-[13px] leading-relaxed text-muted">
                    Vous avez un compte ? Vos coordonnées et votre adresse se remplissent seules.
                  </p>
                  <Link
                    href="/compte/connexion?suite=/commande"
                    className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-white transition-transform duration-400 ease-soft hover:-translate-y-0.5"
                  >
                    Se connecter
                  </Link>
                </div>
              )}

              {account && defaultAddress && (
                <div className="mb-6 rounded-2xl bg-rose-soft px-5 py-4 text-[13px] leading-relaxed text-[#8a2f5d]">
                  Rempli depuis «&nbsp;{defaultAddress.label}&nbsp;», votre adresse par défaut.{" "}
                  <Link href="/compte/profil" className="font-bold underline underline-offset-2">
                    Changer d&apos;adresse
                  </Link>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Nom complet"
                  icon={IconUser}
                  placeholder="Aminata Fall"
                  autoComplete="name"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  onBlur={() => toucher("nom")}
                  error={erreurDe("nom")}
                  valid={valideDe("nom")}
                />
                <TextField
                  label="Téléphone"
                  icon={IconPhone}
                  inputMode="tel"
                  placeholder="77 123 45 67"
                  autoComplete="tel"
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  onBlur={() => toucher("tel")}
                  error={erreurDe("tel")}
                  valid={valideDe("tel")}
                />
                <TextField
                  label="Adresse e-mail"
                  icon={IconMail}
                  optional
                  type="email"
                  placeholder="aminata@exemple.sn"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => toucher("email")}
                  error={erreurDe("email")}
                  hint="Pour recevoir le récapitulatif."
                  className="sm:col-span-2"
                />
                <TextField
                  label={z.key === "dakar" ? "Quartier ou commune" : "Ville"}
                  icon={IconPin}
                  placeholder={z.key === "dakar" ? "Sacré-Cœur 3" : "Thiès"}
                  autoComplete="address-level2"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  onBlur={() => toucher("ville")}
                  error={erreurDe("ville")}
                  valid={valideDe("ville")}
                />
                <TextField
                  label="Point de repère"
                  placeholder="En face de la pharmacie Mermoz"
                  value={repere}
                  onChange={(e) => setRepere(e.target.value)}
                  onBlur={() => toucher("repere")}
                  error={erreurDe("repere")}
                  valid={valideDe("repere")}
                />
                <TextField
                  label="Instructions pour le livreur"
                  optional
                  placeholder="Appeler en arrivant, portail bleu"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="sm:col-span-2"
                />
              </div>

              <div className="mt-6.5">
                <div className="mb-2.5 text-[12.5px] font-bold">Zone de livraison</div>
                <div className="flex flex-wrap gap-2.5">
                  {ZONES.map((zz, i) => (
                    <button
                      key={zz.key}
                      onClick={() => setZone(i)}
                      className={`flex flex-col gap-1 rounded-2xl border-[1.5px] px-4.5 py-3.5 text-left transition-colors ${
                        zone === i ? "border-rose bg-rose-soft" : "border-[#ece3e7] bg-white"
                      }`}
                    >
                      <span className="text-sm font-bold">{zz.t}</span>
                      <span className="text-[12.5px] text-muted">
                        {descriptionZone(reglages, zz.key)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ========================================================== paiement */}
          {step === 3 && (
            <>
              <h1 className="text-[clamp(1.9rem,4.4vw,2.15rem)] font-extrabold tracking-[-.03em]">
                Paiement
              </h1>
              <p className="mb-6 mt-1.5 text-sm text-muted">
                La commande n&apos;est validée qu&apos;à réception du webhook signé du prestataire.
              </p>

              <div className="flex flex-col gap-3">
                {METHODS.map((m) => {
                  const indisponible = m.k === "cod" && !codDisponible;
                  return (
                    <button
                      key={m.k}
                      disabled={indisponible}
                      onClick={() => setMethod(m.k)}
                      className={`flex items-center gap-4 rounded-[18px] border-[1.5px] px-5 py-4.5 text-left transition-colors ${
                        indisponible
                          ? "cursor-not-allowed border-[#f2eaee] bg-white opacity-45"
                          : method === m.k
                            ? "border-rose bg-rose-soft"
                            : "border-[#ece3e7] bg-white"
                      }`}
                    >
                      <span
                        className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                          method === m.k
                            ? "border-rose bg-rose shadow-[inset_0_0_0_3px_#fff]"
                            : "border-[#d8cbd1] bg-white"
                        }`}
                      />
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold"
                        style={{ background: m.chip, color: m.fg }}
                      >
                        {m.i}
                      </span>
                      <span className="flex-1">
                        <span className="block text-[15px] font-bold">{m.t}</span>
                        <span className="mt-0.5 block text-[13px] text-muted">
                          {indisponible ? "Disponible sur Dakar et banlieue uniquement" : m.s}
                        </span>
                      </span>
                      <span className="text-[12.5px] font-semibold text-[#9c8d93]">{m.fee}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl bg-gold-soft px-5 py-4 text-[13px] leading-relaxed text-[#5c4a2a]">
                Trois règles côté serveur : jamais de validation sur le retour navigateur, signature
                du webhook vérifiée, identifiant de transaction en clé unique pour absorber les
                doublons.
              </div>

              <p className="mt-4 flex gap-2.5 rounded-2xl bg-mist px-5 py-4 text-[12.5px] leading-relaxed text-muted">
                <IconLock className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
                Aucun paiement n&apos;est encore déclenché : la commande part à la boutique, qui
                vous rappelle pour la confirmer. Le stock est réservé dès maintenant.
              </p>
            </>
          )}
        </div>

        {/* ===================================================== récapitulatif */}
        <aside className="rounded-3xl border border-line bg-white p-6.5 lg:sticky lg:top-30">
          <div className="text-base font-extrabold tracking-tight">Récapitulatif</div>

          <div className="mt-4.5 flex flex-col gap-3 text-sm">
            <div className="flex justify-between text-[#6b5a61]">
              <span>Sous-total</span>
              <span className="tabular-nums">{formatXOF(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#6b5a61]">
              <span>Livraison {z.short}</span>
              <span>{shipping === 0 ? "Offerte" : formatXOF(shipping)}</span>
            </div>
            {/* Pas de code à saisir : une remise ne vient que d'une campagne
                que le serveur applique de lui-même. */}
            {discount > 0 && (
              <div className="flex justify-between text-[#2e7d52]">
                <span>{chiffrage.remise_libelle || "Remise"}</span>
                <span className="tabular-nums">−{formatXOF(discount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-line pt-3.5 text-xl font-extrabold">
              <span>Total</span>
              <span className="tabular-nums">{formatXOF(total)}</span>
            </div>
          </div>

          <button
            onClick={() => void valider()}
            disabled={lignes.length === 0 || !complet || caisseFermee}
            className="mt-5 w-full rounded-full bg-rose py-4 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(224,65,127,.65)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
          >
            {cta}
          </button>

          {/* Un bouton grisé sans explication laisse croire à une panne : on dit
              pourquoi il ne part pas. */}
          {caisseFermee ? (
            <p className="mt-3 text-center text-[12.5px] font-semibold text-rose-deep">
              La boutique ne prend pas de commande en ce moment. Votre panier vous attend.
            </p>
          ) : erreurCaisse ? (
            <p className="mt-3 text-center text-[12.5px] font-semibold text-rose-deep">
              {erreurCaisse}
            </p>
          ) : lignes.length === 0 ? (
            <p className="mt-3 text-center text-[12.5px] font-semibold text-rose-deep">
              Votre panier est vide, il n&apos;y a rien à commander.{" "}
              <Link href="/boutique" className="underline underline-offset-2">
                Voir la sélection
              </Link>
            </p>
          ) : !complet ? (
            <p className="mt-3 text-center text-[12.5px] font-semibold text-rose-deep">
              Un article de votre panier n&apos;est plus servable. Ajustez la quantité ou
              retirez-le pour continuer.
            </p>
          ) : (
            tente &&
            Object.keys(erreurs).length > 0 && (
              <p className="mt-3 text-center text-[12.5px] font-semibold text-rose-deep">
                Il manque {Object.keys(erreurs).length} information
                {Object.keys(erreurs).length > 1 ? "s" : ""} à l&apos;étape Livraison.
              </p>
            )
          )}

          <p className="mt-3 text-center text-[12.5px] text-muted">
            Prix figés à la commande — une hausse ultérieure ne réécrit pas la facture.
          </p>
        </aside>
      </div>
    </div>
  );
}
