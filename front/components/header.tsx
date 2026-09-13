import { lireEnTeteCatalogue, lireRayonsNavigables } from "@/lib/catalogue";
import { HeaderBarre } from "./header-barre";

/**
 * La barre du haut, servie déjà remplie.
 *
 * Les rayons du menu ne sont plus une liste écrite à la main : ce sont les
 * catégories du back-office. Elles sont lues ici, sur le serveur, pour être
 * dans le HTML servi — un menu qui n'apparaîtrait qu'une fois le JavaScript
 * arrivé sauterait à chaque changement de page.
 *
 * Le panneau « Boutique » montre les deux univers, chacun avec ses
 * sous-catégories : le vestiaire enfant, puis le Coin Maman. Les deux pages
 * filtrent sur `?cat=` par le nom — le menu envoie vers l'une ou l'autre selon
 * l'univers de la sous-catégorie.
 *
 * Le décompte vient du catalogue, pas des rayons : les additionner à la main
 * compterait deux fois une sous-catégorie rangée sous deux parentes. Il ne
 * porte que sur le vestiaire enfant, comme le lien « Toute la boutique » qui
 * l'affiche et qui ouvre `/boutique`.
 */
export async function Header() {
  const [rayons, rayonsMaman, entete] = await Promise.all([
    lireRayonsNavigables("enfant"),
    lireRayonsNavigables("maman"),
    lireEnTeteCatalogue("enfant"),
  ]);

  return <HeaderBarre rayons={rayons} rayonsMaman={rayonsMaman} nombrePieces={entete.nombre} />;
}
