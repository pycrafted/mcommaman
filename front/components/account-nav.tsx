"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconGrid, IconUser } from "./icons";

/* Les deux pages de l'espace client (« Mes commandes » reviendra avec le
   paiement en ligne), dans l'ordre où on les ouvre. */
const LIENS = [
  { href: "/compte", label: "Tableau de bord", Icone: IconGrid },
  { href: "/compte/profil", label: "Mon profil", Icone: IconUser },
];

export function AccountNav() {
  const chemin = usePathname();

  return (
    <nav aria-label="Espace client" className="mb-7 flex gap-2 overflow-x-auto">
      {LIENS.map((l) => {
        const actif = chemin === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={actif ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors duration-300 ${
              actif ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"
            }`}
          >
            <l.Icone className="h-4 w-4" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
