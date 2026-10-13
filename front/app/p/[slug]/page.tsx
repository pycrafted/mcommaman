import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { CartDrawer } from "@/components/cart-drawer";
import { ProductDetail } from "@/components/product-detail";
import { lireFiche, lireSimilaires } from "@/lib/catalogue";

/* Plus de pré-génération : les fiches viennent de la base, et une fiche
   publiée après la construction du site doit être visible tout de suite. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fiche = await lireFiche(slug);
  if (!fiche) return { title: "Produit introuvable" };
  const product = fiche.produit;
  return {
    title: product.name,
    description: product.description,
    openGraph: { title: product.name, description: product.description, images: [product.image] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fiche = await lireFiche(slug);
  if (!fiche) notFound();
  const product = fiche.produit;
  const similaires = await lireSimilaires(slug);

  // Donnée structurée : absente de l'ancien site (défaut #19).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: fiche.brut.variantes?.[0]?.sku ?? "",
    image: [product.image],
    brand: { "@type": "Brand", name: "M comme Maman" },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "XOF",
      availability: product.outOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header />
      <main>
        <ProductDetail product={product} fiche={fiche.brut} similaires={similaires} />
      </main>
      <CartDrawer />
    </>
  );
}
