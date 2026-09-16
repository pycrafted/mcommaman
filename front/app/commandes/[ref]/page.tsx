import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { OrderDetail } from "@/components/order-detail";

export const metadata: Metadata = { title: "Suivi de commande", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;

  return (
    <>
      <Header />
      <main>
        {/* La commande vit dans le navigateur : le serveur ne sait pas si elle
            existe, seul le client peut le dire. `useSearchParams` lit `?nouvelle=1`,
            d'où le Suspense. */}
        <Suspense
          fallback={<div className="mx-auto max-w-[1180px] px-5 py-20 text-muted md:px-10">Chargement…</div>}
        >
          <OrderDetail orderRef={decodeURIComponent(ref)} />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
