"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { IconCheck, IconPlus, IconRefresh, IconX } from "@/components/admin/icons";

type Filtre = OrderStatus | "toutes";

export default function Page() {
  const { orders, customers, setOrderStatus, restoreOrder, hydrated } = useAdmin();
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
      if (!cible) return;
      setOuverte(cible.id);
      // L'ancre a servi : elle ne reste pas dans la barre d'adresse.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
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
          (cliente?.name.toLowerCase().includes(q) ?? false) ||
          (o.customerName?.toLowerCase().includes(q) ?? false)
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
      >
        {/* Une vente conclue sur WhatsApp ou à la boutique se saisit ici : sans
            elle, le stock resterait faux. */}
        <Link href="/admin/commandes/nouvelle">
          <Button variant="rose">
            <IconPlus />
            Nouvelle commande
          </Button>
        </Link>
      </PageHeader>

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
              {cliente?.name ?? o.customerName ?? "Cliente"}
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
        nom={commande ? (nomDe(commande.customerId)?.name ?? commande.customerName ?? null) : null}
        telephone={
          commande ? (nomDe(commande.customerId)?.phone || commande.customerPhone || null) : null
        }
        onClose={() => setOuverte(null)}
        onStatut={(statut) => commande && setOrderStatus(commande.id, statut)}
        onRetablir={() => commande && restoreOrder(commande.ref)}
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
  onRetablir,
}: {
  commande: Order | null;
  nom: string | null;
  telephone: string | null;
  onClose: () => void;
  onStatut: (statut: OrderStatus) => void;
  onRetablir: () => void;
}) {
  /* Une annulation remet le stock et sort la commande du circuit, sans retour
     possible : elle se confirme. */
  const [confirmeAnnulation, setConfirmeAnnulation] = useState(false);
  const [confirmeRetablissement, setConfirmeRetablissement] = useState(false);

  if (!commande) return null;

  const etape = ORDER_PIPELINE.indexOf(commande.status);
  const suivante = etape >= 0 && etape < ORDER_PIPELINE.length - 1 ? ORDER_PIPELINE[etape + 1] : null;
  const articles = commande.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    /* Tant que la confirmation est ouverte, Échap ne ferme qu'elle. */
    <Modal
      open
      onClose={confirmeAnnulation || confirmeRetablissement ? () => undefined : onClose}
      title={commande.ref}
      wide
    >
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
                  {/* L'option est déjà rédigée : « Bleu nuit · 6 ». */}
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {l.size ? `${l.size} · ` : ""}×{l.quantity}
                  </span>
                </span>
                <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums">
                  {formatXOF(l.price * l.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {/* Le total se détaille : sans la livraison, il ne tombait pas juste
              avec les articles au-dessus. */}
          <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3.5 text-[13px]">
            {commande.subtotal !== undefined && (
              <div className="flex justify-between text-muted">
                <dt>
                  {articles} article{articles > 1 ? "s" : ""}
                </dt>
                <dd className="tabular-nums">{formatXOF(commande.subtotal)}</dd>
              </div>
            )}
            {commande.shipping !== undefined && (
              <div className="flex justify-between text-muted">
                <dt>Livraison</dt>
                <dd className="tabular-nums">
                  {commande.shipping === 0 ? "Offerte" : formatXOF(commande.shipping)}
                </dd>
              </div>
            )}
            {Boolean(commande.discount) && (
              <div className="flex justify-between text-[#2e7d52]">
                <dt>Remise</dt>
                <dd className="tabular-nums">−{formatXOF(commande.discount ?? 0)}</dd>
              </div>
            )}
            <div className="mt-1 flex items-baseline justify-between">
              <dt className="font-bold">Total</dt>
              <dd className="text-[17px] font-extrabold tabular-nums">
                {formatXOF(commande.total)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-mist p-4">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-muted">Cliente</p>
            <p className="mt-1.5 text-[13.5px] font-bold">{nom ?? "Cliente"}</p>
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
              <Button variant="danger" onClick={() => setConfirmeAnnulation(true)}>
                <IconX />
                Annuler la commande
              </Button>
            )}
            {commande.status === "annulee" && (
              <>
                <p className="rounded-2xl bg-rose-soft px-4 py-3 text-[12.5px] leading-relaxed text-rose-deep">
                  Commande annulée.
                </p>
                {/* Une annulation faite par erreur se rattrape, tant que le
                    stock le permet : c'est le serveur qui vérifie. */}
                <Button variant="ghost" onClick={() => setConfirmeRetablissement(true)}>
                  <IconRefresh />
                  Rétablir la commande
                </Button>
              </>
            )}
          </div>

          <Modal
            open={confirmeRetablissement}
            onClose={() => setConfirmeRetablissement(false)}
            title={`Rétablir la commande ${commande.ref} ?`}
          >
            <p className="text-[13.5px] leading-relaxed text-muted">
              Elle repart « En attente », à ses prix d&apos;origine, et ses articles sont de nouveau
              retirés du stock. Si l&apos;un d&apos;eux n&apos;est plus disponible en quantité
              suffisante, la commande reste annulée.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setConfirmeRetablissement(false)}>
                Laisser annulée
              </Button>
              <Button
                variant="rose"
                onClick={() => {
                  setConfirmeRetablissement(false);
                  onRetablir();
                }}
              >
                <IconRefresh />
                Oui, rétablir
              </Button>
            </div>
          </Modal>

          <Modal
            open={confirmeAnnulation}
            onClose={() => setConfirmeAnnulation(false)}
            title={`Annuler la commande ${commande.ref} ?`}
          >
            <p className="text-[13.5px] leading-relaxed text-muted">
              Les articles reviennent en stock et la commande ne pourra plus avancer. Cette
              action est définitive.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setConfirmeAnnulation(false)}>
                Garder la commande
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmeAnnulation(false);
                  onStatut("annulee");
                }}
              >
                <IconX />
                Oui, annuler
              </Button>
            </div>
          </Modal>
        </div>
      </div>
    </Modal>
  );
}
