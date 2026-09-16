"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatXOF } from "@/lib/format";
import { lire, type ProduitApi } from "@/lib/api";
import type { Product } from "@/lib/products";
import { useCart } from "./cart-context";
import { FavoriteButton } from "./favorite-button";

/**
 * L'aperçu rapide.
 *
 * La vignette ne connaît que la fiche résumée : les coloris, les tailles et le
 * stock demandent un appel de plus. Il part à l'ouverture — le temps de lire le
 * titre et le prix, déjà affichés — plutôt que sur chaque carte de la grille.
 */
export function QuickView({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { add, erreur } = useCart();
  const [fiche, setFiche] = useState<ProduitApi | null>(null);
  const [nomColoris, setNomColoris] = useState("");
  const [valeurTaille, setValeurTaille] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const slug = product?.slug ?? null;

  useEffect(() => {
    if (!slug) return;
    let vivant = true;
    setFiche(null);
    // Sans cache : proposer une taille épuisée depuis une minute serait pire
    // qu'un aller-retour de plus.
    lire<ProduitApi>(`/api/catalogue/produits/${slug}/`, { revalider: 0 })
      .then((brut) => {
        if (!vivant || !brut) return;
        setFiche(brut);
        const premiere =
          brut.variantes?.find((v) => v.disponible && v.stock > 0) ?? brut.variantes?.[0];
        setNomColoris(premiere?.coloris_nom ?? brut.coloris?.[0]?.nom ?? "");
        setValeurTaille(premiere?.taille_valeur ?? brut.tailles?.[0]?.valeur ?? "");
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [slug]);

  if (!product) return null;

  const variantes = fiche?.variantes ?? [];
  const servable = (coloris: string, taille: string) =>
    variantes.find(
      (v) => v.coloris_nom === coloris && v.taille_valeur === taille && v.disponible && v.stock > 0,
    );

  const variante =
    variantes.find((v) => v.coloris_nom === nomColoris && v.taille_valeur === valeurTaille) ?? null;
  const enStock = Boolean(variante && variante.disponible && variante.stock > 0);

  /* Changer de coloris ne doit pas laisser une taille qu'il ne propose pas. */
  const choisirColoris = (nom: string) => {
    setNomColoris(nom);
    if (!servable(nom, valeurTaille)) {
      const repli = variantes.find((v) => v.coloris_nom === nom && v.disponible && v.stock > 0);
      if (repli) setValeurTaille(repli.taille_valeur);
    }
  };

  const ajouter = async () => {
    if (!fiche || !variante) return;
    setEnvoi(true);
    const resultat = await add({
      variante: variante.id,
      produit: fiche.id,
      slug: fiche.slug,
      nom: fiche.nom,
      option: `${variante.coloris_nom} · ${variante.taille_valeur}`,
      image: fiche.image,
      prix_unitaire: fiche.prix,
      stock_restant: variante.stock,
    });
    setEnvoi(false);
    // On ne referme que si l'article est bien parti : sinon le message de refus
    // disparaîtrait avec la fenêtre.
    if (resultat.ok) onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-90 flex items-end justify-center bg-ink/45 backdrop-blur-[3px] sm:items-center sm:p-10"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-fade-up grid max-h-[90vh] w-full max-w-[900px] overflow-auto rounded-t-[26px] bg-cream sm:grid-cols-2 sm:rounded-[26px]"
      >
        <div
          className="aspect-4/3 bg-stone bg-cover bg-center sm:aspect-auto sm:min-h-[420px]"
          style={{ backgroundImage: `url(${product.image})` }}
        />

        <div className="p-5 sm:p-9">
          <div className="flex items-start justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-[.1em] text-rose">Aperçu rapide</span>
            <button onClick={onClose} aria-label="Fermer" className="text-xl leading-none text-muted">
              ×
            </button>
          </div>

          <h2 className="mt-3 text-[24px] font-extrabold tracking-tight sm:mt-3.5 sm:text-[28px]">{product.name}</h2>

          <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
            <span className={`text-2xl font-extrabold ${product.compareAt ? "text-rose" : ""}`}>
              {formatXOF(product.price)}
            </span>
            {product.compareAt && (
              <>
                <span className="text-[15px] text-muted line-through">
                  {formatXOF(product.compareAt)}
                </span>
                <span className="rounded-full bg-rose-soft px-2.5 py-1 text-[11.5px] font-bold text-rose-deep">
                  −{Math.round((1 - product.price / product.compareAt) * 100)} %
                </span>
              </>
            )}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-[#6b5a61]">
            {fiche?.description ?? product.description}
          </p>

          {!fiche ? (
            <p className="mt-6 text-[13px] text-muted">Lecture des tailles disponibles…</p>
          ) : (
            <>
              {(fiche.coloris ?? []).length > 0 && (
                <>
                  <div className="mb-2.5 mt-5 text-[12.5px] font-bold">
                    Couleur <span className="font-medium text-muted">· {nomColoris}</span>
                  </div>
                  <div className="flex gap-2.5">
                    {fiche.coloris.map((c) => (
                      <button
                        key={c.nom}
                        onClick={() => choisirColoris(c.nom)}
                        aria-label={c.nom}
                        aria-pressed={nomColoris === c.nom}
                        className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                        style={{
                          background: c.hexa,
                          boxShadow: `0 0 0 1px #e5d9de, 0 0 0 ${nomColoris === c.nom ? 2 : 0}px #241a20`,
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              {(fiche.tailles ?? []).length > 0 && (
                <>
                  <div className="mb-2.5 mt-5 text-[12.5px] font-bold">Taille</div>
                  <div className="flex flex-wrap gap-2.5">
                    {fiche.tailles.map((t) => {
                      const dispo = Boolean(servable(nomColoris, t.valeur));
                      return (
                        <button
                          key={t.valeur}
                          onClick={() => setValeurTaille(t.valeur)}
                          disabled={!dispo}
                          title={dispo ? t.repere : "Épuisée dans ce coloris"}
                          aria-pressed={valeurTaille === t.valeur}
                          className={`rounded-xl border-[1.5px] px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                            valeurTaille === t.valeur
                              ? "border-ink bg-ink text-white"
                              : "border-[#e5d9de] bg-white"
                          } ${dispo ? "" : "cursor-not-allowed text-[#c3b6bb] line-through"}`}
                        >
                          {t.valeur}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {erreur && (
            <p className="mt-4 rounded-2xl bg-rose-soft px-4 py-2.5 text-[12.5px] text-rose-deep">
              {erreur}
            </p>
          )}

          <div className="mt-6 flex gap-2.5">
            <button
              onClick={ajouter}
              disabled={!enStock || envoi}
              className="flex-1 rounded-full bg-rose py-3.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-97 disabled:opacity-50"
            >
              {!fiche ? "Un instant…" : enStock ? (envoi ? "Ajout…" : "Ajouter au panier") : "Épuisé"}
            </button>
            <Link
              href={`/p/${product.slug}`}
              className="rounded-full border-[1.5px] border-[#e5d9de] px-5 py-3.5 text-[14.5px] font-bold"
            >
              Voir la fiche
            </Link>
            <FavoriteButton
              productId={product.id}
              productName={product.name}
              size="md"
              variant="contour"
              className="shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
