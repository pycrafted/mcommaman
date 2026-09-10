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

import { envoyer, televerser, type Page, type RayonApi } from "@/lib/api";
import {
  depuisPromotion,
  depuisProduit,
  depuisReglages,
  versCategorie,
  versCliente,
  versColoris,
  versCommande,
  versMedia,
  versMembre,
  versMatiere,
  versProduit,
  versPromotion,
  versReglages,
  versTaille,
  type CampagneApi,
  type ClienteApi,
  type ColorisApi,
  type CommandeApi,
  type MediaApi,
  type MembreApi,
  type MatiereApi,
  type PhotoProduitApi,
  type ProduitGestionApi,
  type ReglagesApi,
  type TailleApi,
} from "./passage";
import { useAuth } from "@/components/auth-context";
import type {
  ActivityEntry,
  AdminCategory,
  AdminColor,
  AdminProduct,
  AdminPromotion,
  Customer,
  CustomerSegment,
  HeroConfig,
  MediaItem,
  Order,
  OrderStatus,
  ProductLibrary,
  SizeValue,
  StoreSettings,
  TeamMember,
} from "./types";

/**
 * Aujourd'hui.
 *
 * Le back-office travaillait sur une date figée au 15 août 2026 — celle de la
 * graine de démonstration. Les commandes viennent maintenant de la base : les
 * trente derniers jours doivent se compter à partir du vrai jour, sinon les
 * indicateurs se figent avec elle.
 *
 * Une fonction et non une constante : un onglet laissé ouvert une nuit doit
 * changer de jour comme tout le monde.
 */
export const maintenant = () => new Date();

/**
 * La clé qui portait autrefois tout le back-office dans le navigateur.
 *
 * Conservée pour une seule raison : la page des réglages propose d'effacer ce
 * qu'un ancien passage y aurait laissé. Plus rien n'y est écrit.
 */
export const ADMIN_STORAGE_KEY = "mcm-admin-v1";

/**
 * La taille des fiches vendues sans déclinaison.
 *
 * Une variante porte toujours une taille — c'est elle qui tient le stock et
 * qui part au panier. Un article qui ne se décline pas en reçoit donc une
 * seule, « TU », et son stock est celui de la fiche entière.
 */
export const TAILLE_UNIQUE = "TU";

/**
 * L'état du back-office, tenu par le serveur.
 *
 * Il n'y a plus rien dans le navigateur : chaque écriture part vers
 * `/api/gestion/`, et l'état affiché est relu ensuite. Deux postes ouverts sur
 * la même boutique voient donc la même chose — ce qui était impossible tant
 * que tout vivait dans `localStorage`.
 *
 * La surface publique n'a pas bougé : les onze pages consomment `useAdmin()`
 * exactement comme avant.
 */

interface AdminState {
  products: AdminProduct[];
  orders: Order[];
  customers: Customer[];
  /* L'equipe : les comptes qui ouvrent le back-office, par opposition aux
     clientes. Les deux vivent dans la meme table cote serveur, separes par
     leur role, et la page Utilisateurs les montre en deux onglets. */
  team: TeamMember[];
  categories: AdminCategory[];
  promotions: AdminPromotion[];
  library: ProductLibrary;
  settings: StoreSettings;
  hero: HeroConfig;
  activity: ActivityEntry[];
}

const VIDE: AdminState = {
  products: [],
  orders: [],
  customers: [],
  team: [],
  categories: [],
  promotions: [],
  library: { sizes: [], sizeGuide: "", colors: [], materials: [], media: [] },
  settings: {
    storeName: "M comme Maman",
    tagline: "",
    contactEmail: "",
    phone: "",
    currency: "F",
    freeShippingThreshold: 25000,
    shippingDakar: 2000,
    shippingRegions: 3500,
    lowStockThreshold: 6,
    acceptOrders: true,
    showPromoBanner: true,
    promoBannerText: "",
  },
  hero: { custom: false, slides: [] },
  activity: [],
};

interface AdminContextValue extends AdminState {
  hydrated: boolean;
  /** Vrai le temps d'une écriture : les boutons peuvent se désactiver. */
  enCours: boolean;
  /** Le dernier refus du serveur, en clair. */
  erreur: string;
  notification: { type: "success" | "error" | "warning"; message: string } | null;
  dismissNotification: () => void;
  notify: (type: "success" | "error" | "warning", message: string) => void;
  /* Produits */
  saveProduct: (product: AdminProduct) => void;
  createProduct: (product: AdminProduct) => void;
  deleteProduct: (id: string) => void;
  duplicateProduct: (id: string) => void;
  setProductStatus: (id: string, status: AdminProduct["status"]) => void;
  setStock: (id: string, stock: number) => void;
  /* Commandes */
  setOrderStatus: (id: string, status: OrderStatus) => void;

  /* Renvoie `true` si le serveur a accepte. La fenetre appelante en a besoin :
     elle ne se referme que sur un succes, sinon l'adresse deja saisie serait
     perdue avec le message qui explique pourquoi elle a ete refusee. */
  saveTeamMember: (
    membre: { id?: string; name: string; email: string; phone: string },
    motDePasse: string,
  ) => Promise<boolean>;
  setTeamMemberActive: (id: string, active: boolean) => void;
  /* Rayons */
  saveCategory: (category: AdminCategory) => void;
  deleteCategory: (
    id: string,
    brouillons?: { mode: "supprimer" } | { mode: "deplacer"; destinationId: string },
  ) => void;
  /* Promotions */
  savePromotion: (promotion: AdminPromotion) => void;
  deletePromotion: (id: string) => void;
  /* Bibliothèque */
  saveSizes: (sizes: SizeValue[]) => void;
  saveColor: (color: AdminColor) => void;
  deleteColor: (id: string) => void;
  saveMaterial: (name: string) => void;
  deleteMaterial: (id: string) => void;
  addMedia: (items: Pick<MediaItem, "src" | "name">[]) => void;
  /** Envoie un fichier à la photothèque et renvoie l'image créée. */
  televerserMedia: (fichier: File, nom?: string) => Promise<MediaItem | null>;
  removeMedia: (id: string) => void;
  /* Vitrine */
  updateHero: (hero: HeroConfig) => void;
  updateSettings: (patch: Partial<StoreSettings>) => void;
  /* Divers */
  resetDemoData: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

/** Une liste paginée dont on ne veut que le contenu. */
const contenu = <T,>(page: Page<T> | T[] | null): T[] =>
  Array.isArray(page) ? page : (page?.results ?? []);

/**
 * Toutes les lignes d'une collection paginée.
 *
 * Le back-office calcule des totaux et des segments : une page de moins et le
 * chiffre d'affaires est faux, les clientes fidèles disparaissent, et rien ne
 * signale l'écart. On suit donc `next` jusqu'au bout plutôt que d'espérer que
 * tout tienne sur la première page.
 *
 * Renvoie ce qui a pu être lu si le serveur s'interrompt : mieux vaut une liste
 * partielle qu'un back-office vide, et l'erreur remonte par ailleurs.
 */
async function tout<T>(chemin: string): Promise<T[]> {
  const lignes: T[] = [];
  let suite: string | null = chemin + (chemin.includes("?") ? "&" : "?") + "page_size=200";

  try {
    while (suite) {
      const page: Page<T> = await envoyer<Page<T>>(suite);
      lignes.push(...page.results);
      // `next` est une adresse absolue : on n'en garde que le chemin, seul
      // `lib/api` sait à quel serveur il parle.
      suite = page.next ? new URL(page.next).pathname + new URL(page.next).search : null;
    }
  } catch {
    /* interrompu : on garde ce qui est déjà arrivé */
  }
  return lignes;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  /* Le back-office ne se lit que pour une session d'équipe. Ce fournisseur est
     monté au-dessus de la page de connexion aussi : sans cette condition, il
     partait à vide sur `/admin/connexion` — treize appels, treize 403 avalés
     en silence — puis ne repartait plus après la connexion, qui est une
     navigation client sans remontage. Le tableau de bord restait à zéro
     jusqu'à un rechargement complet. */
  const { account, hydrated: sessionPrete } = useAuth();
  const equipe = Boolean(account?.equipe);

  const [state, setState] = useState<AdminState>(VIDE);
  const [hydrated, setHydrated] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [notification, setNotification] = useState<AdminContextValue["notification"]>(null);

  useEffect(() => {
    if (!notification) return;
    const minuteur = window.setTimeout(() => setNotification(null), 4200);
    return () => window.clearTimeout(minuteur);
  }, [notification]);

  /**
   * Relit tout.
   *
   * Un seul appel groupé plutôt qu'un rechargement par domaine : le
   * back-office se consulte d'une page à l'autre, et les compteurs de la barre
   * latérale ont besoin des commandes même sur la page des rayons.
   */
  const relire = useCallback(async () => {
    const [produits, rayons, commandes, clientes, equipe, campagnes, tailles, coloris, matieres, medias, reglages] =
      await Promise.all([
        tout<ProduitGestionApi>("/api/gestion/produits/"),
        // La route publique masque les rayons invisibles : lus par là, ceux
        // qu'on vient de décocher disparaissaient aussi du back-office, comme
        // s'ils avaient été supprimés. `/api/gestion/` les rend tous.
        tout<RayonApi>("/api/gestion/rayons/"),
        tout<CommandeApi>("/api/gestion/commandes/"),
        tout<ClienteApi>("/api/gestion/clientes/"),
        tout<MembreApi>("/api/gestion/equipe/"),
        tout<CampagneApi>("/api/gestion/campagnes/"),
        envoyer<TailleApi[]>("/api/gestion/tailles/").catch(() => null),
        envoyer<ColorisApi[]>("/api/gestion/coloris/").catch(() => null),
        envoyer<MatiereApi[]>("/api/gestion/matieres/").catch(() => null),
        tout<MediaApi>("/api/gestion/photheque/"),
        // Les réglages du back-office passent par `/api/gestion/` : la route
        // publique est en lecture seule et ne porte pas le seuil de stock bas.
        // Réservée à la gérante — une vendeuse garde le reste du back-office.
        envoyer<ReglagesApi>("/api/gestion/reglages/").catch(() => null),
      ]);

    const categories = contenu(rayons).map(versCategorie);
    const rayonsParId = new Map(categories.map((r) => [Number(r.id), r.slug]));
    setState((courant) => ({
      ...courant,
      products: contenu(produits).map(versProduit),
      categories,
      orders: contenu(commandes).map(versCommande),
      customers: contenu(clientes).map(versCliente),
      team: contenu(equipe).map(versMembre),
      promotions: contenu(campagnes).map((campagne) => versPromotion(campagne, rayonsParId)),
      library: {
        ...courant.library,
        sizes: (tailles ?? []).map(versTaille),
        colors: (coloris ?? []).map(versColoris),
        materials: (matieres ?? []).map(versMatiere),
        media: contenu(medias).map(versMedia),
      },
      settings: reglages ? versReglages(reglages) : courant.settings,
    }));
  }, []);

  useEffect(() => {
    if (!sessionPrete) return;
    if (!equipe) {
      // Session fermée ou étrangère à l'équipe : on ne garde rien de ce qui a
      // pu être lu — la personne suivante sur ce navigateur n'a pas à voir les
      // commandes de la précédente.
      setState(VIDE);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    relire().finally(() => setHydrated(true));
  }, [relire, sessionPrete, equipe]);

  /**
   * Exécute une écriture, puis relit.
   *
   * On relit systématiquement au lieu de deviner l'état d'arrivée : le serveur
   * peut avoir recalculé un stock, changé un slug, refusé une publication. Ce
   * qu'il renvoie fait foi.
   */
  const ecrire = useCallback(
    async (action: () => Promise<unknown>) => {
      setEnCours(true);
      setErreur("");
      try {
        await action();
        await relire();
        setNotification({ type: "success", message: "Modifications enregistrées." });
      } catch (e) {
        const message = e instanceof Error ? e.message : "L'enregistrement a échoué.";
        setErreur(message);
        setNotification({ type: "error", message });
        // On relit quand même : l'écran doit montrer l'état réel, pas celui
        // qu'on espérait.
        await relire();
      } finally {
        setEnCours(false);
      }
    },
    [relire],
  );

  const rayonsParNom = useMemo(() => {
    const table = new Map<string, number>();
    for (const categorie of state.categories) table.set(categorie.label, Number(categorie.id));
    return table;
  }, [state.categories]);

  const matieresParNom = useMemo(() => {
    const table = new Map<string, number>();
    for (const matiere of state.library.materials) table.set(matiere.name, Number(matiere.id));
    return table;
  }, [state.library.materials]);

  /* --------------------------------------------------------- produits */

  /**
   * Range les photos d'une fiche.
   *
   * Elles voyagent en adresses dans le formulaire, en identifiants en base : on
   * passe donc par la photothèque, qui les garde. Une image déjà connue n'y est
   * pas réenregistrée — deux fiches peuvent montrer le même visuel.
   *
   * Sans cette étape, une fiche naissait sans aucune photo et le serveur
   * refusait de la publier, en disant vrai.
   */
  const rangerPhotos = useCallback(
    async (produitId: number, adresses: string[]) => {
      const photothegue = new Map(
        contenu(await envoyer<Page<MediaApi>>("/api/gestion/photheque/?page_size=500").catch(
          () => null,
        )).map((m) => [m.url, m.id]),
      );

      const existantes = contenu(
        await envoyer<Page<PhotoProduitApi>>(
          `/api/gestion/photos/?produit=${produitId}&page_size=200`,
        ).catch(() => null),
      ).filter((p) => p.produit === produitId);

      // Ce qui n'est plus dans le formulaire quitte la fiche.
      for (const photo of existantes) {
        if (!adresses.includes(photo.url)) {
          await envoyer(`/api/gestion/photos/${photo.id}/`, "DELETE").catch(() => undefined);
        }
      }

      for (const [position, adresse] of adresses.entries()) {
        const deja = existantes.find((p) => p.url === adresse);
        if (deja) {
          if (deja.position !== position) {
            await envoyer(`/api/gestion/photos/${deja.id}/`, "PATCH", { position }).catch(
              () => undefined,
            );
          }
          continue;
        }

        let media = photothegue.get(adresse);
        if (!media) {
          const cree = await envoyer<MediaApi>("/api/gestion/photheque/", "POST", {
            url: adresse,
            nom: adresse.split("/").pop() ?? "Visuel",
          }).catch(() => null);
          if (!cree) continue;
          media = cree.id;
          photothegue.set(adresse, cree.id);
        }

        await envoyer("/api/gestion/photos/", "POST", {
          produit: produitId,
          media,
          position,
        }).catch(() => undefined);
      }
    },
    [],
  );

  const rangerVariantes = useCallback(
    async (produitId: number, produit: AdminProduct) => {
      const tailles = new Map(state.library.sizes.map((t) => [t.value, Number(t.id)]));
      const coloris = new Map(state.library.colors.map((c) => [c.name, Number(c.id)]));

      /* Une taille ou un coloris saisi depuis la fiche peut ne pas être encore
         revenu du serveur. Plutôt que de laisser tomber la variante — l'article
         partait alors sans stock, donc invendable —, on crée ce qui manque. Un
         refus signifie presque toujours que la valeur existe déjà : on relit
         plutôt que d'abandonner. */
      const taillePour = async (valeur: string): Promise<number | null> => {
        const connue = tailles.get(valeur);
        if (connue) return connue;
        const creee = await envoyer<TailleApi>("/api/gestion/tailles/", "POST", {
          valeur,
          repere: valeur === TAILLE_UNIQUE ? "Taille unique" : "",
          ordre: tailles.size,
        }).catch(() => null);
        if (creee) tailles.set(creee.valeur, creee.id);
        else
          for (const t of (await envoyer<TailleApi[]>("/api/gestion/tailles/").catch(() => null)) ?? [])
            tailles.set(t.valeur, t.id);
        return tailles.get(valeur) ?? null;
      };

      const colorisPour = async (nom: string): Promise<number | null> => {
        const connu = coloris.get(nom);
        if (connu) return connu;
        const cree = await envoyer<ColorisApi>("/api/gestion/coloris/", "POST", {
          nom,
          hexa: "#000000",
        }).catch(() => null);
        if (cree) coloris.set(cree.nom, cree.id);
        else
          for (const c of (await envoyer<ColorisApi[]>("/api/gestion/coloris/").catch(() => null)) ?? [])
            coloris.set(c.nom, c.id);
        return coloris.get(nom) ?? null;
      };

      const existantes = contenu(
        await envoyer<Page<{ id: number; taille: number; coloris: number | null; stock: number }>>(
          `/api/gestion/variantes/?produit=${produitId}&page_size=200`,
        ),
      );
      const souhaitees = new Map<
        string,
        { taille: number; coloris: number | null; sku: string; stock: number }
      >();

      for (const varianteProduit of produit.variants) {
        const taille = await taillePour(varianteProduit.size);
        if (!taille) continue;
        const colorisId = varianteProduit.color
          ? await colorisPour(varianteProduit.color)
          : null;
        const cle = `${taille}:${colorisId ?? ""}`;
        const suffixe = [varianteProduit.size, varianteProduit.color]
          .filter(Boolean)
          .join("-")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .toUpperCase();
        souhaitees.set(cle, {
          taille,
          coloris: colorisId,
          sku: `${produit.sku}-${suffixe}`,
          stock: varianteProduit.stock,
        });
      }

      for (const variante of existantes) {
        const cle = `${variante.taille}:${variante.coloris ?? ""}`;
        const souhaitee = souhaitees.get(cle);
        if (souhaitee) {
          if (variante.stock !== souhaitee.stock) {
            await envoyer(`/api/gestion/variantes/${variante.id}/`, "PATCH", {
              stock: souhaitee.stock,
            });
          }
          souhaitees.delete(cle);
        } else if (variante.stock === 0) {
          await envoyer(`/api/gestion/variantes/${variante.id}/`, "DELETE");
        } else {
          throw new Error("Une option encore en stock ne peut pas être retirée de la fiche.");
        }
      }

      for (const variante of souhaitees.values()) {
        await envoyer("/api/gestion/variantes/", "POST", {
          produit: produitId,
          taille: variante.taille,
          coloris: variante.coloris,
          sku: variante.sku,
          stock: variante.stock,
        });
      }
    },
    [state.library.colors, state.library.sizes],
  );

  const saveProduct = useCallback<AdminContextValue["saveProduct"]>(
    (produit) =>
      void ecrire(async () => {
        const publier = produit.status === "publie";
        await envoyer(
          `/api/gestion/produits/${produit.id}/`,
          "PATCH",
          depuisProduit({ ...produit, status: "brouillon" }, rayonsParNom, matieresParNom),
        );
        await rangerPhotos(Number(produit.id), [produit.image, ...produit.gallery].filter(Boolean));
        await rangerVariantes(Number(produit.id), produit);
        if (publier) await envoyer(`/api/gestion/produits/${produit.id}/publier/`, "POST");
      }),
    [ecrire, matieresParNom, rangerPhotos, rangerVariantes, rayonsParNom],
  );

  const createProduct = useCallback<AdminContextValue["createProduct"]>(
    (produit) =>
      void ecrire(async () => {
        const publier = produit.status === "publie";
        const cree = await envoyer<{ id: number }>(
          "/api/gestion/produits/",
          "POST",
          depuisProduit({ ...produit, status: "brouillon" }, rayonsParNom, matieresParNom),
        );
        // La fiche existe avant ses photos : elles ont besoin de son identifiant.
        await rangerPhotos(cree.id, [produit.image, ...produit.gallery].filter(Boolean));
        await rangerVariantes(cree.id, produit);
        if (publier) await envoyer(`/api/gestion/produits/${cree.id}/publier/`, "POST");
      }),
    [ecrire, matieresParNom, rangerPhotos, rangerVariantes, rayonsParNom],
  );

  const deleteProduct = useCallback<AdminContextValue["deleteProduct"]>(
    (id) => void ecrire(() => envoyer(`/api/gestion/produits/${id}/`, "DELETE")),
    [ecrire],
  );

  const duplicateProduct = useCallback<AdminContextValue["duplicateProduct"]>(
    (id) => void ecrire(() => envoyer(`/api/gestion/produits/${id}/dupliquer/`, "POST")),
    [ecrire],
  );

  const setProductStatus = useCallback<AdminContextValue["setProductStatus"]>(
    (id, statut) => {
      // Publier passe par l'action dédiée : c'est elle qui refait le contrôle
      // des cinq conditions et refuse une fiche incomplète.
      const chemin =
        statut === "publie"
          ? `/api/gestion/produits/${id}/publier/`
          : statut === "archive"
            ? `/api/gestion/produits/${id}/archiver/`
            : null;
      void ecrire(() =>
        chemin
          ? envoyer(chemin, "POST")
          : envoyer(`/api/gestion/produits/${id}/`, "PATCH", { statut }),
      );
    },
    [ecrire],
  );

  const setStock = useCallback<AdminContextValue["setStock"]>(
    (id, stock) => {
      // Le stock vit sur la variante. Sans variante unique, on ne devine pas
      // laquelle ajuster : la page des variantes s'en charge.
      const produit = state.products.find((p) => p.id === id);
      const ecart = stock - (produit?.stock ?? 0);
      if (!produit || ecart === 0) return;
      void ecrire(async () => {
        const variantes = await envoyer<Page<{ id: number }>>(
          `/api/gestion/variantes/?produit=${id}`,
        );
        const premiere = contenu(variantes)[0];
        if (!premiere) throw new Error("Cette fiche n'a pas encore de variante.");
        return envoyer(`/api/gestion/variantes/${premiere.id}/ajuster/`, "POST", {
          quantite: ecart,
          motif: "ajustement",
        });
      });
    },
    [ecrire, state.products],
  );

  /* -------------------------------------------------------- commandes */

  const setOrderStatus = useCallback<AdminContextValue["setOrderStatus"]>(
    (ref, statut) =>
      void ecrire(() =>
        statut === "annulee"
          ? envoyer(`/api/gestion/commandes/${ref}/annuler/`, "POST")
          : envoyer(`/api/gestion/commandes/${ref}/avancer/`, "POST"),
      ),
    [ecrire],
  );

  /* ----------------------------------------------------------- equipe */

  /**
   * Ouvre un compte du back-office, ou corrige celui d'un collegue.
   *
   * Ne passe pas par `ecrire` : celui-ci avale l'erreur dans une bandeau et
   * renvoie `void`, alors que la fenetre de saisie doit savoir si elle peut se
   * refermer. Le message du serveur — adresse deja prise, mot de passe trop
   * court — remonte donc tel quel jusqu'au formulaire.
   */
  const saveTeamMember = useCallback<AdminContextValue["saveTeamMember"]>(
    async (membre, motDePasse) => {
      // Pas de role dans la requete : le serveur n'ouvre que des comptes de
      // gerante, et refuse de le laisser choisir. Rien a envoyer, donc.
      const corps: Record<string, unknown> = {
        email: membre.email.trim().toLowerCase(),
        nom: membre.name.trim(),
        telephone: membre.phone.trim(),
      };
      // A la modification, un mot de passe vide veut dire « garde celui en
      // place » : on ne l'envoie pas du tout plutot que d'envoyer du vide.
      if (motDePasse) corps.mot_de_passe = motDePasse;

      setEnCours(true);
      setErreur("");
      try {
        await (membre.id
          ? envoyer(`/api/gestion/equipe/${membre.id}/`, "PATCH", corps)
          : envoyer("/api/gestion/equipe/", "POST", corps));
        await relire();
        setNotification({
          type: "success",
          message: membre.id ? "Compte mis a jour." : "Compte cree.",
        });
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "L'enregistrement a echoue.";
        setErreur(message);
        setNotification({ type: "error", message });
        return false;
      } finally {
        setEnCours(false);
      }
    },
    [relire],
  );

  /* Desactiver plutot que supprimer : le compte perd l'acces, son nom reste
     lisible sur ce qu'il a fait. Le serveur refuse qu'on se ferme la porte a
     soi-meme, l'interface cache deja le bouton dans ce cas. */
  const setTeamMemberActive = useCallback<AdminContextValue["setTeamMemberActive"]>(
    (id, active) =>
      void ecrire(() => envoyer(`/api/gestion/equipe/${id}/`, "PATCH", { is_active: active })),
    [ecrire],
  );

  /* ----------------------------------------------------------- rayons */

  const saveCategory = useCallback<AdminContextValue["saveCategory"]>(
    (categorie) => {
      // Les parentes voyagent par identifiant. Le serveur refuse qu'une
      // sous-catégorie en porte une autre : deux niveaux suffisent, et il ne
      // prend pas notre mot pour argent comptant.
      const parents = (categorie.parentSlugs ?? [])
        .map((slug) => state.categories.find((c) => c.slug === slug))
        .filter((c): c is AdminCategory => Boolean(c))
        .map((c) => Number(c.id));

      const corps = {
        nom: categorie.label,
        description: categorie.description,
        visible: categorie.active,
        ordre: categorie.order,
        // Le rayon référence un média par son identifiant. L'éditeur manipule
        // son URL pour pouvoir afficher l'aperçu : on retrouve donc ici le
        // média correspondant avant d'envoyer la fiche au serveur.
        image: categorie.image
          ? Number(state.library.media.find((media) => media.src === categorie.image)?.id) || null
          : null,
        parents,
      };
      void ecrire(() =>
        state.categories.some((c) => c.id === categorie.id)
          ? envoyer(`/api/gestion/rayons/${categorie.id}/`, "PATCH", corps)
          : envoyer("/api/gestion/rayons/", "POST", corps),
      );
    },
    [ecrire, state.categories, state.library.media],
  );

  const deleteCategory = useCallback<AdminContextValue["deleteCategory"]>(
    (id, brouillons) => {
      const params = new URLSearchParams();
      if (brouillons) params.set("brouillons", brouillons.mode);
      if (brouillons?.mode === "deplacer") params.set("destination", brouillons.destinationId);
      const query = params.size ? `?${params.toString()}` : "";
      void ecrire(() => envoyer(`/api/gestion/rayons/${id}/${query}`, "DELETE"));
    },
    [ecrire],
  );

  /* ------------------------------------------------------- promotions */

  const savePromotion = useCallback<AdminContextValue["savePromotion"]>(
    (promotion) => {
      const rayonsParSlug = new Map(state.categories.map((r) => [r.slug, Number(r.id)]));
      const corps = depuisPromotion(promotion, rayonsParSlug);
      void ecrire(() =>
        state.promotions.some((p) => p.id === promotion.id)
          ? envoyer(`/api/gestion/campagnes/${promotion.id}/`, "PATCH", corps)
          : envoyer("/api/gestion/campagnes/", "POST", corps),
      );
    },
    [ecrire, state.promotions],
  );

  const deletePromotion = useCallback<AdminContextValue["deletePromotion"]>(
    (id) => void ecrire(() => envoyer(`/api/gestion/campagnes/${id}/`, "DELETE")),
    [ecrire],
  );

  /* ----------------------------------------------------- bibliothèque */

  const saveSizes = useCallback<AdminContextValue["saveSizes"]>(
    (tailles) => {
      // La liste envoyée fait foi : on crée ce qui manque, on retire le reste.
      const avant = new Map(state.library.sizes.map((t) => [t.value, t]));
      const apres = new Map(tailles.map((t) => [t.value, t]));
      void ecrire(async () => {
        for (const [valeur, taille] of apres) {
          const precedente = avant.get(valeur);
          if (!precedente) {
            await envoyer("/api/gestion/tailles/", "POST", {
              valeur,
              repere: taille.age,
              ordre: tailles.indexOf(taille),
            });
          } else if (precedente.age !== taille.age && precedente.id) {
            await envoyer(`/api/gestion/tailles/${precedente.id}/`, "PATCH", {
              repere: taille.age,
            });
          }
        }
        const restantes = await envoyer<TailleApi[]>("/api/gestion/tailles/");
        for (const existante of restantes ?? []) {
          if (!apres.has(existante.valeur)) {
            await envoyer(`/api/gestion/tailles/${existante.id}/`, "DELETE");
          }
        }
      });
    },
    [ecrire, state.library.sizes],
  );

  const saveColor = useCallback<AdminContextValue["saveColor"]>(
    (couleur) => {
      const corps = { nom: couleur.name, hexa: couleur.hex };
      void ecrire(() =>
        state.library.colors.some((c) => c.id === couleur.id)
          ? envoyer(`/api/gestion/coloris/${couleur.id}/`, "PATCH", corps)
          : envoyer("/api/gestion/coloris/", "POST", corps),
      );
    },
    [ecrire, state.library.colors],
  );

  const deleteColor = useCallback<AdminContextValue["deleteColor"]>(
    (id) => void ecrire(() => envoyer(`/api/gestion/coloris/${id}/`, "DELETE")),
    [ecrire],
  );

  const saveMaterial = useCallback<AdminContextValue["saveMaterial"]>(
    (name) => void ecrire(() => envoyer("/api/gestion/matieres/", "POST", { nom: name })),
    [ecrire],
  );

  const deleteMaterial = useCallback<AdminContextValue["deleteMaterial"]>(
    (id) => void ecrire(() => envoyer(`/api/gestion/matieres/${id}/`, "DELETE")),
    [ecrire],
  );

  const addMedia = useCallback<AdminContextValue["addMedia"]>(
    (items) =>
      void ecrire(async () => {
        for (const item of items) {
          await envoyer("/api/gestion/photheque/", "POST", { url: item.src, nom: item.name });
        }
      }),
    [ecrire],
  );

  /**
   * Envoie une image et la range dans la photothèque.
   *
   * Renvoie l'entrée créée plutôt que rien : l'appelant en a besoin tout de
   * suite pour l'attacher à un rayon ou à une fiche, sans attendre la relecture.
   */
  const televerserMedia = useCallback<AdminContextValue["televerserMedia"]>(
    async (fichier, nom) => {
      const forme = new FormData();
      forme.append("fichier", fichier);
      forme.append("nom", nom?.trim() || fichier.name);

      setEnCours(true);
      setErreur("");
      try {
        const brut = await televerser<MediaApi>("/api/gestion/photheque/", forme);
        await relire();
        return versMedia(brut);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "L'envoi de l'image a échoué.");
        return null;
      } finally {
        setEnCours(false);
      }
    },
    [relire],
  );

  const removeMedia = useCallback<AdminContextValue["removeMedia"]>(
    (id) => void ecrire(() => envoyer(`/api/gestion/photheque/${id}/`, "DELETE")),
    [ecrire],
  );

  /* ---------------------------------------------------------- vitrine */

  const updateHero = useCallback<AdminContextValue["updateHero"]>(
    (hero) => setState((courant) => ({ ...courant, hero })),
    [],
  );

  const updateSettings = useCallback<AdminContextValue["updateSettings"]>(
    (patch) =>
      void ecrire(() => envoyer("/api/gestion/reglages/", "PATCH", depuisReglages(patch))),
    [ecrire],
  );

  const resetDemoData = useCallback(() => {
    // Les données ne vivent plus dans ce navigateur : il n'y a rien à
    // réinitialiser d'ici. La commande `peupler --vider` s'en charge côté
    // serveur, sous le contrôle de quelqu'un.
    void relire();
  }, [relire]);

  const value = useMemo<AdminContextValue>(
    () => ({
      ...state,
      hydrated,
      enCours,
      erreur,
      notification,
      dismissNotification: () => setNotification(null),
      notify: (type, message) => setNotification({ type, message }),
      saveProduct,
      createProduct,
      deleteProduct,
      duplicateProduct,
      setProductStatus,
      setStock,
      setOrderStatus,
      saveTeamMember,
      setTeamMemberActive,
      saveCategory,
      deleteCategory,
      savePromotion,
      deletePromotion,
      saveSizes,
      saveColor,
      deleteColor,
      saveMaterial,
      deleteMaterial,
      addMedia,
      televerserMedia,
      removeMedia,
      updateHero,
      updateSettings,
      resetDemoData,
    }),
    [
      state, hydrated, enCours, erreur, notification, saveProduct, createProduct, deleteProduct,
      duplicateProduct, setProductStatus, setStock, setOrderStatus, saveTeamMember, setTeamMemberActive, saveCategory,
      deleteCategory, savePromotion, deletePromotion, saveSizes,
      saveColor, deleteColor, saveMaterial, deleteMaterial, addMedia, televerserMedia, removeMedia, updateHero,
      updateSettings, resetDemoData,
    ],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin doit être utilisé à l'intérieur de <AdminProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Statistiques dérivées                                               */
/* ------------------------------------------------------------------ */

export const STATUTS_ENCAISSES: OrderStatus[] = ["payee", "preparation", "expediee", "livree"];

function encaisse(order: Order) {
  return STATUTS_ENCAISSES.includes(order.status);
}

export interface PeriodStats {
  revenue: number;
  orders: number;
  averageBasket: number;
  customers: number;
  cancelRate: number;
}

export function computePeriod(
  orders: Order[],
  days: number,
  offset = 0,
  now: Date = maintenant(),
): PeriodStats {
  const fin = new Date(now);
  fin.setUTCDate(fin.getUTCDate() - offset * days);
  const debut = new Date(fin);
  debut.setUTCDate(debut.getUTCDate() - days);

  const fenetre = orders.filter((o) => {
    const at = new Date(o.createdAt);
    return at > debut && at <= fin;
  });

  const payees = fenetre.filter(encaisse);
  const revenue = payees.reduce((somme, o) => somme + o.total, 0);
  const annulees = fenetre.filter((o) => o.status === "annulee").length;

  return {
    revenue,
    orders: fenetre.length,
    averageBasket: payees.length ? Math.round(revenue / payees.length) : 0,
    customers: new Set(fenetre.map((o) => o.customerId)).size,
    cancelRate: fenetre.length ? annulees / fenetre.length : 0,
  };
}

export function deltaPercent(courant: number, precedent: number): number | null {
  if (!precedent) return null;
  return ((courant - precedent) / precedent) * 100;
}

export interface DayPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

export function buildDailySeries(
  orders: Order[],
  days: number,
  now: Date = maintenant(),
): DayPoint[] {
  const paniers = new Map<string, DayPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const cle = d.toISOString().slice(0, 10);
    paniers.set(cle, {
      date: cle,
      label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" }),
      revenue: 0,
      orders: 0,
    });
  }
  for (const order of orders) {
    const panier = paniers.get(order.createdAt.slice(0, 10));
    if (!panier) continue;
    panier.orders += 1;
    if (encaisse(order)) panier.revenue += order.total;
  }
  return [...paniers.values()];
}

export interface ProductPerformance {
  product: AdminProduct;
  units: number;
  revenue: number;
}

export function computeProductPerformance(
  products: AdminProduct[],
  orders: Order[],
): ProductPerformance[] {
  const parId = new Map<string, { units: number; revenue: number }>();
  for (const order of orders) {
    if (!encaisse(order)) continue;
    for (const ligne of order.lines) {
      const entree = parId.get(ligne.productId) ?? { units: 0, revenue: 0 };
      entree.units += ligne.quantity;
      entree.revenue += ligne.quantity * ligne.price;
      parId.set(ligne.productId, entree);
    }
  }
  return products
    .map((product) => ({ product, ...(parId.get(product.id) ?? { units: 0, revenue: 0 }) }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface CustomerStats {
  customer: Customer;
  orders: number;
  spent: number;
  lastOrder: string | null;
  segment: CustomerSegment;
}

export function computeCustomerStats(
  customers: Customer[],
  orders: Order[],
  now: Date = maintenant(),
): CustomerStats[] {
  const parCliente = new Map<string, { orders: number; spent: number; last: string | null }>();
  for (const order of orders) {
    const entree = parCliente.get(order.customerId) ?? { orders: 0, spent: 0, last: null };
    entree.orders += 1;
    if (encaisse(order)) entree.spent += order.total;
    if (!entree.last || order.createdAt > entree.last) entree.last = order.createdAt;
    parCliente.set(order.customerId, entree);
  }

  return customers
    .map((customer) => {
      const entree = parCliente.get(customer.id) ?? { orders: 0, spent: 0, last: null };
      const jours = entree.last
        ? Math.floor((now.getTime() - new Date(entree.last).getTime()) / 86_400_000)
        : Number.POSITIVE_INFINITY;

      let segment: CustomerSegment = "nouvelle";
      if (entree.spent >= 120_000) segment = "vip";
      else if (entree.orders >= 3) segment = "fidele";
      if (entree.last && jours > 90) segment = "endormie";

      return { customer, orders: entree.orders, spent: entree.spent, lastOrder: entree.last, segment };
    })
    .sort((a, b) => b.spent - a.spent);
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: "En attente",
  payee: "Payée",
  preparation: "À préparer",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
};

/** Teintes des pastilles de statut, alignées sur la maquette. */
export const STATUS_TONES: Record<OrderStatus, { bg: string; fg: string }> = {
  en_attente: { bg: "#fdf3dc", fg: "#8a6a12" },
  payee: { bg: "#eaf6ef", fg: "#2e7d52" },
  preparation: { bg: "#fdf3dc", fg: "#8a6a12" },
  expediee: { bg: "#eef3fd", fg: "#33538f" },
  livree: { bg: "#f4f1f2", fg: "#5d5157" },
  annulee: { bg: "#fbeaf1", fg: "#b3306a" },
};

export const ORDER_PIPELINE: OrderStatus[] = [
  "en_attente",
  "payee",
  "preparation",
  "expediee",
  "livree",
];

export const PAYMENT_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  carte: "Carte bancaire",
  livraison: "À la livraison",
};

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  nouvelle: "Nouvelle",
  fidele: "Fidèle",
  vip: "VIP",
  endormie: "Endormie",
};
