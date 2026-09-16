"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatXOF } from "@/lib/format";
import { envoyer } from "@/lib/api";
import { TAILLE_UNIQUE, useAdmin } from "@/lib/admin/store";
import { slugify } from "@/lib/admin/slug";
import type { AdminColor, AdminMaterial, AdminProduct, SizeValue } from "@/lib/admin/types";
import {
  Button,
  GrilleMedias,
  Modal,
  Pagination,
  sansAccent,
  usePagination,
} from "./admin/ui";
import {
  IconArrowLeft,
  IconCheck,
  IconImage,
  IconPalette,
  IconPlus,
  IconRulerAdmin,
  IconScissors,
  IconTrash,
  IconX,
} from "./admin/icons";

const inputClass =
  "w-full rounded-2xl border-[1.5px] border-[#ece3e7] bg-white px-4 py-3.5 text-sm outline-none transition-colors placeholder:text-[#b3a5aa] focus:border-rose";

const Field = ({
  label,
  hint,
  children,
  span = 1,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  span?: number;
}) => (
  <div style={{ gridColumn: `span ${span}` }}>
    <label className="mb-2 block text-[12.5px] font-bold">{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{hint}</p>}
  </div>
);

/** Un nombre saisi avec des espaces reste un nombre : « 12 000 » vaut 12000. */
const nombre = (v: string) => Number(v.replace(/\s/g, "")) || 0;

/**
 * Le « + Autre » au bout d'une liste de choix.
 *
 * Une matière, un coloris ou une taille absent de la bibliothèque se saisit
 * ici. La valeur part quand même dans la configuration — c'est elle qui garde
 * l'orthographe commune à tout le catalogue — mais la gérante n'a plus à
 * quitter sa fiche pour ajouter « Lin lavé ».
 */
const AjoutRapide = ({
  placeholder,
  couleur = false,
  onAjouter,
}: {
  placeholder: string;
  /** Un coloris a besoin de sa pastille en plus de son nom. */
  couleur?: boolean;
  onAjouter: (valeur: string, hex: string) => void;
}) => {
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState("");
  const [hex, setHex] = useState("#e8b7c8");

  const fermer = () => {
    setValeur("");
    setOuvert(false);
  };

  const valider = () => {
    if (!valeur.trim()) return;
    onAjouter(valeur.trim(), hex);
    fermer();
  };

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-[#e0d3d9] px-3.5 py-2 text-[12.5px] font-semibold text-muted transition-colors hover:border-rose hover:text-rose"
      >
        <IconPlus />
        Autre
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-full border-[1.5px] border-rose bg-white p-1">
      {couleur && (
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          aria-label="Pastille"
          className="h-7 w-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
        />
      )}
      <input
        autoFocus
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            valider();
          }
          if (e.key === "Escape") fermer();
        }}
        placeholder={placeholder}
        className="w-32 bg-transparent px-2 text-[12.5px] font-semibold outline-none placeholder:font-normal placeholder:text-[#b3a5aa]"
      />
      <button
        type="button"
        onClick={valider}
        disabled={!valeur.trim()}
        aria-label="Ajouter"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-white transition-opacity disabled:opacity-40"
      >
        <IconCheck className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={fermer}
        aria-label="Annuler"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-rose-soft hover:text-rose-deep"
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </span>
  );
};

/**
 * L'éditeur de fiche.
 *
 * Sans `product`, il crée ; avec, il modifie. Les couleurs, les tailles et les
 * matières ne sont pas écrites ici : elles viennent de la bibliothèque du
 * back-office, pour que deux fiches ne finissent pas avec « rose poudré » et
 * « Rose Poudre ».
 */
/**
 * Une référence de secours, le temps que le serveur propose la sienne.
 *
 * La vraie proposition — trois lettres et le premier numéro libre — vient de
 * `/api/gestion/produits/disponibilite/` : le navigateur ne connaît plus tout
 * le catalogue pour la calculer. Celle-ci n'est unique que par l'horodatage.
 */
function referenceDeSecours(nom: string): string {
  const lettres = (nom
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3) || "REF").padEnd(3, "X");
  return `${lettres}-${Date.now().toString(36).toUpperCase()}`;
}

/** Une valeur de la bibliothèque, telle qu'elle s'affiche dans la fenêtre. */
type ChoixItem = { cle: string; valeur: string; hex?: string };

/**
 * La bibliothèque en fenêtre : matières, coloris ou tailles.
 *
 * La fiche ne montre plus que ce qui est coché. Déroulées, les puces d'une
 * bibliothèque un peu fournie tenaient plus de place que le formulaire ; on
 * vient les chercher ici, avec une recherche et des pages.
 */
const FenetreChoix = ({
  ouvert,
  titre,
  placeholder,
  vide,
  items,
  selection,
  onBasculer,
  onFermer,
}: {
  ouvert: boolean;
  titre: string;
  placeholder: string;
  vide: string;
  items: ChoixItem[];
  selection: string[];
  onBasculer: (valeur: string) => void;
  onFermer: () => void;
}) => {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(() => {
    const cherche = sansAccent(recherche);
    return cherche ? items.filter((i) => sansAccent(i.valeur).includes(cherche)) : items;
  }, [items, recherche]);

  const page = usePagination(filtres, 24, (i) => i.cle);

  return (
    <Modal open={ouvert} onClose={onFermer} title={titre} wide>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">{vide}</p>
      ) : (
        <>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={placeholder}
            className={`${inputClass} mb-4`}
          />

          {filtres.length === 0 ? (
            <p className="text-[13px] text-muted">Aucun résultat.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {page.tranche.map((item) => {
                const on = selection.includes(item.valeur);
                return (
                  <button
                    key={item.cle}
                    type="button"
                    onClick={() => onBasculer(item.valeur)}
                    className={`flex items-center gap-2.5 rounded-full border-[1.5px] py-2 text-[12.5px] font-semibold transition-colors ${
                      item.hex ? "pl-2 pr-4" : "px-3.5"
                    } ${on ? "border-ink bg-ink text-white" : "border-[#ece3e7] bg-white"}`}
                  >
                    {item.hex && (
                      <span
                        className="h-5 w-5 rounded-full"
                        style={{ background: item.hex, boxShadow: "0 0 0 1px #e5d9de" }}
                      />
                    )}
                    {item.valeur}
                    {on && <IconCheck className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          )}

          <Pagination
            page={page.page}
            pages={page.pages}
            total={page.total}
            debut={page.debut}
            affiches={page.tranche.length}
            onPage={page.setPage}
            unite="valeurs"
          />
        </>
      )}
    </Modal>
  );
};

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const {
    library,
    createProduct,
    saveProduct,
    categories,
    saveMaterial,
    saveColor,
    saveSizes,
    televerserMedia,
  } = useAdmin();

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  /* Tant que la gérante n'a pas écrit sa propre référence, celle-ci suit le
     nom. Dès qu'elle en saisit une, on ne la lui reprend plus. */
  const [skuTouche, setSkuTouche] = useState(Boolean(product?.sku));
  const [price, setPrice] = useState(product ? String(product.price) : "");
  /* Les rayons viennent de la table des catégories, jamais d'une liste écrite
     ici : en créer une nouvelle doit suffire à la voir apparaître. Les
     sous-catégories d'abord, ce sont elles qui rangent vraiment une fiche. */
  const rayons = useMemo(() => {
    const racines = categories.filter((c) => c.parentSlugs.length === 0);
    const groupes = racines.map((racine) => ({
      titre: racine.label,
      options: [
        racine,
        ...categories.filter((c) => c.parentSlugs.includes(racine.slug)),
      ],
    }));
    /* Une sous-catégorie dont la parente aurait disparu resterait choisissable :
       mieux vaut la proposer que la perdre. */
    const orphelines = categories.filter(
      (c) => c.parentSlugs.length > 0 && !racines.some((r) => c.parentSlugs.includes(r.slug)),
    );
    return orphelines.length
      ? [...groupes, { titre: "Sans catégorie parente", options: orphelines }]
      : groupes;
  }, [categories]);

  const premierRayon = rayons[0]?.options[0]?.label ?? "";
  const [category, setCategory] = useState<string>(product?.category ?? premierRayon);
  const [description, setDescription] = useState(product?.description ?? "");
  const [photos, setPhotos] = useState<string[]>(
    product ? [product.image, ...product.gallery].filter(Boolean) : []
  );
  const [colors, setColors] = useState<string[]>(product?.colors ?? []);
  /* Une fiche enregistrée sans taille revient avec sa seule « TU » : on la
     relit comme une absence de déclinaison, sinon l'écran de reprise ne
     ressemblerait pas à celui de la saisie. */
  const [sizes, setSizes] = useState<string[]>(() => {
    const enregistrees = product?.sizes ?? [];
    return enregistrees.length === 1 && enregistrees[0] === TAILLE_UNIQUE ? [] : enregistrees;
  });
  const [materials, setMaterials] = useState<string[]>(product?.materials ?? []);
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (product?.variants ?? []).map((v) => [`${v.size}\u0000${v.color}`, v.stock]),
    ),
  );
  const [variantesExclues, setVariantesExclues] = useState<Set<string>>(() => {
    if (!product) return new Set();
    const presentes = new Set(product.variants.map((v) => `${v.size}\u0000${v.color}`));
    const couleurs = product.colors.length ? product.colors : [""];
    return new Set(
      product.sizes
        .flatMap((size) => couleurs.map((color) => `${size}\u0000${color}`))
        .filter((cle) => !presentes.has(cle)),
    );
  });
  const [varianteASupprimer, setVarianteASupprimer] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [photothegue, setPhotothegue] = useState(false);
  const [envoiPhotos, setEnvoiPhotos] = useState(false);
  const [choix, setChoix] = useState<"matieres" | "coloris" | "tailles" | null>(null);
  const fichierRef = useRef<HTMLInputElement>(null);

  /* Une valeur créée depuis la fiche part vers la bibliothèque, mais celle-ci
     ne revient du serveur qu'après l'aller-retour. On la garde donc ici en
     attendant, sinon la puce qu'on vient de cocher disparaîtrait le temps d'un
     battement. */
  const [matieresAjoutees, setMatieresAjoutees] = useState<AdminMaterial[]>([]);
  const [colorisAjoutes, setColorisAjoutes] = useState<AdminColor[]>([]);
  const [taillesAjoutees, setTaillesAjoutees] = useState<SizeValue[]>([]);

  /* La référence libre et l'adresse déjà prise, demandées au serveur quand la
     frappe s'arrête. */
  const [disponibilite, setDisponibilite] = useState<{ reference: string; slugPris: boolean }>({
    reference: "",
    slugPris: false,
  });

  useEffect(() => {
    if (!name.trim()) {
      setDisponibilite({ reference: "", slugPris: false });
      return;
    }
    let vivant = true;
    const minuteur = window.setTimeout(() => {
      const params = new URLSearchParams({ nom: name });
      if (product?.id) params.set("exclure", product.id);
      envoyer<{ reference: string; slug_pris: boolean }>(
        `/api/gestion/produits/disponibilite/?${params}`,
      )
        .then((r) => vivant && setDisponibilite({ reference: r.reference, slugPris: r.slug_pris }))
        .catch(() => undefined);
    }, 300);
    return () => {
      vivant = false;
      window.clearTimeout(minuteur);
    };
  }, [name, product?.id]);

  useEffect(() => {
    if (skuTouche) return;
    setSku(name.trim() ? disponibilite.reference : "");
  }, [name, skuTouche, disponibilite.reference]);

  /* Le premier rayon connu sert de valeur de départ : la liste arrive après le
     premier rendu, quand le back-office a fini de lire la base. */
  useEffect(() => {
    if (!category && premierRayon) setCategory(premierRayon);
  }, [category, premierRayon]);

  const priceNumber = nombre(price);
  const slug = slugify(name);

  /**
   * Garde-fou de l'audit : un produit ne peut pas être publié tant qu'il n'a pas
   * un nom commercial, au moins une photo et un prix supérieur à zéro.
   * C'est ce contrôle qui manquait quand « Safari enfant » est parti en ligne à 0 F.
   *
   * Rien de plus, et aucune longueur minimale : la description, la composition
   * et les tailles restent facultatives, et la référence interne se propose
   * toute seule. La même liste est opposable côté serveur.
   */
  const blockers = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push("un nom commercial");
    if (photos.length === 0) list.push("au moins une photo");
    if (priceNumber <= 0) list.push("un prix supérieur à zéro");
    return list;
  }, [name, photos.length, priceNumber]);

  /* Sans taille cochée, la fiche se vend en taille unique. Une variante porte
     toujours une taille, et c'est elle qui tient le stock : sans ce repli, un
     article sans déclinaison n'aurait rien à vendre. */
  const taillesVendues = useMemo(() => (sizes.length ? sizes : [TAILLE_UNIQUE]), [sizes]);

  /** Ce qu'on lit dans le tableau : « TU » ne dit rien à personne. */
  const libelleOption = (size: string, color: string) => {
    const taille = sizes.length === 0 ? "Taille unique" : size;
    return color ? `${taille} · ${color}` : taille;
  };

  const variantChoices = useMemo(
    () =>
      taillesVendues.flatMap((size) =>
        (colors.length ? colors : [""]).map((color) => ({
          size,
          color,
          key: `${size}\u0000${color}`,
        })),
      ).filter((variante) => !variantesExclues.has(variante.key)),
    [colors, taillesVendues, variantesExclues],
  );
  const variantCount = variantChoices.length;
  const canPublish = blockers.length === 0;

  /* Deux fiches qui partagent une adresse s'écrasent en boutique. */
  const slugPris = Boolean(slug) && disponibilite.slugPris;

  const bascule = (liste: string[], set: (v: string[]) => void, valeur: string) =>
    set(liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]);

  /* Ce qui s'affiche en puces : la bibliothèque, plus ce que la fiche vient
     d'ajouter et que le serveur n'a pas encore renvoyé. */
  const matieresProposees = useMemo(
    () => [
      ...library.materials,
      ...matieresAjoutees.filter((m) => !library.materials.some((x) => x.name === m.name)),
    ],
    [library.materials, matieresAjoutees],
  );
  const colorisProposes = useMemo(
    () => [
      ...library.colors,
      ...colorisAjoutes.filter((c) => !library.colors.some((x) => x.name === c.name)),
    ],
    [library.colors, colorisAjoutes],
  );
  const taillesProposees = useMemo(
    () => [
      ...library.sizes,
      ...taillesAjoutees.filter((t) => !library.sizes.some((x) => x.value === t.value)),
    ],
    [library.sizes, taillesAjoutees],
  );

  /* Les trois bibliothèques partagent la même fenêtre : seule change la liste
     qu'on lui donne, et le tableau de la fiche qu'elle coche. */
  const fenetres = {
    matieres: {
      titre: "Choisir des matières",
      placeholder: "Rechercher une matière…",
      vide: "Aucune matière dans la bibliothèque.",
      items: matieresProposees.map((m) => ({ cle: m.id, valeur: m.name })),
      selection: materials,
      set: setMaterials,
    },
    coloris: {
      titre: "Choisir des coloris",
      placeholder: "Rechercher un coloris…",
      vide: "Aucun coloris dans la bibliothèque.",
      items: colorisProposes.map((c) => ({ cle: c.id, valeur: c.name, hex: c.hex })),
      selection: colors,
      set: setColors,
    },
    tailles: {
      titre: "Choisir des tailles",
      placeholder: "Rechercher une taille…",
      vide: "Aucune taille dans la bibliothèque.",
      items: taillesProposees.map((t) => ({ cle: t.value, valeur: t.value })),
      selection: sizes,
      set: setSizes,
    },
  };

  const fenetre = choix ? fenetres[choix] : null;

  const ajouterMatiere = (nom: string) => {
    // Saisie deux fois, ou déjà en bibliothèque : on coche, on ne duplique pas.
    const connue = matieresProposees.find((m) => m.name.toLowerCase() === nom.toLowerCase());
    const valeur = connue?.name ?? nom;
    if (!materials.includes(valeur)) setMaterials((liste) => [...liste, valeur]);
    if (connue) return;
    setMatieresAjoutees((liste) => [...liste, { id: `attente-${nom}`, name: nom }]);
    saveMaterial(nom);
  };

  const ajouterColoris = (nom: string, hex: string) => {
    const connu = colorisProposes.find((c) => c.name.toLowerCase() === nom.toLowerCase());
    const valeur = connu?.name ?? nom;
    if (!colors.includes(valeur)) setColors((liste) => [...liste, valeur]);
    if (connu) return;
    const coloris: AdminColor = { id: `attente-${nom}`, name: nom, hex };
    setColorisAjoutes((liste) => [...liste, coloris]);
    saveColor(coloris);
  };

  const ajouterTaille = (valeurSaisie: string) => {
    const connue = taillesProposees.find(
      (t) => t.value.toLowerCase() === valeurSaisie.toLowerCase(),
    );
    const valeur = connue?.value ?? valeurSaisie;
    if (!sizes.includes(valeur)) setSizes((liste) => [...liste, valeur]);
    if (connue) return;
    const taille: SizeValue = { value: valeurSaisie, age: "" };
    setTaillesAjoutees((liste) => [...liste, taille]);
    /* `saveSizes` prend la liste entière et retire ce qui n'y figure pas : on
       repart des puces affichées, pas de la bibliothèque seule, sinon deux
       ajouts rapprochés se supprimeraient l'un l'autre. */
    saveSizes([...taillesProposees, taille]);
  };

  const ajouterPhoto = (src: string) => {
    const propre = src.trim();
    if (!propre) return;
    // Forme fonctionnelle : plusieurs fichiers s'envoient à la suite, et la
    // liste lue dans la portée serait celle d'avant le premier.
    setPhotos((p) => (p.includes(propre) ? p : [...p, propre]));
  };

  /**
   * Importe des images depuis l'ordinateur.
   *
   * Elles rejoignent la photothèque — c'est elle qui garde les fichiers et les
   * partage entre fiches — puis la fiche en cours. Plusieurs d'un coup : une
   * séance photo donne rarement une seule vue.
   */
  const importerPhotos = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    setEnvoiPhotos(true);
    for (const fichier of Array.from(fichiers)) {
      const media = await televerserMedia(fichier, name.trim() || fichier.name);
      if (media) ajouterPhoto(media.src);
    }
    setEnvoiPhotos(false);
    if (fichierRef.current) fichierRef.current.value = "";
  };

  const enregistrer = (statut: "brouillon" | "publie") => {
    if (statut === "publie" && !canPublish) return;
    const maintenant = new Date().toISOString();
    /* La référence n'est plus réclamée à la gérante : si le champ a été vidé,
       on en reprend une libre. Le serveur, lui, l'exige toujours unique. */
    const reference = sku.trim() || disponibilite.reference || referenceDeSecours(name);

    const fiche: AdminProduct = {
      id: product?.id ?? `prod-${Date.now().toString(36)}`,
      univers: categories.find((c) => c.label === category)?.univers ?? "enfant",
      slug: slug || `fiche-${Date.now().toString(36)}`,
      name: name.trim(),
      sku: reference,
      price: priceNumber,
      /* Le prix barré ne se saisit plus ici : une fiche déjà en promotion garde
         le sien tant qu'on ne le change pas. */
      ...(product?.compareAt ? { compareAt: product.compareAt } : {}),
      category,
      image: photos[0] ?? "",
      gallery: photos.slice(1),
      description: description.trim(),
      colors,
      sizes: taillesVendues,
      materials,
      variants: variantChoices.map(({ size, color, key }) => ({
        id: product?.variants.find((v) => v.size === size && v.color === color)?.id,
        size,
        color,
        stock: variantStocks[key] ?? 0,
      })),
      stock: variantChoices.reduce((total, v) => total + (variantStocks[v.key] ?? 0), 0),
      status: statut,
      outOfStock: variantChoices.every((v) => (variantStocks[v.key] ?? 0) <= 0),
      createdAt: product?.createdAt ?? maintenant,
      updatedAt: maintenant,
    };

    if (product) saveProduct(fiche);
    else createProduct(fiche);

    window.setTimeout(() => router.push("/admin/produits"), 900);
  };

  return (
    <div className="anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.push("/admin/produits")}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-rose"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            Retour aux produits
          </button>
          <h1 className="mt-2 text-[clamp(1.6rem,3vw,1.9rem)] font-extrabold tracking-[-.03em]">
            {product ? product.name : "Nouveau produit"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="contour" onClick={() => enregistrer("brouillon")}>
            Enregistrer en brouillon
          </Button>
          <Button
            variant="rose"
            disabled={!canPublish}
            onClick={() => enregistrer("publie")}
          >
            {product?.status === "publie" ? "Enregistrer et garder en ligne" : "Publier en boutique"}
          </Button>
        </div>
      </div>


      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* -------------------------------------------------------- identité */}
          <section className="rounded-[20px] border border-line bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-[15px] font-extrabold tracking-tight">Identité</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nom commercial"
                span={2}
              >
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Robe chasuble rose à volant plumetis"
                  className={inputClass}
                />
              </Field>

              {slugPris && (
                <p
                  style={{ gridColumn: "span 2" }}
                  className="rounded-xl bg-rose-soft px-4 py-3 text-[12.5px] font-semibold text-rose-deep"
                >
                  Un produit portant ce nom existe déjà.
                </p>
              )}

              <Field
                label="Référence interne"
              >
                <input
                  value={sku}
                  onChange={(e) => {
                    setSkuTouche(true);
                    setSku(e.target.value.toUpperCase());
                  }}
                  placeholder="TEE-0001"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Catégorie"
              >
                {rayons.length === 0 ? (
                  <p className="rounded-xl bg-rose-soft px-4 py-3 text-[12.5px] leading-relaxed text-rose-deep">
                    Aucune catégorie disponible.{" "}
                    <Link href="/admin/categories" className="underline underline-offset-2">
                      Ajouter une catégorie
                    </Link>
                  </p>
                ) : (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={inputClass}
                  >
                    {rayons.map((groupe) => (
                      <optgroup key={groupe.titre} label={groupe.titre}>
                        {groupe.options.map((c) => (
                          <option key={c.id} value={c.label}>
                            {c.parentSlugs.length > 0 ? `\u00a0\u00a0${c.label}` : c.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </Field>

              <Field
                label="Description"
                span={2}
              >
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Chasuble en satin rose, rosette froncée à l'épaule, bas de jupe en plumetis duveteux. Doublure coton, fermeture pression au dos."
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <span className="text-[12.5px] font-bold">Composition</span>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {materials.map((nom) => (
                  <button
                    key={nom}
                    type="button"
                    onClick={() => bascule(materials, setMaterials, nom)}
                    title="Retirer de la fiche"
                    className="flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white"
                  >
                    {nom}
                    <IconX className="h-3 w-3" />
                  </button>
                ))}
                <AjoutRapide placeholder="Lin lavé" onAjouter={(nom) => ajouterMatiere(nom)} />
                <Button variant="contour" size="sm" onClick={() => setChoix("matieres")}>
                  <IconScissors className="h-4 w-4" />
                  Bibliothèque
                </Button>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------- photos */}
          <section className="rounded-[20px] border border-line bg-white p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-extrabold tracking-tight">Photos</h2>
              <span className="text-[12px] text-muted">
                Format 3:4, fond uni, même lumière pour tout le catalogue
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((src, i) => (
                <div
                  key={src}
                  className="anim-fade-up group relative aspect-3/4 overflow-hidden rounded-2xl bg-stone bg-cover bg-center"
                  style={{ backgroundImage: `url(${src})` }}
                >
                  {i === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide text-white">
                      Principale
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((x) => x !== src))}
                    aria-label="Retirer la photo"
                    className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => fichierRef.current?.click()}
                disabled={envoiPhotos}
                className="flex aspect-3/4 flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-[#e0d3d9] text-muted transition-colors hover:border-rose hover:text-rose disabled:opacity-50"
              >
                <IconPlus />
                <span className="text-[11px] font-semibold">
                  {envoiPhotos ? "Envoi…" : "Importer"}
                </span>
              </button>
            </div>

            {/* Le champ de fichier natif reste caché : la tuile en tient lieu. */}
            <input
              ref={fichierRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void importerPhotos(e.target.files)}
            />

            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <Button variant="contour" onClick={() => setPhotothegue(true)}>
                <IconImage />
                Photothèque
              </Button>
              <span className="text-[12px] text-muted">
                JPG ou PNG, plusieurs à la fois
              </span>
            </div>
          </section>

          {/* ------------------------------------------------------------- prix */}
          <section className="rounded-[20px] border border-line bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-[15px] font-extrabold tracking-tight">Prix</h2>
            <div className="max-w-md">
              <Field label="Prix de vente">
                <div className="relative">
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d\s]/g, ""))}
                    placeholder="12 000"
                    inputMode="numeric"
                    className={`${inputClass} pr-14`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12.5px] font-semibold text-muted">
                    F CFA
                  </span>
                </div>
              </Field>

            </div>
          </section>

          {/* -------------------------------------------------------- variantes */}
          <section className="rounded-[20px] border border-line bg-white p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-extrabold tracking-tight">Variantes</h2>
              <span className="text-[12px] text-muted">
                {variantCount} variante{variantCount > 1 ? "s" : ""} ·{" "}
                {sizes.length === 0 && colors.length === 0
                  ? "stock de la fiche entière"
                  : "stock géré par option"}
              </span>
            </div>

            <div className="mb-2.5 text-[12.5px] font-bold">Couleurs</div>
            <div className="flex flex-wrap items-center gap-2.5">
              {colors.map((nom) => (
                <button
                  key={nom}
                  type="button"
                  onClick={() => bascule(colors, setColors, nom)}
                  title="Retirer de la fiche"
                  className="flex items-center gap-2.5 rounded-full border-[1.5px] border-ink bg-ink py-2 pl-2 pr-3.5 text-[12.5px] font-semibold text-white"
                >
                  <span
                    className="h-5 w-5 rounded-full"
                    style={{
                      background: colorisProposes.find((c) => c.name === nom)?.hex ?? "#e8b7c8",
                      boxShadow: "0 0 0 1px #e5d9de",
                    }}
                  />
                  {nom}
                  <IconX className="h-3 w-3" />
                </button>
              ))}
              <AjoutRapide placeholder="Bleu nuit" couleur onAjouter={ajouterColoris} />
              <Button variant="contour" size="sm" onClick={() => setChoix("coloris")}>
                <IconPalette className="h-4 w-4" />
                Bibliothèque
              </Button>
            </div>

            <div className="mb-2.5 mt-5 text-[12.5px] font-bold">Tailles</div>
            <div className="flex flex-wrap items-center gap-2.5">
              {sizes.map((valeur) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => bascule(sizes, setSizes, valeur)}
                  title="Retirer de la fiche"
                  className="flex items-center gap-2 rounded-xl border-[1.5px] border-ink bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
                >
                  {valeur}
                  <IconX className="h-3 w-3" />
                </button>
              ))}
              <AjoutRapide placeholder="TU" onAjouter={(valeur) => ajouterTaille(valeur)} />
              <Button variant="contour" size="sm" onClick={() => setChoix("tailles")}>
                <IconRulerAdmin className="h-4 w-4" />
                Bibliothèque
              </Button>
            </div>

            {variantChoices.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-xl border border-line">
                <div className="grid grid-cols-[1fr_110px_40px] bg-[#faf7f8] px-4 py-2.5 text-[11.5px] font-bold uppercase text-muted">
                  <span>Option vendable</span>
                  <span>Stock</span>
                  <span />
                </div>
                {variantChoices.map(({ size, color, key }) => (
                  <div
                    key={key}
                    className="grid grid-cols-[1fr_110px_40px] items-center gap-2 border-t border-line px-4 py-2.5"
                  >
                    <span className="text-[13px] font-semibold">
                      {libelleOption(size, color)}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={variantStocks[key] ?? 0}
                      onChange={(e) =>
                        setVariantStocks((stocks) => ({
                          ...stocks,
                          [key]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      aria-label={`Stock ${libelleOption(size, color)}`}
                      className="w-full rounded-lg border-[1.5px] border-[#ece3e7] bg-white px-3 py-2 text-[13px] tabular-nums outline-none focus:border-rose"
                    />
                    {/* Une fiche sans déclinaison n'a qu'une ligne, celle de son
                        propre stock : la retirer ne voudrait rien dire. */}
                    {sizes.length === 0 && colors.length === 0 ? (
                      <span />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setVarianteASupprimer({ key, label: libelleOption(size, color) })
                        }
                        aria-label={`Supprimer ${libelleOption(size, color)}`}
                        className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-rose-soft hover:text-rose-deep"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------------ aside */}
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          <div className="rounded-[20px] border border-line bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-extrabold uppercase tracking-[.06em]">Statut</span>
              <span
                className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                style={
                  canPublish
                    ? { background: "#eaf6ef", color: "#2e7d52" }
                    : { background: "#fdf3dc", color: "#8a6a12" }
                }
              >
                {canPublish ? "Prêt à publier" : "Brouillon"}
              </span>
            </div>

            {!canPublish && (
              <>
                <p className="mt-3.5 text-[13px] font-semibold">Il manque encore :</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {blockers.map((b) => (
                    <li key={b} className="flex gap-2.5 text-[13px] leading-snug text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />
                      {b}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="rounded-[20px] border border-line bg-white p-5">
            <div className="text-[12.5px] font-extrabold uppercase tracking-[.06em]">
              Aperçu de la carte
            </div>
            <div className="mt-3.5">
              <div
                className="relative flex aspect-3/4 items-end overflow-hidden rounded-2xl bg-stone bg-cover bg-center p-3"
                style={photos[0] ? { backgroundImage: `url(${photos[0]})` } : undefined}
              >
                {Boolean(product?.compareAt) && (
                  <span className="absolute left-3 top-3 rounded-full bg-rose px-3 py-1.5 text-[11.5px] font-bold text-white">
                    Promo
                  </span>
                )}
                {photos.length === 0 && (
                  <span className="text-[10.5px] font-semibold text-[#a2939a]">aucune photo</span>
                )}
              </div>
              <div className="pt-3">
                <div className="text-[14px] font-semibold tracking-tight">
                  {name || <span className="text-[#b3a5aa]">Nom du produit</span>}
                </div>
                <div className="mt-1.5 flex items-baseline gap-2.5">
                  <span className="text-[15px] font-extrabold tabular-nums">
                    {priceNumber > 0 ? formatXOF(priceNumber) : "— F"}
                  </span>
                  {product?.compareAt && (
                    <span className="text-[13px] text-muted line-through">
                      {formatXOF(product.compareAt)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[12.5px] text-muted">
                  {category}{materials.length ? ` · ${materials.join(", ")}` : ""}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------- bibliothèques */}
      {/* La clé remonte le composant à chaque ouverture : la recherche et la
          page repartent de zéro, sans effet de nettoyage à écrire. */}
      <FenetreChoix
        key={choix ?? "aucune"}
        ouvert={Boolean(fenetre)}
        titre={fenetre?.titre ?? ""}
        placeholder={fenetre?.placeholder ?? ""}
        vide={fenetre?.vide ?? ""}
        items={fenetre?.items ?? []}
        selection={fenetre?.selection ?? []}
        onBasculer={(valeur) => {
          if (fenetre) bascule(fenetre.selection, fenetre.set, valeur);
        }}
        onFermer={() => setChoix(null)}
      />

      {/* ----------------------------------------------------- photothèque */}
      <Modal
        open={Boolean(varianteASupprimer)}
        onClose={() => setVarianteASupprimer(null)}
        title={`Supprimer ${varianteASupprimer?.label ?? "cette option"} ?`}
      >
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setVarianteASupprimer(null)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!varianteASupprimer) return;
              const restantes = variantChoices.filter((v) => v.key !== varianteASupprimer.key);
              if (restantes.length === 0) {
                /* C'était la dernière : la fiche n'aurait plus rien à vendre.
                   On relâche les puces cochées et on repart de la taille
                   unique, celle du stock de la fiche entière. */
                setSizes([]);
                setColors([]);
                setVariantesExclues(new Set());
              } else {
                setVariantesExclues((cles) => new Set(cles).add(varianteASupprimer.key));
              }
              setVarianteASupprimer(null);
            }}
          >
            <IconTrash className="h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </Modal>

      <Modal
        open={photothegue}
        onClose={() => setPhotothegue(false)}
        title="Choisir une photo"
        wide
      >
        <div className="mb-5">
          <Button
            variant="ink"
            disabled={envoiPhotos}
            onClick={() => fichierRef.current?.click()}
          >
            <IconPlus />
            {envoiPhotos ? "Envoi…" : "Importer depuis l'ordinateur"}
          </Button>
        </div>

        <GrilleMedias
          medias={library.media}
          estChoisi={(m) => photos.includes(m.src)}
          onChoisir={(m) => {
            ajouterPhoto(m.src);
            setPhotothegue(false);
          }}
          vide="La photothèque est vide : importez une première image."
        />
      </Modal>
    </div>
  );
}
