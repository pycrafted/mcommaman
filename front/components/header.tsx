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
 * Le panneau « Boutique » ouvre `/boutique`, qui ne montre que le vestiaire
 * enfant : on ne demande donc que cet univers-là. Le Coin Maman garde son
 * entrée propre, et ses tissus leurs pastilles sur `/coin-maman`.
 *
 * Deux lectures et pas une : le décompte et la vignette viennent du catalogue,
 * les rayons du menu. Additionner les rayons à la main compterait deux fois une
 * sous-catégorie rangée sous deux parentes.
 *
 * La pièce mise en avant est la dernière publiée. Elle ne se choisit plus dans
 * le code : une fiche écrite en dur finit par pointer vers un article retiré.
 */
export async function Header() {
  const [rayons, entete] = await Promise.all([
    lireRayonsNavigables("enfant"),
    lireEnTeteCatalogue("enfant"),
  ]);

  return (
    <HeaderBarre rayons={rayons} nombrePieces={entete.nombre} vedette={entete.derniere} />
  );
}
