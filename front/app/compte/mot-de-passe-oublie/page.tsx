import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  description: "Recevez un lien pour choisir un nouveau mot de passe.",
  robots: { index: false },
};

export default function Page(): never {
  redirect("/?ouvrirCompte=oubli");
}
