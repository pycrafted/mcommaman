import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { ResetPasswordForm } from "@/components/password-reset";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <Header />
      <main>
        {/* Le lien du courriel porte `?uid=` et `?jeton=` : `useSearchParams`
            impose de rendre la page sous Suspense, comme la connexion. */}
        <Suspense
          fallback={
            <div className="mx-auto max-w-[1180px] px-5 py-20 text-muted md:px-10">Chargement…</div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
