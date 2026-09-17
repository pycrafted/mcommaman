"use client";

import { zoneDelay } from "@/lib/livraison";
import type { ZoneKey } from "./auth-context";
import { ORDER_STEPS, type OrderStatus } from "./orders-context";
import { IconBoxOpen, IconCheck, IconClock, IconClose, IconHome, IconPackage, IconPin, IconTruck } from "./icons";

type Etape = Exclude<OrderStatus, "annulee">;
type Icone = ({ className }: { className?: string }) => React.ReactElement;

const ICONES: Record<Etape, Icone> = {
  recue: IconPackage,
  preparation: IconBoxOpen,
  expediee: IconTruck,
  livree: IconHome,
};

/* Une phrase par étape : le suivi raconte où en est le colis, il ne se contente
   pas d'afficher un statut. */
const MESSAGES: Record<Etape, { eyebrow: string; title: string; copy: string }> = {
  recue: {
    eyebrow: "C'est parti",
    title: "Votre commande nous est bien arrivée.",
    copy: "Nous vérifions les tailles et la disponibilité avant de commencer la préparation.",
  },
  preparation: {
    eyebrow: "Entre de bonnes mains",
    title: "On prépare vos pièces.",
    copy: "Chaque article est contrôlé, plié, puis glissé dans son colis.",
  },
  expediee: {
    eyebrow: "Plus très loin",
    title: "Votre colis est en route.",
    copy: "Le livreur appelle avant de passer, et attend l'essayage.",
  },
  livree: {
    eyebrow: "Belle arrivée",
    title: "Votre commande est arrivée !",
    copy: "Si une taille ne va pas, l'échange reste possible pendant sept jours.",
  },
};

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

function Pastille({ etape, etat }: { etape: Etape; etat: "fait" | "encours" | "attente" }) {
  const Icone = ICONES[etape];

  return (
    <span
      className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 transition-colors duration-500 sm:h-14 sm:w-14 ${
        etat === "fait"
          ? "border-rose/15 bg-rose text-white"
          : etat === "encours"
            ? "border-rose/20 bg-white text-rose shadow-[0_0_0_8px_rgba(224,65,127,.09)]"
            : "border-cream bg-stone text-muted/70"
      }`}
    >
      {etat === "fait" ? <IconCheck className="h-4 w-4" /> : <Icone className="h-5 w-5" />}
      {etat === "encours" && (
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-rose">
          <span className="absolute inset-0 animate-ping rounded-full bg-rose/50" />
        </span>
      )}
    </span>
  );
}

export function OrderJourney({
  status,
  createdAt,
  city,
  zone,
}: {
  status: OrderStatus;
  createdAt: string;
  city: string;
  zone: ZoneKey;
}) {
  if (status === "annulee") {
    return (
      <section className="mb-7 overflow-hidden rounded-[26px] border-[1.5px] border-rose-deep/20 bg-rose-soft/60 p-7 sm:p-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-rose-deep text-white">
            <IconClose className="h-7 w-7" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-rose-deep">
              Parcours interrompu
            </p>
            <h2 className="mt-2 text-[clamp(1.5rem,3.4vw,2rem)] font-extrabold tracking-[-.03em]">
              Cette commande a été annulée.
            </h2>
            <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-muted text-pretty">
              Si c&apos;est une erreur, écrivez-nous sur WhatsApp.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const index = ORDER_STEPS.findIndex((s) => s.value === status);
  const progression = Math.round(((index + 1) / ORDER_STEPS.length) * 100);
  const message = MESSAGES[status as Etape];
  const suivante = ORDER_STEPS[index + 1];
  const IconeActive = ICONES[status as Etape];

  return (
    <section className="mb-7 overflow-hidden rounded-[26px] border border-line bg-white md:rounded-[30px]">
      {/* ------------------------------------------------------ bandeau sombre */}
      <div className="noise relative overflow-hidden bg-ink px-6 py-7 text-white sm:px-9 sm:py-9">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="aurora absolute -left-16 -top-12 h-64 w-64 rounded-full bg-rose/40 blur-[90px]" />
          <div className="aurora absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-gold/25 blur-[90px] [animation-delay:-11s]" />
        </div>

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-2xl items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10">
              <IconeActive className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-gold">
                {message.eyebrow}
              </p>
              <h2 className="mt-2 text-[clamp(1.35rem,3.2vw,1.9rem)] font-extrabold leading-tight tracking-[-.03em] text-balance">
                {message.title}
              </h2>
              <p className="mt-2 max-w-[54ch] text-[13.5px] leading-relaxed text-white/65 text-pretty">
                {message.copy}
              </p>
            </div>
          </div>

          <div className="min-w-[160px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-end justify-between gap-4">
              <span className="text-[11px] uppercase tracking-[.14em] text-white/55">Progression</span>
              <strong className="text-2xl font-extrabold tabular-nums">{progression}%</strong>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <span
                className="block h-full rounded-full bg-rose transition-[width] duration-700 ease-soft"
                style={{ width: `${progression}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-7 sm:px-8">
        {/* Sous `sm`, le trajet passe à la verticale : quatre libellés sur une
            ligne d'écran de téléphone ne se lisent pas. */}
        <ol className="sm:hidden">
          {ORDER_STEPS.map((etape, i) => {
            const etat = i < index ? "fait" : i === index ? "encours" : "attente";
            return (
              <li key={etape.value} className="grid grid-cols-[48px_1fr] gap-4">
                <div className="flex flex-col items-center">
                  <Pastille etape={etape.value} etat={etat} />
                  {i < ORDER_STEPS.length - 1 && (
                    <span
                      className={`min-h-8 w-px flex-1 ${
                        i < index ? "bg-rose" : "border-l border-dashed border-line"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-7 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`text-[13.5px] font-bold ${etat === "attente" ? "text-muted" : ""}`}
                    >
                      {etape.label}
                    </h3>
                    {etat === "encours" && (
                      <span className="rounded-full bg-rose-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-rose">
                        Maintenant
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{etape.hint}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="relative hidden sm:block">
          <div className="absolute left-[12.5%] right-[12.5%] top-7 h-1 rounded-full bg-stone">
            <span
              className="block h-full rounded-full bg-rose transition-[width] duration-700 ease-soft"
              style={{ width: `${(index / (ORDER_STEPS.length - 1)) * 100}%` }}
            />
          </div>
          <ol className="relative grid grid-cols-4 gap-3">
            {ORDER_STEPS.map((etape, i) => {
              const etat = i < index ? "fait" : i === index ? "encours" : "attente";
              return (
                <li key={etape.value} className="flex flex-col items-center text-center">
                  <Pastille etape={etape.value} etat={etat} />
                  <h3
                    className={`mt-4 text-[13.5px] font-bold ${etat === "attente" ? "text-muted" : ""}`}
                  >
                    {etape.label}
                  </h3>
                  <p className="mt-1 max-w-[180px] text-[12.5px] leading-relaxed text-muted">
                    {etape.hint}
                  </p>
                  {etat === "encours" && (
                    <span className="mt-2 rounded-full bg-rose-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-rose">
                      Maintenant
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* ------------------------------------------------- les trois repères */}
        <div className="mt-6 grid gap-2 rounded-2xl bg-mist p-2 sm:mt-7 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3">
            <IconClock className="h-4 w-4 shrink-0 text-rose" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[.14em] text-muted">Commandée le</p>
              <p className="mt-0.5 text-[12.5px] font-bold">{dateCourte(createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3">
            <IconPin className="h-4 w-4 shrink-0 text-rose" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[.14em] text-muted">Destination</p>
              <p className="mt-0.5 truncate text-[12.5px] font-bold">{city}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3">
            {suivante ? (
              <IconTruck className="h-4 w-4 shrink-0 text-rose" />
            ) : (
              <IconCheck className="h-4 w-4 shrink-0 text-[#3f8a5f]" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[.14em] text-muted">
                {suivante ? "Prochaine étape" : "Parcours terminé"}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] font-bold">
                {suivante?.label ?? "Colis remis"}
                {suivante && status === "recue" ? ` · ${zoneDelay(zone)}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
