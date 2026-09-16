import { lireArborescence, lireEnTeteCatalogue } from "@/lib/catalogue";
import { HeaderBarre } from "./header-barre";

/**
 * La barre du haut, servie déjà remplie.
 *
 * Les rayons du menu ne sont plus une liste écrite à la main : ce sont les
 * catégories du back-office. Elles sont lues ici, sur le serveur, pour être
 * dans le HTML servi — un menu qui n'apparaîtrait qu'une fois le JavaScript
 * arrivé sauterait à chaque changement de page.
 *
 * Chaque univers a son panneau, et chaque panneau déplie l'arborescence sur
 * ses deux étages : les catégories, et sous chacune ses sous-catégories. C'est
 * `lireArborescence` qui la conserve — `lireRayonsNavigables`, dont vivent le
 * pied de page et les filtres, l'aplatit.
 *
 * Le décompte vient du catalogue et non des rayons : les additionner à la main
 * compterait deux fois une sous-catégorie rangée sous deux parentes. La
 * dernière fiche arrivée vient du même appel, qui en ramène une seule — la
 * vignette du panneau ne coûte donc aucune requête de plus.
 *
 * Quatre appels, tous mis en cache par `lire` et lancés ensemble : la barre
 * s'affiche sur chaque page, elle ne peut pas les enchaîner.
 */
export async function Header() {
  const [branchesEnfant, branchesMaman, enteteEnfant, enteteMaman] = await Promise.all([
    lireArborescence("enfant"),
    lireArborescence("maman"),
    lireEnTeteCatalogue("enfant"),
    lireEnTeteCatalogue("maman"),
  ]);

  return (
    <HeaderBarre
      enfant={{
        branches: branchesEnfant,
        nombre: enteteEnfant.nombre,
        derniere: enteteEnfant.derniere,
      }}
      maman={{
        branches: branchesMaman,
        nombre: enteteMaman.nombre,
        derniere: enteteMaman.derniere,
      }}
    />
  );
}
