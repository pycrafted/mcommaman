import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Se connecter",
  description: "Connectez-vous à votre espace M comme Maman pour retrouver vos adresses de livraison.",
  robots: { index: false },
};

export default function Page(): never {
  redirect("/?ouvrirCompte=connexion");
}
