"use client";

import { useState } from "react";
import Link from "next/link";
import { formatXOF, jusquAu, waLink } from "@/lib/format";
import type { ProduitApi } from "@/lib/api";
import type { Product } from "@/lib/products";
import { ProductCard } from "./product-card";
import { useCart } from "./cart-context";
import { useAvis } from "./reviews-context";
import { FavoriteButton } from "./favorite-button";
import { ReviewForm, ReviewList, StarRow } from "./review-form";
import { useReglages } from "./reglages-context";

/**
 * La fiche produit.
 *
 * Les coloris, les tailles et le stock viennent du serveur, pas des tableaux de
 * référence : ce qu'on ajoute au panier est une **variante** précise, celle que
 * la commande achètera. Une taille absente du coloris choisi ne se propose pas.
 */
export function ProductDetail({
  product,
  fiche,
  similaires,
}: {
  product: Product;
  fiche: ProduitApi;
  similaires: Product[];
}) {
  const { add, erreur } = useCart();
  const reglages = useReglages();
  /* Les avis de cette fiche, demandés au serveur au montage. Ni la note ni le
     nombre ne sont écrits dans la page : tant que personne n'a écrit, l'article
     l'annonce plutôt que d'inventer une moyenne. */
  const { avis, resume: note, pret: avisPrets } = useAvis({
    kind: "product",
    productId: product.id,
  });

  const coloris = fiche.coloris ?? [];
  const tailles = fiche.tailles ?? [];
  const variantes = fiche.variantes ?? [];

  /** La variante servable pour un couple coloris × taille, s'il en existe une. */
  const servable = (nomColoris: string, valeurTaille: string) =>
    variantes.find(
      (v) =>
        v.coloris_nom === nomColoris &&
        v.taille_valeur === valeurTaille &&
        v.disponible &&
        v.stock > 0,
    );

  const premiere = variantes.find((v) => v.disponible && v.stock > 0) ?? variantes[0];
  const [nomColoris, setNomColoris] = useState(premiere?.coloris_nom ?? coloris[0]?.nom ?? "");
  const [valeurTaille, setValeurTaille] = useState(
    premiere?.taille_valeur ?? tailles[0]?.valeur ?? "",
  );
  const [openBlock, setOpenBlock] = useState(0);
  const [envoi, setEnvoi] = useState(false);

  const variante =
    variantes.find(
      (v) => v.coloris_nom === nomColoris && v.taille_valeur === valeurTaille,
    ) ?? null;
  const enStock = Boolean(variante && variante.disponible && variante.stock > 0);

  /* Changer de coloris ne doit pas laisser une taille qu'il ne propose pas :
     on glisse sur la première servable plutôt que d'afficher un bouton mort. */
  const choisirColoris = (nom: string) => {
    setNomColoris(nom);
    if (!servable(nom, valeurTaille)) {
      const repli = variantes.find((v) => v.coloris_nom === nom && v.disponible && v.stock > 0);
      if (repli) setValeurTaille(repli.taille_valeur);
    }
  };

  const ajouter = async () => {
    if (!variante) return;
    setEnvoi(true);
    await add({
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
  };

  const blocks = [
    { t: "Description", c: product.description },
    {
      t: "Composition",
      c: fiche.matiere,
    },
    {
      t: "Livraison et retours",
      c: "Dakar et banlieue : 24 h, 2 000 F, offerte dès 25 000 F.\nRégions : 2 à 4 jours, 3 500 F.\nÉchange ou remboursement sous 7 jours.",
    },
  ];

  /* Les vraies photos quand la fiche en porte plusieurs ; sinon les repères de
     la maquette, en attendant la séance photo. */
  const photos = fiche.photos?.length ? fiche.photos : [product.image];
  const gallery =
    photos.length > 1
      ? photos.slice(0, 4).map((image) => ({ image, label: "" }))
      : [
          { image: product.image, label: "" },
          { image: null, label: "vue dos" },
          { image: null, label: "détail tissu" },
          { image: null, label: "porté" },
        ];

  const [principale, setPrincipale] = useState(0);

  const discount = product.compareAt
    ? `−${Math.round((1 - product.price / product.compareAt) * 100)} %`
    : null;


  return (
    <div className="mx-auto max-w-[1400px] px-10 pb-20 pt-7">
      <div className="text-[12.5px] text-muted">
        <Link href="/">Accueil</Link> · <Link href="/boutique">{product.category}</Link> · {product.name}
      </div>

      <div className="grid grid-cols-[1.05fr_.95fr] gap-14 pt-5">
        <div>
          <div
            className="aspect-4/5 rounded-3xl bg-stone bg-cover bg-center"
            style={{ backgroundImage: `url(${gallery[principale]?.image ?? product.image})` }}
          />
          <div className="mt-3 grid grid-cols-4 gap-3">
            {gallery.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => g.image && setPrincipale(i)}
                aria-label={g.image ? `Voir la photo ${i + 1}` : g.label}
                className="flex aspect-square items-end rounded-2xl bg-stone bg-cover bg-center p-2.5"
                style={{
                  backgroundImage: g.image ? `url(${g.image})` : undefined,
                  boxShadow: i === principale ? "0 0 0 2px #241a20" : undefined,
                }}
              >
                <span className="text-[10px] font-semibold leading-tight text-[#a2939a]">{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[.1em] text-rose">{product.category}</span>
            {variante && <span className="text-xs text-[#9c8d93]">réf. {variante.sku}</span>}
          </div>

          <h1 className="mt-3.5 text-[40px] font-extrabold leading-[1.08] tracking-[-.03em]">
            {product.name}
          </h1>

          <div className="mt-3 flex items-center gap-2.5">
            {note.count > 0 ? (
              <>
                <StarRow rating={note.average} />
                <a href="#avis" className="text-[13px] text-muted transition-colors hover:text-rose">
                  {String(note.average).replace(".", ",")} · {note.count} avis
                </a>
              </>
            ) : (
              <a href="#avis" className="text-[13px] text-muted transition-colors hover:text-rose">
                Aucun avis pour le moment
              </a>
            )}
          </div>

          {/* En promotion, le prix du jour passe en rose et l'ancien s'efface.
              Deux prix de même poids se lisent mal, et c'est le nouveau qu'on
              veut voir en premier. */}
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span
              className={`text-[30px] font-extrabold tracking-[-.03em] ${
                product.compareAt ? "text-rose" : ""
              }`}
            >
              {formatXOF(product.price)}
            </span>
            {product.compareAt && (
              <span className="text-base text-[#9c8d93] line-through">{formatXOF(product.compareAt)}</span>
            )}
            {discount && (
              <span className="rounded-full bg-rose-soft px-2.5 py-1 text-xs font-bold text-rose-deep">
                {discount}
              </span>
            )}
          </div>

          {/* La campagne se nomme : « −15 % » ne dit pas pourquoi, ni jusqu'à
              quand. Une remise sans échéance n'en presse aucune. */}
          {product.promotion && (
            <p className="mt-2.5 inline-flex flex-wrap items-baseline gap-x-2 rounded-2xl bg-rose-soft px-4 py-2.5 text-[13px] leading-relaxed text-rose-deep">
              <strong className="font-bold">{product.promotion.libelle}</strong>
              <span>
                vous économisez {formatXOF(product.promotion.economie)}, jusqu&apos;au{" "}
                {jusquAu(product.promotion.jusquau)}
              </span>
            </p>
          )}

          <p className="mt-1.5 text-[12.5px] text-muted">
            Taxes incluses. Livraison calculée à l&apos;étape suivante.
          </p>

          {coloris.length > 0 && (
            <div className="mt-7">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[13px] font-bold">Couleur</span>
                <span className="text-[13px] text-muted">{nomColoris}</span>
              </div>
              <div className="flex gap-2.5">
                {coloris.map((c) => (
                  <button
                    key={c.nom}
                    onClick={() => choisirColoris(c.nom)}
                    aria-label={c.nom}
                    aria-pressed={nomColoris === c.nom}
                    className="h-9 w-9 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c.hexa,
                      boxShadow: `0 0 0 1px #e5d9de, 0 0 0 ${nomColoris === c.nom ? 2 : 0}px #241a20`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {tailles.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[13px] font-bold">Taille</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {tailles.map((t) => {
                  const dispo = Boolean(servable(nomColoris, t.valeur));
                  return (
                    <button
                      key={t.valeur}
                      onClick={() => setValeurTaille(t.valeur)}
                      disabled={!dispo}
                      title={dispo ? t.repere : "Épuisée dans ce coloris"}
                      aria-pressed={valeurTaille === t.valeur}
                      className={`rounded-xl border-[1.5px] px-4.5 py-2.5 text-[13.5px] font-semibold transition-colors ${
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
            </div>
          )}

          <div
            className={`mt-5.5 flex items-center gap-2.5 text-[13.5px] font-semibold ${
              enStock ? "text-[#2e7d52]" : "text-muted"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${enStock ? "bg-[#2e7d52]" : "bg-[#c3b6bb]"}`}
            />
            {enStock
              ? variante && variante.stock <= 3
                ? `Plus que ${variante.stock} en stock`
                : "En stock — expédié aujourd'hui"
              : "Réassort attendu sous 10 jours"}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={ajouter}
              disabled={!enStock || envoi}
              className="flex-1 rounded-full bg-rose py-4.5 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(224,65,127,.65)] transition-all hover:-translate-y-[3px] active:scale-97 disabled:opacity-50"
            >
              {enStock ? (envoi ? "Ajout…" : "Ajouter au panier") : "Me prévenir du réassort"}
            </button>
            <a
              href={waLink(
                `Bonjour, je suis intéressée par : ${product.name}${variante ? ` (${variante.sku})` : ""}`,
                reglages.telephone,
              )}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border-[1.5px] border-[#e5d9de] bg-white px-6 py-4.5 text-[15px] font-bold"
            >
              WhatsApp
            </a>
            <FavoriteButton
              productId={product.id}
              productName={product.name}
              size="lg"
              variant="contour"
              className="shrink-0"
            />
          </div>

          {/* Le refus vient du serveur, qui seul connaît le stock à l'instant du clic. */}
          {erreur && (
            <p className="mt-3 rounded-2xl bg-rose-soft px-4 py-3 text-[13px] text-rose-deep">
              {erreur}
            </p>
          )}

          <div className="mt-5 flex gap-5 text-[12.5px] text-muted">
            <span>Livraison Dakar 24 h</span>
            <span>Échange sous 7 jours</span>
            <span>Paiement à la livraison</span>
          </div>

          <div className="mt-7 border-t border-line">
            {blocks.map((b, i) => (
              <div key={b.t} className="border-b border-line">
                <button
                  onClick={() => setOpenBlock(openBlock === i ? -1 : i)}
                  className="flex w-full items-center justify-between py-4.5 text-left text-[14.5px] font-bold"
                >
                  {b.t}
                  <span className="text-lg text-rose">{openBlock === i ? "−" : "+"}</span>
                </button>
                {openBlock === i && (
                  <p className="whitespace-pre-line pb-5 text-sm leading-[1.7] text-[#6b5a61]">{b.c}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {similaires.length > 0 && (
        <div className="pt-17">
          <h2 className="mb-5 text-[32px] font-extrabold tracking-[-.03em]">Dans le même esprit</h2>
          <div className="grid grid-cols-4 gap-5">
            {similaires.map((p, i) => (
              <ProductCard key={p.id} product={p} delay={i * 60} />
            ))}
          </div>
        </div>
      )}

      {/* Les avis ferment la fiche, sous les recommandations : c’est là que la
          page d’avis renvoie les clientes. */}
      <section id="avis" className="scroll-mt-28 pt-17">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[32px] font-extrabold tracking-[-.03em]">Avis sur cet article</h2>
          {note.count > 0 && (
            <span className="flex items-center gap-2.5 text-[13.5px] text-muted">
              <StarRow rating={note.average} />
              {String(note.average).replace(".", ",")}/5 · {note.count} avis
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1.35fr_.95fr] items-start gap-14">
          {/* Avant la réponse du serveur on ne sait pas encore ce qui existe. */}
          <div>{avisPrets && <ReviewList reviews={avis} />}</div>

          <div className="rounded-3xl border border-line bg-mist p-6">
            <h3 className="text-[15px] font-bold">Vous l’avez reçu&nbsp;?</h3>
            <p className="mb-5 mt-1.5 text-[13px] leading-relaxed text-muted">
              La taille, la matière, la tenue au lavage : ce qui aide la prochaine maman à choisir.
            </p>
            <ReviewForm target={{ kind: "product", productId: product.id }} titre="Votre note" />
          </div>
        </div>
      </section>
    </div>
  );
}
