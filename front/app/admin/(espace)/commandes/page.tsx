"use client";

import { useEffect, useMemo, useState } from "react";
import { formatXOF } from "@/lib/format";
import {
  ORDER_PIPELINE,
  PAYMENT_LABELS,
  STATUS_LABELS,
  useAdmin,
} from "@/lib/admin/store";
import type { Order, OrderStatus } from "@/lib/admin/types";
import {
  Button,
  Modal,
  OrderChip,
  PageHeader,
  Pills,
  SearchField,
  Table,
  dateLongue,
} from "@/components/admin/ui";
import { IconCheck, IconX } from "@/components/admin/icons";

type Filtre = OrderStatus | "toutes";

export default function Page() {
  const { orders, customers, setOrderStatus, hydrated } = useAdmin();
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [recherche, setRecherche] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);

  /* Le tableau de bord renvoie ici avec la référence en ancre : on ouvre la
     commande visée sans passer par les paramètres de recherche, qui
     obligeraient à envelopper la page dans un <Suspense>. */
  useEffect(() => {
    const ouvrirAncre = () => {
      const ancre = decodeURIComponent(window.location.hash.replace("#", ""));
      if (!ancre) return;
      const cible = orders.find((o) => o.ref === ancre);
      if (cible) setOuverte(cible.id);
    };
    ouvrirAncre();
    // L'alerte de nouvelle commande pose l'ancre alors que la page est
    // peut-être déjà ouverte : on suit donc aussi ses changements.
    window.addEventListener("hashchange", ouvrirAncre);
    return () => window.removeEventListener("hashchange", ouvrirAncre);
    // La liste n'est complète qu'après hydratation : d'où la dépendance.
  }, [orders]);

  const nomDe = useMemo(() => {
    const table = new Map(customers.map((c) => [c.id, c]));
    return (id: string) => table.get(id);
  }, [customers]);

  const comptes = useMemo(() => {
    const c: Record<string, number> = { toutes: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return orders
      .filter((o) => filtre === "toutes" || o.status === filtre)
      .filter((o) => {
        if (!q) return true;
        const cliente = nomDe(o.customerId);
        return (
          o.ref.toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q) ||
          (cliente?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, filtre, recherche, nomDe]);

  const commande = orders.find((o) => o.id === ouverte) ?? null;

  if (!hydrated) return <p className="text-[13px] text-muted">Lecture des commandes…</p>;

  return (
    <>
      <PageHeader
        eyebrow="Logistique"
        title="Commandes"
        sub="Le statut se change ici, et nulle part ailleurs. Une commande annulée ne revient pas dans le circuit."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchField
          value={recherche}
          onChange={setRecherche}
          placeholder="Référence, cliente ou ville…"
        />
        <Pills
          value={filtre}
          onChange={setFiltre}
          options={[
            { value: "toutes" as Filtre, label: "Toutes", count: comptes.toutes },
            ...ORDER_PIPELINE.map((s) => ({
              value: s as Filtre,
              label: STATUS_LABELS[s],
              count: comptes[s] ?? 0,
            })),
            { value: "annulee" as Filtre, label: STATUS_LABELS.annulee, count: comptes.annulee ?? 0 },
          ]}
        />
      </div>

      <Table
        cols="1.05fr 1.4fr 1fr 1fr .8fr"
        head={["Référence", "Cliente", "Paiement", "Statut", "Total"]}
        rows={liste}
        keyOf={(o) => o.id}
        pageSize={20}
        unite="commandes"
        onRow={(o) => setOuverte(o.id)}
        empty={
          recherche || filtre !== "toutes"
            ? "Aucune commande ne correspond à ce filtre."
            : "Aucune commande enregistrée."
        }
        cells={(o) => {
          const cliente = nomDe(o.customerId);
          return [
            <span key="r" className="font-bold tabular-nums">
              {o.ref}
              <span className="mt-0.5 block text-[11.5px] font-medium text-muted">
                {dateLongue(o.createdAt)}
              </span>
            </span>,
            <span key="c" className="block truncate">
              {cliente?.name ?? "Cliente supprimée"}
              <span className="mt-0.5 block truncate text-[11.5px] text-muted">{o.city}</span>
            </span>,
            <span key="p" className="text-[13px]">
              {PAYMENT_LABELS[o.payment] ?? o.payment}
            </span>,
            <OrderChip key="s" status={o.status} />,
            <span key="t" className="font-extrabold tabular-nums">
              {formatXOF(o.total)}
            </span>,
          ];
        }}
      />

      <DetailCommande
        commande={commande}
        nom={commande ? (nomDe(commande.customerId)?.name ?? null) : null}
        telephone={commande ? (nomDe(commande.customerId)?.phone ?? null) : null}
        onClose={() => setOuverte(null)}
        onStatut={(statut) => commande && setOrderStatus(commande.id, statut)}
      />
    </>
  );
}

function DetailCommande({
  commande,
  nom,
  telephone,
  onClose,
  onStatut,
}: {
  commande: Order | null;
  nom: string | null;
  telephone: string | null;
  onClose: () => void;
  onStatut: (statut: OrderStatus) => void;
}) {
  if (!commande) return null;

  const etape = ORDER_PIPELINE.indexOf(commande.status);
  const suivante = etape >= 0 && etape < ORDER_PIPELINE.length - 1 ? ORDER_PIPELINE[etape + 1] : null;
  const articles = commande.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <Modal open onClose={onClose} title={commande.ref} wide>
      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-start">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <OrderChip status={commande.status} />
            <span className="text-[12.5px] text-muted">{dateLongue(commande.createdAt)}</span>
          </div>

          <ul className="flex flex-col gap-2.5">
            {commande.lines.map((l, i) => (
              <li
                key={`${l.productId}-${i}`}
                className="flex items-baseline gap-3 rounded-2xl bg-mist px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold">{l.name}</span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    Taille {l.size} · ×{l.quantity}
                  </span>
                </span>
                <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums">
                  {formatXOF(l.price * l.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3.5">
            <span className="text-[13px] text-muted">
              {articles} article{articles > 1 ? "s" : ""}
            </span>
            <strong className="text-[17px] font-extrabold tabular-nums">
              {formatXOF(commande.total)}
            </strong>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-mist p-4">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-muted">Cliente</p>
            <p className="mt-1.5 text-[13.5px] font-bold">{nom ?? "Cliente supprimée"}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">{commande.city}</p>
            {telephone && <p className="mt-0.5 text-[12.5px] tabular-nums text-muted">{telephone}</p>}
            <p className="mt-2.5 text-[12.5px]">
              Paiement&nbsp;: <strong>{PAYMENT_LABELS[commande.payment] ?? commande.payment}</strong>
            </p>
          </div>

          <div>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-muted">
              Avancement
            </p>
            <ol className="flex flex-col gap-1.5">
              {ORDER_PIPELINE.map((s, i) => {
                const passe = etape >= 0 && i <= etape;
                return (
                  <li key={s} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${
                        passe ? "bg-rose text-white" : "bg-stone text-muted"
                      }`}
                    >
                      {passe ? <IconCheck className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={passe ? "font-bold" : "text-muted"}>{STATUS_LABELS[s]}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="flex flex-col gap-2">
            {suivante && (
              <Button variant="rose" onClick={() => onStatut(suivante)}>
                <IconCheck />
                Passer à «&nbsp;{STATUS_LABELS[suivante]}&nbsp;»
              </Button>
            )}
            {commande.status !== "annulee" && commande.status !== "livree" && (
              <Button variant="danger" onClick={() => onStatut("annulee")}>
                <IconX />
                Annuler la commande
              </Button>
            )}
            {commande.status === "annulee" && (
              <p className="rounded-2xl bg-rose-soft px-4 py-3 text-[12.5px] leading-relaxed text-rose-deep">
                Commande annulée.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
