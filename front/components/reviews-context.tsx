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

import { ErreurApi, envoyer, lire, type AvisApi, type AvisPossibleApi, type Page } from "@/lib/api";
import { useAuth } from "./auth-context";

/**
 * Les avis.
 *
 * Ils vivaient dans le navigateur, et le droit d'écrire s'y vérifiait tout
 * seul : il suffisait d'éditer le stockage pour noter n'importe quoi. Le
 * serveur exige maintenant une commande **livrée**, la sienne, contenant
 * l'article — et l'avis attend d'être relu avant de paraître.
 *
 * Rien n'est chargé d'avance : une fiche demande les avis de son article, la
 * page d'accueil ceux de la boutique. Le cache est partagé, si bien que le
 * formulaire et la liste d'une même page lisent la même chose et se remettent
 * à jour ensemble.
 */

/** Avis sur un article précis, ou sur la boutique dans son ensemble. */
export type ReviewTarget = { kind: "product"; productId: string } | { kind: "shop" };

export interface Review {
  id: number;
  target: ReviewTarget;
  /** Note de 1 à 5. */
  rating: number;
  comment: string;
  authorName: string;
  /** L'article noté, quand il en existe encore un au catalogue. */
  productName: string;
  productSlug: string;
  /** Vrai pour l'autrice : c'est ce qui ouvre la modification et le retrait. */
  mine: boolean;
  /** « en_attente » tant qu'il n'a pas été relu. Seule son autrice le voit. */
  state: AvisApi["etat"];
  createdAt: string;
}

export interface Aggregate {
  count: number;
  average: number;
  /** Nombre d'avis par note, de 1 à 5. */
  distribution: Record<number, number>;
}

const AGREGAT_VIDE: Aggregate = {
  count: 0,
  average: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/** La clé de cache d'une cible. « shop » ou « p:12 ». */
const cleDe = (target: ReviewTarget) =>
  target.kind === "shop" ? "shop" : `p:${target.productId}`;

/** Les paramètres qui disent au serveur de quels avis on parle. */
const requeteDe = (target: ReviewTarget) =>
  target.kind === "shop" ? "boutique=1" : `produit=${encodeURIComponent(target.productId)}`;

function versAvis(brut: AvisApi): Review {
  return {
    id: brut.id,
    target:
      brut.produit === null
        ? { kind: "shop" }
        : { kind: "product", productId: String(brut.produit) },
    rating: brut.note,
    comment: brut.commentaire,
    authorName: brut.auteur_nom,
    productName: brut.produit_nom,
    productSlug: brut.produit_slug,
    mine: brut.est_le_mien,
    state: brut.etat,
    createdAt: brut.ecrit_le,
  };
}

type Entree = { avis: Review[]; resume: Aggregate };

type Ctx = {
  /** Ce que le cache tient pour cette cible, ou `undefined` avant réponse. */
  entree: (cle: string) => Entree | undefined;
  /** Demande le chargement d'une cible. Sans effet si elle est déjà en route. */
  demander: (target: ReviewTarget) => void;
  /** Force une relecture — après dépôt, modification ou retrait. */
  recharger: (target: ReviewTarget) => Promise<void>;
  /** Ce que la cliente peut encore noter : ses achats livrés, non déjà notés. */
  aNoter: AvisPossibleApi[];
  deposer: (
    target: ReviewTarget,
    note: number,
    commentaire: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  modifier: (
    id: number,
    target: ReviewTarget,
    note: number,
    commentaire: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  retirer: (id: number, target: ReviewTarget) => Promise<{ ok: boolean; error?: string }>;
  hydrated: boolean;
};

const ReviewsContext = createContext<Ctx | null>(null);

const message = (erreur: unknown, defaut: string) =>
  erreur instanceof ErreurApi ? erreur.message : defaut;

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const { account, hydrated: authPrete } = useAuth();

  const [cache, setCache] = useState<Record<string, Entree>>({});
  const [aNoter, setANoter] = useState<AvisPossibleApi[]>([]);
  const [hydrated, setHydrated] = useState(false);

  /* Les cibles déjà demandées. Une ref plutôt qu'un état : la relancer ne doit
     pas redessiner la page, et deux composants d'une même page demandent la
     même cible au même rendu. */
  const enRoute = useRef<Set<string>>(new Set());

  const charger = useCallback(async (target: ReviewTarget) => {
    const cle = cleDe(target);
    const params = requeteDe(target);
    try {
      const [liste, resume] = await Promise.all([
        /* Les avis sont lus avec le cookie de session : c'est lui qui permet à
           l'autrice de retrouver le sien, encore en attente de relecture. */
        envoyer<Page<AvisApi>>(`/api/avis/?${params}&page_size=100`),
        envoyer<{ nombre: number; moyenne: number; repartition: Record<string, number> }>(
          `/api/avis/resume/?${params}`,
        ),
      ]);
      setCache((etat) => ({
        ...etat,
        [cle]: {
          avis: (liste.results ?? []).map(versAvis),
          resume: {
            count: resume.nombre,
            /* Une décimale : « 4,7 » se lit, « 4,666… » non. */
            average: Math.round(resume.moyenne * 10) / 10,
            distribution: {
              1: resume.repartition["1"] ?? 0,
              2: resume.repartition["2"] ?? 0,
              3: resume.repartition["3"] ?? 0,
              4: resume.repartition["4"] ?? 0,
              5: resume.repartition["5"] ?? 0,
            },
          },
        },
      }));
    } catch {
      /* Serveur muet : une cible vide plutôt qu'une page en erreur. La section
         des avis dit alors qu'il n'y en a pas encore, ce qui est faux mais
         inoffensif — et se corrige au rechargement suivant. */
      setCache((etat) => (etat[cle] ? etat : { ...etat, [cle]: { avis: [], resume: AGREGAT_VIDE } }));
    }
  }, []);

  const demander = useCallback(
    (target: ReviewTarget) => {
      const cle = cleDe(target);
      if (enRoute.current.has(cle)) return;
      enRoute.current.add(cle);
      void charger(target);
    },
    [charger],
  );

  const recharger = useCallback(
    async (target: ReviewTarget) => {
      enRoute.current.add(cleDe(target));
      await charger(target);
    },
    [charger],
  );

  /**
   * Ce qui reste à noter.
   *
   * Le serveur seul peut le dire : il croise les commandes livrées de la
   * cliente avec ce qu'elle a déjà écrit. Relu à chaque changement de session —
   * une déconnexion doit refermer le formulaire.
   */
  const relireANoter = useCallback(async () => {
    if (!account) {
      setANoter([]);
      return;
    }
    try {
      setANoter(await envoyer<AvisPossibleApi[]>("/api/avis/a-noter/"));
    } catch {
      setANoter([]);
    }
  }, [account]);

  useEffect(() => {
    if (!authPrete) return;
    let vivant = true;
    void relireANoter().finally(() => {
      if (vivant) setHydrated(true);
    });
    return () => {
      vivant = false;
    };
  }, [authPrete, relireANoter]);

  /* Changer de session change ce que chacun a le droit de voir : l'avis en
     attente de la précédente n'appartient plus à la suivante. On repart du
     cache vide plutôt que de montrer celui d'avant. */
  useEffect(() => {
    enRoute.current = new Set();
    setCache({});
  }, [account?.email]);

  /** La commande qui ouvre le droit d'écrire sur cette cible, s'il y en a une. */
  const commandePour = useCallback(
    (target: ReviewTarget): number | null => {
      const attendu = target.kind === "shop" ? null : Number(target.productId);
      return aNoter.find((entree) => entree.produit === attendu)?.commande ?? null;
    },
    [aNoter],
  );

  const deposer = useCallback<Ctx["deposer"]>(
    async (target, note, commentaire) => {
      const commande = commandePour(target);
      if (commande === null) {
        return { ok: false, error: "Cet achat n'ouvre pas le droit à un avis." };
      }
      try {
        await envoyer("/api/avis/", "POST", {
          note,
          commentaire,
          commande,
          produit: target.kind === "shop" ? null : Number(target.productId),
        });
        await Promise.all([recharger(target), relireANoter()]);
        return { ok: true };
      } catch (erreur) {
        return { ok: false, error: message(erreur, "Votre avis n'a pas pu être envoyé.") };
      }
    },
    [commandePour, recharger, relireANoter],
  );

  const modifier = useCallback<Ctx["modifier"]>(
    async (id, target, note, commentaire) => {
      try {
        await envoyer(`/api/avis/${id}/`, "PATCH", { note, commentaire });
        await recharger(target);
        return { ok: true };
      } catch (erreur) {
        return { ok: false, error: message(erreur, "La modification n'a pas abouti.") };
      }
    },
    [recharger],
  );

  const retirer = useCallback<Ctx["retirer"]>(
    async (id, target) => {
      try {
        await envoyer(`/api/avis/${id}/`, "DELETE");
        await Promise.all([recharger(target), relireANoter()]);
        return { ok: true };
      } catch (erreur) {
        return { ok: false, error: message(erreur, "Le retrait n'a pas abouti.") };
      }
    },
    [recharger, relireANoter],
  );

  const entree = useCallback((cle: string) => cache[cle], [cache]);

  const value = useMemo<Ctx>(
    () => ({ entree, demander, recharger, aNoter, deposer, modifier, retirer, hydrated }),
    [entree, demander, recharger, aNoter, deposer, modifier, retirer, hydrated],
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

function useContexteAvis(): Ctx {
  const ctx = useContext(ReviewsContext);
  if (!ctx) throw new Error("Les avis doivent être lus dans <ReviewsProvider>");
  return ctx;
}

/**
 * Les avis d'une cible, chargés à la demande.
 *
 * `pret` reste faux tant que la réponse n'est pas là : le premier rendu est
 * donc identique côté serveur et client, comme pour le panier et les comptes.
 */
export function useAvis(target: ReviewTarget) {
  const ctx = useContexteAvis();
  const cle = cleDe(target);

  /* La cible est reconstruite à chaque rendu par les appelants ; c'est sa clé,
     une chaîne, qui sert de dépendance. */
  const stable = useMemo(
    () => (cle === "shop" ? ({ kind: "shop" } as const) : ({ kind: "product", productId: cle.slice(2) } as const)),
    [cle],
  );

  useEffect(() => {
    ctx.demander(stable);
  }, [ctx, stable]);

  const entree = ctx.entree(cle);

  return {
    avis: entree?.avis ?? [],
    resume: entree?.resume ?? AGREGAT_VIDE,
    pret: entree !== undefined,
    /** L'avis déjà déposé par la cliente sur cette cible, s'il existe. */
    mien: entree?.avis.find((a) => a.mine),
    cible: stable as ReviewTarget,
  };
}

/**
 * Les derniers avis sur des articles, tous rayons confondus.
 *
 * Sert la page d'avis, qui les présente sous ceux de la boutique. Une seule
 * lecture, non filtrée, plutôt qu'un appel par fiche du catalogue.
 */
export function useDerniersAvisArticles(combien = 6) {
  const [avis, setAvis] = useState<Review[]>([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      try {
        const page = await lire<Page<AvisApi>>(`/api/avis/?page_size=${combien * 4}`, {
          revalider: 60,
        });
        if (!vivant) return;
        setAvis(
          (page?.results ?? [])
            .filter((a) => a.produit !== null && a.etat === "publie")
            .slice(0, combien)
            .map(versAvis),
        );
      } catch {
        /* rien à montrer plutôt qu'une page en erreur */
      } finally {
        if (vivant) setPret(true);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [combien]);

  return { avis, pret };
}

/** Ce que la cliente peut encore noter, et de quoi écrire. */
export function useMesAvis() {
  const { aNoter, deposer, modifier, retirer, hydrated } = useContexteAvis();
  return { aNoter, deposer, modifier, retirer, hydrated };
}
