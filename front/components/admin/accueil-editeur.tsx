"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { envoyer } from "@/lib/api";
import { formatXOF } from "@/lib/format";
import { useAdmin } from "@/lib/admin/store";
import { lireProduits } from "@/lib/admin/produits";
import type { AdminProduct } from "@/lib/admin/types";
import {
  Button,
  Field,
  Input,
  Modal,
  SearchField,
  Section,
  Textarea,
  Toggle,
} from "./ui";
import { IconArrowLeft, IconArrowRight, IconCheck, IconPlus, IconTrash, IconX } from "./icons";

/*
 * Le bandeau de la page d'accueil, réglé ici de bout en bout :
 *
 * — les textes (`Reglages.hero_*`), enregistrés d'un bouton ;
 * — les photos de l'arche (`/api/gestion/bandeau/`), une ligne par photo ;
 * — les pièces qui défilent dans la carte posée sur la photo
 *   (`Reglages.hero_produits`). Sans choix, ce sont les nouveautés.
 *
 * Tout passe par le serveur : rien n'est gardé dans ce navigateur.
 */

type Textes = {
  hero_pastille: string;
  hero_titre: string;
  hero_accent: string;
  hero_chapo: string;
  hero_sceau: string;
  hero_sceau_centre: string;
  hero_sceau_legende: string;
};

type ReglagesAccueil = Textes & { hero_produits: number[] };

type Photo = {
  id: number;
  url: string;
  texte_alternatif: string;
  cadrage: string;
  etiquette: string;
  active: boolean;
  ordre: number;
};

const CHAMPS: { cle: keyof Textes; label: string; long?: boolean; max: number }[] = [
  { cle: "hero_pastille", label: "Pastille", max: 60 },
  { cle: "hero_titre", label: "Titre (un retour à la ligne pour le couper)", long: true, max: 120 },
  { cle: "hero_accent", label: "Fin du titre, en couleur", max: 60 },
  { cle: "hero_chapo", label: "Texte d'introduction", long: true, max: 240 },
  { cle: "hero_sceau", label: "Texte du macaron", max: 60 },
  { cle: "hero_sceau_centre", label: "Centre du macaron", max: 12 },
  { cle: "hero_sceau_legende", label: "Sous le centre", max: 20 },
];

const PRODUITS_MAX = 12;

const message = (e: unknown, repli: string) => (e instanceof Error ? e.message : repli);

export function AccueilEditeur() {
  const { televerserMedia, notify } = useAdmin();
  /* `notify` change à chaque rendu du back-office : lu par une référence, il ne
     relance pas la lecture initiale. */
  const notifier = useRef(notify);
  notifier.current = notify;

  /* ------------------------------------------------------------ lecture */
  const [pret, setPret] = useState(false);
  const [textes, setTextes] = useState<Textes | null>(null);
  const [brouillon, setBrouillon] = useState<Textes | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [vedettes, setVedettes] = useState<AdminProduct[]>([]);

  const relire = useCallback(async () => {
    const [reglages, bandeau] = await Promise.all([
      envoyer<ReglagesAccueil>("/api/gestion/reglages/"),
      envoyer<Photo[]>("/api/gestion/bandeau/"),
    ]);
    const { hero_produits: ids, ...lus } = reglages;
    setTextes(lus);
    setBrouillon((b) => b ?? lus);
    setPhotos([...bandeau].sort((a, b) => a.ordre - b.ordre || a.id - b.id));
    if (ids.length === 0) {
      setVedettes([]);
    } else {
      const { produits } = await lireProduits({ ids, taille: PRODUITS_MAX });
      setVedettes(ids.map((id) => produits.find((p) => p.id === String(id))).filter(Boolean) as AdminProduct[]);
    }
  }, []);

  useEffect(() => {
    relire()
      .catch((e) => notifier.current("error", message(e, "Lecture du bandeau impossible.")))
      .finally(() => setPret(true));
  }, [relire]);

  /* ------------------------------------------------------------- textes */
  const [envoiTextes, setEnvoiTextes] = useState(false);
  const modifies = Boolean(
    textes && brouillon && CHAMPS.some(({ cle }) => textes[cle] !== brouillon[cle]),
  );

  const enregistrerTextes = async () => {
    if (!brouillon) return;
    setEnvoiTextes(true);
    try {
      const lus = await envoyer<ReglagesAccueil>("/api/gestion/reglages/", "PATCH", brouillon);
      const { hero_produits: _ids, ...propres } = lus;
      setTextes(propres);
      setBrouillon(propres);
      notify("success", "Textes de l'accueil enregistrés.");
    } catch (e) {
      notify("error", message(e, "L'enregistrement a échoué."));
    } finally {
      setEnvoiTextes(false);
    }
  };

  /* ------------------------------------------------------------- photos */
  const fichierRef = useRef<HTMLInputElement>(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [aRetirer, setARetirer] = useState<Photo | null>(null);

  const ecrirePhoto = async (id: number, patch: Partial<Photo>) => {
    setPhotos((liste) => liste.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    try {
      await envoyer(`/api/gestion/bandeau/${id}/`, "PATCH", patch);
    } catch (e) {
      notify("error", message(e, "La photo n'a pas pu être modifiée."));
      void relire();
    }
  };

  const importer = async (fichiers: FileList | null) => {
    const fichier = fichiers?.[0];
    if (fichierRef.current) fichierRef.current.value = "";
    if (!fichier) return;
    setEnvoiPhoto(true);
    try {
      const media = await televerserMedia(fichier, `accueil-${Date.now()}`);
      if (!media) throw new Error("L'envoi de l'image a échoué.");
      await envoyer("/api/gestion/bandeau/", "POST", {
        media: Number(media.id),
        texte_alternatif: fichier.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        cadrage: "50% 40%",
        etiquette: "",
        active: true,
        ordre: (photos.at(-1)?.ordre ?? -1) + 1,
      });
      await relire();
      notify("success", "Photo ajoutée au bandeau.");
    } catch (e) {
      notify("error", message(e, "L'ajout de la photo a échoué."));
    } finally {
      setEnvoiPhoto(false);
    }
  };

  /* Deux photos échangent leur place : on réécrit l'ordre de toute la liste,
     plus simple que de gérer les ex æquo. */
  const deplacer = async (index: number, sens: -1 | 1) => {
    const cible = index + sens;
    if (cible < 0 || cible >= photos.length) return;
    const liste = [...photos];
    [liste[index], liste[cible]] = [liste[cible], liste[index]];
    const renumerotee = liste.map((p, i) => ({ ...p, ordre: i }));
    setPhotos(renumerotee);
    try {
      await Promise.all(
        renumerotee
          .filter((p, i) => photos[i]?.id !== p.id)
          .map((p) => envoyer(`/api/gestion/bandeau/${p.id}/`, "PATCH", { ordre: p.ordre })),
      );
    } catch (e) {
      notify("error", message(e, "L'ordre n'a pas pu être enregistré."));
      void relire();
    }
  };

  const retirer = async (photo: Photo) => {
    setARetirer(null);
    try {
      await envoyer(`/api/gestion/bandeau/${photo.id}/`, "DELETE");
      setPhotos((liste) => liste.filter((p) => p.id !== photo.id));
      notify("success", "Photo retirée du bandeau.");
    } catch (e) {
      notify("error", message(e, "La photo n'a pas pu être retirée."));
    }
  };

  /* ----------------------------------------------------------- vedettes */
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<AdminProduct[]>([]);

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

  const ecrireVedettes = async (liste: AdminProduct[]) => {
    const avant = vedettes;
    setVedettes(liste);
    try {
      await envoyer("/api/gestion/reglages/", "PATCH", {
        hero_produits: liste.map((p) => Number(p.id)),
      });
    } catch (e) {
      setVedettes(avant);
      notify("error", message(e, "La sélection n'a pas pu être enregistrée."));
    }
  };

  if (!pret || !brouillon) {
    return (
      <Section title="Accueil">
        <p className="text-[13px] text-muted">Lecture du bandeau d&apos;accueil…</p>
      </Section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------ textes */}
      <Section
        title="Textes de l'accueil"
        action={
          <Button
            size="sm"
            variant="rose"
            disabled={!modifies || envoiTextes}
            onClick={() => void enregistrerTextes()}
          >
            <IconCheck />
            {envoiTextes ? "Enregistrement…" : "Enregistrer"}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {CHAMPS.map(({ cle, label, long, max }) => (
            <Field key={cle} label={label} className={long ? "md:col-span-2" : ""}>
              {long ? (
                <Textarea
                  rows={2}
                  maxLength={max}
                  value={brouillon[cle]}
                  onChange={(v) => setBrouillon({ ...brouillon, [cle]: v })}
                />
              ) : (
                <Input
                  maxLength={max}
                  value={brouillon[cle]}
                  onChange={(v) => setBrouillon({ ...brouillon, [cle]: v })}
                />
              )}
            </Field>
          ))}
        </div>

        {/* L'aperçu reprend la mise en forme de la vitrine, en petit. */}
        <div className="mt-5 rounded-2xl bg-mist p-5">
          {brouillon.hero_pastille && (
            <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-bold">
              {brouillon.hero_pastille}
            </span>
          )}
          <p className="mt-3 whitespace-pre-line text-[22px] font-extrabold leading-[1.05] tracking-[-.03em]">
            {brouillon.hero_titre}
            {brouillon.hero_accent && (
              <>
                {"\n"}
                <span className="bg-linear-to-r from-rose to-gold bg-clip-text text-transparent">
                  {brouillon.hero_accent}
                </span>
              </>
            )}
          </p>
          {brouillon.hero_chapo && (
            <p className="mt-2.5 max-w-[46ch] text-[12.5px] leading-relaxed text-muted">
              {brouillon.hero_chapo}
            </p>
          )}
        </div>
      </Section>

      {/* ------------------------------------------------------------ photos */}
      <Section
        title="Photos de l'accueil"
        action={
          <Button
            size="sm"
            variant="contour"
            disabled={envoiPhoto}
            onClick={() => fichierRef.current?.click()}
          >
            <IconPlus />
            {envoiPhoto ? "Envoi…" : "Ajouter une photo"}
          </Button>
        }
      >
        <input
          ref={fichierRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void importer(e.target.files)}
        />

        {photos.length === 0 ? (
          <p className="text-[13px] text-muted">
            Aucune photo : les vidéos de la boutique s&apos;affichent.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {photos.map((p, i) => (
              <div
                key={p.id}
                className={`rounded-2xl border border-line p-3.5 ${p.active ? "" : "opacity-60"}`}
              >
                <div
                  className="aspect-4/5 rounded-t-[999px] rounded-b-xl bg-stone bg-cover"
                  style={{ backgroundImage: `url(${p.url})`, backgroundPosition: p.cadrage }}
                />
                <div className="mt-3.5 flex flex-col gap-3">
                  <Toggle
                    checked={p.active}
                    onChange={(v) => void ecrirePhoto(p.id, { active: v })}
                    label="Affichée"
                  />
                  <Field label="Description de la photo">
                    <Input
                      value={p.texte_alternatif}
                      maxLength={200}
                      onChange={(v) =>
                        setPhotos((l) => l.map((x) => (x.id === p.id ? { ...x, texte_alternatif: v } : x)))
                      }
                      onBlur={(e) => void ecrirePhoto(p.id, { texte_alternatif: e.target.value.trim() || "Photo" })}
                    />
                  </Field>
                  <Field label="Cadrage (ex. 50% 30%)">
                    <Input
                      value={p.cadrage}
                      maxLength={20}
                      onChange={(v) =>
                        setPhotos((l) => l.map((x) => (x.id === p.id ? { ...x, cadrage: v } : x)))
                      }
                      onBlur={(e) => void ecrirePhoto(p.id, { cadrage: e.target.value.trim() || "50% 40%" })}
                    />
                  </Field>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={i === 0}
                        onClick={() => void deplacer(i, -1)}
                        aria-label="Avancer la photo"
                      >
                        <IconArrowLeft />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={i === photos.length - 1}
                        onClick={() => void deplacer(i, 1)}
                        aria-label="Reculer la photo"
                      >
                        <IconArrowRight />
                      </Button>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setARetirer(p)}>
                      <IconTrash />
                      Retirer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ---------------------------------------------------------- vedettes */}
      <Section title={`Produits sur la photo (${vedettes.length}/${PRODUITS_MAX})`}>
        {vedettes.length === 0 ? (
          <p className="mb-4 text-[13px] text-muted">
            Aucun produit choisi : les dernières nouveautés défilent.
          </p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {vedettes.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <span
                  className="h-11 w-9 shrink-0 rounded-md bg-stone bg-cover bg-center"
                  style={{ backgroundImage: p.image ? `url(${p.image})` : undefined }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold">{p.name}</span>
                  <span className="block text-[12px] text-muted">{formatXOF(p.price)}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Retirer ${p.name}`}
                  onClick={() => void ecrireVedettes(vedettes.filter((x) => x.id !== p.id))}
                >
                  <IconX />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {vedettes.length < PRODUITS_MAX && (
          <>
            <SearchField
              value={recherche}
              onChange={setRecherche}
              placeholder="Ajouter un produit publié…"
            />
            {trouves.length > 0 && (
              <ul className="mt-2 flex flex-col overflow-hidden rounded-xl border border-line">
                {trouves.map((p) => {
                  const deja = vedettes.some((v) => v.id === p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={deja}
                        onClick={() => {
                          void ecrireVedettes([...vedettes, p]);
                          setRecherche("");
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-mist disabled:opacity-40"
                      >
                        <span
                          className="h-10 w-8 shrink-0 rounded-md bg-stone bg-cover bg-center"
                          style={{ backgroundImage: p.image ? `url(${p.image})` : undefined }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{p.name}</span>
                        <span className="text-[12.5px] text-muted">{deja ? "Déjà choisi" : formatXOF(p.price)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Section>

      <Modal open={Boolean(aRetirer)} onClose={() => setARetirer(null)} title="Retirer cette photo ?">
        <p className="text-[13.5px] leading-relaxed text-muted">
          Elle ne s&apos;affichera plus sur l&apos;accueil. L&apos;image reste dans la photothèque.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setARetirer(null)}>
            Garder
          </Button>
          <Button variant="danger" onClick={() => aRetirer && void retirer(aRetirer)}>
            <IconTrash />
            Retirer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
