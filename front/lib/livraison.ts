import type { ZoneKey } from "@/components/auth-context";
import type { Reglages } from "@/lib/reglages";
import { formatXOF } from "@/lib/format";

/**
 * Zones de livraison et moyens de paiement.
 *
 * Ce qui reste ici est ce qui ne se règle pas : le nom des trois zones, le
 * délai qu'on y annonce, et l'habillage des quatre moyens de paiement. **Les
 * montants n'y sont plus** — frais et franco de port viennent des réglages du
 * back-office, et le total d'une commande est chiffré par le serveur, jamais
 * ici. Deux tables de prix, c'est une de trop : c'est toujours la mauvaise qui
 * s'affiche.
 */
export const ZONES: {
  key: ZoneKey;
  t: string;
  /** Le nom court, pour la ligne « Livraison … » du récapitulatif. */
  short: string;
  /** Le délai annoncé. Le prix, lui, se lit dans les réglages. */
  delai: string;
}[] = [
  { key: "dakar", t: "Dakar et banlieue", short: "Dakar", delai: "24 h" },
  { key: "thies", t: "Thiès, Mbour", short: "Thiès", delai: "2 jours" },
  { key: "regions", t: "Autres régions", short: "régions", delai: "3 à 4 jours" },
];

export const zoneLabel = (key: ZoneKey) => ZONES.find((z) => z.key === key)?.t ?? ZONES[0].t;

export const zoneIndex = (key: ZoneKey) => Math.max(0, ZONES.findIndex((z) => z.key === key));

/** Le délai annoncé pour une zone, tel qu'il apparaît dans le suivi. */
export const zoneDelay = (key: ZoneKey) => (key === "dakar" ? "24 à 48 h" : "2 à 4 jours");

/**
 * Les frais d'une zone, d'après les réglages.
 *
 * Même règle que `Reglages.frais_pour` côté serveur — c'est lui qui fait foi,
 * ceci ne sert qu'à annoncer le prix avant de le lui demander.
 */
export function fraisDeZone(reglages: Reglages, key: ZoneKey): number {
  if (key === "thies") return reglages.frais_thies;
  if (key === "regions") return reglages.frais_regions;
  return reglages.frais_dakar;
}

/** Le montant à partir duquel la livraison est offerte. Jamais hors de Dakar. */
export function francoDeZone(reglages: Reglages, key: ZoneKey): number {
  return key === "dakar" ? reglages.franco_dakar : Infinity;
}

/** « 24 h · offerte dès 25 000 F », composé à partir des réglages du jour. */
export function descriptionZone(reglages: Reglages, key: ZoneKey): string {
  const zone = ZONES.find((z) => z.key === key) ?? ZONES[0];
  if (key === "dakar") {
    return `${zone.delai} · offerte dès ${formatXOF(reglages.franco_dakar)}`;
  }
  return `${zone.delai} · ${formatXOF(fraisDeZone(reglages, key))}`;
}

export type MethodKey = "wave" | "om" | "cb" | "cod";

export const METHODS: {
  k: MethodKey;
  i: string;
  chip: string;
  fg: string;
  t: string;
  s: string;
  fee: string;
}[] = [
  { k: "wave", i: "W", chip: "#e8f1fd", fg: "#1a63c4", t: "Wave", s: "Redirection vers l'application Wave", fee: "1 %" },
  { k: "om", i: "OM", chip: "#fdeee4", fg: "#c25a12", t: "Orange Money", s: "Code de confirmation par SMS", fee: "1,5 %" },
  { k: "cb", i: "CB", chip: "#f1eefb", fg: "#5540a8", t: "Carte bancaire", s: "Page sécurisée du prestataire", fee: "2,9 %" },
  { k: "cod", i: "₣", chip: "#eaf6ef", fg: "#2e7d52", t: "Paiement à la livraison", s: "Espèces ou Wave au livreur, Dakar uniquement", fee: "sans frais" },
];

export const methodOf = (key: MethodKey) => METHODS.find((m) => m.k === key) ?? METHODS[0];

/* Les codes de réduction ne sont plus listés ici.
   Une campagne vit en base, avec sa fenêtre de validité, sa portée et sa
   condition — première commande, montant minimum. C'est `/api/devis/` qui dit
   si un code s'applique et ce qu'il retire ; le navigateur ne peut plus
   s'accorder une remise en tapant le bon mot. */
