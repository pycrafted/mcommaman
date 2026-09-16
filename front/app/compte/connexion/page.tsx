import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
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
        {/* `useSearchParams` lit `?suite=` : la page doit être rendue sous
            Suspense, comme le catalogue. */}
        <Suspense fallback={<div className="mx-auto max-w-[1180px] px-5 py-20 text-muted md:px-10">Chargement…</div>}>
          <LoginForm />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
