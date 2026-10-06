"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { envoyer, lire, type LignePanierApi, type PanierApi, type ProduitApi } from "@/lib/api";
import { useAuth } from "./auth-context";

/**
 * Le panier.
 *
 * Deux régimes : tant que la cliente n'est pas connectée, son
 * panier reste dans son navigateur — écrire en base à chaque clic sur « ajouter »
 * coûterait un aller-retour pour rien, et lui demander un compte avant de
 * remplir son panier lui ferait fermer l'onglet. À la connexion, le panier local
 * remonte au serveur et la suit d'un appareil à l'autre.
 *
 * Ce qu'on met dedans est une **variante** — un produit dans une taille et un
 * coloris — et non un produit : deux tailles du même article n'ont ni le même
 * stock ni la même disponibilité. C'est aussi ce que la commande achètera.
 *
 * Les deux régimes partagent la forme des lignes, celle que renvoie le serveur.
 * Rien en aval n'a donc à savoir si la cliente est connectée.
 */

/* La forme des lignes a changé avec le passage au serveur : l'ancienne clé
   gardait des indices de couleur et de taille qui ne veulent plus rien dire.
   Une nouvelle clé vaut mieux qu'une migration pour un panier en cours. */
const CLE_LOCALE = "mcm-panier-v2";

export type Ligne = LignePanierApi;

/** Ce qu'il faut connaître d'un article pour le mettre au panier hors session. */
export type ArticleAAjouter = {
  variante: number;
  produit: number;
  slug: string;
  nom: string;
  option: string;
  image: string;
  prix_unitaire: number;
  stock_restant: number;
};

type Resultat = { ok: boolean; error?: string };

type Ctx = {
  lignes: Ligne[];
  /** Nombre d'articles, quantités comprises. */
  count: number;
  subtotal: number;
  /** Faux dès qu'une ligne n'est plus servable. */
  complet: boolean;
  /** S'incrémente à chaque ajout : la pastille du panier s'anime dessus. */
  pulse: number;
  drawerOpen: boolean;
  /** Faux tant que le panier n'a pas été relu : évite l'écart d'hydratation. */
  hydrated: boolean;
  /** Le dernier refus du serveur — rupture, fiche retirée — ou `null`. */
  erreur: string | null;
  /** Les articles laissés de côté à la dernière fusion, à signaler une fois. */
  ignorees: string[];
  oublierIgnorees: () => void;

  add: (article: ArticleAAjouter, quantite?: number) => Promise<Resultat>;
  /** Ajout en un clic depuis une vignette : la première variante servable. */
  addBySlug: (slug: string) => Promise<Resultat>;
  setQuantity: (ligne: number, quantite: number) => Promise<Resultat>;
  bump: (ligne: number, delta: number) => Promise<Resultat>;
  remove: (ligne: number) => Promise<Resultat>;
  /** Vide le panier — appelé une fois la commande enregistrée. */
  clear: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<Ctx | null>(null);

/* -------------------------------------------------------------------- local */

function lireLocal(): Ligne[] {
  try {
    const brut = window.localStorage.getItem(CLE_LOCALE);
    const lu: unknown = brut ? JSON.parse(brut) : [];
    if (!Array.isArray(lu)) return [];
    // Un enregistrement d'une version antérieure n'a pas de variante : on le
    // laisse tomber plutôt que d'afficher des lignes qu'on ne saurait commander.
    return lu.filter(
      (l): l is Ligne =>
        Boolean(l) && typeof l === "object" && typeof (l as Ligne).variante === "number",
    );
  } catch {
    return [];
  }
}

function ecrireLocal(lignes: Ligne[]) {
  try {
    window.localStorage.setItem(CLE_LOCALE, JSON.stringify(lignes));
  } catch {
    /* stockage plein ou refusé : le panier reste affiché, seule la mémoire est perdue */
  }
}

/** Recalcule ce que le serveur calculerait, pour que les deux régimes se ressemblent. */
function ligneLocale(article: ArticleAAjouter, quantite: number): Ligne {
  return {
    // Hors session il n'y a pas d'identifiant de ligne : celui de la variante
    // fait l'affaire, il n'y a de toute façon qu'une ligne par variante.
    id: article.variante,
    variante: article.variante,
    produit: article.produit,
    slug: article.slug,
    nom: article.nom,
    option: article.option,
    image: article.image,
    prix_unitaire: article.prix_unitaire,
    quantite,
    sous_total: article.prix_unitaire * quantite,
    stock_restant: article.stock_restant,
    disponible: quantite <= article.stock_restant,
  };
}

/* --------------------------------------------------------------- fournisseur */

export function CartProvider({ children }: { children: ReactNode }) {
  const { account, hydrated: authPrete } = useAuth();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ignorees, setIgnorees] = useState<string[]>([]);
  const fusionFaite = useRef(false);

  const connectee = Boolean(account);

  /* Lecture initiale, puis bascule quand la session change. */
  useEffect(() => {
    if (!authPrete) return;

    if (!connectee) {
      setLignes(lireLocal());
      setHydrated(true);
      fusionFaite.current = false;
      return;
    }

    // À la première connexion de cette session, le panier du navigateur remonte.
    // Sur un article présent des deux côtés, le serveur garde la plus grande des
    // deux quantités et non leur somme : se reconnecter ne double pas le panier.
    const locales = fusionFaite.current ? [] : lireLocal();
    fusionFaite.current = true;

    const charger = locales.length
      ? envoyer<PanierApi>("/api/compte/panier/fusionner/", "POST", {
          lignes: locales.map((l) => ({ variante: l.variante, quantite: l.quantite })),
        })
      : envoyer<PanierApi>("/api/compte/panier/");

    charger
      .then((panier) => {
        setLignes(panier.lignes);
        setIgnorees(panier.ignorees ?? []);
        // Le navigateur n'a plus à le garder : le serveur fait foi.
        ecrireLocal([]);
      })
      .catch(() => setLignes(lireLocal()))
      .finally(() => setHydrated(true));
  }, [authPrete, connectee]);

  /** Enregistre localement à chaque changement, hors session seulement. */
  const poser = useCallback(
    (suivantes: Ligne[]) => {
      setLignes(suivantes);
      if (!connectee) ecrireLocal(suivantes);
    },
    [connectee],
  );

  /** Adopte la réponse du serveur : c'est elle qui fait foi, stock compris. */
  const adopter = useCallback((panier: PanierApi): Resultat => {
    setLignes(panier.lignes);
    setErreur(null);
    return { ok: true };
  }, []);

  /** Un refus laisse le panier tel qu'il était et remonte le message du serveur. */
  const refuser = useCallback((cause: unknown): Resultat => {
    const message = cause instanceof Error ? cause.message : "La demande n'a pas abouti.";
    setErreur(message);
    return { ok: false, error: message };
  }, []);

  const add = useCallback<Ctx["add"]>(
    async (article, quantite = 1) => {
      /* La pastille saute, le tiroir reste fermé : il s'ouvre quand la
         cliente le demande, pas à chaque article. */
      setPulse((p) => p + 1);

      if (connectee) {
        try {
          return adopter(
            await envoyer<PanierApi>("/api/compte/panier/lignes/", "POST", {
              variante: article.variante,
              quantite,
            }),
          );
        } catch (cause) {
          return refuser(cause);
        }
      }

      const presente = lignes.find((l) => l.variante === article.variante);
      const voulue = (presente?.quantite ?? 0) + quantite;
      if (voulue > article.stock_restant) {
        const message =
          article.stock_restant > 0
            ? `Il n'en reste que ${article.stock_restant}.`
            : "Cet article est épuisé.";
        setErreur(message);
        return { ok: false, error: message };
      }

      poser(
        presente
          ? lignes.map((l) => (l.variante === article.variante ? ligneLocale(article, voulue) : l))
          : [...lignes, ligneLocale(article, quantite)],
      );
      setErreur(null);
      return { ok: true };
    },
    [connectee, lignes, poser, adopter, refuser],
  );

  /**
   * Ajout depuis une vignette, où l'on ne connaît que la fiche.
   *
   * On relit la fiche pour prendre sa première variante servable : c'est le seul
   * endroit qui choisit à la place de la cliente, et seulement parce qu'elle n'a
   * pas ouvert la fiche pour choisir.
   */
  const addBySlug = useCallback<Ctx["addBySlug"]>(
    async (slug) => {
      try {
        // Sans cache : proposer une taille épuisée depuis une minute serait pire
        // qu'un aller-retour de plus.
        const fiche = await lire<ProduitApi>(`/api/catalogue/produits/${slug}/`, { revalider: 0 });
        const variante = fiche?.variantes?.find((v) => v.disponible && v.stock > 0);
        if (!fiche || !variante) {
          const message = "Cet article n'est plus disponible.";
          setErreur(message);
          return { ok: false, error: message };
        }
        return add({
          variante: variante.id,
          produit: fiche.id,
          slug: fiche.slug,
          nom: fiche.nom,
          option: `${variante.coloris_nom} · ${variante.taille_valeur}`,
          image: fiche.image,
          prix_unitaire: fiche.prix,
          stock_restant: variante.stock,
        });
      } catch (cause) {
        return refuser(cause);
      }
    },
    [add, refuser],
  );

  const setQuantity = useCallback<Ctx["setQuantity"]>(
    async (ligne, quantite) => {
      if (connectee) {
        try {
          // Descendre à zéro retire la ligne : le serveur en fait autant.
          return adopter(
            await envoyer<PanierApi>(`/api/compte/panier/lignes/${ligne}/`, "PATCH", { quantite }),
          );
        } catch (cause) {
          return refuser(cause);
        }
      }

      if (quantite < 1) {
        poser(lignes.filter((l) => l.id !== ligne));
        return { ok: true };
      }

      const cible = lignes.find((l) => l.id === ligne);
      if (cible && quantite > cible.stock_restant) {
        const message = `Il n'en reste que ${cible.stock_restant}.`;
        setErreur(message);
        return { ok: false, error: message };
      }

      poser(
        lignes.map((l) =>
          l.id === ligne
            ? {
                ...l,
                quantite,
                sous_total: l.prix_unitaire * quantite,
                disponible: quantite <= l.stock_restant,
              }
            : l,
        ),
      );
      setErreur(null);
      return { ok: true };
    },
    [connectee, lignes, poser, adopter, refuser],
  );

  const bump = useCallback<Ctx["bump"]>(
    (ligne, delta) => {
      const cible = lignes.find((l) => l.id === ligne);
      if (!cible) return Promise.resolve({ ok: false, error: "Ligne introuvable." });
      return setQuantity(ligne, cible.quantite + delta);
    },
    [lignes, setQuantity],
  );

  const remove = useCallback<Ctx["remove"]>(
    async (ligne) => {
      if (connectee) {
        try {
          return adopter(await envoyer<PanierApi>(`/api/compte/panier/lignes/${ligne}/`, "DELETE"));
        } catch (cause) {
          return refuser(cause);
        }
      }
      poser(lignes.filter((l) => l.id !== ligne));
      return { ok: true };
    },
    [connectee, lignes, poser, adopter, refuser],
  );

  const clear = useCallback<Ctx["clear"]>(async () => {
    poser([]);
    if (connectee) {
      await envoyer("/api/compte/panier/", "DELETE").catch(() => undefined);
    }
  }, [connectee, poser]);

  const count = useMemo(() => lignes.reduce((n, l) => n + l.quantite, 0), [lignes]);
  const subtotal = useMemo(() => lignes.reduce((n, l) => n + l.sous_total, 0), [lignes]);
  const complet = useMemo(() => lignes.every((l) => l.disponible), [lignes]);

  const valeur = useMemo<Ctx>(
    () => ({
      lignes,
      count,
      subtotal,
      complet,
      pulse,
      drawerOpen,
      hydrated,
      erreur,
      ignorees,
      oublierIgnorees: () => setIgnorees([]),
      add,
      addBySlug,
      setQuantity,
      bump,
      remove,
      clear,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [
      lignes, count, subtotal, complet, pulse, drawerOpen, hydrated, erreur,
      ignorees, add, addBySlug, setQuantity, bump, remove, clear,
    ],
  );

  return <CartContext.Provider value={valeur}>{children}</CartContext.Provider>;
}

export function useCart(): Ctx {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé à l'intérieur de <CartProvider>");
  return ctx;
}
