import type { Metadata } from "next";
import { Header } from "@/components/header";
import { CartDrawer } from "@/components/cart-drawer";
import { AccountDashboard } from "@/components/account-dashboard";

export const metadata: Metadata = { title: "Mon espace", robots: { index: false } };

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <AccountDashboard />
      </main>
      <CartDrawer />
    </>
  );
}
