import type { Metadata } from "next";
import { Header } from "@/components/header";
import { CartDrawer } from "@/components/cart-drawer";
import { ChangePasswordForm } from "@/components/password-reset";

export const metadata: Metadata = {
  title: "Changer mon mot de passe",
  description: "Changez votre mot de passe avec l'actuel, ou recevez un lien par e-mail.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <ChangePasswordForm />
      </main>
      <CartDrawer />
    </>
  );
}
