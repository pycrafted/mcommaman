/**
 * Les messages WhatsApp préremplis.
 *
 * Une cliente qui écrit « je suis intéressée par la robe » oblige la boutique
 * à tout redemander : la taille, la quantité, le quartier, le moyen de
 * paiement. Ces messages arrivent déjà structurés, comme un bon de commande,
 * pour que la gérante n'ait plus qu'à saisir la vente dans le back-office.
 *
 * Le message de commande porte les coordonnées de la cliente dès qu'elle est
 * connectée : son nom, son numéro, et l'adresse par défaut de son carnet si
 * elle en a une — autant de questions que la gérante n'a plus à poser. Sans
 * compte, le même message part sans ce bloc : WhatsApp donne déjà le numéro,
 * et le reste se dit dans la conversation.
 * Les montants sont ceux qu'affiche la boutique — le total d'une livraison
 * reste « à confirmer » : il dépend du quartier, et c'est le serveur qui le
 * chiffre.
 *
 * Les astérisques mettent le texte en gras dans WhatsApp.
 */

import { useEffect, useState } from "react";
import { useAuth, type ZoneKey } from "@/components/auth-context";
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

export type ClienteMessage = {
  nom?: string;
  telephone?: string;
  /** La zone de l'adresse par défaut du carnet. */
  zone?: ZoneKey;
  /** Le quartier de cette adresse, à défaut la ville du profil. */
  quartier?: string;
  /** Le point de repère laissé avec l'adresse : c'est lui qui guide le livreur. */
  repere?: string;
};

/**
 * Les coordonnées de la cliente connectée, prêtes pour le bon de commande.
 *
 * `undefined` tant que la session n'est pas relue, et pour une visiteuse sans
 * compte : `messageCommande` part alors sans bloc de coordonnées. Rien n'est
 * inventé et rien n'est deviné — un champ vide du profil ou une adresse
 * absente du carnet font une ligne en moins, jamais une ligne vide.
 */
export function useCliente(): ClienteMessage | undefined {
  const { account, defaultAddress, hydrated } = useAuth();
  if (!hydrated || !account) return undefined;
  return {
    nom: account.name || undefined,
    telephone: account.phone || undefined,
    zone: defaultAddress?.zone,
    quartier: defaultAddress?.city || account.city || undefined,
    repere: defaultAddress?.address || undefined,
  };
}

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

function blocCliente(c: ClienteMessage): string[] {
  const lignes = [
    ...(c.nom ? [`Nom : ${c.nom}`] : []),
    ...(c.telephone ? [`Téléphone : ${c.telephone}`] : []),
    ...(c.zone ? [`Zone : ${ZONES[c.zone] ?? c.zone}`] : []),
    ...(c.quartier ? [`Quartier : ${c.quartier}`] : []),
    ...(c.repere ? [`Point de repère : ${c.repere}`] : []),
  ];
  /* Un compte dont on ne sait rien n'a pas droit à un titre : pas de
     « Mes coordonnées » au-dessus du vide. */
  return lignes.length === 0 ? [] : ["", "👤 *Mes coordonnées*", ...lignes];
}

/** Une commande à passer : les articles, leur total, et qui commande. */
export function messageCommande(articles: ArticleMessage[], cliente?: ClienteMessage): string {
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
    ...(cliente ? blocCliente(cliente) : []),
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
