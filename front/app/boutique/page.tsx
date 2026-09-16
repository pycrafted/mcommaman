import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { Catalogue } from "@/components/catalogue";
import { lireCatalogue, lireRayons } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Toute la boutique M comme Maman : vêtements pour filles et garçons de 2 à 14 ans, tissus et voiles du Coin Maman. Livraison 24 h sur Dakar.",
};

/* Une seule page pour toute la boutique et pour chaque catégorie : « ?cat= »
   choisit la catégorie, « &sous= » une sous-catégorie. Le Coin Maman passe par
   là comme Filles ou Garçons. La page interroge le serveur, le composant se
   contente d'afficher : le rendu part rempli, sans attendre le JavaScript. */
export default async function Page() {
  const [produits, rayons] = await Promise.all([lireCatalogue(), lireRayons()]);

  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<div className="mx-auto max-w-[1400px] px-10 py-20 text-muted">Chargement…</div>}>
          <Catalogue produits={produits} rayons={rayons} />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
