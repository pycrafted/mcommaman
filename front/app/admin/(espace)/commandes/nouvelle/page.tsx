"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErreurApi, envoyer, type Page } from "@/lib/api";
import { formatXOF } from "@/lib/format";
import { useAdmin } from "@/lib/admin/store";
import { lireProduits } from "@/lib/admin/produits";
import type { AdminProduct } from "@/lib/admin/types";
import {
  Button,
  CARTE,
  Field,
  Input,
  OptionPills,
  PageHeader,
  SearchField,
  Textarea,
} from "@/components/admin/ui";
import { IconArrowLeft, IconCheck, IconPlus, IconTrash } from "@/components/admin/icons";

/*
 * La saisie d'une vente conclue hors du site — sur WhatsApp, au téléphone, à
 * la boutique.
 *
 * Le navigateur ne calcule aucun montant : le récapitulatif vient de
 * `/api/gestion/commandes/devis/`, et l'enregistrement refait tout sur le
 * serveur, stock retiré compris, exactement comme une commande du site.
 */

type Zone = "dakar" | "thies" | "regions" | "retrait";
type Moyen = "cod" | "wave" | "om" | "esp";

const ZONES: { value: Zone; label: string }[] = [
  { value: "dakar", label: "Dakar et banlieue" },
  { value: "thies", label: "Thiès, Mbour" },
  { value: "regions", label: "Autres régions" },
  { value: "retrait", label: "Retrait en boutique" },
];

const MOYENS: { value: Moyen; label: string }[] = [
  { value: "cod", label: "À la livraison" },
  { value: "wave", label: "Wave" },
  { value: "om", label: "Orange Money" },
  { value: "esp", label: "Espèces en boutique" },
];

/** Les moyens possibles pour une zone — la même règle que le serveur. */
const moyensPour = (zone: Zone): Moyen[] =>
  zone === "retrait" ? ["esp", "wave", "om"] : zone === "dakar" ? ["cod", "wave", "om"] : ["wave", "om"];

type VarianteApi = {
  id: number;
  taille_valeur: string;
  coloris_nom: string;
  stock: number;
};

type Ligne = {
  variante: number;
  produit: string;
  option: string;
  image: string;
  stock: number;
  quantite: number;
};

type Devis = {
  sous_total: number;
  frais_livraison: number;
  remise: number;
  total: number;
  cliente_nom: string;
};

const option = (v: VarianteApi) =>
  [v.taille_valeur && `Taille ${v.taille_valeur}`, v.coloris_nom].filter(Boolean).join(" · ");

export default function Page() {
  const router = useRouter();
  const { rafraichir, notify } = useAdmin();

  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [zone, setZone] = useState<Zone>("dakar");
  const [ville, setVille] = useState("");
  const [adresse, setAdresse] = useState("");
  const [notes, setNotes] = useState("");
  const [moyen, setMoyen] = useState<Moyen>("cod");
  const [remise, setRemise] = useState("");
  const [devis, setDevis] = useState<Devis | null>(null);
  const [refusDevis, setRefusDevis] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  /* ------------------------------------------------ recherche d'articles */
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<AdminProduct[]>([]);
  const [choisi, setChoisi] = useState<AdminProduct | null>(null);
  const [variantes, setVariantes] = useState<VarianteApi[] | null>(null);

  useEffect(() => {
    const terme = recherche.trim();
    if (!terme) {
      setTrouves([]);
      return;
    }
    let vivant = true;
    const minuteur = window.setTimeout(() => {
      lireProduits({ q: terme, statut: "publie", taille: 6 })
        .then((r) => vivant && setTrouves(r.produits))
        .catch(() => undefined);
    }, 250);
    return () => {
      vivant = false;
      window.clearTimeout(minuteur);
    };
  }, [recherche]);

  useEffect(() => {
    if (!choisi) {
      setVariantes(null);
      return;
    }
    let vivant = true;
    setVariantes(null);
    envoyer<Page<VarianteApi> | VarianteApi[]>(
      `/api/gestion/variantes/?produit=${choisi.id}&page_size=100`,
    )
      .then((r) => vivant && setVariantes(Array.isArray(r) ? r : r.results))
      .catch(() => vivant && setVariantes([]));
    return () => {
      vivant = false;
    };
  }, [choisi]);

  const ajouter = (v: VarianteApi) => {
    if (!choisi) return;
    setLignes((courantes) => {
      const deja = courantes.find((l) => l.variante === v.id);
      if (deja) {
        return courantes.map((l) =>
          l.variante === v.id ? { ...l, quantite: Math.min(l.quantite + 1, l.stock) } : l,
        );
      }
      return [
        ...courantes,
        {
          variante: v.id,
          produit: choisi.name,
          option: option(v),
          image: choisi.image,
          stock: v.stock,
          quantite: 1,
        },
      ];
    });
  };

  const changerQuantite = (variante: number, quantite: number) =>
    setLignes((courantes) =>
      courantes.map((l) =>
        l.variante === variante ? { ...l, quantite: Math.max(1, Math.min(quantite, l.stock)) } : l,
      ),
    );

  /* Un moyen qui ne vaut pas pour la zone choisie est remplacé. */
  useEffect(() => {
    if (!moyensPour(zone).includes(moyen)) setMoyen(moyensPour(zone)[0]);
  }, [zone, moyen]);

  const remiseNombre = Math.max(0, Number.parseInt(remise.replace(/\D/g, ""), 10) || 0);
  const demandees = useMemo(
    () => lignes.map((l) => ({ variante: l.variante, quantite: l.quantite })),
    [lignes],
  );

  /* -------------------------------------------------- le devis du serveur */
  useEffect(() => {
    if (demandees.length === 0) {
      setDevis(null);
      setRefusDevis("");
      return;
    }
    let vivant = true;
    const minuteur = window.setTimeout(() => {
      envoyer<Devis>("/api/gestion/commandes/devis/", "POST", {
        lignes: demandees,
        zone,
        telephone,
        remise: remiseNombre,
      })
        .then((d) => {
          if (!vivant) return;
          setDevis(d);
          setRefusDevis("");
        })
        .catch((e: unknown) => {
          if (!vivant) return;
          setDevis(null);
          setRefusDevis(e instanceof ErreurApi ? e.message : "Chiffrage impossible pour le moment.");
        });
    }, 300);
    return () => {
      vivant = false;
      window.clearTimeout(minuteur);
    };
  }, [demandees, zone, telephone, remiseNombre]);

  const livraison = zone !== "retrait";
  const manques = [
    lignes.length === 0 && "au moins un article",
    nom.trim().length < 2 && "le nom de la cliente",
    telephone.replace(/\D/g, "").length < 9 && "son téléphone",
    livraison && !ville.trim() && "le quartier ou la ville",
    livraison && !adresse.trim() && "un point de repère",
  ].filter(Boolean) as string[];

  const enregistrer = async () => {
    if (manques.length > 0 || envoi) return;
    setEnvoi(true);
    setErreur("");
    try {
      const commande = await envoyer<{ reference: string }>("/api/gestion/commandes/", "POST", {
        lignes: demandees,
        nom_client: nom.trim(),
        telephone: telephone.trim(),
        email: email.trim(),
        zone,
        ville: livraison ? ville.trim() : "",
        adresse: livraison ? adresse.trim() : "",
        notes: notes.trim(),
        moyen_paiement: moyen,
        remise: remiseNombre,
      });
      await rafraichir();
      notify("success", `Commande ${commande.reference} enregistrée, stock mis à jour.`);
      router.push(`/admin/commandes#${commande.reference}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.");
      setEnvoi(false);
    }
  };

  const titreBloc = "mb-4 text-[11px] font-bold uppercase tracking-[.14em] text-muted";

  return (
    <>
      <Link
        href="/admin/commandes"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        Commandes
      </Link>
      <PageHeader
        eyebrow="Logistique"
        title="Nouvelle commande"
        sub="Une vente conclue sur WhatsApp, au téléphone ou à la boutique."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          {/* ------------------------------------------------------ articles */}
          <section className={`${CARTE} p-5 sm:p-6`}>
            <h2 className={titreBloc}>Articles</h2>

            <SearchField
              value={recherche}
              onChange={(v) => {
                setRecherche(v);
                setChoisi(null);
              }}
              placeholder="Chercher un produit par nom ou référence…"
            />

            {!choisi && trouves.length > 0 && (
              <ul className="mt-2 flex flex-col overflow-hidden rounded-xl border border-line">
                {trouves.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setChoisi(p)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-mist"
                    >
                      <span
                        className="h-10 w-8 shrink-0 rounded-md bg-stone bg-cover bg-center"
                        style={{ backgroundImage: p.image ? `url(${p.image})` : undefined }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold">{p.name}</span>
                        <span className="block text-[12px] text-muted">
                          {p.category} · {p.stock} en stock
                        </span>
                      </span>
                      <span className="text-[13px] font-bold tabular-nums">{formatXOF(p.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {choisi && (
              <div className="mt-3 rounded-xl bg-mist p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-bold">{choisi.name}</span>
                  <button
                    type="button"
                    onClick={() => setChoisi(null)}
                    className="text-[12px] font-semibold text-muted hover:text-ink"
                  >
                    Changer
                  </button>
                </div>
                {variantes === null ? (
                  <p className="mt-2 text-[12.5px] text-muted">Lecture des options…</p>
                ) : variantes.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">Ce produit n&apos;a aucune option en vente.</p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {variantes.map((v) => {
                      const dans = lignes.find((l) => l.variante === v.id)?.quantite ?? 0;
                      const epuisee = v.stock - dans <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={epuisee}
                          onClick={() => ajouter(v)}
                          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold transition-colors hover:border-rose hover:text-rose disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <IconPlus className="h-3.5 w-3.5" />
                          {option(v) || "Article"}
                          <span className="font-normal text-muted">· {v.stock} en stock</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {lignes.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {lignes.map((l) => (
                  <li key={l.variante} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                    <span
                      className="h-11 w-9 shrink-0 rounded-md bg-stone bg-cover bg-center"
                      style={{ backgroundImage: l.image ? `url(${l.image})` : undefined }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold">{l.produit}</span>
                      <span className="block text-[12px] text-muted">{l.option}</span>
                    </span>
                    <span className="flex items-center rounded-full border border-line">
                      <button
                        type="button"
                        onClick={() => changerQuantite(l.variante, l.quantite - 1)}
                        disabled={l.quantite <= 1}
                        aria-label="Retirer un"
                        className="grid h-8 w-8 place-items-center text-[15px] disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-[13px] font-bold tabular-nums">{l.quantite}</span>
                      <button
                        type="button"
                        onClick={() => changerQuantite(l.variante, l.quantite + 1)}
                        disabled={l.quantite >= l.stock}
                        aria-label="Ajouter un"
                        title={l.quantite >= l.stock ? "Tout le stock est dans la commande" : undefined}
                        className="grid h-8 w-8 place-items-center text-[15px] disabled:opacity-30"
                      >
                        +
                      </button>
                    </span>
                    <button
                      type="button"
                      onClick={() => setLignes((c) => c.filter((x) => x.variante !== l.variante))}
                      aria-label={`Retirer ${l.produit}`}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-rose-soft hover:text-rose-deep"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------------- cliente */}
          <section className={`${CARTE} p-5 sm:p-6`}>
            <h2 className={titreBloc}>Cliente</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom complet">
                <Input value={nom} onChange={setNom} placeholder="Awa Ndiaye" />
              </Field>
              <Field label="Téléphone">
                <Input value={telephone} onChange={setTelephone} placeholder="77 123 45 67" inputMode="tel" />
              </Field>
              <Field label="Adresse e-mail (facultatif)" className="sm:col-span-2">
                <Input value={email} onChange={setEmail} type="email" placeholder="awa@exemple.sn" />
              </Field>
            </div>
            {devis?.cliente_nom && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#eaf6ef] px-3 py-1.5 text-[12px] font-semibold text-[#256b46]">
                <IconCheck className="h-3.5 w-3.5" />
                Compte trouvé : {devis.cliente_nom} — la commande y sera rattachée.
              </p>
            )}
          </section>

          {/* ------------------------------------------------------ livraison */}
          <section className={`${CARTE} flex flex-col gap-4 p-5 sm:p-6`}>
            <h2 className={`${titreBloc} mb-0`}>Livraison et paiement</h2>
            <OptionPills<Zone> label="Zone" value={zone} onChange={setZone} options={ZONES} />
            {livraison && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Quartier ou ville">
                  <Input value={ville} onChange={setVille} placeholder="Sacré-Cœur 3" />
                </Field>
                <Field label="Point de repère">
                  <Input value={adresse} onChange={setAdresse} placeholder="En face de la pharmacie" />
                </Field>
              </div>
            )}
            <OptionPills<Moyen>
              label="Paiement"
              value={moyen}
              onChange={setMoyen}
              options={MOYENS.filter((m) => moyensPour(zone).includes(m.value))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Remise accordée (F, facultatif)">
                <Input value={remise} onChange={setRemise} inputMode="numeric" placeholder="0" />
              </Field>
            </div>
            <Field label="Note (facultatif)">
              <Textarea
                value={notes}
                onChange={setNotes}
                rows={2}
                placeholder="Vendue sur WhatsApp, appeler avant de passer…"
              />
            </Field>
          </section>
        </div>

        {/* ------------------------------------------------------ récapitulatif */}
        <aside className={`${CARTE} p-5 sm:p-6 lg:sticky lg:top-6`}>
          <h2 className={titreBloc}>Récapitulatif</h2>
          {lignes.length === 0 ? (
            <p className="text-[13px] text-muted">Ajoutez un article pour chiffrer la commande.</p>
          ) : devis ? (
            <dl className="flex flex-col gap-2 text-[13.5px]">
              <div className="flex justify-between text-muted">
                <dt>Articles</dt>
                <dd className="tabular-nums">{formatXOF(devis.sous_total)}</dd>
              </div>
              <div className="flex justify-between text-muted">
                <dt>Livraison</dt>
                <dd className="tabular-nums">
                  {devis.frais_livraison === 0 ? "Offerte" : formatXOF(devis.frais_livraison)}
                </dd>
              </div>
              {devis.remise > 0 && (
                <div className="flex justify-between text-[#2e7d52]">
                  <dt>Remise</dt>
                  <dd className="tabular-nums">−{formatXOF(devis.remise)}</dd>
                </div>
              )}
              <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-bold">Total</dt>
                <dd className="text-[20px] font-extrabold tabular-nums">{formatXOF(devis.total)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-[13px] text-muted">{refusDevis || "Chiffrage…"}</p>
          )}

          <Button
            variant="rose"
            className="mt-5 w-full"
            disabled={manques.length > 0 || envoi || !devis}
            onClick={() => void enregistrer()}
          >
            <IconCheck />
            {envoi ? "Enregistrement…" : "Enregistrer la commande"}
          </Button>

          {manques.length > 0 && (
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Il manque {manques.join(", ")}.
            </p>
          )}
          {erreur && (
            <p className="mt-3 rounded-xl bg-rose-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-deep">
              {erreur}
            </p>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            À l&apos;enregistrement, le stock est retiré et la commande suit ensuite les mêmes
            étapes qu&apos;une commande du site.
          </p>
        </aside>
      </div>
    </>
  );
}
