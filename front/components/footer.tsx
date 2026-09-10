import Link from "next/link";
import { waLink } from "@/lib/format";
import { lireRayonsNavigables } from "@/lib/catalogue";
import { lireReglages } from "@/lib/reglages";

/* Les colonnes d'aide et de mentions légales ne bougent pas ; celle de la
   boutique se compose au rendu, autour des rayons du back-office. */
const COLUMNS = [
  {
    title: "Aide",
    links: [
      { href: "/infos/livraison", label: "Livraison" },
      { href: "/infos/retours", label: "Retours" },
      { href: "/infos/faq", label: "Questions fréquentes" },
      { href: "/contact", label: "Nous contacter" },
      { href: "/compte", label: "Mon compte" },
      { href: "/commandes", label: "Suivre ma commande" },
      { href: "/avis", label: "Avis des clientes" },
      { href: "/favoris", label: "Mes favoris" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/infos/cgv", label: "CGV" },
      { href: "/infos/mentions-legales", label: "Mentions légales" },
      { href: "/infos/confidentialite", label: "Confidentialité" },
    ],
  },
];

/** Combien de rayons le pied de page nomme avant de renvoyer au catalogue. */
const RAYONS_CITES = 3;

export async function Footer() {
  /* Trois rayons, pas la liste entière : le pied de page est un raccourci, pas
     un second menu. Les mêmes catégories que le menu du haut, dans le même
     ordre — celui donné dans le back-office. */
  const [rayons, reglages] = await Promise.all([
    lireRayonsNavigables("enfant").then((liste) => liste.slice(0, RAYONS_CITES)),
    lireReglages(),
  ]);
  const boutique = {
    title: "Boutique",
    links: [
      { href: "/boutique", label: "Catalogue" },
      ...rayons.map((r) => ({
        href: `/boutique?cat=${encodeURIComponent(r.nom)}`,
        label: r.nom,
      })),
      { href: "/coin-maman", label: "Coin Maman" },
    ],
  };

  return (
    <footer className="mt-20 bg-ink text-white">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-x-6 gap-y-10 px-5 pb-6 pt-14 md:px-8 lg:grid-cols-[1.5fr_repeat(3,1fr)] lg:gap-10 lg:px-10">
        <div className="col-span-2 lg:col-span-1">
          {/* Nom, téléphone et courriel viennent des réglages : ce sont des
              coordonnées, elles changent sans passer par une livraison. */}
          <div className="text-[22px] font-extrabold tracking-tight">{reglages.nom_boutique}</div>
          <div className="mt-3.5 text-[13.5px] leading-7 text-white/60">
            {reglages.telephone}
            <br />
            {reglages.email_contact}
            <br />
            Dakar, Sénégal
          </div>
          <a
            href={waLink("Bonjour, j'ai une question", reglages.telephone)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-full bg-rose px-5 py-2.5 text-[13px] font-bold transition-transform hover:-translate-y-0.5"
          >
            Écrire sur WhatsApp
          </a>
        </div>

        {[boutique, ...COLUMNS].map((c) => (
          <div key={c.title}>
            <div className="mb-3.5 text-xs font-bold uppercase tracking-[.1em] text-gold">{c.title}</div>
            <div className="flex flex-col gap-2.5 text-[13.5px] text-white/70">
              {c.links.map((l) => (
                <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-1.5 border-t border-white/10 px-5 pb-8 pt-5 text-xs text-white/50 sm:flex-row sm:justify-between md:px-8 lg:px-10">
        <span>© 2026 {reglages.nom_boutique} — Dakar</span>
        <span>Prix en francs CFA, taxes incluses</span>
      </div>
    </footer>
  );
}
