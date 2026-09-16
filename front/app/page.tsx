import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { Home } from "@/components/home";
import { lireArborescence, lireCatalogue } from "@/lib/catalogue";
import { lireBandeau, lireCampagnes } from "@/lib/reglages";

/* Tout ce que l'accueil montre vient du serveur : les pièces, les rayons et
   leurs visuels, le bandeau. Rien n'est écrit dans la page. */
export default async function Page() {
  const [products, categories, bandeau, campagnes] = await Promise.all([
    lireCatalogue(),
    lireArborescence(),
    lireBandeau(),
    lireCampagnes(),
  ]);

  return (
    <>
      <Header />
      <main>
        <Home
          products={products}
          categories={categories}
          bandeau={bandeau}
          campagnes={campagnes}
        />
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
