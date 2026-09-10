"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { initiales } from "@/lib/format";
import { useAuth } from "./auth-context";
import { useCart } from "./cart-context";
import { useOrders } from "./orders-context";
import { useFavorites } from "./favorites-context";
import { AccountNav } from "./account-nav";
import { IconBag, IconHeart, IconLogout, IconPackage, IconPin } from "./icons";

/**
 * L'en-tête de l'espace client, le même sur les quatre pages.
 *
 * Il vivait autrefois dans le seul tableau de bord : passer sur « Mes
 * commandes » faisait disparaître l'avatar, le bonjour et les compteurs, et on
 * ne savait plus trop où on était ni sous quel compte. Un espace personnel se
 * reconnaît à son en-tête — il reste, c'est la section en dessous qui change.
 */

export function AccountHeader({
  /**
   * Appelé juste avant la déconnexion.
   *
   * Le tableau de bord s'en sert pour désarmer sa garde : sans ça, le compte
   * disparaît, l'effet qui protège la page voit qu'il n'y a plus personne et
   * renvoie vers la connexion avant que le retour à l'accueil n'ait eu lieu.
   */
  avantSortie,
}: {
  avantSortie?: () => void;
}) {
  const router = useRouter();
  const { account, logout } = useAuth();
  const { count } = useCart();
  const { orders } = useOrders();
  const { count: favoris } = useFavorites();

  /* Personne d'identifié : rien à saluer. « Mes commandes » et « Mes favoris »
     s'ouvrent aussi sans compte, sur ce que garde le navigateur — elles gardent
     alors leur seul titre, comme avant. */
  if (!account) return null;

  const prenom = account.name.split(" ")[0];
  const salutation = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";

  const deconnecter = () => {
    avantSortie?.();
    logout();
    router.replace("/");
  };

  const chiffres = [
    {
      valeur: String(orders.length),
      label: orders.length > 1 ? "Commandes passées" : "Commande passée",
      href: "/commandes",
      Icone: IconPackage,
    },
    {
      valeur: String(count),
      label: count > 1 ? "Articles au panier" : "Article au panier",
      href: "/panier",
      Icone: IconBag,
    },
    {
      valeur: String(favoris),
      label: favoris > 1 ? "Favoris" : "Favori",
      href: "/favoris",
      Icone: IconHeart,
    },
    {
      valeur: String(account.addresses.length),
      label: account.addresses.length > 1 ? "Adresses enregistrées" : "Adresse enregistrée",
      href: "/compte/profil",
      Icone: IconPin,
    },
  ];

  return (
    <>
      {/* ------------------------------------------------------ en-tête sombre */}
      <section className="noise anim-fade-up relative overflow-hidden rounded-[26px] bg-ink px-6 py-8 text-white sm:px-9 md:rounded-[30px]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="aurora absolute -left-16 -top-10 h-72 w-72 rounded-full bg-rose/40 blur-[90px]" />
          <div className="aurora absolute -right-12 bottom-0 h-64 w-64 rounded-full bg-gold/25 blur-[90px] [animation-delay:-11s]" />
        </div>

        <div className="relative">
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose text-base font-extrabold sm:h-16 sm:w-16 sm:text-lg">
              {initiales(account.name)}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-[.16em] text-gold">
                Votre espace
              </span>
              <h1 className="mt-1.5 truncate text-[clamp(1.7rem,4vw,2.4rem)] font-extrabold leading-tight tracking-[-.035em]">
                {salutation} {prenom}
              </h1>
              <p className="mt-1 truncate text-[13.5px] text-white/55">{account.email}</p>
            </div>
            <button
              type="button"
              onClick={deconnecter}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-[12.5px] font-semibold text-white/75 transition-colors duration-300 hover:border-white/50 hover:bg-white/10 hover:text-white"
            >
              <IconLogout className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>

          <div className="mt-7 grid gap-px overflow-hidden rounded-2xl bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {chiffres.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="flex items-center gap-4 bg-ink/70 px-5 py-4 transition-colors duration-300 hover:bg-white/10"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                  <c.Icone className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-xl font-extrabold tabular-nums tracking-tight">
                    {c.valeur}
                  </strong>
                  <small className="text-[12px] text-white/55">{c.label}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6">
        <AccountNav />
      </div>
    </>
  );
}
