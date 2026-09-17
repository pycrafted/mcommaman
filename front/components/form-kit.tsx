"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { IconCheck, IconEye, IconEyeOff } from "./icons";

/**
 * Les briques de formulaire de l'espace client.
 *
 * Le site n'avait jusqu'ici que des champs décoratifs (page contact, tunnel de
 * commande) : ceux-là sont contrôlés, annoncent leurs erreurs et reprennent le
 * même dessin — bord de 1,5 px couleur `#ece3e7`, coins à 16 px, bord rose au
 * focus. Une icône à gauche quand le champ en mérite une.
 */

type Icone = ({ className }: { className?: string }) => React.ReactElement;

const CHAMP =
  "w-full rounded-2xl border-[1.5px] bg-white py-3.5 text-sm outline-none transition-colors placeholder:text-[#b3a5aa]";

function bord(error?: string, valid?: boolean) {
  if (error) return "border-rose-deep";
  if (valid) return "border-[#8fbfa2]";
  return "border-[#ece3e7] focus:border-rose";
}

export function TextField({
  label,
  icon: Icone,
  hint,
  error,
  valid,
  optional,
  className = "",
  ...props
}: {
  label: string;
  icon?: Icone;
  hint?: string;
  error?: string;
  valid?: boolean;
  optional?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-bold">{label}</span>
        {optional && <span className="text-[11.5px] font-medium text-muted">facultatif</span>}
      </label>

      <div className="relative">
        {Icone && (
          <Icone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          className={`${CHAMP} ${bord(error, valid)} ${Icone ? "pl-11" : "pl-4"} ${
            valid && !error ? "pr-10" : "pr-4"
          }`}
          {...props}
        />
        {valid && !error && (
          <IconCheck className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3f8a5f]" />
        )}
      </div>

      {error ? (
        <p className="mt-1.5 text-[11.5px] font-semibold leading-snug text-rose-deep">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{hint}</p>
      )}
    </div>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  value,
  onChange,
  className = "",
  ...props
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-bold">{label}</span>
        {props.maxLength && (
          <span className="text-[11.5px] font-medium text-muted tabular-nums">
            {value.length}/{props.maxLength}
          </span>
        )}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`${CHAMP} resize-none px-4 ${bord(error)}`}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-[11.5px] font-semibold leading-snug text-rose-deep">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{hint}</p>
      )}
    </div>
  );
}

export function PasswordField({
  label,
  icon: Icone,
  value,
  onChange,
  hint,
  error,
  valid,
  className = "",
  ...props
}: {
  label: string;
  icon?: Icone;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  valid?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[12.5px] font-bold">
        {label}
      </label>

      <div className="relative">
        {Icone && (
          <Icone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        )}
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={`${CHAMP} ${bord(error, valid)} ${Icone ? "pl-11" : "pl-4"} pr-12`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:text-ink"
        >
          {visible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
        </button>
      </div>

      {error ? (
        <p className="mt-1.5 text-[11.5px] font-semibold leading-snug text-rose-deep">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{hint}</p>
      )}
    </div>
  );
}

/* Quatre critères, quatre segments. Pas de score savant : on montre ce qui
   manque encore plutôt qu'une note que personne ne sait interpréter. */
const CRITERES: { test: (v: string) => boolean; label: string }[] = [
  { test: (v) => v.length >= 8, label: "8 caractères" },
  { test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v), label: "majuscule et minuscule" },
  { test: (v) => /[0-9]/.test(v), label: "un chiffre" },
  { test: (v) => /[^a-zA-Z0-9]/.test(v), label: "un caractère spécial" },
];

const NIVEAUX = ["Trop court", "Faible", "Correct", "Bon", "Solide"];
const TEINTES = ["bg-line", "bg-rose-deep", "bg-gold", "bg-[#8fbfa2]", "bg-[#3f8a5f]"];

export function PasswordMeter({ password }: { password: string }) {
  if (!password) return null;

  const remplis = CRITERES.filter((c) => c.test(password)).length;
  const manquants = CRITERES.filter((c) => !c.test(password)).map((c) => c.label);

  return (
    <div className="mt-2.5">
      <div className="flex gap-1.5">
        {CRITERES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < remplis ? TEINTES[remplis] : "bg-line"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
        <span className="font-semibold text-ink">{NIVEAUX[remplis]}</span>
        {manquants.length > 0 && ` — il manque ${manquants.join(", ")}.`}
      </p>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  error,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();

  /* La vraie case est masquée mais reste dans l'ordre de tabulation ; le carré
     dessiné, posé juste après, porte son focus grâce à `peer`. Sans ça, la case
     est invisible au clavier. Le libellé est un `<label>` : il ne doit donc
     contenir aucun lien, deux éléments cliquables imbriqués se disputant le
     clic. */
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <label
          htmlFor={id}
          className={`mt-0.5 grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-md border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-rose/50 peer-focus-visible:ring-offset-2 ${
            checked ? "border-rose bg-rose text-white" : error ? "border-rose-deep" : "border-[#e5d9de] bg-white"
          }`}
        >
          {checked && <IconCheck className="h-3 w-3" />}
        </label>
        <label htmlFor={id} className="cursor-pointer text-[13px] leading-relaxed text-[#5d4f55]">
          {children}
        </label>
      </div>
      {error && <p className="mt-1.5 pl-8 text-[11.5px] font-semibold text-rose-deep">{error}</p>}
    </div>
  );
}

export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="anim-fade-up rounded-2xl bg-rose-soft px-4 py-3 text-[13px] font-semibold leading-relaxed text-rose-deep"
    >
      {children}
    </p>
  );
}

export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="shine w-full rounded-full bg-rose px-8 py-4 text-[14.5px] font-bold text-white shadow-[0_16px_38px_-16px_rgba(224,65,127,.9)] transition-transform duration-400 ease-soft hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
      <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
      {description && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Le décor des pages connexion et inscription : le formulaire à gauche, une
 * photo et une phrase à droite. La colonne visuelle disparaît sous `lg` — sur
 * un téléphone, elle repousserait le formulaire hors de l'écran.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  image,
  quote,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  image: string;
  quote: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-[1180px] gap-10 px-5 pb-22 pt-10 md:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:px-10">
      <div className="anim-fade-up">
        <span className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">{eyebrow}</span>
        <h1 className="mt-3 text-[clamp(2rem,4.6vw,2.9rem)] font-extrabold leading-[1.05] tracking-[-.035em]">
          {title}
        </h1>
        {description ? (
          <p className="mb-8 mt-2.5 max-w-[46ch] text-[14.5px] leading-relaxed text-muted text-pretty">
            {description}
          </p>
        ) : (
          <div className="mb-8" />
        )}

        <div className="rounded-3xl border border-line bg-white p-6 sm:p-8">{children}</div>

        <div className="mt-5 text-center text-[13.5px]">{footer}</div>
      </div>

      {/* La photo n'est pas décorative pour rien : elle rappelle ce qu'on vient
          chercher ici. `sticky` la garde en vue pendant que le formulaire long
          de l'inscription défile. */}
      <aside className="hidden lg:sticky lg:top-[104px] lg:block">
        <div className="noise relative overflow-hidden rounded-[30px] bg-ink">
          <div className="relative aspect-4/5">
            <Image
              src={image}
              alt=""
              fill
              sizes="(min-width:1024px) 520px, 0px"
              className="anim-zoom object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-linear-to-t from-ink/90 via-ink/25 to-transparent" />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-8 text-white">
            <p className="text-[19px] font-bold leading-snug tracking-[-.02em] text-balance">
              «&nbsp;{quote}&nbsp;»
            </p>
            <p className="mt-3 text-[12.5px] text-white/60">M comme Maman — Dakar</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
