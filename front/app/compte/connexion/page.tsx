import type { Metadata } from "next";
import { Header } from "@/components/header";
import { CartDrawer } from "@/components/cart-drawer";
import { LoginForm } from "@/components/account-auth";

export const metadata: Metadata = {
  title: "Se connecter",
  description: "Connectez-vous à votre espace M comme Maman pour retrouver vos adresses de livraison.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <LoginForm />
      </main>
      <CartDrawer />
    </>
  );
}
