import type { Metadata } from "next";
import { Header } from "@/components/header";
import { CartDrawer } from "@/components/cart-drawer";
import { SignupForm } from "@/components/account-auth";

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Créez votre compte M comme Maman : adresses de livraison enregistrées et tailles suivies.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <SignupForm />
      </main>
      <CartDrawer />
    </>
  );
}
