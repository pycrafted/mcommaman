/**
 * L'adresse d'une fiche ou d'un rayon, dérivée de son libellé.
 *
 * Le back-office la propose pendant la saisie pour que la gérante voie l'URL
 * qu'elle est en train de créer. Le serveur la recalcule de son côté : c'est
 * lui qui fait foi, ceci n'est qu'un aperçu.
 */
export const slugify = (valeur: string) =>
  valeur
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
