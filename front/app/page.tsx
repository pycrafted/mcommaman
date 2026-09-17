import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { Home } from "@/components/home";
import { lireArborescence, lireCatalogue, lireProduitsParIds } from "@/lib/catalogue";
import { lireBandeau, lireCampagnes, lireReglages, lireVideosAccueil } from "@/lib/reglages";

/* Tout ce que l'accueil montre vient du serveur : les pièces, les rayons et
   leurs visuels, le bandeau. Rien n'est écrit dans la page. */
export default async function Page() {
  const [products, categories, bandeau, campagnes, reglages, videos] = await Promise.all([
    lireCatalogue(),
    lireArborescence(),
    lireBandeau(),
    lireCampagnes(),
    lireReglages(),
    lireVideosAccueil(),
  ]);
  /* La carte posée sur la photo fait défiler les pièces choisies dans le
     back-office ; sans choix, les dernières arrivées. */
  const choisies = await lireProduitsParIds(reglages.hero_produits.map(String));
  const vedettes = choisies.length > 0 ? choisies : products;

  return (
    <>
      <Header />
      <main>
        <Home
          products={products}
          categories={categories}
          vedettes={vedettes}
          videos={videos}
          bandeau={bandeau}
          campagnes={campagnes}
        />
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
