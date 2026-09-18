/**
 * Les variantes web de la photothèque.
 *
 * Le serveur fabrique trois largeurs de chaque photo envoyée (voir
 * `back/catalogue/imaging.py`) et l'API rend l'adresse de celle de 800 px :
 * `…/robe-a1b2-web-800.jpg`. Les deux autres se déduisent en changeant le
 * nombre. Une adresse qui ne suit pas ce motif (photo collée depuis un autre
 * site, ou déjà légère) est rendue telle quelle.
 */

const MOTIF = /-web-(\d+)\.(jpg|png)$/;

export const LARGEURS_WEB = [400, 800, 1600] as const;
export type LargeurWeb = (typeof LARGEURS_WEB)[number];

/** L'adresse de la variante voulue, ou l'adresse d'origine faute de variantes. */
export function variante(src: string, largeur: LargeurWeb): string {
  return src && MOTIF.test(src) ? src.replace(MOTIF, `-web-${largeur}.$2`) : src;
}

/** Le `srcset` des trois largeurs, ou `undefined` si la photo n'en a pas. */
export function srcSetWeb(src: string): string | undefined {
  if (!src || !MOTIF.test(src)) return undefined;
  return LARGEURS_WEB.map((l) => `${variante(src, l)} ${l}w`).join(", ");
}
