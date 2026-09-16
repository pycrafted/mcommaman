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

import { ErreurApi, envoyer } from "@/lib/api";

/**
 * Le compte cliente, tenu par le serveur.
 *
 * Le mot de passe ne transite qu'une fois, à l'aller : il est haché en Argon2
 * côté serveur et ne revient jamais. La session vit dans un cookie que le
 * JavaScript ne peut pas lire — c'est précisément ce qui le protège.
 *
 * Ce fichier gardait autrefois les comptes dans le navigateur, empreintes
 * comprises. Ce n'était pas une sécurité, le commentaire d'alors le disait.
 */

export type ZoneKey = "dakar" | "thies" | "regions";

export interface SavedAddress {
  id: string;
  /** Nom donné par la cliente : « Maison », « Bureau »… */
  label: string;
  zone: ZoneKey;
  city: string;
  address: string;
  notes: string;
  isDefault: boolean;
}

export interface AccountPreferences {
  /** Tailles suivies, pour repérer les nouveautés à la bonne taille. */
  sizes: string[];
}

export const defaultPreferences: AccountPreferences = { sizes: [] };

export interface Account {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
  addresses: SavedAddress[];
  preferences: AccountPreferences;
  /** Vrai pour la gérante et l'équipe : ouvre la porte du back-office. */
  equipe: boolean;
}

export type PublicAccount = Account;

export interface AuthResult {
  ok: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ passage */

type AdresseApi = {
  id: number;
  libelle: string;
  zone: ZoneKey;
  ville: string;
  adresse: string;
  notes: string;
  par_defaut: boolean;
};

type UtilisateurApi = {
  id: number;
  email: string;
  nom: string;
  telephone: string;
  ville: string;
  est_equipe: boolean;
  tailles_suivies: string[];
  date_creation: string;
  adresses: AdresseApi[];
};

const versAdresse = (brut: AdresseApi): SavedAddress => ({
  id: String(brut.id),
  label: brut.libelle,
  zone: brut.zone,
  city: brut.ville,
  address: brut.adresse,
  notes: brut.notes,
  isDefault: brut.par_defaut,
});

const versCompte = (brut: UtilisateurApi): Account => ({
  id: String(brut.id),
  name: brut.nom,
  email: brut.email,
  phone: brut.telephone,
  city: brut.ville,
  createdAt: brut.date_creation,
  addresses: (brut.adresses ?? []).map(versAdresse),
  preferences: { sizes: brut.tailles_suivies ?? [] },
  equipe: brut.est_equipe,
});

/** Le message du serveur, ou un repli lisible quand il ne répond pas. */
function raison(erreur: unknown): string {
  if (erreur instanceof ErreurApi) return erreur.message;
  return "Impossible de joindre la boutique pour le moment. Vérifiez votre connexion internet.";
}

/* ------------------------------------------------------------------ contexte */

type Ctx = {
  account: PublicAccount | null;
  register: (input: {
    name: string;
    email: string;
    phone: string;
    city: string;
    password: string;
  }) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  /** La même chose par la porte du back-office : refusée avant d'ouvrir une
      session si le compte n'est pas de l'équipe. */
  loginEquipe: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<Account, "name" | "phone" | "city">>) => void;
  updatePreferences: (patch: Partial<AccountPreferences>) => void;
  addAddress: (address: Omit<SavedAddress, "id" | "isDefault">) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  changePassword: (current: string, next: string) => Promise<AuthResult>;
  deleteAccount: () => void;
  /** L'adresse proposée par défaut à la commande, s'il y en a une. */
  defaultAddress: SavedAddress | null;
  hydrated: boolean;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [hydrated, setHydrated] = useState(false);

  /**
   * Qui est connecté.
   *
   * Appelé au montage : le serveur répond par `null` sans lever d'erreur quand
   * personne ne l'est — la vitrine interroge cette route à chaque visite.
   */
  const relire = useCallback(async () => {
    try {
      const reponse = await envoyer<{ utilisateur: UtilisateurApi | null }>("/api/compte/moi/");
      setAccount(reponse.utilisateur ? versCompte(reponse.utilisateur) : null);
    } catch {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    relire().finally(() => setHydrated(true));
  }, [relire]);

  const register = useCallback<Ctx["register"]>(async (input) => {
    try {
      const brut = await envoyer<UtilisateurApi>("/api/compte/inscription/", "POST", {
        nom: input.name,
        email: input.email,
        telephone: input.phone,
        ville: input.city,
        mot_de_passe: input.password,
      });
      setAccount(versCompte(brut));
      return { ok: true };
    } catch (erreur) {
      return { ok: false, error: raison(erreur) };
    }
  }, []);

  const login = useCallback<Ctx["login"]>(async (email, password) => {
    try {
      const brut = await envoyer<UtilisateurApi>("/api/compte/connexion/", "POST", {
        email,
        mot_de_passe: password,
      });
      setAccount(versCompte(brut));
      return { ok: true };
    } catch (erreur) {
      return { ok: false, error: raison(erreur) };
    }
  }, []);

  /**
   * Entrer dans le back-office.
   *
   * Passe par `/api/gestion/connexion/` et non par la route des clientes : le
   * serveur y vérifie le rôle avant `login()`, un refus ne laisse aucune
   * session derrière lui. Et le compte arrive dans ce contexte comme n'importe
   * quelle connexion — la vitrine et l'admin ne se contredisent plus sur qui
   * est là.
   */
  const loginEquipe = useCallback<Ctx["loginEquipe"]>(async (email, password) => {
    try {
      const brut = await envoyer<UtilisateurApi>("/api/gestion/connexion/", "POST", {
        email,
        mot_de_passe: password,
      });
      setAccount(versCompte(brut));
      return { ok: true };
    } catch (erreur) {
      return { ok: false, error: raison(erreur) };
    }
  }, []);

  const logout = useCallback(() => {
    setAccount(null);
    // On oublie la session localement sans attendre : la fermer côté serveur
    // peut prendre un aller-retour, l'interface ne doit pas patienter.
    envoyer("/api/compte/deconnexion/", "POST").catch(() => undefined);
  }, []);

  /**
   * Les modifications de profil sont optimistes : l'écran change tout de suite,
   * le serveur suit. En cas d'échec, on relit — l'état affiché redevient celui
   * qui fait foi plutôt que de rester faux en silence.
   */
  const appliquer = useCallback(
    async (corps: Record<string, unknown>, optimiste: (courant: Account) => Account) => {
      setAccount((courant) => (courant ? optimiste(courant) : courant));
      try {
        const brut = await envoyer<UtilisateurApi>("/api/compte/moi/", "PATCH", corps);
        setAccount(versCompte(brut));
      } catch {
        relire();
      }
    },
    [relire],
  );

  const updateProfile = useCallback<Ctx["updateProfile"]>(
    (patch) => {
      appliquer(
        {
          ...(patch.name !== undefined ? { nom: patch.name } : {}),
          ...(patch.phone !== undefined ? { telephone: patch.phone } : {}),
          ...(patch.city !== undefined ? { ville: patch.city } : {}),
        },
        (courant) => ({ ...courant, ...patch }),
      );
    },
    [appliquer],
  );

  const updatePreferences = useCallback<Ctx["updatePreferences"]>(
    (patch) => {
      appliquer(
        {
          ...(patch.sizes !== undefined ? { tailles_suivies: patch.sizes } : {}),
        },
        (courant) => ({ ...courant, preferences: { ...courant.preferences, ...patch } }),
      );
    },
    [appliquer],
  );

  const addAddress = useCallback<Ctx["addAddress"]>(
    (adresse) => {
      envoyer("/api/compte/adresses/", "POST", {
        libelle: adresse.label,
        zone: adresse.zone,
        ville: adresse.city,
        adresse: adresse.address,
        notes: adresse.notes,
      })
        .then(relire)
        .catch(() => undefined);
    },
    [relire],
  );

  const removeAddress = useCallback<Ctx["removeAddress"]>(
    (id) => {
      setAccount((courant) =>
        courant
          ? { ...courant, addresses: courant.addresses.filter((a) => a.id !== id) }
          : courant,
      );
      envoyer(`/api/compte/adresses/${id}/`, "DELETE").catch(relire);
    },
    [relire],
  );

  const setDefaultAddress = useCallback<Ctx["setDefaultAddress"]>(
    (id) => {
      envoyer(`/api/compte/adresses/${id}/`, "PATCH", { par_defaut: true })
        .then(relire)
        .catch(() => undefined);
    },
    [relire],
  );

  const changePassword = useCallback<Ctx["changePassword"]>(async (current, next) => {
    try {
      await envoyer("/api/compte/mot-de-passe/", "POST", { actuel: current, nouveau: next });
      return { ok: true };
    } catch (erreur) {
      return { ok: false, error: raison(erreur) };
    }
  }, []);

  const deleteAccount = useCallback(() => {
    // La suppression définitive d'un compte n'est pas ouverte à l'API : elle
    // emporterait l'historique des commandes. On ferme la session, et la
    // demande se traite à la main.
    logout();
  }, [logout]);

  const defaultAddress = useMemo(
    () => account?.addresses.find((a) => a.isDefault) ?? account?.addresses[0] ?? null,
    [account],
  );

  const valeur = useMemo<Ctx>(
    () => ({
      account,
      register,
      login,
      loginEquipe,
      logout,
      updateProfile,
      updatePreferences,
      addAddress,
      removeAddress,
      setDefaultAddress,
      changePassword,
      deleteAccount,
      defaultAddress,
      hydrated,
    }),
    [
      account, register, login, loginEquipe, logout, updateProfile, updatePreferences,
      addAddress, removeAddress, setDefaultAddress, changePassword,
      deleteAccount, defaultAddress, hydrated,
    ],
  );

  return <AuthCtx.Provider value={valeur}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>");
  return ctx;
}
