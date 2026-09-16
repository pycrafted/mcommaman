"use client";

import { useRef, useState } from "react";
import { useAdmin } from "@/lib/admin/store";
import type { AdminColor, SizeValue } from "@/lib/admin/types";
import {
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Section,
  usePagination,
} from "@/components/admin/ui";
import { IconPencil, IconPlus, IconTrash, IconX } from "@/components/admin/icons";

const normaliser = (valeur: string) =>
  valeur.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");

/**
 * La bibliothèque : le vocabulaire commun des fiches.
 *
 * Tailles, coloris, matières et photothèque se règlent une fois ici et se
 * choisissent ensuite dans l'éditeur de fiche. C'est ce qui empêche « rose
 * poudré » et « Rose Poudre » de cohabiter dans le même catalogue.
 */
export default function Page() {
  const {
    library,
    saveSizes,
    saveColor,
    deleteColor,
    saveMaterial,
    deleteMaterial,
    televerserMedia,
    removeMedia,
    hydrated,
    enCours,
    notify,
  } = useAdmin();

  const [taille, setTaille] = useState("");
  const [repere, setRepere] = useState("");
  const [couleur, setCouleur] = useState({ name: "", hex: "#e0417f" });
  const [matiere, setMatiere] = useState("");
  const [envoiMedia, setEnvoiMedia] = useState(false);
  const [rechercheMedia, setRechercheMedia] = useState("");
  const fichierRef = useRef<HTMLInputElement>(null);
  const [editionRepere, setEditionRepere] = useState<SizeValue | null>(null);
  const [repereEdite, setRepereEdite] = useState("");

  const taillesPage = usePagination(library.sizes, 8, (s) => s.value);
  const couleursPage = usePagination(library.colors, 8, (c) => c.id);
  const matieresPage = usePagination(library.materials, 12, (m) => m.id);
  /* Même besoin que dans l'éditeur de fiche : passé quelques séances photo, on
     ne retrouve plus une image en déroulant. */
  const mediasFiltres = library.media.filter(
    (m) => !rechercheMedia.trim() || normaliser(m.name).includes(normaliser(rechercheMedia)),
  );
  const mediasPage = usePagination(mediasFiltres, 12, (m) => m.id);

  if (!hydrated) return <p className="text-[13px] text-muted">Lecture de la configuration…</p>;

  /* Combien de fiches se servent d'une valeur : on ne supprime pas à l'aveugle. */
  const fichesAvecTaille = (v: string) =>
    library.sizes.find((s) => s.value === v)?.productCount ?? 0;
  const fichesAvecCouleur = (n: string) =>
    library.colors.find((c) => c.name === n)?.productCount ?? 0;

  const ajouterTaille = () => {
    const v = taille.trim();
    if (!v) return;
    if (library.sizes.some((s) => normaliser(s.value) === normaliser(v))) {
      notify("warning", `La taille « ${v} » existe déjà.`);
      return;
    }
    saveSizes([...library.sizes, { value: v, age: repere.trim() }]);
    setTaille("");
    setRepere("");
  };

  const retirerTaille = (v: string) => saveSizes(library.sizes.filter((s) => s.value !== v));

  const ouvrirRepere = (tailleChoisie: SizeValue) => {
    setEditionRepere(tailleChoisie);
    setRepereEdite(tailleChoisie.age);
  };

  const enregistrerRepere = () => {
    if (!editionRepere) return;
    saveSizes(
      library.sizes.map((s: SizeValue) =>
        s.value === editionRepere.value ? { ...s, age: repereEdite.trim() } : s,
      ),
    );
    setEditionRepere(null);
  };

  const ajouterCouleur = () => {
    const nom = couleur.name.trim();
    if (!nom) return;
    const memeNom = library.colors.find((item) => normaliser(item.name) === normaliser(nom));
    if (memeNom) {
      notify("warning", `Le coloris « ${memeNom.name} » existe déjà.`);
      return;
    }
    const memeTeinte = library.colors.find(
      (item) => item.hex.toLocaleLowerCase() === couleur.hex.toLocaleLowerCase(),
    );
    if (memeTeinte) {
      notify("warning", `Cette teinte est déjà utilisée par « ${memeTeinte.name} ».`);
      return;
    }
    saveColor({ id: `col-${Date.now().toString(36)}`, name: nom, hex: couleur.hex } as AdminColor);
    setCouleur({ name: "", hex: "#e0417f" });
  };

  const ajouterMatiere = () => {
    const m = matiere.trim();
    if (!m) return;
    const existante = library.materials.find((item) => normaliser(item.name) === normaliser(m));
    if (existante) {
      notify("warning", `La matière « ${existante.name} » existe déjà.`);
      return;
    }
    saveMaterial(m);
    setMatiere("");
  };

  /**
   * Importe des images depuis l'ordinateur.
   *
   * La photothèque garde les fichiers eux-mêmes : rien à héberger ailleurs, ni
   * d'adresse à recopier. Plusieurs d'un coup, une séance photo en donne
   * rarement une seule.
   */
  const importerMedias = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    setEnvoiMedia(true);
    let envoyees = 0;
    for (const fichier of Array.from(fichiers)) {
      if (await televerserMedia(fichier)) envoyees += 1;
    }
    setEnvoiMedia(false);
    if (fichierRef.current) fichierRef.current.value = "";
    if (envoyees) notify("success", `${envoyees} image${envoyees > 1 ? "s" : ""} ajoutée${envoyees > 1 ? "s" : ""}.`);
    else notify("error", "Aucune image n'a pu être envoyée.");
  };

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Configuration"
        sub="Ce qui se règle une fois et se réutilise partout : tailles, coloris, matières, photothèque."
      />

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {/* ---------------------------------------------------------- tailles */}
        <Section
          title="Tailles"
          sub="Une lettre ou un nombre, rien d'autre. Le repère d'âge est une aide au choix, pas une taille."
        >
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Valeur" className="w-24">
              <Input value={taille} onChange={setTaille} placeholder="4" />
            </Field>
            <Field label="Repère (facultatif)" className="min-w-[140px] flex-1">
              <Input value={repere} onChange={setRepere} placeholder="4 ans" />
            </Field>
            <Button variant="ink" onClick={ajouterTaille} disabled={!taille.trim() || enCours}>
              <IconPlus />
              Ajouter
            </Button>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {taillesPage.tranche.map((s) => {
              const usages = fichesAvecTaille(s.value);
              return (
                <li key={s.value} className="flex items-center gap-2.5 rounded-xl bg-mist px-3 py-2">
                  <span className="w-12 shrink-0 text-[13.5px] font-extrabold">{s.value}</span>
                  <span className={`min-w-0 flex-1 text-[12.5px] ${s.age ? "text-ink" : "text-muted"}`}>
                    {s.age || "Aucun repère"}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-muted">
                    {usages} produit{usages > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => ouvrirRepere(s)}
                    aria-label={`Modifier le repère de la taille ${s.value}`}
                    title="Modifier le repère"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-ink"
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => retirerTaille(s.value)}
                    disabled={usages > 0}
                    title={usages > 0 ? "Utilisée par des produits" : "Retirer"}
                    aria-label={`Retirer la taille ${s.value}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-rose-deep disabled:opacity-25"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={taillesPage.page}
            pages={taillesPage.pages}
            total={taillesPage.total}
            debut={taillesPage.debut}
            affiches={taillesPage.tranche.length}
            onPage={taillesPage.setPage}
            unite="tailles"
          />

        </Section>

        {/* --------------------------------------------------------- coloris */}
        <Section title="Coloris" sub="Le nom commercial et sa pastille, réutilisés par tous les produits.">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Nom" className="min-w-[160px] flex-1">
              <Input
                value={couleur.name}
                onChange={(v) => setCouleur((c) => ({ ...c, name: v }))}
                placeholder="Rose poudré"
              />
            </Field>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-bold">Teinte</span>
              <input
                type="color"
                value={couleur.hex}
                onChange={(e) => setCouleur((c) => ({ ...c, hex: e.target.value }))}
                aria-label="Teinte du coloris"
                className="h-[42px] w-14 cursor-pointer rounded-xl border-[1.5px] border-[#ece3e7] bg-white p-1"
              />
            </label>
            <Button variant="ink" onClick={ajouterCouleur} disabled={!couleur.name.trim() || enCours}>
              <IconPlus />
              Ajouter
            </Button>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {couleursPage.tranche.map((c) => {
              const usages = fichesAvecCouleur(c.name);
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-mist px-3 py-2">
                  <span
                    className="h-6 w-6 shrink-0 rounded-full"
                    style={{ background: c.hex, boxShadow: "0 0 0 1px #e5d9de" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{c.name}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-muted">{c.hex}</span>
                  <span className="shrink-0 text-[11.5px] text-muted">
                    {usages} produit{usages > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteColor(c.id)}
                    disabled={usages > 0}
                    title={usages > 0 ? "Utilisé par des produits" : "Retirer"}
                    aria-label={`Retirer le coloris ${c.name}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-rose-deep disabled:opacity-25"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={couleursPage.page}
            pages={couleursPage.pages}
            total={couleursPage.total}
            debut={couleursPage.debut}
            affiches={couleursPage.tranche.length}
            onPage={couleursPage.setPage}
            unite="coloris"
          />
        </Section>

        {/* -------------------------------------------------------- matières */}
        <Section
          title="Matières"
          sub="Référentiel de composition : un produit peut utiliser plusieurs matières."
        >
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Matière" className="min-w-[180px] flex-1">
              <Input value={matiere} onChange={setMatiere} placeholder="100 % coton peigné" />
            </Field>
            <Button variant="ink" onClick={ajouterMatiere} disabled={!matiere.trim() || enCours}>
              <IconPlus />
              Ajouter
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {matieresPage.tranche.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-2 rounded-full bg-mist px-3.5 py-2 text-[12.5px] font-semibold"
              >
                {m.name}
                <button
                  type="button"
                  onClick={() => deleteMaterial(m.id)}
                  aria-label={`Retirer ${m.name}`}
                  className="text-muted transition-colors hover:text-rose-deep"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {library.materials.length === 0 && (
              <p className="text-[13px] text-muted">Aucune matière enregistrée.</p>
            )}
          </div>
          <Pagination
            page={matieresPage.page}
            pages={matieresPage.pages}
            total={matieresPage.total}
            debut={matieresPage.debut}
            affiches={matieresPage.tranche.length}
            onPage={matieresPage.setPage}
            unite="matières"
          />
        </Section>

        {/* ----------------------------------------------------- photothèque */}
        <Section
          title="Photothèque"
          sub="Les visuels partagés par les produits et les catégories."
        >
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Le champ natif reste caché : le bouton en tient lieu. */}
            <input
              ref={fichierRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void importerMedias(e.target.files)}
            />
            <Button
              variant="ink"
              onClick={() => fichierRef.current?.click()}
              disabled={envoiMedia || enCours}
            >
              <IconPlus />
              {envoiMedia ? "Envoi…" : "Importer des images"}
            </Button>
            <span className="text-[12px] text-muted">
              JPG ou PNG, plusieurs à la fois
            </span>
          </div>

          {library.media.length > 0 && (
            <Input
              className="mt-3.5"
              value={rechercheMedia}
              onChange={setRechercheMedia}
              placeholder="Rechercher une photo par son nom…"
            />
          )}

          {mediasFiltres.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted">
              {library.media.length === 0
                ? "La photothèque est vide."
                : "Aucune photo ne porte ce nom."}
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {mediasPage.tranche.map((m) => (
                <div
                  key={m.id}
                  className="group relative aspect-3/4 overflow-hidden rounded-xl bg-stone bg-cover bg-center"
                  style={{ backgroundImage: `url(${m.src})` }}
                >
                  <button
                    type="button"
                    onClick={() => removeMedia(m.id)}
                    aria-label={`Retirer ${m.name}`}
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute inset-x-0 bottom-0 truncate bg-ink/60 px-2 py-1 text-[10px] font-semibold text-white">
                    {m.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={mediasPage.page}
            pages={mediasPage.pages}
            total={mediasPage.total}
            debut={mediasPage.debut}
            affiches={mediasPage.tranche.length}
            onPage={mediasPage.setPage}
            unite="images"
          />
        </Section>
      </div>

      <Modal
        open={Boolean(editionRepere)}
        onClose={() => setEditionRepere(null)}
        title={`Modifier le repère${editionRepere ? ` · ${editionRepere.value}` : ""}`}
      >
        <Field label="Repère (facultatif)">
          <Input value={repereEdite} onChange={setRepereEdite} placeholder="Ex. 4 ans" />
        </Field>
        <div className="mt-6 flex justify-end gap-2.5 border-t border-line pt-4">
          <Button variant="ghost" onClick={() => setEditionRepere(null)}>
            Annuler
          </Button>
          <Button variant="ink" onClick={enregistrerRepere} disabled={enCours}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </>
  );
}
