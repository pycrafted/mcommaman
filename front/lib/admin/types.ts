import type { Product } from "@/lib/products";

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export type ProductStatus = "publie" | "brouillon" | "archive";

/**
 * Un produit vu du back-office : la fiche boutique plus ce qui ne se montre
 * jamais à la cliente — stock, statut, dates.
 *
 * `Product` reste la source : le jour où le catalogue passe en base, seule la
 * provenance change, la forme non.
 */
export interface AdminProduct extends Product {
  stock: number;
  status: ProductStatus;
  /** Vues supplémentaires : dos, détail, porté. */
  gallery: string[];
  /** Noms de coloris, tenus dans la bibliothèque. */
  colors: string[];
  /** Valeurs de taille, tenues dans la bibliothèque. */
  sizes: string[];
  /** Matières choisies dans le référentiel partagé. */
  materials: string[];
  /** Options réellement vendables et leur stock propre. */
  variants: {
    id?: string;
    size: string;
    color: string;
    stock: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | "en_attente"
  | "preparation"
  | "expediee"
  | "livree"
  | "annulee";

export type PaymentMethod =
  | "wave"
  | "om"
  | "cb"
  | "cod"
  | "esp"
  | "orange_money"
  | "carte"
  | "livraison";

export interface OrderLine {
  productId: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  ref: string;
  customerId: string;
  /** Le nom et le téléphone saisis à la commande — ils existent aussi sans compte. */
  customerName?: string;
  customerPhone?: string;
  /** Le détail du total. */
  subtotal?: number;
  shipping?: number;
  discount?: number;
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
  payment: PaymentMethod;
  city: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

export type CustomerSegment = "nouvelle" | "fidele" | "vip" | "endormie";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Equipe                                                              */
/* ------------------------------------------------------------------ */

/* Le role qui ouvre le back-office — il n'y en a qu'un. « cliente » n'en fait
   pas partie : c'est ce qui separe les deux onglets de la page Utilisateurs.
   Le type reste nomme au singulier d'un role pour que le jour ou un acces
   partiel apparait, il n'y ait qu'ici a l'ajouter. */
export type TeamRole = "gerante";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  /* Un compte ne se supprime pas, il se desactive : l'historique des commandes
     et des publications garde le nom de qui les a faites. */
  active: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Rayons                                                              */
/* ------------------------------------------------------------------ */

export interface AdminCategory {
  id: string;
  /** Dérivé du libellé, jamais saisi à la main. */
  slug: string;
  label: string;
  description: string;
  /** Visuel du rayon, affiché en boutique. */
  image: string;
  /**
   * Les catégories qui la contiennent, par slug. Vide pour une catégorie de
   * premier niveau. Plusieurs, parce qu'une sous-catégorie peut se ranger à
   * deux endroits — « Chaussures » sous « Enfants » et sous « Coin Maman ».
   */
  parentSlugs: string[];
  /** Leurs libellés, pour les afficher sans les rechercher. */
  parentNoms: string[];
  /** Le monde où elle se montre : vestiaire enfant ou coin maman. */
  univers: "enfant" | "maman";
  active: boolean;
  order: number;
  /** Fiches rangées directement dans ce rayon, tous statuts. Compté par le serveur. */
  productCount?: number;
  /** Parmi elles, les brouillons. */
  draftCount?: number;
}

/* ------------------------------------------------------------------ */
/* Promotions                                                          */
/* ------------------------------------------------------------------ */

export type PromotionType = "pourcentage" | "montant";

/** Sur quoi la remise s'applique. */
export type PromotionTarget = "boutique" | "categorie" | "produit" | "commande";

/** Condition liée à la commande, quand la portée vaut « commande ». */
export type OrderRule = "premiere-commande" | "montant-minimum";

export interface AdminPromotion {
  id: string;
  /** Libellé interne, affiché dans la liste des campagnes. */
  name: string;
  type: PromotionType;
  value: number;
  /** Date d'effet ; la fin se calcule à partir de la durée. */
  startsAt: string;
  /** Durée en jours, à partir de la date d'effet. */
  durationDays: number;
  target: PromotionTarget;
  /** Renseigné pour les portées « categorie » et « produit ». */
  categorySlug: string;
  /** Renseigné pour la portée « produit ». */
  productId: string;
  /** Le nom de l'article visé, fourni par le serveur. */
  productName?: string;
  /** Renseignés pour la portée « commande ». */
  orderRule: OrderRule;
  minAmount: number;
  active: boolean;
  description: string;
}

/** Dernier jour inclus de la campagne, au format AAAA-MM-JJ. */
export function promotionEndDate(
  promotion: Pick<AdminPromotion, "startsAt" | "durationDays">,
): string {
  const start = new Date(`${promotion.startsAt}T12:00:00`);
  // Une date ou une durée illisible ne doit pas faire tomber la page.
  if (Number.isNaN(start.getTime())) return promotion.startsAt ?? "";
  const jours = Number.isFinite(promotion.durationDays)
    ? Math.max(1, promotion.durationDays)
    : 1;
  start.setDate(start.getDate() + jours - 1);
  return start.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Bibliothèque : le vocabulaire commun des fiches                     */
/* ------------------------------------------------------------------ */

/**
 * Une taille : une lettre ou un nombre, et rien d'autre.
 *
 * Elle ne dépend d'aucun rayon ni d'aucun âge. Le repère est une aide au
 * choix, facultative : « S » peut convenir vers 2 ans sans que « 2 ans »
 * devienne une taille.
 */
export interface SizeValue {
  id?: string;
  /** Ce qui figure sur l'étiquette : S, 4, 24, TU… */
  value: string;
  /** Repère indicatif, souvent un âge. Vide la plupart du temps. */
  age: string;
  /** Combien de fiches s'en servent. Compté par le serveur. */
  productCount?: number;
}

/** Un coloris du catalogue : son nom commercial et sa pastille. */
export interface AdminColor {
  id: string;
  name: string;
  /** Couleur CSS de la pastille, au format #rrggbb. */
  hex: string;
  /** Combien de fiches s'en servent. Compté par le serveur. */
  productCount?: number;
}

export interface AdminMaterial {
  id: string;
  name: string;
}

/** Une image de la photothèque, partagée par les fiches et les rayons. */
export interface MediaItem {
  id: string;
  /** Adresse publique, distante, ou image importée (data:). */
  src: string;
  name: string;
  addedAt: string;
}

/** Tout ce qui se règle une fois et se réutilise partout. */
export interface ProductLibrary {
  sizes: SizeValue[];
  /** Visuel du guide des tailles. Facultatif. */
  sizeGuide: string;
  colors: AdminColor[];
  materials: AdminMaterial[];
  media: MediaItem[];
}

/* ------------------------------------------------------------------ */
/* Boutique et journal                                                 */
/* ------------------------------------------------------------------ */

export interface StoreSettings {
  storeName: string;
  tagline: string;
  contactEmail: string;
  phone: string;
  currency: string;
  freeShippingThreshold: number;
  shippingDakar: number;
  shippingRegions: number;
  lowStockThreshold: number;
  acceptOrders: boolean;
  showPromoBanner: boolean;
  promoBannerText: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  author: string;
  action: string;
  target: string;
}

/* ------------------------------------------------------------------ */
/* Bandeau d'accueil                                                   */
/* ------------------------------------------------------------------ */

/**
 * Une photo du bandeau d'accueil.
 *
 * Le cadrage en arche impose un sujet centré : `pos` rattrape le cadrage
 * quand le corps n'est pas au milieu. `piece` est l'article proposé sous la
 * photo — la pièce portée n'est jamais exactement celle-là.
 */
