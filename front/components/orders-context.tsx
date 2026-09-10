"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ErreurApi, envoyer, type CommandeApi } from "@/lib/api";
import type { MethodKey } from "@/lib/livraison";
import { useAuth, type ZoneKey } from "./auth-context";

/**
 * Les commandes.
 *
 * Elles vivaient dans le navigateur : la boutique ne les voyait jamais, le
 * statut ne bougeait pas, et la référence sortait d'un compteur local. Tout
 * cela est maintenant en base — le serveur refait les prix, retire le stock,
 * numérote, et c'est le back-office qui fait avancer le suivi.
 *
 * Deux régimes, comme le panier :
 *
 * — **Connectée**, ses commandes viennent de `/api/mes-commandes/` et
 *   la suivent d'un appareil à l'autre.
 * — **Sans compte**, la commande existe tout aussi bien en base ; seul le lien
 *   vers elle manque. Le navigateur retient donc la référence et le téléphone
 *   qui l'a passée — c'est ce couple que le serveur exige pour la montrer — et
 *   les fiches sont relues chez lui à chaque visite.
 *
 * Ce qui n'est plus retenu ici : le contenu des commandes. Il est en base.
 */

const CLE_SUIVIS = "mcm-suivis-v1";

export type OrderStatus = "recue" | "preparation" | "expediee" | "livree" | "annulee";

/* Les quatre temps du parcours, dans l'ordre. « annulee » n'en fait pas partie :
   c'est une sortie de route, pas une étape. */
export const ORDER_STEPS: { value: Exclude<OrderStatus, "annulee">; label: string; hint: string }[] = [
  { value: "recue", label: "Commande reçue", hint: "Nous avons bien reçu votre demande." },
  { value: "preparation", label: "En préparation", hint: "Les pièces sont rassemblées et emballées." },
  { value: "expediee", label: "En route", hint: "Le colis est confié au livreur." },
  { value: "livree", label: "Livrée", hint: "Bonne découverte !" },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  recue: "Commande reçue",
  preparation: "En préparation",
  expediee: "En route",
  livree: "Livrée",
  annulee: "Annulée",
};

export interface OrderLine {
  /** L'identifiant de la ligne en base. Sert de clé, rien de plus. */
  id: number;
  /** Pour reconstruire le lien vers la fiche, `/p/[slug]`. */
  slug: string;
  name: string;
  image: string;
  /** Le choix en toutes lettres, figé : « Rose poudré · 2 ans ». Si le coloris
      disparaît du catalogue, la commande garde ce qui a été acheté. */
  option: string;
  price: number;
  quantity: number;
}

export interface Order {
  ref: string;
  createdAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  /** Remise appliquée, 0 sans code. */
  discount: number;
  /** Le code retenu par le serveur, chaîne vide sans code. */
  promoCode: string;
  total: number;
  customer: { name: string; phone: string; email: string };
  delivery: { zone: ZoneKey; city: string; address: string; notes: string };
  payment: MethodKey;
}

/** Ce que le tunnel envoie à la caisse. Aucun montant : le serveur les refait. */
export type CommandeADeposer = {
  lignes: { variante: number; quantite: number }[];
  nom_client: string;
  telephone: string;
  email: string;
  zone: ZoneKey;
  ville: string;
  adresse: string;
  notes: string;
  moyen_paiement: MethodKey;
  code_promo: string;
};

type Resultat = { ok: boolean; error?: string };

type Ctx = {
  orders: Order[];
  /** Enregistre la commande en base et renvoie ce que le serveur a retenu. */
  placeOrder: (commande: CommandeADeposer) => Promise<{ ok: boolean; order?: Order; error?: string }>;
  getOrder: (ref: string) => Order | undefined;
  /** Annulation par la cliente, tant que rien n'est parti en préparation. */
  cancelOrder: (ref: string) => Promise<Resultat>;
  /** Va chercher une commande passée ailleurs, avec son téléphone. */
  trackOrder: (ref: string, telephone: string) => Promise<Resultat>;
  hydrated: boolean;
};

const OrdersContext = createContext<Ctx | null>(null);

/* La boutique distingue « en attente de paiement » de « payée » ; la cliente,
   non — dans les deux cas sa commande est reçue. Le serveur dit la même chose
   dans `statut_cliente`, mais en toutes lettres : ici on veut la clé, parce que
   c'est elle qui place le curseur sur les étapes du parcours. */
const STATUTS: Record<CommandeApi["statut"], OrderStatus> = {
  en_attente: "recue",
  payee: "recue",
  preparation: "preparation",
  expediee: "expediee",
  livree: "livree",
  annulee: "annulee",
};

/** Une commande du serveur, mise à la forme que les pages connaissent déjà. */
export function versCommande(brut: CommandeApi): Order {
  return {
    ref: brut.reference,
    createdAt: brut.creee_le,
    status: STATUTS[brut.statut] ?? "recue",
    lines: brut.lignes.map((l) => ({
      id: l.id,
      slug: l.slug_produit,
      name: l.nom_produit,
      image: l.url_image,
      option: l.libelle_option,
      price: l.prix_unitaire,
      quantity: l.quantite,
    })),
    subtotal: brut.sous_total,
    shipping: brut.frais_livraison,
    discount: brut.remise,
    promoCode: brut.code_promo,
    total: brut.total,
    customer: { name: brut.nom_client, phone: brut.telephone, email: brut.email },
    delivery: {
      zone: brut.zone,
      city: brut.ville,
      address: brut.adresse,
      notes: brut.notes,
    },
    payment: brut.moyen_paiement,
  };
}

/** Les commandes suivies sans compte : de quoi les redemander au serveur. */
type Suivi = { reference: string; telephone: string };

function lireSuivis(): Suivi[] {
  try {
    const brut = window.localStorage.getItem(CLE_SUIVIS);
    const lu: unknown = brut ? JSON.parse(brut) : null;
    return Array.isArray(lu) ? (lu as Suivi[]) : [];
  } catch {
    return [];
  }
}

function ecrireSuivis(suivis: Suivi[]) {
  try {
    window.localStorage.setItem(CLE_SUIVIS, JSON.stringify(suivis));
  } catch {
    /* stockage plein ou refusé : la commande existe en base, seul le raccourci
       depuis ce navigateur est perdu. */
  }
}

const message = (erreur: unknown, defaut: string) =>
  erreur instanceof ErreurApi ? erreur.message : defaut;

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { account, hydrated: authPrete } = useAuth();
  const connectee = Boolean(account);

  const [orders, setOrders] = useState<Order[]>([]);
  const [hydrated, setHydrated] = useState(false);

  /** Les commandes d'un compte : le serveur les tient toutes. */
  const lireDuCompte = useCallback(async (): Promise<Order[]> => {
    try {
      const liste = await envoyer<CommandeApi[]>("/api/mes-commandes/");
      return liste.map(versCommande);
    } catch {
      return [];
    }
  }, []);

  /**
   * Les commandes suivies sans compte, relues une par une.
   *
   * Une référence qui ne répond plus — téléphone changé, base remise à zéro —
   * sort du suivi plutôt que d'y rester indéfiniment.
   */
  const lireLesSuivies = useCallback(async (): Promise<Order[]> => {
    const suivis = lireSuivis();
    if (suivis.length === 0) return [];

    const reponses = await Promise.all(
      suivis.map(async (suivi) => {
        try {
          const brut = await envoyer<CommandeApi>(
            `/api/commandes/${encodeURIComponent(suivi.reference)}/` +
              `?telephone=${encodeURIComponent(suivi.telephone)}`,
          );
          return { suivi, commande: versCommande(brut) };
        } catch {
          return { suivi, commande: null };
        }
      }),
    );

    const vivantes = reponses.filter((r) => r.commande !== null);
    if (vivantes.length !== suivis.length) ecrireSuivis(vivantes.map((r) => r.suivi));
    return vivantes.map((r) => r.commande as Order);
  }, []);

  const relire = useCallback(async () => {
    const liste = connectee ? await lireDuCompte() : await lireLesSuivies();
    /* La plus récente en tête : c'est l'ordre d'affichage partout. */
    setOrders([...liste].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [connectee, lireDuCompte, lireLesSuivies]);

  /* On attend de savoir si quelqu'un est connecté : demander les commandes du
     compte avant que la session soit connue les ramènerait vides. */
  useEffect(() => {
    if (!authPrete) return;
    let vivant = true;
    void relire().finally(() => {
      if (vivant) setHydrated(true);
    });
    return () => {
      vivant = false;
    };
  }, [authPrete, relire]);

  const placeOrder = useCallback<Ctx["placeOrder"]>(
    async (commande) => {
      try {
        const brut = await envoyer<CommandeApi>("/api/commandes/", "POST", commande);
        const posee = versCommande(brut);

        /* Sans compte, rien ne relierait cette cliente à sa commande au
           prochain passage : on retient la référence et le téléphone qui
           permettent de la redemander. */
        if (!connectee) {
          ecrireSuivis([
            { reference: posee.ref, telephone: posee.customer.phone },
            ...lireSuivis().filter((s) => s.reference !== posee.ref),
          ]);
        }

        setOrders((liste) => [posee, ...liste.filter((o) => o.ref !== posee.ref)]);
        return { ok: true, order: posee };
      } catch (erreur) {
        return {
          ok: false,
          error: message(erreur, "La commande n'a pas pu être enregistrée."),
        };
      }
    },
    [connectee],
  );

  const getOrder = useCallback((ref: string) => orders.find((o) => o.ref === ref), [orders]);

  const cancelOrder = useCallback<Ctx["cancelOrder"]>(
    async (ref) => {
      const telephone = lireSuivis().find((s) => s.reference === ref)?.telephone ?? "";
      try {
        const brut = await envoyer<CommandeApi>(
          `/api/commandes/${encodeURIComponent(ref)}/annuler/`,
          "POST",
          connectee ? {} : { telephone },
        );
        const annulee = versCommande(brut);
        setOrders((liste) => liste.map((o) => (o.ref === ref ? annulee : o)));
        return { ok: true };
      } catch (erreur) {
        return { ok: false, error: message(erreur, "L'annulation n'a pas abouti.") };
      }
    },
    [connectee],
  );

  /**
   * Retrouver une commande passée ailleurs — autre navigateur, téléphone de la
   * cliente. La référence seule ne prouve rien : elle circule sur un ticket.
   */
  const trackOrder = useCallback<Ctx["trackOrder"]>(async (ref, telephone) => {
    try {
      const brut = await envoyer<CommandeApi>(
        `/api/commandes/${encodeURIComponent(ref)}/?telephone=${encodeURIComponent(telephone)}`,
      );
      const trouvee = versCommande(brut);
      ecrireSuivis([
        { reference: trouvee.ref, telephone },
        ...lireSuivis().filter((s) => s.reference !== trouvee.ref),
      ]);
      setOrders((liste) => [trouvee, ...liste.filter((o) => o.ref !== trouvee.ref)]);
      return { ok: true };
    } catch (erreur) {
      return {
        ok: false,
        error: message(erreur, "Aucune commande ne répond à cette référence."),
      };
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ orders, placeOrder, getOrder, cancelOrder, trackOrder, hydrated }),
    [orders, placeOrder, getOrder, cancelOrder, trackOrder, hydrated],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders(): Ctx {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders doit être utilisé dans <OrdersProvider>");
  return ctx;
}
