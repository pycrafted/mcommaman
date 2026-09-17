"use client";

import Link from "next/link";
import { formatXOF } from "@/lib/format";
import { maintenant, computePeriod, useAdmin } from "@/lib/admin/store";
import { Button, PageHeader } from "@/components/admin/ui";
import {
  IconArrowRight,
  IconBox,
  IconCart,
  IconGear,
  IconGrid,
  IconPercent,
  IconSliders,
  IconTagAdmin,
  IconUsers,
} from "@/components/admin/icons";

type Icone = typeof IconBox;

/** Carte d'accès à une rubrique du back-office. */
function CarteRubrique({
  href,
  titre,
  chiffre,
  legende,
  description,
  Icone,
}: {
  href: string;
  titre: string;
  chiffre: string;
  legende: string;
  description: string;
  Icone: Icone;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[22px] border border-line bg-white p-6 transition-all duration-400 ease-soft hover:-translate-y-1 hover:border-rose/50 sm:p-7"
    >
      {/* Le voile rose monte du bas au survol : la carte s'allume sans déplacer
          d'un pixel le texte qu'elle porte. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0 bg-linear-to-t from-rose/8 to-transparent transition-all duration-500 ease-soft group-hover:h-full" />

      <span className="relative flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mist text-ink transition-colors duration-300 group-hover:bg-rose group-hover:text-white">
          <Icone className="h-5 w-5" />
        </span>
        <IconArrowRight className="h-4 w-4 -translate-x-1 text-muted opacity-0 transition-all duration-300 ease-soft group-hover:translate-x-0 group-hover:opacity-100" />
      </span>

      <span className="relative mt-5 block text-[17px] font-extrabold tracking-tight">{titre}</span>

      <span className="relative mt-1.5 flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold tabular-nums tracking-[-.03em]">{chiffre}</span>
        <span className="text-[12px] text-muted">{legende}</span>
      </span>

      <span className="relative mt-2 block text-[12px] leading-relaxed text-muted">
        {description}
      </span>
    </Link>
  );
}

export default function Page() {
  const { compteursProduits, orders, customers, categories, promotions, settings, library, hydrated } =
    useAdmin();

  if (!hydrated) return <p className="text-[13px] text-muted">Lecture du back-office…</p>;

  const aPreparer = orders.filter((o) => o.status === "en_attente").length;
  /* Compté par le serveur, au seuil réglé : le catalogue n'est pas chargé ici. */
  const stockFaible = compteursProduits.stock_bas;
  const periode = computePeriod(orders, 30);

  /* Le vrai jour : les commandes viennent de la base, une campagne « en
     cours » l'est par rapport à aujourd'hui. */
  const aujourdhui = maintenant().toISOString().slice(0, 10);
  const promosEnCours = promotions.filter((p) => p.active && p.startsAt <= aujourdhui).length;

  return (
    <>
      <PageHeader
        eyebrow={maintenant().toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })}
        title="Tableau de bord"
        sub={`${settings.storeName} — choisissez une rubrique.`}
      >
        <Link href="/admin/produits/nouveau">
          <Button variant="rose">Nouveau produit</Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CarteRubrique
          href="/admin/produits"
          titre="Produits"
          chiffre={String(compteursProduits.tous)}
          legende="produits au catalogue"
          description={
            stockFaible > 0
              ? `${stockFaible} produit${stockFaible > 1 ? "s" : ""} sous le seuil de stock`
              : "Stocks au vert"
          }
          Icone={IconBox}
        />
        <CarteRubrique
          href="/admin/categories"
          titre="Catégories"
          chiffre={String(categories.filter((c) => c.active).length)}
          legende="rayons visibles"
          description="Visuels, descriptions et rayons liés"
          Icone={IconTagAdmin}
        />
        <CarteRubrique
          href="/admin/promotions"
          titre="Promotions"
          chiffre={String(promosEnCours)}
          legende={promosEnCours > 1 ? "campagnes en cours" : "campagne en cours"}
          description={`${promotions.length} campagne${promotions.length > 1 ? "s" : ""} enregistrée${
            promotions.length > 1 ? "s" : ""
          }`}
          Icone={IconPercent}
        />
        <CarteRubrique
          href="/admin/commandes"
          titre="Commandes"
          chiffre={String(aPreparer)}
          legende="à préparer"
          description={`${orders.length} commandes depuis l'ouverture`}
          Icone={IconCart}
        />
        <CarteRubrique
          href="/admin/clients"
          titre="Clientes"
          chiffre={String(customers.length)}
          legende="inscrites"
          description={`${periode.customers} actives sur les 30 derniers jours`}
          Icone={IconUsers}
        />
        <CarteRubrique
          href="/admin/configuration"
          titre="Configuration"
          chiffre={String(library.sizes.length + library.colors.length)}
          legende="tailles et coloris"
          description={`${library.media.length} photos en photothèque`}
          Icone={IconSliders}
        />
        <CarteRubrique
          href="/admin/reglages"
          titre="Réglages"
          chiffre={settings.currency}
          legende="devise"
          description={`Livraison offerte dès ${formatXOF(settings.freeShippingThreshold)}`}
          Icone={IconGear}
        />
        {/* Cette huitième carte n'existe pas sur 3001, où la page d'analyse
            n'est reliée à rien. Ici elle est au moins accessible. */}
        <CarteRubrique
          href="/admin/statistiques"
          titre="Statistiques"
          chiffre={formatXOF(periode.revenue)}
          legende="sur 30 jours"
          description="Ventes jour par jour, rayons, moyens de paiement, villes"
          Icone={IconGrid}
        />
      </div>
    </>
  );
}
