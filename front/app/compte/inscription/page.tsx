import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
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
        <Suspense fallback={<div className="mx-auto max-w-[1180px] px-5 py-20 text-muted md:px-10">Chargement…</div>}>
          <SignupForm />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
