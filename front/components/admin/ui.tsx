"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/admin/store";
import type { OrderStatus, ProductStatus } from "@/lib/admin/types";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconSearchAdmin,
  IconTrash,
  IconX,
} from "./icons";

/**
 * Les primitives du back-office.
 *
 * Elles reprennent le vocabulaire de la vitrine — mêmes jetons de couleur,
 * mêmes arrondis, même `ease-soft` — mais en plus dense : ici on lit des
 * tableaux, pas des pages. Aucune bibliothèque d'interface, comme partout
 * ailleurs dans ce projet.
 */

export const CARTE = "rounded-[20px] border border-line bg-white";

/* ------------------------------------------------------------------ */
/* Titres                                                              */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  sub,
  children,
}: {
  /** Le rayon auquel appartient la page, au-dessus du titre. */
  eyebrow?: string;
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.16em] text-rose">
            {eyebrow}
          </span>
        )}
        <h1 className="text-[clamp(1.6rem,3vw,1.9rem)] font-extrabold tracking-[-.03em]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Section({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title?: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARTE} p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-extrabold tracking-tight">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

const VARIANTES = {
  rose: "bg-rose text-white hover:-translate-y-0.5",
  ink: "bg-ink text-white hover:-translate-y-0.5",
  contour: "border-[1.5px] border-[#e5d9de] bg-white text-ink hover:border-rose/40",
  ghost: "text-muted hover:text-ink",
  danger: "border-[1.5px] border-rose-deep/30 bg-white text-rose-deep hover:bg-rose-soft",
};

export function Button({
  variant = "contour",
  size = "md",
  children,
  className = "",
  ...props
}: {
  variant?: keyof typeof VARIANTES;
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const dim = size === "sm" ? "px-3.5 py-2 text-[12.5px]" : "px-5 py-2.5 text-[13px]";
  return (
    <button
      {...props}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold transition-all duration-300 ease-soft disabled:pointer-events-none disabled:opacity-40 ${dim} ${VARIANTES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

export function Chip({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export function OrderChip({ status }: { status: OrderStatus }) {
  const t = STATUS_TONES[status];
  return (
    <Chip bg={t.bg} fg={t.fg}>
      {STATUS_LABELS[status]}
    </Chip>
  );
}

/* Le stock à zéro se lit avant le statut : une fiche publiée mais vide déçoit
   plus qu'un brouillon. */
export function ProductChip({ status, stock }: { status: ProductStatus; stock: number }) {
  if (status === "publie" && stock <= 0) return <Chip bg="#fbeaf1" fg="#b3306a">Rupture</Chip>;
  if (status === "publie") return <Chip bg="#eaf6ef" fg="#2e7d52">Publié</Chip>;
  if (status === "brouillon") return <Chip bg="#fdf3dc" fg="#8a6a12">Brouillon</Chip>;
  return <Chip bg="#f4f1f2" fg="#5d5157">Archivé</Chip>;
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

/**
 * Découpe une liste en pages.
 *
 * Le retour au premier écran est déclenché par une signature de la liste —
 * sa longueur et ses bornes — plutôt que par la liste elle-même : un parent
 * qui reconstruit son tableau à chaque rendu ne doit pas remettre la
 * pagination à zéro en boucle.
 */
export function usePagination<T>(rows: T[], pageSize: number, keyOf?: (row: T) => string) {
  const [page, setPage] = useState(1);

  const signature = [
    rows.length,
    rows.length && keyOf ? keyOf(rows[0]) : "",
    rows.length && keyOf ? keyOf(rows[rows.length - 1]) : "",
  ].join("|");

  /* Un changement de filtre, de tri ou de recherche ramène en page 1 : rester
     à la page 7 d'une liste qui n'en compte plus que deux donne un écran vide. */
  useEffect(() => setPage(1), [signature]);

  const taille = Math.max(1, pageSize);
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / taille)) : 1;
  /* Après une suppression, la page courante peut ne plus exister. */
  const courante = Math.min(page, pages);
  const debut = pageSize > 0 ? (courante - 1) * taille : 0;
  const tranche = pageSize > 0 ? rows.slice(debut, debut + taille) : rows;

  return { page: courante, pages, setPage, tranche, debut, total: rows.length };
}

/** Numéros affichés : les bords, les voisins de la page courante, et des points. */
function numeros(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const proches = new Set([1, pages, page, page - 1, page + 1]);
  const liste: (number | "…")[] = [];
  let trou = false;
  for (let i = 1; i <= pages; i++) {
    if (proches.has(i)) {
      liste.push(i);
      trou = false;
    } else if (!trou) {
      liste.push("…");
      trou = true;
    }
  }
  return liste;
}

export function Pagination({
  page,
  pages,
  total,
  debut,
  affiches,
  onPage,
  unite = "éléments",
}: {
  page: number;
  pages: number;
  total: number;
  debut: number;
  affiches: number;
  onPage: (p: number) => void;
  unite?: string;
}) {
  if (pages <= 1) return null;

  const bouton =
    "grid h-8 min-w-8 place-items-center rounded-lg px-2 text-[12.5px] font-semibold transition-colors duration-300 disabled:opacity-30";

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-muted">
        <span className="tabular-nums">
          {debut + 1}–{debut + affiches}
        </span>{" "}
        sur <span className="font-bold tabular-nums text-ink">{total}</span> {unite}
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
          className={`${bouton} border border-line bg-white text-muted hover:text-ink`}
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
        </button>

        {numeros(page, pages).map((n, i) =>
          n === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-[12.5px] text-muted">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-current={n === page ? "page" : undefined}
              className={`${bouton} ${
                n === page
                  ? "bg-ink text-white"
                  : "border border-line bg-white text-muted hover:text-ink"
              }`}
            >
              {n}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Page suivante"
          className={`${bouton} border border-line bg-white text-muted hover:text-ink`}
        >
          <IconArrowRight className="h-3.5 w-3.5" />
        </button>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tableaux                                                            */
/* ------------------------------------------------------------------ */

/**
 * Tableau en grille CSS plutôt qu'en `<table>` : les colonnes se règlent d'une
 * chaîne, et chaque ligne peut devenir un lien ou un bouton sans casser la
 * sémantique d'un tableau HTML.
 */
export function Table<T>({
  cols,
  head,
  rows,
  cells,
  onRow,
  keyOf,
  empty = "Rien à afficher.",
  pageSize = 20,
  unite,
  serveur,
}: {
  cols: string;
  head: string[];
  rows: T[];
  cells: (row: T) => ReactNode[];
  onRow?: (row: T) => void;
  keyOf: (row: T) => string;
  empty?: string;
  /** Lignes par page. `0` affiche tout d'un coup. */
  pageSize?: number;
  /** Ce qu'on compte, pour la ligne « 1–20 sur 243 commandes ». */
  unite?: string;
  /**
   * Pagination tenue par le serveur : `rows` est déjà la page affichée, et
   * `total` le nombre de lignes de toute la liste.
   */
  serveur?: { page: number; total: number; onPage: (page: number) => void };
}) {
  const locale = usePagination(rows, serveur ? 0 : pageSize, keyOf);
  const taille = Math.max(1, pageSize);
  const { page, pages, setPage, tranche, debut, total } = serveur
    ? {
        page: serveur.page,
        pages: Math.max(1, Math.ceil(serveur.total / taille)),
        setPage: serveur.onPage,
        tranche: rows,
        debut: (serveur.page - 1) * taille,
        total: serveur.total,
      }
    : locale;

  if (rows.length === 0) {
    return (
      <div className={`${CARTE} px-6 py-12 text-center`}>
        <p className="text-[13.5px] text-muted">{empty}</p>
      </div>
    );
  }

  return (
    <div>
      <div className={`${CARTE} overflow-hidden`}>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div
              className="grid gap-4 bg-mist px-5.5 py-3.5 text-[11px] font-bold uppercase tracking-[.05em] text-muted"
              style={{ gridTemplateColumns: cols }}
            >
              {head.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>

            {tranche.map((row) => (
              <div
                key={keyOf(row)}
                onClick={onRow ? () => onRow(row) : undefined}
                className={`grid items-center gap-4 border-t border-[#f4edf0] px-5.5 py-3.5 text-[13.5px] transition-colors ${
                  onRow ? "cursor-pointer hover:bg-mist" : ""
                }`}
                style={{ gridTemplateColumns: cols }}
              >
                {cells(row).map((c, j) => (
                  <div key={j} className="min-w-0 font-medium text-[#3d2f35]">
                    {c}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        debut={debut}
        affiches={tranche.length}
        onPage={setPage}
        unite={unite}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulaires                                                         */
/* ------------------------------------------------------------------ */

const CHAMP =
  "w-full rounded-xl border-[1.5px] border-[#ece3e7] bg-white px-3.5 py-2.5 text-[13.5px] outline-none transition-colors placeholder:text-[#b3a5aa] focus:border-rose";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-bold">{label}</span>
      {children}
    </label>
  );
}

export function Input({
  value,
  onChange,
  className = "",
  ...props
}: { value: string; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <input
      {...props}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${CHAMP} ${className}`}
    />
  );
}

export function Textarea({
  value,
  onChange,
  rows = 4,
  ...props
}: { value: string; onChange: (v: string) => void } & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>) {
  return (
    <textarea
      {...props}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${CHAMP} resize-y leading-relaxed`}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      /* Pas de chevron dessine a la main : une valeur arbitraire Tailwind ne
         supporte pas les espaces, et le chevron natif fait le travail. */
      className={`${CHAMP} cursor-pointer pr-9`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="mt-0.5 grid h-6 w-10 shrink-0 grid-cols-[1fr] items-center rounded-full bg-stone p-0.5 transition-colors duration-300 peer-checked:bg-rose peer-focus-visible:ring-2 peer-focus-visible:ring-rose/40">
        <span
          className={`h-5 w-5 rounded-full bg-white transition-transform duration-300 ease-back ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      <span className="min-w-0 text-[13px] font-bold">{label}</span>
    </label>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <IconSearchAdmin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${CHAMP} pl-10`}
      />
    </div>
  );
}

/**
 * Pour chercher sans se soucier des accents ni des majuscules.
 *
 * « ecru » doit trouver « Écru », et « rose poudre » « Rose poudré » : sans ça
 * la recherche ne sert qu'à celles qui savent déjà comment c'est écrit.
 */
export const sansAccent = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");

/** Ce qu'il faut d'une image pour l'afficher : la photothèque en donne plus. */
type Vignette = { id: string; src: string; name: string };

/**
 * La photothèque en grille, avec recherche et pages.
 *
 * Deux formulaires viennent y chercher une image — la fiche produit et le
 * rayon — et une séance photo en ajoute quinze d'un coup : sans recherche ni
 * pagination, on finit par dérouler tout le catalogue pour retrouver une robe.
 * La recherche ignore les accents et la casse.
 */
export function GrilleMedias({
  medias,
  onChoisir,
  estChoisi,
  parPage = 15,
  vide = "La photothèque est vide.",
}: {
  medias: Vignette[];
  onChoisir: (media: Vignette) => void;
  /** Coche les images déjà retenues par le formulaire appelant. */
  estChoisi?: (media: Vignette) => boolean;
  parPage?: number;
  vide?: string;
}) {
  const [recherche, setRecherche] = useState("");

  const cherche = sansAccent(recherche);
  const filtres = cherche
    ? medias.filter((m) => sansAccent(m.name).includes(cherche))
    : medias;
  const page = usePagination(filtres, parPage, (m) => m.id);

  if (medias.length === 0) return <p className="text-[13px] text-muted">{vide}</p>;

  return (
    <>
      <div className="mb-4 flex">
        <SearchField
          value={recherche}
          onChange={setRecherche}
          placeholder="Rechercher une photo par son nom…"
        />
      </div>

      {filtres.length === 0 ? (
        <p className="text-[13px] text-muted">Aucune photo ne porte ce nom.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {page.tranche.map((media) => (
            <button
              key={media.id}
              type="button"
              onClick={() => onChoisir(media)}
              title={media.name}
              className={`group relative aspect-3/4 overflow-hidden rounded-2xl bg-stone bg-cover bg-center ring-offset-2 transition-all hover:ring-2 hover:ring-rose ${
                estChoisi?.(media) ? "ring-2 ring-ink" : ""
              }`}
              style={{ backgroundImage: `url(${media.src})` }}
            >
              <span className="absolute inset-x-0 bottom-0 truncate bg-ink/60 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                {media.name}
              </span>
              {estChoisi?.(media) && (
                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose text-white">
                  <IconCheck className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <Pagination
        page={page.page}
        pages={page.pages}
        total={page.total}
        debut={page.debut}
        affiches={page.tranche.length}
        onPage={page.setPage}
        unite="photos"
      />
    </>
  );
}

/** Filtres en pastilles : plus lisibles qu'un menu déroulant sur cinq états. */
export function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors duration-300 ${
            value === o.value
              ? "bg-ink text-white"
              : "border border-line bg-white text-muted hover:text-ink"
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={value === o.value ? "text-white/55" : "text-muted/70"}> · {o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chiffres                                                            */
/* ------------------------------------------------------------------ */

export function Kpi({
  label,
  value,
  hint,
  tone = "#7a6b72",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className={`${CARTE} p-5`}>
      <div className="text-[12.5px] font-semibold text-muted">{label}</div>
      <div className="mt-2 whitespace-nowrap text-[26px] font-extrabold tracking-[-.03em] tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[11.5px] font-semibold" style={{ color: tone }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fenêtres et confirmations                                           */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  /* Échap ferme, et le fond ne défile pas derrière la fenêtre. */
  useEffect(() => {
    if (!open) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", surTouche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = avant;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-90 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-[3px] sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-fade-up my-auto max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-[22px] bg-white p-5 sm:max-h-[calc(100dvh-4rem)] sm:p-6 ${
          wide ? "max-w-[860px]" : "max-w-[560px]"
        }`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-[16px] font-extrabold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink"
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Toute suppression se confirme dans une fenêtre modale. */
export function DeleteButton({
  onConfirm,
  label = "Supprimer",
  empeche,
}: {
  onConfirm: () => void;
  label?: string;
  /** Renseigné quand la suppression est impossible : le bouton l'explique
      au survol plutôt que de laisser le serveur refuser après coup. */
  empeche?: string;
}) {
  const [demande, setDemande] = useState(false);

  if (empeche) {
    return (
      <Button variant="ghost" size="sm" disabled title={empeche}>
        <IconTrash />
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setDemande(true);
        }}
      >
        <IconTrash />
        {label}
      </Button>
      <Modal open={demande} onClose={() => setDemande(false)} title="Confirmer la suppression">
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setDemande(false)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              setDemande(false);
            }}
          >
            <IconTrash />
            Supprimer
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${CARTE} px-6 py-14 text-center`}>
      <p className="text-[15px] font-extrabold tracking-tight">{title}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Barres verticales dessinées à la main : aucune bibliothèque de graphes. */
export function BarChart({
  points,
  format,
}: {
  points: { label: string; value: number; hint?: string }[];
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));

  return (
    <div className="flex h-[180px] items-end gap-1.5">
      {points.map((p, i) => (
        <div key={`${p.label}-${i}`} className="group/bar flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-rose/25 transition-colors duration-300 group-hover/bar:bg-rose"
              style={{
                height: `${Math.max(2, (p.value / max) * 100)}%`,
                animation: `rise-scale .5s ${i * 22}ms var(--ease-soft) backwards`,
              }}
            />
            <span className="pointer-events-none absolute inset-x-0 -top-1 hidden justify-center text-[10.5px] font-bold tabular-nums group-hover/bar:flex">
              {format(p.value)}
            </span>
          </div>
          <span className="w-full truncate text-center text-[9.5px] text-muted">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

export const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

export const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

/* ------------------------------------------------------------------ */
/* Tiroir latéral                                                      */
/* ------------------------------------------------------------------ */

/**
 * Le tiroir, repris de 3001.
 *
 * Un formulaire long se remplit mieux dans une colonne à droite que dans une
 * fenêtre centrée : la liste reste visible derrière, et le pouce atteint le
 * bouton d'enregistrement sans traverser l'écran.
 */
export function SideDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", surTouche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = avant;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-90 flex justify-end">
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="anim-slide-in relative flex h-full w-full max-w-[26rem] flex-col border-l border-line bg-white"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold tracking-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:bg-mist hover:text-ink"
          >
            <IconX />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-line px-6 py-4">{footer}</footer>}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choix en pastilles                                                  */
/* ------------------------------------------------------------------ */

/**
 * Les options courtes se choisissent mieux en pastilles qu'en liste
 * déroulante : tout est lisible d'un coup, et l'explication du choix courant
 * s'affiche dessous plutôt que de rester cachée.
 */
export function OptionPills<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div>
      <span className="mb-2 block text-[12px] font-bold">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors duration-300 ${
              value === o.value
                ? "bg-ink text-white"
                : "border border-line bg-white text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
