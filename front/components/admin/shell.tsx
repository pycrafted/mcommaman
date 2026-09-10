"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { formatXOF } from "@/lib/format";
import { useAdmin } from "@/lib/admin/store";
import { envoyer } from "@/lib/api";
import {
  IconBell,
  IconBox,
  IconChevronRight,
  IconCart,
  IconGear,
  IconGrid,
  IconLogout,
  IconMenuAdmin,
  IconPercent,
  IconSearchAdmin,
  IconSliders,
  IconStore,
  IconUserAdmin,
  IconTagAdmin,
  IconUsers,
  IconX,
} from "./icons";

/** La session d'administration : une clé, rien de plus. Voir la note en bas. */
export const NAV = [
  { href: "/admin", label: "Tableau de bord", Icone: IconGrid },
  { href: "/admin/produits", label: "Produits", Icone: IconBox },
  { href: "/admin/categories", label: "Catégories", Icone: IconTagAdmin },
  { href: "/admin/promotions", label: "Promotions", Icone: IconPercent },
  { href: "/admin/commandes", label: "Commandes", Icone: IconCart },
  { href: "/admin/clients", label: "Utilisateurs", Icone: IconUsers },
  { href: "/admin/configuration", label: "Configuration", Icone: IconSliders },
  { href: "/admin/reglages", label: "Réglages", Icone: IconGear },
];

/* ------------------------------------------------------------------ */
/* Palette de commandes                                                */
/* ------------------------------------------------------------------ */

/**
 * Ctrl/⌘ + K : aller n'importe où sans lâcher le clavier.
 *
 * Sans saisie, elle liste les pages ; dès qu'on tape, elle cherche aussi dans
 * les fiches, les commandes et les clientes. Entrée ouvre le premier résultat.
 */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { products, orders, customers } = useAdmin();
  const [q, setQ] = useState("");

  const resultats = useMemo(() => {
    const terme = q.trim().toLowerCase();
    const pages = NAV.filter((n) => !terme || n.label.toLowerCase().includes(terme)).map((n) => ({
      key: `page-${n.href}`,
      group: "Navigation",
      label: n.label,
      hint: n.href,
      href: n.href,
    }));
    if (!terme) return pages;

    const fiches = products
      .filter((p) => p.name.toLowerCase().includes(terme) || p.sku.toLowerCase().includes(terme))
      .slice(0, 5)
      .map((p) => ({
        key: `p-${p.id}`,
        group: "Produits",
        label: p.name,
        hint: p.sku,
        href: `/admin/produits/${p.id}`,
      }));

    const commandes = orders
      .filter((o) => o.ref.toLowerCase().includes(terme))
      .slice(0, 4)
      .map((o) => ({
        key: `o-${o.id}`,
        group: "Commandes",
        label: o.ref,
        hint: formatXOF(o.total),
        href: `/admin/commandes#${o.ref}`,
      }));

    const clientes = customers
      .filter((c) => c.name.toLowerCase().includes(terme) || c.email.toLowerCase().includes(terme))
      .slice(0, 4)
      .map((c) => ({
        key: `c-${c.id}`,
        group: "Clients",
        label: c.name,
        hint: c.email,
        href: `/admin/clients?q=${encodeURIComponent(c.name)}`,
      }));

    return [...pages, ...fiches, ...commandes, ...clientes];
  }, [q, products, orders, customers]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center p-4 pt-[12vh]">
      <div onClick={onClose} aria-hidden className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]" />
      <div className="anim-fade-up relative w-full max-w-[36rem] overflow-hidden rounded-[22px] border border-line bg-white">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <IconSearchAdmin className="h-4 w-4 shrink-0 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && resultats[0]) {
                router.push(resultats[0].href);
                onClose();
              }
            }}
            placeholder="Produit, commande, cliente, page…"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[#b3a5aa]"
          />
          <kbd className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted">
            esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {resultats.length === 0 && (
            <p className="px-5 py-6 text-center text-[13px] text-muted">Aucun résultat.</p>
          )}
          {resultats.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                router.push(r.href);
                onClose();
              }}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-[13.5px] transition-colors hover:bg-mist"
            >
              {/* Le nom du groupe ne se répète pas d'une ligne à l'autre. */}
              <span className="w-20 shrink-0 text-[10px] uppercase tracking-[.14em] text-muted">
                {i === 0 || resultats[i - 1].group !== r.group ? r.group : ""}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="hidden truncate text-[12px] text-muted sm:block">{r.hint}</span>
              <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Le portier.
 *
 * Elle demande au serveur qui est connecté et n'ouvre que pour l'équipe.
 * Tant que la réponse n'est pas là on n'affiche rien : montrer le back-office
 * puis le retirer serait pire que d'attendre un instant.
 *
 * Ce n'est plus décoratif. Chaque route de `/api/gestion/` revérifie de son
 * côté : cacher un bouton ne protège rien, c'est le serveur qui refuse.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [etat, setEtat] = useState<"lecture" | "ouvert" | "ferme">("lecture");

  useEffect(() => {
    let vivant = true;

    envoyer<{ utilisateur: { est_equipe: boolean } | null }>("/api/compte/moi/")
      .then((reponse) => {
        if (!vivant) return;
        if (reponse.utilisateur?.est_equipe) {
          setEtat("ouvert");
        } else {
          setEtat("ferme");
          router.replace("/admin/connexion");
        }
      })
      .catch(() => {
        if (!vivant) return;
        setEtat("ferme");
        router.replace("/admin/connexion");
      });

    return () => {
      vivant = false;
    };
  }, [router]);

  if (etat !== "ouvert") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#faf8f9]">
        <p className="text-[13px] text-muted">
          {etat === "lecture" ? "Ouverture du back-office…" : "Redirection vers la connexion…"}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

export function AdminShell({ children }: { children: ReactNode }) {
  const chemin = usePathname();
  const router = useRouter();
  const { settings, orders, products, hydrated, notification, dismissNotification } = useAdmin();
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);

  /* Ctrl/⌘ + K depuis n'importe où dans le back-office. */
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  /* Le menu au doigt se referme au changement de page : sinon il recouvre la
     page qu'on vient d'ouvrir. */
  useEffect(() => setMenu(false), [chemin]);

  const aPreparer = orders.filter(
    (o) => o.status === "en_attente" || o.status === "payee"
  ).length;
  const ruptures = products.filter((p) => p.status === "publie" && p.stock <= 0).length;

  const deconnecter = () => {
    // On ferme la session côté serveur : retirer une clé locale ne fermait rien.
    envoyer("/api/compte/deconnexion/", "POST").catch(() => undefined);
    router.replace("/admin/connexion");
  };

  const actif = (href: string) =>
    href === "/admin" ? chemin === "/admin" : chemin.startsWith(href);

  const liens = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={actif(n.href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors duration-300 ${
            actif(n.href)
              ? "bg-white/12 font-bold text-white"
              : "font-medium text-white/60 hover:text-white"
          }`}
        >
          <n.Icone className="h-[18px] w-[18px] shrink-0" />
          <span className="min-w-0 flex-1 truncate">{n.label}</span>
          {n.href === "/admin/commandes" && aPreparer > 0 && (
            <span className="rounded-full bg-rose px-1.5 text-[10.5px] font-bold tabular-nums text-white">
              {aPreparer}
            </span>
          )}
          {n.href === "/admin/produits" && ruptures > 0 && (
            <span className="rounded-full bg-gold px-1.5 text-[10.5px] font-bold tabular-nums text-ink">
              {ruptures}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );

  const pied = (
    <div className="mt-6 border-t border-white/10 pt-4">
      <Link
        href="/admin/compte"
        aria-current={chemin === "/admin/compte" ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-300 ${
          chemin === "/admin/compte"
            ? "bg-white/12 font-bold text-white"
            : "font-medium text-white/60 hover:text-white"
        }`}
      >
        <IconUserAdmin className="h-[18px] w-[18px] shrink-0" />
        Mon compte
      </Link>
      <Link
        href="/"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/60 transition-colors duration-300 hover:text-white"
      >
        <IconStore className="h-[18px] w-[18px] shrink-0" />
        Voir la boutique
      </Link>
      <button
        type="button"
        onClick={deconnecter}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/60 transition-colors duration-300 hover:text-white"
      >
        <IconLogout className="h-[18px] w-[18px] shrink-0" />
        Se déconnecter
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink lg:grid lg:grid-cols-[240px_1fr]">
      <CommandPalette open={palette} onClose={() => setPalette(false)} />

      {/* ------------------------------------------------ colonne, en grand */}
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto bg-ink px-4 pb-6 pt-4 text-white lg:flex">
        <div className="px-3">
          <div className="text-[15px] font-extrabold tracking-tight">Back-office</div>
          <div className="pb-5 pt-1 text-[11.5px] text-white/45">
            {hydrated ? settings.storeName.toLowerCase() : "m comme maman"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="mb-3 flex items-center gap-2.5 rounded-xl border border-white/15 px-3 py-2.5 text-[12.5px] text-white/55 transition-colors duration-300 hover:border-white/35 hover:text-white"
        >
          <IconSearchAdmin className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Rechercher</span>
          <kbd className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>
        {liens}
        <div className="mt-auto">{pied}</div>
      </aside>

      {/* ------------------------------------------------ barre, au doigt */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between bg-ink px-4 py-3.5 text-white">
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold tracking-tight">Back-office</div>
            <div className="truncate text-[11px] text-white/45">
              {NAV.find((n) => actif(n.href))?.label ?? "Administration"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-expanded={menu}
            aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"
          >
            {menu ? <IconX /> : <IconMenuAdmin />}
          </button>
        </div>

        <div
          className={`overflow-hidden bg-ink px-4 text-white transition-[max-height] duration-400 ease-soft ${
            menu ? "max-h-[36rem] pb-4" : "max-h-0"
          }`}
        >
          {liens}
          {pied}
        </div>
      </div>

      {/* ------------------------------------------------------------ page */}
      <div className="flex min-h-screen min-w-0 flex-col">
        {/* La barre haute appartient au cadre sombre, pas à la page : elle
            prolonge la colonne au lieu de la couper. */}
        <header className="hidden items-center justify-between gap-4 px-8 py-4 text-white lg:flex">
          <p className="text-[12.5px] text-white/50">
            {hydrated ? (
              <>
                {orders.length} commande{orders.length > 1 ? "s" : ""} ·{" "}
                {products.filter((p) => p.status === "publie").length} produits publiés
              </>
            ) : (
              "Lecture du back-office…"
            )}
          </p>
          <div className="flex items-center gap-2.5">
            {aPreparer > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose px-3 py-1.5 text-[12px] font-bold text-white">
                <IconBell className="h-3.5 w-3.5" />
                {aPreparer} à préparer
              </span>
            )}
            <span className="grid h-8 w-8 place-items-center rounded-full bg-rose text-[11px] font-extrabold text-white">
              MM
            </span>
          </div>
        </header>

        {/* La feuille de travail, posée dans le cadre. Le coin arrondi en haut
            à gauche est tout l'effet : il détache la page de la colonne au lieu
            de les faire se toucher à angle droit. */}
        <div className="flex-1 rounded-t-[22px] bg-[#faf8f9] lg:rounded-tr-none lg:rounded-tl-[26px]">
          {notification && (
            <div className="fixed right-4 top-4 z-100 w-[min(24rem,calc(100vw-2rem))] anim-slide-in sm:right-6 sm:top-6">
              <div
                role={notification.type === "error" ? "alert" : "status"}
                className={`flex items-start gap-3 rounded-xl border bg-white px-4 py-3.5 shadow-[0_14px_40px_rgba(38,25,31,.18)] ${
                  notification.type === "error"
                    ? "border-rose/35 text-rose-deep"
                    : notification.type === "warning"
                      ? "border-[#e8cf8d] text-[#765b13]"
                      : "border-[#b9dfc8] text-[#256b46]"
                }`}
              >
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-relaxed">
                  {notification.message}
                </span>
                <button
                  type="button"
                  onClick={dismissNotification}
                  aria-label="Fermer la notification"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-current transition-colors hover:bg-black/5"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <main className="px-4 pb-16 pt-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

/**
 * Note — ce portier ne fait qu'éviter d'afficher une page inutile.
 *
 * Il demande au serveur qui est connecté et regarde le rôle. Ce n'est pas lui
 * qui protège quoi que ce soit : chaque route de `/api/gestion/` revérifie le
 * rôle de son côté, sur une session en cookie signé que le JavaScript ne peut
 * pas lire. Contourner ce composant ne donne accès à rien.
 */
