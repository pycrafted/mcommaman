import type { Metadata } from "next";
import { Header } from "@/components/header";
import { CartDrawer } from "@/components/cart-drawer";
import { OrdersList } from "@/components/orders-list";

export const metadata: Metadata = { title: "Mes commandes", robots: { index: false } };

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <OrdersList />
      </main>
      <CartDrawer />
    </>
  );
}
