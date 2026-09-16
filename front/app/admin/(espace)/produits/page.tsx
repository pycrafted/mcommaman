"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatXOF } from "@/lib/format";
import { useAdmin } from "@/lib/admin/store";
import { useProduits } from "@/lib/admin/produits";
import type { AdminProduct, ProductStatus } from "@/lib/admin/types";
import {
  Button,
  DeleteButton,
  Modal,
  PageHeader,
  Pills,
  ProductChip,
  SearchField,
  Table,
} from "@/components/admin/ui";
import { IconEye, IconPencil, IconPlus, IconRefresh } from "@/components/admin/icons";

type Filtre = ProductStatus | "tous" | "rupture";

/** Lignes par page. Le serveur ne renvoie que celles-là. */
const PAR_PAGE = 20;

const FILTRES: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "publie", label: "Publiés" },
  { value: "brouillon", label: "Brouillons" },
  { value: "rupture", label: "Ruptures" },
];

export default function Page() {
  const router = useRouter();
  const { compteursProduits, setProductStatus, duplicateProduct, deleteProduct, hydrated } =
    useAdmin();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [changementStatut, setChangementStatut] = useState<{
    produit: AdminProduct;
    statut: "publie" | "brouillon";
  } | null>(null);

  /* Un autre filtre ou une autre recherche repart de la première page. */
  useEffect(() => setPage(1), [filtre, recherche]);

  /* Le serveur filtre, trie et découpe : la page ne reçoit que ses vingt lignes. */
  const { produits: liste, total, pret, erreur } = useProduits({
    page,
    taille: PAR_PAGE,
    q: recherche,
    statut: filtre === "tous" || filtre === "rupture" ? undefined : filtre,
    rupture: filtre === "rupture",
  });

  const compte = (f: Filtre) =>
    f === "tous"
      ? compteursProduits.tous
      : f === "rupture"
        ? compteursProduits.rupture
        : compteursProduits[f];

  if (!hydrated || !pret) return <p className="text-[13px] text-muted">Lecture du catalogue…</p>;

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Produits"
        sub="Tout produit naît en brouillon. Un brouillon n'apparaît jamais en boutique, et un produit publié sans stock se signale de lui-même."
      >
        <Link href="/admin/produits/nouveau">
          <Button variant="rose">
            <IconPlus />
            Nouveau produit
          </Button>
        </Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchField
          value={recherche}
          onChange={setRecherche}
          placeholder="Nom, référence ou rayon…"
        />
        <Pills
          value={filtre}
          onChange={setFiltre}
          options={FILTRES.map((f) => ({ ...f, count: compte(f.value) }))}
        />
      </div>

      <Table
        cols="2fr .9fr .8fr .7fr .9fr 1.1fr"
        head={["Produit", "Référence", "Prix", "Stock", "Statut", ""]}
        rows={liste}
        keyOf={(p) => p.id}
        pageSize={PAR_PAGE}
        serveur={{ page, total, onPage: setPage }}
        unite="produits"
        empty={
          erreur
            ? erreur
            : recherche || filtre !== "tous"
            ? "Aucun produit ne correspond à ce filtre."
            : "Le catalogue est vide."
        }
        cells={(p: AdminProduct) => [
          <span key="n" className="flex min-w-0 items-center gap-3">
            <span
              className="h-11 w-9 shrink-0 rounded-lg bg-stone bg-cover bg-center"
              style={{ backgroundImage: `url(${p.image})` }}
            />
            <span className="min-w-0">
              <Link
                href={`/admin/produits/${p.id}`}
                className="line-clamp-1 font-bold transition-colors hover:text-rose"
              >
                {p.name}
              </Link>
              <span className="mt-0.5 block text-[11.5px] text-muted">
                {p.category}{p.materials.length ? ` · ${p.materials.join(", ")}` : ""}
              </span>
            </span>
          </span>,

          <span key="s" className="text-[12.5px] tabular-nums text-muted">
            {p.sku}
          </span>,

          <span key="p" className="font-extrabold tabular-nums">
            {formatXOF(p.price)}
          </span>,

          <span key="stock" className="text-[13px] font-semibold tabular-nums" title="Somme des stocks par option">
            {p.stock}
          </span>,

          <ProductChip key="st" status={p.status} stock={p.stock} />,

          <span key="a" className="flex flex-wrap items-center justify-end gap-1">
            {p.status === "publie" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setChangementStatut({ produit: p, statut: "brouillon" });
                }}
              >
                Dépublier
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setChangementStatut({ produit: p, statut: "publie" });
                }}
              >
                <IconEye />
                Publier
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                duplicateProduct(p.id);
              }}
              title="Dupliquer en brouillon"
            >
              <IconRefresh />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/admin/produits/${p.id}`);
              }}
              title="Modifier"
            >
              <IconPencil />
            </Button>
            <DeleteButton onConfirm={() => deleteProduct(p.id)} label="" />
          </span>,
        ]}
      />

      <Modal
        open={Boolean(changementStatut)}
        onClose={() => setChangementStatut(null)}
        title={changementStatut?.statut === "publie" ? "Publier ce produit ?" : "Dépublier ce produit ?"}
      >
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setChangementStatut(null)}>
            Annuler
          </Button>
          <Button
            variant="rose"
            onClick={() => {
              if (!changementStatut) return;
              setProductStatus(changementStatut.produit.id, changementStatut.statut);
              setChangementStatut(null);
            }}
          >
            Confirmer
          </Button>
        </div>
      </Modal>
    </>
  );
}
