import { lireArborescence, lireEnTeteCatalogue } from "@/lib/catalogue";
import { HeaderBarre } from "./header-barre";

/**
 * La barre du haut, servie déjà remplie.
 *
 * Les catégories du menu ne sont pas une liste écrite à la main : ce sont les
 * catégories de premier niveau du back-office — Filles, Garçons, Coin Maman…
 * Elles sont lues ici, sur le serveur, pour être dans le HTML servi : un menu
 * qui n'apparaîtrait qu'une fois le JavaScript arrivé sauterait à chaque
 * changement de page.
 *
 * Le décompte vient du catalogue et non des rayons : les additionner à la main
 * compterait deux fois une sous-catégorie rangée sous deux parentes.
 */
export async function Header() {
  const [branches, entete] = await Promise.all([lireArborescence(), lireEnTeteCatalogue()]);

  return (
    <HeaderBarre
      categories={branches.map((b) => ({ nom: b.nom, slug: b.slug }))}
      nombre={entete.nombre}
    />
  );
}
