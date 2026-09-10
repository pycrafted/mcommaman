import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { CoinMaman } from "@/components/coin-maman";
import { lireCatalogue, lireRayonsNavigables } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Coin Maman",
  description:
    "Tissus au coupon et voiles choisis à Dakar. Bazin riche, wax, soie et voiles brodés — pour les mamans qui repartent avec de quoi se coudre quelque chose.",
};

/* La pastille demandée est lue ici plutôt que dans le navigateur : la page
   part donc déjà filtrée, et son contenu reste dans le HTML servi. Un « ?cat= »
   qui ne correspond à aucune catégorie retombe sur « Tout » — mieux vaut la
   page entière qu'une grille vide. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const [{ cat }, produits, rayons] = await Promise.all([
    searchParams,
    lireCatalogue({ univers: "maman" }),
    lireRayonsNavigables("maman"),
  ]);
  const demande = rayons.some((r) => r.nom === cat) ? cat! : "Tout";

  return (
    <>
      <Header />
      <main>
        <CoinMaman produits={produits} rayons={rayons} rayonInitial={demande} />
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
