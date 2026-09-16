/**
 * La forme d'une fiche, et les visuels du bandeau.
 *
 * Ce fichier tenait le catalogue de démonstration : douze pièces écrites à la
 * main, et tout ce qui s'en déduisait — les rayons, les tailles, les coloris,
 * la date de fin de promotion. Tout cela vient du serveur maintenant
 * (`lib/catalogue.ts`, `lib/reglages.ts`), et ce qui reste ici est ce que le
 * serveur ne sait pas dire : le type `Product`, que les composants attendent,
 * et deux ou trois visuels livrés avec le site.
 */

/* La boutique habille de 2 à 14 ans. En dessous et au-dessus elle ne promet
   rien : mieux vaut ne pas vendre que décevoir sur la taille. */
export type Age = "2-10" | "11-14";
export type Gender = "fille" | "garcon" | "mixte";

/* Les deux mondes de la boutique. Le Coin Maman vend du tissu et du voile :
   ni âge ni genre n'y ont de sens, et les mélanger au vestiaire enfant
   appliquerait des filtres absurdes à un coupon de bazin. */
export type Univers = "enfant" | "maman";

export type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  price: number;
  compareAt?: number;
  /** La campagne en cours sur cet article, quand le serveur en signale une. */
  promotion?: {
    libelle: string;
    pourcentage: number;
    economie: number;
    jusquau: string;
  };
  category: string;
  /** Le slug de cette catégorie : deux rayons peuvent porter le même nom
      (« T-shirt » chez les filles et chez les garçons), pas le même slug. */
  categorySlug?: string;
  /** Les tailles de la fiche, dans l'ordre du guide, avec leur disponibilité. */
  tailles?: { valeur: string; ordre: number; disponible: boolean }[];
  univers: Univers;
  /* Vides pour le Coin Maman. */
  gender?: Gender;
  age?: Age;
  image: string;
  description: string;
  outOfStock?: boolean;
};

const cdn = (file: string) => `https://mcommaman.com/cdn/shop/files/${file}`;

/* Le bandeau d'accueil.
   Ces deux séquences sont celles livrées avec le site. Elles ne servent que
   tant que le back-office n'a pas de photo active : dès qu'il en a une,
   `/api/vitrine/bandeau/` prend la main (voir `components/hero.tsx`). La page
   d'accueil n'est donc jamais nue, et elle n'impose rien à la gérante.

   Les photos sont cadrées en arche, ce qui impose un sujet centré et un fond
   calme — `pos` rattrape le cadrage quand le corps n'est pas au milieu.
   `poster` est la première image affichée : elle tient la place tant que la
   vidéo n'est pas chargée, et reste seule si le mouvement réduit est demandé. */
export const HERO_VIDEOS = [
  {
    src: "/videos/hero-1.mp4",
    poster: "/images/hero/fille-cour.webp",
    alt: "Enfants en tenues M comme Maman, filmés en boutique",
    pos: "50% 40%",
    tag: "Tous les jours",
  },
  {
    src: "/videos/hero-2.mp4",
    poster: "/images/hero/robe-rouge.webp",
    alt: "Tenues de fête présentées en boutique",
    pos: "50% 35%",
    tag: "Les grands jours",
  },
] as const;

/** Les enfants déjà habillés par la boutique, en petit, sous les avis. */
export const HERO_VIGNETTES = [
  cdn("enf1.jpg?v=1784389757&width=160"),
  cdn("enf2.jpg?width=160"),
  cdn("Ensemble_enfant-138.jpg?v=1785881597&width=160"),
];

export const LOGO = cdn("logo_mcommaman.png?v=1785937900&width=360");
