"use client";

import { createContext, useContext, type ReactNode } from "react";
import { REGLAGES_DEFAUT, type Reglages } from "@/lib/reglages";

/**
 * Les réglages de la boutique, mis à disposition de toute la vitrine.
 *
 * Ils sont lus une seule fois, par `app/layout.tsx`, côté serveur : le tunnel
 * de commande, le pied de page et la page contact les trouvent ici sans
 * refaire l'appel chacun de leur côté.
 *
 * Pas de `hydrated` ni de lecture différée, contrairement au panier ou aux
 * favoris : la valeur arrive déjà remplie du serveur, les deux rendus sont
 * identiques par construction.
 */
const ReglagesContext = createContext<Reglages>(REGLAGES_DEFAUT);

export function ReglagesProvider({
  valeur,
  children,
}: {
  valeur: Reglages;
  children: ReactNode;
}) {
  return <ReglagesContext.Provider value={valeur}>{children}</ReglagesContext.Provider>;
}

export function useReglages(): Reglages {
  return useContext(ReglagesContext);
}
