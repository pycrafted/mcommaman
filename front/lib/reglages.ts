/**
 * Les réglages de la boutique, lus sur le serveur.
 *
 * Frais de livraison, franco de port, identité, bandeau d'annonce : tout cela
 * se règle dans le back-office et ne s'écrit plus ici. Une gérante qui change
 * son franco de port ne doit pas attendre une mise en production.
 *
 * Les valeurs de repli sont exactement celles du modèle Django. Elles ne
 * servent qu'au cas où le serveur ne répond pas : la boutique reste lisible,
 * elle n'annonce pas des frais inventés.
 */

import { lire, type BandeauApi, type CampagneApi, type ReglagesApi } from "./api";

export type Reglages = ReglagesApi;

export const REGLAGES_DEFAUT: Reglages = {
  nom_boutique: "M comme Maman",
  signature: "Le monde des mamans",
  email_contact: "bonjour@mcommaman.com",
  telephone: "+221 77 000 00 00",
  devise: "F",
  franco_dakar: 25_000,
  frais_dakar: 2_000,
  frais_thies: 3_500,
  frais_regions: 3_500,
  accepte_commandes: true,
  affiche_bandeau_promo: true,
  texte_bandeau_promo:
    "Livraison offerte à Dakar dès 25 000 F — Retours gratuits sous 14 jours",
};

/**
 * Les réglages courants.
 *
 * Cinq minutes de cache : ils changent rarement, mais une gérante qui ferme la
 * caisse pendant ses congés ne doit pas attendre un quart d'heure que la
 * boutique s'en aperçoive.
 */
export async function lireReglages(): Promise<Reglages> {
  try {
    return (await lire<Reglages>("/api/vitrine/reglages/", { revalider: 300 })) ?? REGLAGES_DEFAUT;
  } catch {
    return REGLAGES_DEFAUT;
  }
}

/**
 * Le bandeau d'accueil réglé dans le back-office.
 *
 * Vide, la vitrine garde les séquences livrées avec le site : la page
 * d'accueil n'est jamais nue. C'est la règle que le modèle Django annonce, et
 * celle que `components/hero.tsx` applique.
 */
export async function lireBandeau(): Promise<BandeauApi[]> {
  try {
    return (await lire<BandeauApi[]>("/api/vitrine/bandeau/", { revalider: 300 })) ?? [];
  } catch {
    return [];
  }
}

/**
 * Les campagnes qui courent aujourd'hui.
 *
 * Le bandeau d'accueil et son compte à rebours lisent ici : sans cette
 * lecture, la vitrine ne connaîtrait des remises que ce que le prix des fiches
 * en laisse deviner — donc rien des codes, qui ne s'appliquent pas seuls.
 *
 * Cinq minutes de cache : une campagne qui se termine ne doit pas rester
 * affichée un quart d'heure de plus.
 */
export async function lireCampagnes(): Promise<CampagneApi[]> {
  try {
    return (await lire<CampagneApi[]>("/api/campagnes/", { revalider: 300 })) ?? [];
  } catch {
    return [];
  }
}
