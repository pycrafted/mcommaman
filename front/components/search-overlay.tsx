"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatXOF } from "@/lib/format";
import { lireCatalogue } from "@/lib/catalogue";
import type { Product } from "@/lib/products";
import {
  RECHERCHES_FREQUENTES,
  surligner,
} from "@/lib/search";
import { IconArrow, IconClock, IconClose, IconSearch, IconTag } from "./icons";

const CLE_RECENTES = "mcm-recherches-recentes";
const MAX_RECENTES = 6;

/** Une ligne de résultat : une pièce, ou un rayon entier. */
type Element =
  | {
      type: "piece";
      id: string;
      href: string;
      nom: string;
      rayon: string;
      prix: number;
      image: string;
      epuise?: boolean;
    }
  | { type: "rayon"; id: string; href: string; nom: string; nombre: number };

/** Le libellé, avec les mots cherchés en gras. */
function Surligne({ texte, requete }: { texte: string; requete: string }) {
  return (
    <>
      {surligner(texte, requete).map((fragment, index) =>
        fragment.fort ? (
          <mark key={index} className="bg-rose/15 text-ink">
            {fragment.texte}
          </mark>
        ) : (
          <span key={index}>{fragment.texte}</span>
        )
      )}
    </>
  );
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [requete, setRequete] = useState("");
  const [recentes, setRecentes] = useState<string[]>([]);
  const [curseur, setCurseur] = useState(0);
  const [produits, setProduits] = useState<Product[]>([]);
  const champ = useRef<HTMLInputElement>(null);

  /* Lecture différée : le premier rendu doit rester identique serveur et client. */
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE_RECENTES);
      if (brut) setRecentes(JSON.parse(brut) as string[]);
    } catch {
      /* stockage indisponible : on s'en passe */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setRequete("");
    setCurseur(0);
    const t = window.setTimeout(() => champ.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  /**
   * La recherche est faite par le serveur.
   *
   * Il connaît les accents, les synonymes et le catalogue entier
   * (`catalogue/recherche.py`) : chercher « bebe » doit trouver « bébé », et
   * une boutique de mille fiches ne peut pas les charger toutes pour les
   * filtrer dans le navigateur.
   *
   * Un quart de seconde d'attente avant de partir : sans elle, taper « robe »
   * lancerait quatre requêtes dont trois périmées.
   */
  useEffect(() => {
    if (!open) return;
    let vivant = true;
    const attente = window.setTimeout(() => {
      void lireCatalogue(requete.trim() ? { q: requete.trim() } : {}).then((liste) => {
        if (vivant) setProduits(liste);
      });
    }, requete.trim() ? 250 : 0);
    return () => {
      vivant = false;
      window.clearTimeout(attente);
    };
  }, [open, requete]);

  /* La page derrière ne doit pas défiler pendant la recherche. */
  useEffect(() => {
    if (!open) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, [open]);

  const q = requete.toLocaleLowerCase("fr").trim();
  const rayons = useMemo(
    () =>
      [...new Set(produits.map((p) => p.category))]
        .filter((rayon) => !q || rayon.toLocaleLowerCase("fr").includes(q))
        .slice(0, 2),
    [produits, q],
  );
  /* Le serveur a déjà écarté ce qui ne correspond pas : la liste reçue est le
     résultat, on ne la refiltre pas. */
  const pieces = produits;

  const elements = useMemo<Element[]>(() => {
    const liste: Element[] = rayons.map((rayon) => ({
      type: "rayon",
      id: rayon,
      href: `/boutique?cat=${encodeURIComponent(rayon)}`,
      nom: rayon,
      nombre: produits.filter((p) => p.category === rayon).length,
    }));
    for (const product of pieces.slice(0, 6)) {
      liste.push({
        type: "piece",
        id: product.id,
        href: `/p/${product.slug}`,
        nom: product.name,
        rayon: product.category,
        prix: product.price,
        image: product.image,
        epuise: product.outOfStock,
      });
    }
    return liste;
  }, [rayons, pieces, produits]);

  useEffect(() => setCurseur(0), [requete]);

  const memoriser = (valeur: string) => {
    const propre = valeur.trim();
    if (propre.length < 2) return;
    const liste = [propre, ...recentes.filter((r) => r.toLowerCase() !== propre.toLowerCase())].slice(
      0,
      MAX_RECENTES
    );
    setRecentes(liste);
    try {
      window.localStorage.setItem(CLE_RECENTES, JSON.stringify(liste));
    } catch {
      /* ignoré */
    }
  };

  const ouvrir = (href: string) => {
    memoriser(requete);
    onClose();
    router.push(href);
  };

  const toutVoir = () => {
    memoriser(requete);
    onClose();
    router.push(`/boutique?q=${encodeURIComponent(requete.trim())}`);
  };

  const auClavier = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCurseur((c) => Math.min(c + 1, elements.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCurseur((c) => Math.max(c - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const cible = elements[curseur];
      if (cible) ouvrir(cible.href);
      else if (requete.trim()) toutVoir();
    }
  };

  if (!open) return null;

  const vide = requete.trim().length === 0;

  return (
    <div
      className="fixed inset-0 z-70 flex justify-center px-3 pt-[7dvh] sm:pt-[11dvh]"
      role="dialog"
      aria-modal="true"
      aria-label="Recherche"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la recherche"
        className="anim-veil absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[3px]"
      />

      <div className="anim-pop-in relative flex max-h-[78dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-line bg-cream shadow-[0_50px_100px_-40px_rgba(36,26,32,.55)]">
        {/* ------------------------------------------------------- le champ */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <IconSearch className="h-5 w-5 shrink-0 text-muted" />
          <input
            ref={champ}
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            onKeyDown={auClavier}
            placeholder="Une robe, un pyjama, une pointure…"
            aria-label="Que cherchez-vous ?"
            className="flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-muted/70"
          />
          {requete && (
            <button
              type="button"
              onClick={() => {
                setRequete("");
                champ.current?.focus();
              }}
              aria-label="Effacer"
              className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-stone hover:text-ink"
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* ----------------------------- champ vide : on propose des pistes */}
          {vide && (
            <div className="space-y-6 px-5 py-5">
              {recentes.length > 0 && (
                <section>
                  <div className="mb-2.5 flex items-center justify-between">
                    <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-muted">
                      <IconClock /> Vos dernières recherches
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setRecentes([]);
                        try {
                          window.localStorage.removeItem(CLE_RECENTES);
                        } catch {
                          /* ignoré */
                        }
                      }}
                      className="text-[12.5px] text-muted underline-offset-2 hover:underline"
                    >
                      Effacer
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentes.map((mot) => (
                      <button
                        key={mot}
                        type="button"
                        onClick={() => setRequete(mot)}
                        className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13.5px] transition-colors hover:border-rose/40 hover:text-rose"
                      >
                        {mot}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-muted">
                  Recherches fréquentes
                </h2>
                <div className="flex flex-wrap gap-2">
                  {RECHERCHES_FREQUENTES.map((mot) => (
                    <button
                      key={mot}
                      type="button"
                      onClick={() => setRequete(mot)}
                      className="rounded-full bg-stone px-3.5 py-1.5 text-[13.5px] font-medium transition-colors hover:bg-rose hover:text-white"
                    >
                      {mot}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ------------------------------------------------------ résultats */}
          {!vide && elements.length > 0 && (
            <div className="py-2">
              {elements.map((element, index) => {
                const actif = index === curseur;
                return (
                  <button
                    key={`${element.type}-${element.id}`}
                    type="button"
                    onMouseEnter={() => setCurseur(index)}
                    onClick={() => ouvrir(element.href)}
                    className={`flex w-full items-center gap-3.5 px-5 py-2.5 text-left transition-colors ${
                      actif ? "bg-stone/80" : ""
                    }`}
                  >
                    {element.type === "piece" ? (
                      <>
                        <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-stone">
                          <Image src={element.image} alt="" fill sizes="44px" className="object-cover" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">
                            <Surligne texte={element.nom} requete={requete} />
                          </span>
                          <span className="mt-0.5 block text-[12.5px] text-muted">
                            {element.rayon}
                            {element.epuise ? " · épuisé" : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[14px] font-extrabold tabular-nums">
                          {formatXOF(element.prix)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-rose/10 text-rose">
                          <IconTag className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">
                            Rayon <Surligne texte={element.nom} requete={requete} />
                          </span>
                          <span className="mt-0.5 block text-[12.5px] text-muted">
                            {element.nombre} pièce{element.nombre > 1 ? "s" : ""}
                          </span>
                        </span>
                        <IconArrow className="h-4 w-4 shrink-0 text-muted" />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* --------------------------------------------------- rien trouvé */}
          {!vide && elements.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-[17px] font-extrabold tracking-tight">Rien pour « {requete.trim()} »</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
                Essayez un mot plus court — le nom d&apos;une pièce, un rayon ou un âge.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {RECHERCHES_FREQUENTES.slice(0, 4).map((mot) => (
                  <button
                    key={mot}
                    type="button"
                    onClick={() => setRequete(mot)}
                    className="rounded-full bg-stone px-3.5 py-1.5 text-[13.5px] font-medium transition-colors hover:bg-rose hover:text-white"
                  >
                    {mot}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- le pied */}
        <div className="flex items-center justify-between gap-3 border-t border-line bg-mist px-5 py-3">
          <button
            type="button"
            onClick={toutVoir}
            disabled={vide || pieces.length === 0}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-rose disabled:opacity-30"
          >
            {pieces.length > 0 ? `Voir les ${pieces.length} résultats` : "Voir la boutique"}
            <IconArrow className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
