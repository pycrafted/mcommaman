"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatXOF } from "@/lib/format";
import {
  PAYMENT_LABELS,
  STATUTS_ENCAISSES,
  buildDailySeries,
  computePeriod,
  computeProductPerformance,
  deltaPercent,
  useAdmin,
} from "@/lib/admin/store";
import { lireTousLesProduits } from "@/lib/admin/produits";
import type { AdminProduct, Order } from "@/lib/admin/types";
import {
  BarChart,
  CARTE,
  Kpi,
  OrderChip,
  PageHeader,
  Pills,
  Section,
  Table,
  dateCourte,
} from "@/components/admin/ui";
import { IconArrowRight } from "@/components/admin/icons";

const FENETRES = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
] as const;

/** « +18 % » ou rien : un pourcentage sans période de comparaison ne veut rien dire. */
function ecart(courant: number, precedent: number) {
  const d = deltaPercent(courant, precedent);
  if (d === null) return { texte: "pas de période précédente", tone: "#7a6b72" };
  const signe = d >= 0 ? "+" : "−";
  return {
    texte: `${signe}${Math.abs(d).toFixed(0)} % sur la période précédente`,
    tone: d >= 0 ? "#2e7d52" : "#b3306a",
  };
}

const encaisse = (o: Order) => STATUTS_ENCAISSES.includes(o.status);

/** Liste en barres horizontales : une répartition se lit mieux qu'un camembert. */
function Repartition({
  lignes,
  format,
}: {
  lignes: { cle: string; label: string; valeur: number }[];
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  if (lignes.length === 0) return <p className="text-[13px] text-muted">Rien à répartir.</p>;

  return (
    <ul className="flex flex-col gap-2.5">
      {lignes.map((l) => (
        <li key={l.cle}>
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 truncate font-semibold">{l.label}</span>
            <span className="shrink-0 tabular-nums text-muted">{format(l.valeur)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone">
            <span
              className="block h-full rounded-full bg-rose transition-[width] duration-700 ease-soft"
              style={{ width: `${(l.valeur / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  const { orders, customers, activity, settings, hydrated, versionProduits } = useAdmin();
  /* Les analyses croisent chaque fiche avec les ventes : c'est la seule page
     qui lit tout le catalogue, et elle le fait à l'ouverture seulement. */
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [produitsPrets, setProduitsPrets] = useState(false);
  useEffect(() => {
    let vivant = true;
    lireTousLesProduits()
      .then((liste) => vivant && setProducts(liste))
      .catch(() => undefined)
      .finally(() => vivant && setProduitsPrets(true));
    return () => {
      vivant = false;
    };
  }, [versionProduits]);
  const [fenetre, setFenetre] = useState<(typeof FENETRES)[number]["value"]>("30");
  const jours = Number(fenetre);

  const courant = useMemo(() => computePeriod(orders, jours), [orders, jours]);
  const precedent = useMemo(() => computePeriod(orders, jours, 1), [orders, jours]);
  const serie = useMemo(() => buildDailySeries(orders, Math.min(jours, 30)), [orders, jours]);

  const performances = useMemo(
    () => computeProductPerformance(products, orders),
    [products, orders]
  );
  const meilleurs = performances.slice(0, 5);

  /* Une fiche publiée qui n'a jamais rien vendu n'est pas forcément mauvaise :
     c'est souvent la photo, le prix ou l'absence de mise en avant. */
  const sansVente = useMemo(
    () => performances.filter((p) => p.units === 0 && p.product.status === "publie").slice(0, 6),
    [performances]
  );

  const parRayon = useMemo(() => {
    const table = new Map<string, number>();
    for (const o of orders) {
      if (!encaisse(o)) continue;
      for (const ligne of o.lines) {
        const fiche = products.find((p) => p.id === ligne.productId);
        const cle = fiche?.category ?? "Autre";
        table.set(cle, (table.get(cle) ?? 0) + ligne.price * ligne.quantity);
      }
    }
    return [...table.entries()]
      .map(([cle, valeur]) => ({ cle, label: cle, valeur }))
      .sort((a, b) => b.valeur - a.valeur);
  }, [orders, products]);

  const parPaiement = useMemo(() => {
    const table = new Map<string, number>();
    for (const o of orders) {
      if (!encaisse(o)) continue;
      table.set(o.payment, (table.get(o.payment) ?? 0) + o.total);
    }
    return [...table.entries()]
      .map(([cle, valeur]) => ({ cle, label: PAYMENT_LABELS[cle] ?? cle, valeur }))
      .sort((a, b) => b.valeur - a.valeur);
  }, [orders]);

  const parVille = useMemo(() => {
    const table = new Map<string, number>();
    for (const o of orders) {
      if (!encaisse(o)) continue;
      table.set(o.city, (table.get(o.city) ?? 0) + o.total);
    }
    return [...table.entries()]
      .map(([cle, valeur]) => ({ cle, label: cle, valeur }))
      .sort((a, b) => b.valeur - a.valeur)
      .slice(0, 6);
  }, [orders]);

  const recentes = useMemo(
    () => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [orders]
  );

  const alertes = useMemo(
    () =>
      products
        .filter((p) => p.status === "publie" && p.stock <= settings.lowStockThreshold)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
    [products, settings.lowStockThreshold]
  );

  if (!hydrated || !produitsPrets) {
    return <p className="text-[13px] text-muted">Lecture des statistiques…</p>;
  }

  const ruptures = products.filter((p) => p.status === "publie" && p.stock <= 0).length;
  const chiffre = ecart(courant.revenue, precedent.revenue);
  const panier = ecart(courant.averageBasket, precedent.averageBasket);

  return (
    <>
      <PageHeader
        eyebrow="Analyse"
        title="Statistiques"
        sub={`Comparaison automatique avec la période précédente de même durée — ${customers.length} clientes, ${orders.length} commandes.`}
      >
        <Pills value={fenetre} onChange={setFenetre} options={[...FENETRES]} />
      </PageHeader>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={`Chiffre d'affaires · ${jours} j`}
          value={formatXOF(courant.revenue)}
          hint={chiffre.texte}
          tone={chiffre.tone}
        />
        <Kpi
          label="Commandes"
          value={String(courant.orders)}
          hint={`${Math.round(courant.cancelRate * 100)} % annulées`}
          tone={courant.cancelRate > 0.15 ? "#b3306a" : "#7a6b72"}
        />
        <Kpi
          label="Panier moyen"
          value={formatXOF(courant.averageBasket)}
          hint={panier.texte}
          tone={panier.tone}
        />
        <Kpi
          label="Ruptures"
          value={String(ruptures)}
          hint={ruptures > 0 ? "produits publiés sans stock" : "aucun produit en rupture"}
          tone={ruptures > 0 ? "#b3306a" : "#2e7d52"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <Section
          title="Ventes encaissées"
          sub={`Jour par jour sur ${serie.length} jours. Les commandes annulées ou en attente de paiement n'y figurent pas.`}
        >
          <BarChart
            points={serie.map((p) => ({ label: p.label, value: p.revenue }))}
            format={(v) => formatXOF(v)}
          />
        </Section>

        <Section
          title="À surveiller"
          sub="Produits publiés dont le stock passe sous le seuil réglé."
          action={
            <Link
              href="/admin/produits"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-rose"
            >
              Le catalogue
              <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {alertes.length === 0 ? (
            <p className="text-[13px] text-muted">
              Rien à réapprovisionner : tout ce qui est publié a du stock.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {alertes.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-mist px-3.5 py-2.5">
                  <span
                    className="h-11 w-9 shrink-0 rounded-lg bg-stone bg-cover bg-center"
                    style={{ backgroundImage: `url(${p.image})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/admin/produits/${p.id}`}
                      className="line-clamp-1 text-[13px] font-bold transition-colors hover:text-rose"
                    >
                      {p.name}
                    </Link>
                    <span className="mt-0.5 block text-[11.5px] text-muted">{p.sku}</span>
                  </span>
                  <span
                    className={`shrink-0 text-[13px] font-extrabold tabular-nums ${
                      p.stock <= 0 ? "text-rose-deep" : "text-[#8a6a12]"
                    }`}
                  >
                    {p.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Section title="Répartition par rayon" sub="Chiffre d'affaires encaissé.">
          <Repartition lignes={parRayon} format={formatXOF} />
        </Section>
        <Section title="Moyens de paiement" sub="Ce que les clientes choisissent vraiment.">
          <Repartition lignes={parPaiement} format={formatXOF} />
        </Section>
        <Section title="Villes les plus actives" sub="Par ville de livraison.">
          <Repartition lignes={parVille} format={formatXOF} />
        </Section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-[15px] font-extrabold tracking-tight">Dernières commandes</h2>
            <Link
              href="/admin/commandes"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-rose"
            >
              Toutes les commandes
              <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Table
            cols="1.1fr 1.3fr .9fr .9fr"
            head={["Référence", "Cliente", "Statut", "Total"]}
            rows={recentes}
            keyOf={(o) => o.id}
            pageSize={0}
            empty="Aucune commande enregistrée."
            cells={(o) => {
              const cliente = customers.find((c) => c.id === o.customerId);
              return [
                <Link
                  key="ref"
                  href={`/admin/commandes#${o.ref}`}
                  className="font-bold tabular-nums transition-colors hover:text-rose"
                >
                  {o.ref}
                </Link>,
                <span key="c" className="block truncate">
                  {cliente?.name ?? "Cliente supprimée"}
                  <span className="block text-[11.5px] text-muted">{dateCourte(o.createdAt)}</span>
                </span>,
                <OrderChip key="s" status={o.status} />,
                <span key="t" className="font-extrabold tabular-nums">
                  {formatXOF(o.total)}
                </span>,
              ];
            }}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Meilleures ventes" sub="Sur toutes les commandes encaissées.">
            {meilleurs.every((m) => m.units === 0) ? (
              <p className="text-[13px] text-muted">Aucune vente encaissée pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {meilleurs.map((m, i) => (
                  <li key={m.product.id} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-soft text-[11.5px] font-extrabold text-rose-deep">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-[13px] font-bold">{m.product.name}</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted">
                        {m.units} vendu{m.units > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums">
                      {formatXOF(m.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Produits sans vente"
            sub="À retravailler : photo, prix ou mise en avant."
          >
            {sansVente.length === 0 ? (
              <p className="text-[13px] text-muted">
                Tous les produits publiés ont vendu au moins une fois.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sansVente.map((m) => (
                  <li key={m.product.id} className="flex items-center gap-2.5">
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/admin/produits/${m.product.id}`}
                        className="line-clamp-1 text-[13px] font-semibold transition-colors hover:text-rose"
                      >
                        {m.product.name}
                      </Link>
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-muted">
                      {formatXOF(m.product.price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Journal" sub="Les quarante dernières actions faites ici.">
            {activity.length === 0 ? (
              <p className="text-[13px] text-muted">Rien encore.</p>
            ) : (
              <ul className={`${CARTE} divide-y divide-[#f4edf0] border-0`}>
                {[...activity]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .slice(0, 7)
                  .map((a) => (
                    <li key={a.id} className="py-2.5 text-[12.5px] leading-relaxed first:pt-0">
                      <strong className="font-bold">{a.author}</strong> {a.action}{" "}
                      <span className="text-muted">{a.target}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{dateCourte(a.at)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
