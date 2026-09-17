"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { envoyer, televerser } from "@/lib/api";
import { useAdmin } from "@/lib/admin/store";
import { lireProduits } from "@/lib/admin/produits";
import type { AdminProduct } from "@/lib/admin/types";
import { Button, Field, Input, Modal, SearchField, Section, Toggle } from "./ui";
import { IconArrowLeft, IconArrowRight, IconPlus, IconTrash, IconX } from "./icons";

/*
 * La vidéothèque : les vidéos envoyées depuis le back-office, et le choix de
 * celles qui passent dans « Nos pièces, filmées » sur l'accueil.
 *
 * Chaque vidéo peut montrer une pièce : sa carte s'affiche sous la vidéo.
 * Sans aucune vidéo à l'accueil, la vitrine garde celles livrées avec le site.
 */

type Video = {
  id: number;
  url: string;
  titre: string;
  produit: number | null;
  produit_nom: string;
  sur_accueil: boolean;
  ordre: number;
};

/** Même plafond que le serveur (`VIDEO_MAX_MO`) : on prévient avant l'envoi. */
const MAX_MO = 60;

const message = (e: unknown, repli: string) => (e instanceof Error ? e.message : repli);

/** Choisir la pièce d'une vidéo : une recherche dans les produits publiés. */
function ChoixPiece({ onChoisir }: { onChoisir: (p: AdminProduct) => void }) {
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<AdminProduct[]>([]);

  useEffect(() => {
    const terme = q.trim();
    if (!terme) {
      setTrouves([]);
      return;
    }
    let vivant = true;
    const minuteur = window.setTimeout(() => {
      lireProduits({ q: terme, statut: "publie", taille: 5 })
        .then((r) => vivant && setTrouves(r.produits))
        .catch(() => undefined);
    }, 250);
    return () => {
      vivant = false;
      window.clearTimeout(minuteur);
    };
  }, [q]);

  return (
    <div>
      <SearchField value={q} onChange={setQ} placeholder="Chercher la pièce montrée…" />
      {trouves.length > 0 && (
        <ul className="mt-1.5 flex flex-col overflow-hidden rounded-xl border border-line bg-white">
          {trouves.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChoisir(p);
                  setQ("");
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-mist"
              >
                <span
                  className="h-8 w-7 shrink-0 rounded bg-stone bg-cover bg-center"
                  style={{ backgroundImage: p.image ? `url(${p.image})` : undefined }}
                />
                <span className="truncate font-semibold">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Videotheque() {
  const { notify } = useAdmin();
  const notifier = useRef(notify);
  notifier.current = notify;

  const [pret, setPret] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [aRetirer, setARetirer] = useState<Video | null>(null);
  const fichierRef = useRef<HTMLInputElement>(null);

  const relire = useCallback(async () => {
    const liste = await envoyer<Video[]>("/api/gestion/videotheque/");
    setVideos([...liste].sort((a, b) => a.ordre - b.ordre || a.id - b.id));
  }, []);

  useEffect(() => {
    relire()
      .catch((e) => notifier.current("error", message(e, "Lecture de la vidéothèque impossible.")))
      .finally(() => setPret(true));
  }, [relire]);

  const ecrire = async (id: number, patch: Partial<Video>) => {
    setVideos((l) => l.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    try {
      await envoyer(`/api/gestion/videotheque/${id}/`, "PATCH", patch);
    } catch (e) {
      notify("error", message(e, "La vidéo n'a pas pu être modifiée."));
      void relire();
    }
  };

  const importer = async (fichiers: FileList | null) => {
    const fichier = fichiers?.[0];
    if (fichierRef.current) fichierRef.current.value = "";
    if (!fichier) return;
    if (fichier.size > MAX_MO * 1024 * 1024) {
      notify("error", `Cette vidéo dépasse ${MAX_MO} Mo : compressez-la avant de l'envoyer.`);
      return;
    }
    const forme = new FormData();
    forme.append("fichier", fichier);
    forme.append("titre", fichier.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    forme.append("sur_accueil", "true");
    forme.append("ordre", String((videos.at(-1)?.ordre ?? -1) + 1));
    setEnvoi(true);
    try {
      await televerser("/api/gestion/videotheque/", forme);
      await relire();
      notify("success", "Vidéo ajoutée.");
    } catch (e) {
      notify("error", message(e, "L'envoi de la vidéo a échoué."));
    } finally {
      setEnvoi(false);
    }
  };

  const deplacer = async (index: number, sens: -1 | 1) => {
    const cible = index + sens;
    if (cible < 0 || cible >= videos.length) return;
    const liste = [...videos];
    [liste[index], liste[cible]] = [liste[cible], liste[index]];
    const renumerotee = liste.map((v, i) => ({ ...v, ordre: i }));
    setVideos(renumerotee);
    try {
      await Promise.all(
        renumerotee
          .filter((v, i) => videos[i]?.id !== v.id)
          .map((v) => envoyer(`/api/gestion/videotheque/${v.id}/`, "PATCH", { ordre: v.ordre })),
      );
    } catch (e) {
      notify("error", message(e, "L'ordre n'a pas pu être enregistré."));
      void relire();
    }
  };

  const retirer = async (video: Video) => {
    setARetirer(null);
    try {
      await envoyer(`/api/gestion/videotheque/${video.id}/`, "DELETE");
      setVideos((l) => l.filter((v) => v.id !== video.id));
      notify("success", "Vidéo supprimée.");
    } catch (e) {
      notify("error", message(e, "La vidéo n'a pas pu être supprimée."));
    }
  };

  const surAccueil = videos.filter((v) => v.sur_accueil).length;

  return (
    <Section
      title={`Vidéothèque · ${surAccueil} sur l'accueil`}
      action={
        <Button
          size="sm"
          variant="contour"
          disabled={envoi}
          onClick={() => fichierRef.current?.click()}
        >
          <IconPlus />
          {envoi ? "Envoi en cours…" : "Ajouter une vidéo"}
        </Button>
      }
    >
      <input
        ref={fichierRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => void importer(e.target.files)}
      />

      {!pret ? (
        <p className="text-[13px] text-muted">Lecture de la vidéothèque…</p>
      ) : videos.length === 0 ? (
        <p className="text-[13px] text-muted">
          Aucune vidéo : l&apos;accueil montre celles de la boutique. MP4, WebM ou MOV, {MAX_MO} Mo
          au plus.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {videos.map((v, i) => (
            <div
              key={v.id}
              className={`flex flex-col rounded-2xl border border-line p-3 ${v.sur_accueil ? "" : "opacity-60"}`}
            >
              <video
                src={`${v.url}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                controls
                className="aspect-9/16 w-full rounded-xl bg-ink object-cover"
              />
              <div className="mt-3 flex flex-1 flex-col gap-3">
                <Toggle
                  checked={v.sur_accueil}
                  onChange={(on) => void ecrire(v.id, { sur_accueil: on })}
                  label="Sur l'accueil"
                />
                <Field label="Titre">
                  <Input
                    value={v.titre}
                    maxLength={120}
                    onChange={(t) => setVideos((l) => l.map((x) => (x.id === v.id ? { ...x, titre: t } : x)))}
                    onBlur={(e) => void ecrire(v.id, { titre: e.target.value.trim() || "Vidéo" })}
                  />
                </Field>
                <div>
                  <span className="mb-1.5 block text-[12px] font-bold">Pièce montrée</span>
                  {v.produit ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-mist px-3 py-2">
                      <span className="truncate text-[13px] font-semibold">{v.produit_nom}</span>
                      <button
                        type="button"
                        onClick={() => void ecrire(v.id, { produit: null, produit_nom: "" })}
                        aria-label="Retirer la pièce"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-white hover:text-ink"
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <ChoixPiece
                      onChoisir={(p) => void ecrire(v.id, { produit: Number(p.id), produit_nom: p.name })}
                    />
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={i === 0}
                      onClick={() => void deplacer(i, -1)}
                      aria-label="Avancer la vidéo"
                    >
                      <IconArrowLeft />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={i === videos.length - 1}
                      onClick={() => void deplacer(i, 1)}
                      aria-label="Reculer la vidéo"
                    >
                      <IconArrowRight />
                    </Button>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setARetirer(v)}>
                    <IconTrash />
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(aRetirer)} onClose={() => setARetirer(null)} title="Supprimer cette vidéo ?">
        <p className="text-[13.5px] leading-relaxed text-muted">
          «&nbsp;{aRetirer?.titre}&nbsp;» sera supprimée de la vidéothèque et de l&apos;accueil.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setARetirer(null)}>
            Garder
          </Button>
          <Button variant="danger" onClick={() => aRetirer && void retirer(aRetirer)}>
            <IconTrash />
            Supprimer
          </Button>
        </div>
      </Modal>
    </Section>
  );
}
