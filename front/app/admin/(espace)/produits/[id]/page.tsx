"use client";

import { use } from "react";
import Link from "next/link";
import { useAdmin } from "@/lib/admin/store";
import { useFicheProduit } from "@/lib/admin/produits";
import { ProductForm } from "@/components/product-form";
import { Button, EmptyState } from "@/components/admin/ui";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hydrated } = useAdmin();
  /* La fiche est lue seule, variantes et galerie comprises : le back-office
     ne garde plus tout le catalogue en mémoire. */
  const fiche = useFicheProduit(id);

  if (!hydrated || fiche === undefined) {
    return <p className="text-[13px] text-muted">Ouverture du produit…</p>;
  }

  if (!fiche) {
    return (
      <EmptyState
        title="Produit introuvable"
        hint="Elle a peut-être été supprimée depuis un autre onglet."
        action={
          <Link href="/admin/produits">
            <Button variant="rose">Retour aux produits</Button>
          </Link>
        }
      />
    );
  }

  return <ProductForm key={fiche.id} product={fiche} />;
}
