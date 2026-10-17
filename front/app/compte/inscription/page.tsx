import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Créez votre compte M comme Maman : adresses de livraison enregistrées et tailles suivies.",
  robots: { index: false },
};

export default function Page(): never {
  redirect("/?ouvrirCompte=inscription");
}
