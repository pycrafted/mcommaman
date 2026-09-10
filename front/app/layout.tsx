import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-context";
import { CartProvider } from "@/components/cart-context";
import { OrdersProvider } from "@/components/orders-context";
import { ReviewsProvider } from "@/components/reviews-context";
import { FavoritesProvider } from "@/components/favorites-context";
import { ReglagesProvider } from "@/components/reglages-context";
import { lireReglages } from "@/lib/reglages";

export const metadata: Metadata = {
  title: {
    default: "M comme Maman — vêtements d'enfant à Dakar",
    template: "%s · M comme Maman",
  },
  description:
    "Vêtements d'enfant de 0 à 15 ans choisis pièce par pièce à Dakar. Livraison 24 h, paiement Wave, Orange Money ou à la livraison.",
  openGraph: {
    title: "M comme Maman — vêtements d'enfant à Dakar",
    description: "Le monde des mamans. Livraison 24 h sur Dakar, paiement mobile money.",
    locale: "fr_SN",
    type: "website",
  },
};

/* Les réglages de la boutique sont lus une fois ici, au-dessus de tout le
   reste : frais de livraison, identité, ouverture de la caisse. Les lire à
   la racine évite que chaque page les redemande, et ils arrivent dans le
   HTML servi plutôt qu'après coup. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const reglages = await lireReglages();

  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <ReglagesProvider valeur={reglages}>
          <AuthProvider>
            <OrdersProvider>
              <ReviewsProvider>
                <FavoritesProvider>
                  <CartProvider>{children}</CartProvider>
                </FavoritesProvider>
              </ReviewsProvider>
            </OrdersProvider>
          </AuthProvider>
        </ReglagesProvider>
      </body>
    </html>
  );
}
