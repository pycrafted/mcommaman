import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { Home } from "@/components/home";
import { lireArborescence, lireFacettes, lirePageCatalogue } from "@/lib/catalogue";
import { lireBandeau, lireCampagnes } from "@/lib/reglages";

/* L'accueil est la boutique : il montre toutes les pièces publiées, et ses
   filtres les restreignent ensuite depuis le navigateur. Le plafond est celui
   de l'API. */
const TOUTES = 500;

/* Tout ce que l'accueil montre vient du serveur : les pièces, leurs facettes,
   les rayons, le bandeau. Rien n'est écrit dans la page. */
export default async function Page() {
  const [tous, facettes, categories, campagnes, bandeau] = await Promise.all([
    lirePageCatalogue({ parPage: TOUTES }),
    lireFacettes(),
    lireArborescence(),
    lireCampagnes(),
    lireBandeau(),
  ]);

  return (
    <>
      <Header />
      <main>
        <Home
          boutique={{ produits: tous.produits, total: tous.total, facettes }}
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
