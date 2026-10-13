import type { Metadata } from "next";
import { Header } from "@/components/header";
import { CartDrawer } from "@/components/cart-drawer";
import { AccountProfile } from "@/components/account-profile";

export const metadata: Metadata = { title: "Mon profil", robots: { index: false } };

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <AccountProfile />
      </main>
      <CartDrawer />
    </>
  );
}
