/**
 * « jusqu'au 13 septembre » — la fin d'une promotion, dite à la cliente.
 *
 * Le fuseau est imposé : sans lui, le serveur et le navigateur peuvent tomber
 * sur deux jours différents et React signale un écart d'hydratation.
 */
export function jusquAu(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export const formatXOF = (n: number) =>
  n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ") + " F";

export const WHATSAPP = "221762080202";

/* Les comptes de la boutique. À confirmer avant mise en ligne : un lien vers le
   mauvais compte est pire que pas de lien du tout. */
export const INSTAGRAM = "mcommaman";
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM}`;

export const TIKTOK = "mcommaman";
export const TIKTOK_URL = `https://www.tiktok.com/@${TIKTOK}`;

/* Le magasin.
   • `MAPS_URL` est le lien court de la fiche : il ouvre l'itinéraire dans
     l'application du téléphone, pas une page de plus.
   • `MAPS_EMBED` est le plan encastré dans la page contact. `output=embed`
     n'exige aucune clé d'API — c'est le seul moyen d'afficher un plan sans
     ouvrir un compte Google Cloud. Les coordonnées sont celles de la fiche :
     l'épingle tombe au bon endroit même si Google renomme la rue. */
export const ADRESSE = "Rue GY-187, Dakar, Sénégal";
export const MAPS_URL = "https://maps.app.goo.gl/FhvcWxAku2LBCjP67";
export const MAPS_COORDS = "14.7386622,-17.4621246";
export const MAPS_EMBED = `https://www.google.com/maps?q=${MAPS_COORDS}&z=16&hl=fr&output=embed`;

export const waLink = (message: string) =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;

/** Les initiales servent d'avatar : deux lettres suffisent à se reconnaître.
    Partagées entre la vitrine et le back-office — les deux saluent la même
    personne, elles doivent la dessiner pareil. */
export const initiales = (nom: string) =>
  nom
    .split(" ")
    .filter(Boolean)
    .map((mot) => mot[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
