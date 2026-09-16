"use client";

import { useEffect, useRef, useState } from "react";
import { useAdmin } from "@/lib/admin/store";
import { slugify } from "@/lib/admin/slug";
import type { AdminCategory } from "@/lib/admin/types";
import {
  Button,
  DeleteButton,
  EmptyState,
  Field,
  GrilleMedias,
  Input,
  Modal,
  PageHeader,
  Pagination,
  sansAccent,
  SearchField,
  Textarea,
  Toggle,
  usePagination,
} from "@/components/admin/ui";
import {
  IconCheck,
  IconGrid,
  IconImage,
  IconMenuAdmin,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@/components/admin/icons";

/**
 * Les rayons de la boutique, sur deux niveaux.
 *
 * Deux formulaires, parce que ce sont deux gestes différents. Celui d'une
 * catégorie ne parle jamais de parente : une catégorie n'en a pas, la question
 * n'a pas lieu d'être. Celui d'une sous-catégorie demande à quelles catégories
 * la rattacher — au pluriel, « Chaussures » ayant sa place sous « Enfants »
 * comme sous « Coin Maman ».
 */

type Genre = "categorie" | "sous-categorie";
type Affichage = "liste" | "grille";
type FiltreType = "categories" | "sous-categories";

const vide = (parentSlugs: string[] = []): AdminCategory => ({
  id: `cat-${Date.now().toString(36)}`,
  slug: "",
  label: "",
  description: "",
  image: "",
  parentSlugs,
  parentNoms: [],
  univers: "enfant",
  active: true,
  order: 99,
});

function VisuelCategorie({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  return (
    <span className={`relative block shrink-0 overflow-hidden bg-stone ${className}`}>
      {src ? (
        // Les médias peuvent venir de la photothèque ou d'une adresse distante.
        // Un img natif accepte les deux sans configuration de domaine Next.js.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-[#c8b9bf]">
          <IconImage className="h-5 w-5" />
        </span>
      )}
    </span>
  );
}

export default function Page() {
  const { categories, saveCategory, deleteCategory, hydrated } = useAdmin();
  const [edite, setEdite] = useState<{ rayon: AdminCategory; genre: Genre } | null>(null);
  /* La catégorie dont on choisit les sous-catégories, s'il y en a une d'ouverte. */
  const [rattache, setRattache] = useState<AdminCategory | null>(null);
  const [suppression, setSuppression] = useState<AdminCategory | null>(null);
  const [destination, setDestination] = useState("");
  const [affichage, setAffichage] = useState<Affichage>("liste");
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState<FiltreType>("categories");

  useEffect(() => {
    const prefere = window.localStorage.getItem("mcm-categories-affichage");
    if (prefere === "liste" || prefere === "grille") {
      setAffichage(prefere);
    } else if (window.matchMedia("(max-width: 1023px)").matches) {
      setAffichage("grille");
    }
  }, []);

  const choisirAffichage = (valeur: Affichage) => {
    setAffichage(valeur);
    window.localStorage.setItem("mcm-categories-affichage", valeur);
  };

  /* Les nombres viennent du serveur : le back-office ne charge plus le
     catalogue entier pour les compter. */
  const parSlug = new Map(categories.map((c) => [c.slug, c]));
  const compte = (slug: string) => parSlug.get(slug)?.productCount ?? 0;
  const brouillonsDe = (c: AdminCategory) => c.draftCount ?? 0;

  const racines = categories
    .filter((c) => c.parentSlugs.length === 0)
    .sort((a, b) => a.order - b.order);

  const enfantsDe = (slug: string) =>
    categories.filter((c) => c.parentSlugs.includes(slug)).sort((a, b) => a.order - b.order);

  const sousCategories = categories.filter((c) => c.parentSlugs.length > 0);
  const categoriesAffichees = [...categories]
    .sort((a, b) => {
      if (a.parentSlugs.length === 0 && b.parentSlugs.length > 0) return -1;
      if (a.parentSlugs.length > 0 && b.parentSlugs.length === 0) return 1;
      return a.order - b.order || a.label.localeCompare(b.label, "fr");
    })
    .filter((c) => {
      if (filtreType === "categories" && c.parentSlugs.length > 0) return false;
      if (filtreType === "sous-categories" && c.parentSlugs.length === 0) return false;
      const terme = recherche.trim().toLocaleLowerCase("fr");
      return !terme || `${c.label} ${c.description} ${c.parentNoms.join(" ")}`.toLocaleLowerCase("fr").includes(terme);
    });
  const {
    page: pageCategories,
    pages: pagesCategories,
    setPage: setPageCategories,
    tranche: categoriesPage,
    debut: debutCategories,
    total: totalCategories,
  } = usePagination(categoriesAffichees, affichage === "grille" ? 12 : 15, (c) => c.id);

  /* Le serveur refuse de supprimer un rayon qui porte encore des fiches ou des
     sous-catégories : les fiches deviendraient orphelines. On le sait avant de
     cliquer, autant le dire au lieu de laisser l'appel échouer. */
  const empeche = (c: AdminCategory) => {
    const fiches = (c.productCount ?? 0) - brouillonsDe(c);
    const enfants = enfantsDe(c.slug).length;
    if (fiches > 0 && enfants > 0) {
      return `Contient ${fiches} produit${fiches > 1 ? "s" : ""} et ${enfants} sous-catégorie${
        enfants > 1 ? "s" : ""
      } : déplacez-les d'abord.`;
    }
    if (fiches > 0) {
      return `Contient ${fiches} produit${fiches > 1 ? "s" : ""} : déplacez-les dans un autre rayon d'abord.`;
    }
    if (enfants > 0) {
      return `Contient ${enfants} sous-catégorie${enfants > 1 ? "s" : ""} : supprimez-les d'abord.`;
    }
    return undefined;
  };

  const demanderSuppression = (c: AdminCategory) => {
    setSuppression(c);
    setDestination(categories.find((autre) => autre.id !== c.id)?.id ?? "");
  };

  const boutonSuppression = (c: AdminCategory, label = "Supprimer") => {
    const blocage = empeche(c);
    const brouillons = brouillonsDe(c);
    if (!blocage && brouillons > 0) {
      return (
        <Button size="sm" variant="ghost" onClick={() => demanderSuppression(c)}>
          <IconTrash />
          {label}
        </Button>
      );
    }
    return (
      <DeleteButton
        onConfirm={() => deleteCategory(c.id)}
        empeche={blocage}
        label={label}
      />
    );
  };

  if (!hydrated) return <p className="text-[13px] text-muted">Lecture des catégories…</p>;

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Catégories"
        sub="Les catégories forment le menu de la boutique. Les sous-catégories se rangent à l'intérieur, et peuvent appartenir à plusieurs d'entre elles."
      >
        <Button variant="contour" onClick={() => setEdite({ rayon: vide(), genre: "categorie" })}>
          <IconPlus />
          Nouvelle catégorie
        </Button>
        <Button
          variant="rose"
          disabled={racines.length === 0}
          title={
            racines.length === 0
              ? "Créez d'abord une catégorie : une sous-catégorie se range à l'intérieur d'une autre."
              : undefined
          }
          onClick={() => setEdite({ rayon: vide([]), genre: "sous-categorie" })}
        >
          <IconPlus />
          Nouvelle sous-catégorie
        </Button>
        <div
          className="flex h-10 items-center rounded-xl border border-line bg-white p-1"
          role="group"
          aria-label="Mode d'affichage"
        >
          <button
            type="button"
            onClick={() => choisirAffichage("liste")}
            aria-pressed={affichage === "liste"}
            title="Affichage horizontal"
            className={`grid h-8 w-9 place-items-center rounded-lg transition-colors ${
              affichage === "liste" ? "bg-ink text-white" : "text-muted hover:bg-mist"
            }`}
          >
            <IconMenuAdmin />
          </button>
          <button
            type="button"
            onClick={() => choisirAffichage("grille")}
            aria-pressed={affichage === "grille"}
            title="Affichage par vignettes"
            className={`grid h-8 w-9 place-items-center rounded-lg transition-colors ${
              affichage === "grille" ? "bg-ink text-white" : "text-muted hover:bg-mist"
            }`}
          >
            <IconGrid />
          </button>
        </div>
      </PageHeader>

      {categories.length === 0 ? (
        <EmptyState
          title="Aucune catégorie pour le moment"
          hint="Commencez par une catégorie — « Enfants », « Coin maman » — puis rangez des sous-catégories à l'intérieur."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <SearchField
                value={recherche}
                onChange={setRecherche}
                placeholder={
                  filtreType === "categories"
                    ? "Rechercher une catégorie"
                    : "Rechercher une sous-catégorie"
                }
              />
            </div>
            <div
              className="flex w-full rounded-xl border border-line bg-white p-1 lg:w-auto"
              role="group"
              aria-label="Filtrer les catégories"
            >
              <button
                type="button"
                onClick={() => setFiltreType("categories")}
                aria-pressed={filtreType === "categories"}
                className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-[12.5px] font-bold transition-colors lg:flex-none ${
                  filtreType === "categories" ? "bg-ink text-white" : "text-muted hover:bg-mist"
                }`}
              >
                Catégories · {racines.length}
              </button>
              <button
                type="button"
                onClick={() => setFiltreType("sous-categories")}
                aria-pressed={filtreType === "sous-categories"}
                className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-[12.5px] font-bold transition-colors lg:flex-none ${
                  filtreType === "sous-categories" ? "bg-ink text-white" : "text-muted hover:bg-mist"
                }`}
              >
                Sous-catégories · {sousCategories.length}
              </button>
            </div>
          </div>

          {affichage === "liste" ? (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="bg-rose-soft/70 text-[11px] font-bold uppercase text-muted">
                  <tr>
                    <th className="px-5 py-3.5">Catégorie</th>
                    <th className="px-4 py-3.5">
                      {filtreType === "categories" ? "Sous-catégories" : "Catégorie"}
                    </th>
                    <th className="px-4 py-3.5">Produits</th>
                    <th className="px-4 py-3.5">Statut</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3ecef]">
                  {categoriesPage.map((categorie) => {
                    const principale = categorie.parentSlugs.length === 0;
                    return (
                      <tr key={categorie.id} className="transition-colors hover:bg-mist/60">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <VisuelCategorie
                              src={categorie.image}
                              alt={categorie.label}
                              className="h-12 w-12 rounded-xl"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-extrabold">{categorie.label}</p>
                              {categorie.description && (
                                <p className="mt-0.5 max-w-[34ch] truncate text-[11.5px] text-muted">
                                  {categorie.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {principale ? (
                            <span className="text-[12.5px] font-bold">
                              {enfantsDe(categorie.slug).length}
                            </span>
                          ) : (
                            <div className="flex max-w-[250px] flex-wrap gap-1">
                              {categorie.parentNoms.map((nom) => (
                                <span key={nom} className="rounded-full bg-mist px-2 py-1 text-[10.5px] font-bold text-muted">
                                  {nom}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[12.5px] font-bold">{compte(categorie.slug)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                            categorie.active ? "bg-[#e8f5ed] text-[#24784b]" : "bg-stone text-muted"
                          }`}>
                            {categorie.active ? "Visible" : "Masquée"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {principale && (
                              <Button size="sm" variant="ghost" onClick={() => setRattache(categorie)} title="Gérer les sous-catégories">
                                <IconPlus />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEdite({ rayon: categorie, genre: principale ? "categorie" : "sous-categorie" })}
                              title="Modifier"
                            >
                              <IconPencil />
                            </Button>
                            {boutonSuppression(categorie, "")}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {categoriesPage.map((categorie) => {
                const principale = categorie.parentSlugs.length === 0;
                return (
                  <article key={categorie.id} className="group overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-rose/40">
                    <div className="relative aspect-[16/9] bg-stone">
                      <VisuelCategorie src={categorie.image} alt={categorie.label} className="h-full w-full" />
                      {!categorie.active && (
                        <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-bold text-white">Masquée</span>
                      )}
                    </div>
                    <div className="p-4">
                      <h2 className="truncate text-[15px] font-extrabold">{categorie.label}</h2>
                      {categorie.description && (
                        <p className="mt-1 line-clamp-2 min-h-9 text-[12px] leading-relaxed text-muted">{categorie.description}</p>
                      )}
                      <div className="mt-3 flex min-h-7 flex-wrap items-center gap-1.5">
                        <span className="text-[11.5px] font-bold text-muted">
                          {compte(categorie.slug)} produit{compte(categorie.slug) > 1 ? "s" : ""}
                        </span>
                        {principale && (
                          <span className="rounded-full bg-mist px-2 py-1 text-[10px] font-bold text-muted">
                            {enfantsDe(categorie.slug).length} sous-catégorie{enfantsDe(categorie.slug).length > 1 ? "s" : ""}
                          </span>
                        )}
                        {!principale && categorie.parentNoms.map((nom) => (
                          <span key={nom} className="rounded-full bg-mist px-2 py-1 text-[10px] font-bold text-muted">{nom}</span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-3">
                        {principale && (
                          <Button size="sm" variant="ghost" onClick={() => setRattache(categorie)} title="Gérer les sous-catégories"><IconPlus /></Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEdite({ rayon: categorie, genre: principale ? "categorie" : "sous-categorie" })} title="Modifier"><IconPencil /></Button>
                        {boutonSuppression(categorie, "")}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {categoriesAffichees.length === 0 && (
            <p className="rounded-2xl border border-line bg-white px-5 py-10 text-center text-[13px] text-muted">Aucun résultat</p>
          )}
          <Pagination
            page={pageCategories}
            pages={pagesCategories}
            total={totalCategories}
            debut={debutCategories}
            affiches={categoriesPage.length}
            onPage={setPageCategories}
            unite={filtreType === "categories" ? "catégories" : "sous-catégories"}
          />
        </>
      )}

      <p className="mt-4 text-[12.5px] text-muted">
        {racines.length} catégorie{racines.length > 1 ? "s" : ""} · {sousCategories.length}{" "}
        sous-catégorie{sousCategories.length > 1 ? "s" : ""}
      </p>

      {rattache && (
        <ChoixSousCategories
          key={rattache.id}
          categorie={rattache}
          rayons={categories}
          compte={compte}
          onClose={() => setRattache(null)}
          onEnregistrer={(modifiees) => {
            modifiees.forEach(saveCategory);
            setRattache(null);
          }}
          onCreer={() => {
            setRattache(null);
            setEdite({ rayon: vide([rattache.slug]), genre: "sous-categorie" });
          }}
        />
      )}

      {/* La clé remonte le formulaire à chaque rayon ouvert : pas d'état
          dérivé à recaler à la main. */}
      {edite && (
        <EditeurRayon
          key={edite.rayon.id}
          rayon={edite.rayon}
          genre={edite.genre}
          rayons={categories}
          onClose={() => setEdite(null)}
          onSave={(c) => {
            saveCategory(c);
            setEdite(null);
          }}
        />
      )}

      <Modal
        open={Boolean(suppression)}
        onClose={() => setSuppression(null)}
        title={`Supprimer « ${suppression?.label ?? ""} » ?`}
      >
        <div className="flex flex-col gap-4">
          {categories.some((c) => c.id !== suppression?.id) && (
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-[#ece3e7] bg-white px-3.5 py-2.5 text-[13.5px] outline-none focus:border-rose"
            >
              {categories
                .filter((c) => c.id !== suppression?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
            </select>
          )}
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setSuppression(null)}>Annuler</Button>
            {destination && (
              <Button
                variant="contour"
                onClick={() => {
                  if (!suppression) return;
                  deleteCategory(suppression.id, { mode: "deplacer", destinationId: destination });
                  setSuppression(null);
                }}
              >
                Déplacer les brouillons
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => {
                if (!suppression) return;
                deleteCategory(suppression.id, { mode: "supprimer" });
                setSuppression(null);
              }}
            >
              <IconTrash />
              Supprimer les brouillons
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ---------------------------------------------------- choix des rattachements */

/**
 * Les sous-catégories d'une catégorie, cochées ou non.
 *
 * On ne crée rien ici : on range. « Tee-shirts » existe déjà sous « Filles »,
 * il doit pouvoir servir aussi à « Garçons » sans être ressaisi — c'est tout
 * l'intérêt d'une appartenance multiple.
 *
 * Ne sont proposées que les catégories sans sous-catégories : en ranger une qui
 * en contient ferait de ses enfants un troisième niveau, que le serveur refuse.
 */
function ChoixSousCategories({
  categorie,
  rayons,
  compte,
  onClose,
  onEnregistrer,
  onCreer,
}: {
  categorie: AdminCategory;
  rayons: AdminCategory[];
  compte: (slug: string) => number;
  onClose: () => void;
  onEnregistrer: (modifiees: AdminCategory[]) => void;
  onCreer: () => void;
}) {
  const aDesEnfants = (slug: string) => rayons.some((r) => r.parentSlugs.includes(slug));

  const proposables = rayons
    .filter((r) => r.slug && r.slug !== categorie.slug && !aDesEnfants(r.slug))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  const [choisies, setChoisies] = useState<string[]>(
    proposables.filter((r) => r.parentSlugs.includes(categorie.slug)).map((r) => r.slug),
  );
  const [recherche, setRecherche] = useState("");

  const visibles = proposables.filter((r) => sansAccent(r.label).includes(sansAccent(recherche)));
  /* La liste ne défile plus dans un cadre à hauteur fixe : on la parcourt par
     pages, comme les autres choix du back-office. */
  const visiblesPage = usePagination(visibles, 6, (r) => r.id);

  const basculer = (slug: string) =>
    setChoisies((courant) =>
      courant.includes(slug) ? courant.filter((s) => s !== slug) : [...courant, slug],
    );

  const enregistrer = () => {
    /* On ne renvoie que ce qui a bougé : réécrire les autres ferait autant
       d'appels inutiles, et chacun peut échouer. */
    const modifiees = proposables
      .filter((r) => r.parentSlugs.includes(categorie.slug) !== choisies.includes(r.slug))
      .map((r) => ({
        ...r,
        parentSlugs: choisies.includes(r.slug)
          ? [...r.parentSlugs, categorie.slug]
          : r.parentSlugs.filter((s) => s !== categorie.slug),
      }));
    onEnregistrer(modifiees);
  };

  const change = proposables.some(
    (r) => r.parentSlugs.includes(categorie.slug) !== choisies.includes(r.slug),
  );

  return (
    <Modal open onClose={onClose} title={`Sous-catégories de « ${categorie.label} »`}>
      <div className="flex flex-col gap-4">
        {proposables.length > 0 && (
          <SearchField
            value={recherche}
            onChange={setRecherche}
            placeholder="Rechercher une sous-catégorie"
          />
        )}

        {proposables.length === 0 ? (
          <p className="rounded-2xl bg-mist px-4 py-3.5 text-[12.5px] text-muted">
            Aucune sous-catégorie.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[#f4edf0]">
            {visiblesPage.tranche.map((r) => {
              const on = choisies.includes(r.slug);
              const ailleurs = r.parentNoms.filter((n) => n !== categorie.label);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => basculer(r.slug)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] transition-colors ${
                        on ? "border-rose bg-rose text-white" : "border-[#e5d9de] bg-white"
                      }`}
                    >
                      {on && <IconCheck className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold">{r.label}</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted">
                        {compte(r.slug)} produit{compte(r.slug) > 1 ? "s" : ""}
                        {ailleurs.length > 0 && ` · aussi dans ${ailleurs.join(", ")}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {visibles.length === 0 && (
              <li className="py-4 text-center text-[12.5px] text-muted">
                Rien ne correspond à cette recherche.
              </li>
            )}
          </ul>
        )}

        <Pagination
          page={visiblesPage.page}
          pages={visiblesPage.pages}
          total={visiblesPage.total}
          debut={visiblesPage.debut}
          affiches={visiblesPage.tranche.length}
          onPage={visiblesPage.setPage}
          unite="sous-catégories"
        />

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-4">
          <Button variant="contour" onClick={onCreer}>
            <IconPlus />
            Créer une sous-catégorie
          </Button>
          <span className="flex items-center gap-2.5">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="rose" disabled={!change} onClick={enregistrer}>
              Enregistrer
            </Button>
          </span>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ éditeur */

function EditeurRayon({
  rayon,
  genre,
  rayons,
  onClose,
  onSave,
}: {
  rayon: AdminCategory;
  genre: Genre;
  rayons: AdminCategory[];
  onClose: () => void;
  onSave: (c: AdminCategory) => void;
}) {
  const { library, televerserMedia } = useAdmin();
  const [brouillon, setBrouillon] = useState<AdminCategory>(rayon);
  const [envoiImage, setEnvoiImage] = useState(false);
  const [phototheque, setPhototheque] = useState(false);
  const [rechercheParente, setRechercheParente] = useState("");
  const [choixParentes, setChoixParentes] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  const maj = (patch: Partial<AdminCategory>) => setBrouillon({ ...brouillon, ...patch });

  const nouveau = !rayon.slug;
  const sousCategorie = genre === "sous-categorie";

  const parentesPossibles = rayons.filter(
    (r) => r.parentSlugs.length === 0 && r.slug && r.slug !== brouillon.slug,
  );
  const parentesVisibles = parentesPossibles.filter((r) =>
    sansAccent(r.label).includes(sansAccent(rechercheParente)),
  );
  /* Un catalogue mûr compte des dizaines de rayons : on les parcourt par pages
     plutôt que dans une liste qui déborde du formulaire. */
  const parentesPage = usePagination(parentesVisibles, 8, (r) => r.id);

  const valide =
    brouillon.label.trim().length >= 3 &&
    (!sousCategorie || brouillon.parentSlugs.length > 0);

  const basculer = (slug: string) =>
    maj({
      parentSlugs: brouillon.parentSlugs.includes(slug)
        ? brouillon.parentSlugs.filter((s) => s !== slug)
        : [...brouillon.parentSlugs, slug],
    });

  const choisirFichier = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEnvoiImage(true);
    const media = await televerserMedia(fichier, brouillon.label || fichier.name);
    setEnvoiImage(false);
    if (media) maj({ image: media.src });
    if (fichierRef.current) fichierRef.current.value = "";
  };

  const titre = nouveau
    ? sousCategorie
      ? "Nouvelle sous-catégorie"
      : "Nouvelle catégorie"
    : sousCategorie
      ? `Sous-catégorie · ${rayon.label}`
      : `Catégorie · ${rayon.label}`;

  return (
    <Modal open onClose={onClose} title={titre}>
      <div className="flex flex-col gap-4">
        <Field label="Libellé">
          <Input
            value={brouillon.label}
            onChange={(v) => maj({ label: v, slug: slugify(v) })}
            placeholder={sousCategorie ? "Robes & jupes" : "Enfants"}
          />
        </Field>

        {/* Le seul endroit où la question du rattachement se pose. Une
            catégorie n'a pas de parente : son formulaire n'en parle pas. */}
        {sousCategorie && (
          <div className="rounded-2xl border border-line bg-mist/50 p-3.5">
            <span className="mb-2 block text-[12px] font-bold">Catégories parentes</span>
            {parentesPossibles.length === 0 ? (
              <p className="rounded-2xl bg-mist px-4 py-3 text-[12.5px] text-muted">
                Aucune catégorie disponible.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {parentesPossibles
                  .filter((r) => brouillon.parentSlugs.includes(r.slug))
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => basculer(r.slug)}
                      className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
                      title={`Retirer ${r.label}`}
                    >
                      {r.label}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                <Button variant="contour" size="sm" onClick={() => setChoixParentes(true)}>
                  <IconPlus />
                  {brouillon.parentSlugs.length > 0 ? "Modifier" : "Choisir"}
                </Button>
              </div>
            )}
          </div>
        )}

        <Field label="Description" hint="Une phrase, affichée en tête du rayon.">
          <Textarea
            value={brouillon.description}
            onChange={(v) => maj({ description: v })}
            rows={3}
            placeholder="Des coupes qui laissent courir, du 2 au 12 ans."
          />
        </Field>

        {/* ------------------------------------------------------- visuel */}
        <div>
          <span className="mb-2 block text-[12px] font-bold">Visuel</span>

          {/* Mêmes gestes que sur la fiche produit : une vignette qu'on remplit,
              et la photothèque juste en dessous. */}
          <div className="flex flex-wrap items-center gap-3">
            {brouillon.image && (
              <div
                className="group relative aspect-3/4 w-24 overflow-hidden rounded-2xl bg-stone bg-cover bg-center"
                style={{ backgroundImage: `url(${brouillon.image})` }}
              >
                <button
                  type="button"
                  onClick={() => maj({ image: "" })}
                  aria-label="Retirer l'image"
                  className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => fichierRef.current?.click()}
              disabled={envoiImage}
              className="flex aspect-3/4 w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-[#e0d3d9] text-muted transition-colors hover:border-rose hover:text-rose disabled:opacity-50"
            >
              <IconPlus />
              <span className="text-[11px] font-semibold">
                {envoiImage ? "Envoi…" : brouillon.image ? "Remplacer" : "Importer"}
              </span>
            </button>

            <div className="flex flex-col items-start gap-1.5">
              <Button variant="contour" size="sm" onClick={() => setPhototheque(true)}>
                <IconImage />
                Photothèque
              </Button>
              <span className="text-[12px] text-muted">JPG ou PNG</span>
            </div>
          </div>

          {/* Le champ de fichier natif reste caché : la vignette en tient lieu. */}
          <input
            ref={fichierRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => choisirFichier(e.target.files?.[0])}
          />
        </div>

        <Toggle
          checked={brouillon.active}
          onChange={(v) => maj({ active: v })}
          label="Visible en boutique"
          hint="Masqué, le rayon sort de la navigation ; ses produits restent publiés."
        />

        <div className="flex items-center justify-end gap-2.5 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="rose" disabled={!valide} onClick={() => onSave(brouillon)}>
            Enregistrer
          </Button>
        </div>

        <Modal
          open={choixParentes}
          onClose={() => setChoixParentes(false)}
          title="Catégories parentes"
        >
          <div className="mb-4 flex">
            <SearchField
              value={rechercheParente}
              onChange={setRechercheParente}
              placeholder="Rechercher une catégorie"
            />
          </div>

          {parentesVisibles.length === 0 ? (
            <p className="text-[13px] text-muted">Aucun résultat.</p>
          ) : (
            <div className="rounded-xl border border-line bg-white p-1.5">
              {parentesPage.tranche.map((r) => {
                const on = brouillon.parentSlugs.includes(r.slug);
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => basculer(r.slug)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-mist"
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] ${
                        on ? "border-rose bg-rose text-white" : "border-[#e5d9de] bg-white"
                      }`}
                    >
                      {on && <IconCheck className="h-3 w-3" />}
                    </span>
                    <span className="truncate text-[12.5px] font-semibold">{r.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <Pagination
            page={parentesPage.page}
            pages={parentesPage.pages}
            total={parentesPage.total}
            debut={parentesPage.debut}
            affiches={parentesPage.tranche.length}
            onPage={parentesPage.setPage}
            unite="catégories"
          />

          {/* Les cases s'appliquent au fur et à mesure : ce bouton ne valide
              rien, il referme. Sans lui on ne sait pas qu'on a fini. */}
          <div className="mt-4 flex items-center justify-end border-t border-line pt-4">
            <Button variant="rose" onClick={() => setChoixParentes(false)}>
              <IconCheck />
              Choisir
            </Button>
          </div>
        </Modal>

        <Modal
          open={phototheque}
          onClose={() => setPhototheque(false)}
          title="Photothèque"
          wide
        >
          <GrilleMedias
            medias={library.media}
            estChoisi={(media) => brouillon.image === media.src}
            onChoisir={(media) => {
              maj({ image: media.src });
              setPhototheque(false);
            }}
            vide="Photothèque vide."
          />
        </Modal>
      </div>
    </Modal>
  );
}
