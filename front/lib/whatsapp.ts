/**
 * Les messages WhatsApp préremplis.
 *
 * Une cliente qui écrit « je suis intéressée par la robe » oblige la boutique
 * à tout redemander : la taille, la quantité, le quartier, le moyen de
 * paiement. Ces messages arrivent déjà structurés, comme un bon de commande,
 * pour que la gérante n'ait plus qu'à saisir la vente dans le back-office.
 *
 * Le message de commande ne porte aucune coordonnée de la cliente : WhatsApp
 * donne déjà son numéro, et c'est dans la conversation qu'elle dit où livrer.
 * Les montants sont ceux qu'affiche la boutique — le total d'une livraison
 * reste « à confirmer » : il dépend du quartier, et c'est le serveur qui le
 * chiffre.
 *
 * Les astérisques mettent le texte en gras dans WhatsApp.
 */

import { useEffect, useState } from "react";
import { formatXOF } from "./format";

/**
 * L'adresse du site (`https://…`), pour les liens vers les fiches.
 *
 * Vide au premier rendu, puis lue dans le navigateur : le HTML servi et celui
 * de l'hydratation restent identiques.
 */
export function useOrigine(): string {
  const [origine, setOrigine] = useState("");
  useEffect(() => setOrigine(window.location.origin), []);
  return origine;
}

export type ArticleMessage = {
  nom: string;
  /** « Taille TS · Rouge ». */
  option?: string;
  quantite: number;
  prixUnitaire: number;
  /** L'adresse complète de la fiche, pour que la boutique voie la pièce. */
  lien?: string;
};

const A_COMPLETER = "…";

const ZONES: Record<string, string> = {
  dakar: "Dakar et banlieue",
  thies: "Thiès, Mbour",
  regions: "Autres régions",
  retrait: "Retrait en boutique",
};

function blocArticles(articles: ArticleMessage[]): string[] {
  return articles.flatMap((a) => {
    const lignes = [`• *${a.nom}*`];
    if (a.option) lignes.push(`   ${a.option}`);
    lignes.push(`   Qté ${a.quantite} × ${formatXOF(a.prixUnitaire)}`);
    if (a.lien) lignes.push(`   ${a.lien}`);
    return lignes;
  });
}

/** Une commande à passer : les articles et leur total, rien d'autre. */
export function messageCommande(articles: ArticleMessage[]): string {
  const sousTotal = articles.reduce((s, a) => s + a.prixUnitaire * a.quantite, 0);
  const pieces = articles.reduce((s, a) => s + a.quantite, 0);
  return [
    "Bonjour M comme Maman 👋",
    "Je souhaite passer commande :",
    "",
    "🛍️ *Ma commande*",
    ...blocArticles(articles),
    "",
    `Articles (${pieces}) : ${formatXOF(sousTotal)}`,
    `Livraison : ${A_COMPLETER}`,
    "",
    "Merci de me confirmer la disponibilité 🙏",
  ].join("\n");
}

export type CommandeSuivie = {
  reference: string;
  statut: string;
  articles: ArticleMessage[];
  sousTotal: number;
  livraison: number;
  remise: number;
  total: number;
  zone: string;
  quartier: string;
  repere: string;
  paiement: string;
  nom: string;
  telephone: string;
};

/** Une commande déjà passée, dont la cliente demande des nouvelles. */
export function messageSuivi(c: CommandeSuivie): string {
  return [
    "Bonjour M comme Maman 👋",
    `Je souhaite suivre ma commande *${c.reference}*.`,
    "",
    `📦 *Commande ${c.reference}* : ${c.statut}`,
    ...blocArticles(c.articles),
    "",
    `Articles : ${formatXOF(c.sousTotal)}`,
    `Livraison : ${c.livraison === 0 ? "offerte" : formatXOF(c.livraison)}`,
    ...(c.remise > 0 ? [`Remise : −${formatXOF(c.remise)}`] : []),
    `*Total : ${formatXOF(c.total)}*`,
    `Paiement : ${c.paiement}`,
    "",
    "👤 *Coordonnées*",
    `Nom : ${c.nom}`,
    `Téléphone : ${c.telephone}`,
    `Zone : ${ZONES[c.zone] ?? c.zone}`,
    ...(c.zone === "retrait"
      ? []
      : [`Quartier : ${c.quartier}`, `Point de repère : ${c.repere}`]),
    "",
    "Merci !",
  ].join("\n");
}
