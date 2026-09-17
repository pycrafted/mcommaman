"use client";

import { useState } from "react";
import Link from "next/link";
import { formatXOF, jusquAu, waLink } from "@/lib/format";
import type { ProduitApi } from "@/lib/api";
import { lienCategorie } from "@/lib/catalogue";
import type { Product } from "@/lib/products";
import { ProductCard } from "./product-card";
import { useCart } from "./cart-context";
import { useAvis } from "./reviews-context";
import { FavoriteButton } from "./favorite-button";
import { ReviewForm, ReviewList, StarRow } from "./review-form";
import { useReglages } from "./reglages-context";
import { PhotoEntiere } from "./photo-entiere";
import { useAuth } from "./auth-context";
import { messageCommande, useOrigine } from "@/lib/whatsapp";

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
  const { account, defaultAddress } = useAuth();
  const origine = useOrigine();
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

  /* Seulement les photos qui existent : pas de case vide en attendant une
     séance photo. Une fiche d'une seule photo n'affiche aucune miniature. */
  const gallery = (fiche.photos?.length ? fiche.photos : [product.image]).filter(Boolean);

  const [principale, setPrincipale] = useState(0);

  const discount = product.compareAt
    ? `−${Math.round((1 - product.price / product.compareAt) * 100)} %`
    : null;


  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-20 pt-5 md:px-8 md:pt-7 lg:px-10">
      <div className="truncate text-[12.5px] text-muted">
        <Link href="/">Accueil</Link> ·{" "}
        <Link href={product.categorySlug ? lienCategorie(product.categorySlug) : "/boutique"}>
          {product.category}
        </Link>{" "}
        · {product.name}
      </div>

      <div className="grid gap-7 pt-4 md:grid-cols-[1.05fr_.95fr] md:gap-10 md:pt-5 lg:gap-14">
        <div>
          {/* Les autres photos se posent en miniatures sur la grande, en bas à
              gauche : elles ne repoussent plus le reste de la page. */}
          <PhotoEntiere
            src={gallery[principale] ?? product.image}
            alt={product.name}
            className="aspect-4/5 rounded-3xl"
          >
            {gallery.length > 1 && (
              <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] gap-2 sm:bottom-4 sm:left-4 sm:max-w-[calc(100%-2rem)] overflow-x-auto rounded-2xl bg-white/80 p-1.5 shadow-[0_10px_30px_-12px_rgba(36,26,32,.35)] backdrop-blur">
                {gallery.map((image, i) => (
                  <button
                    key={image + i}
                    type="button"
                    onClick={() => setPrincipale(i)}
                    aria-label={`Voir la photo ${i + 1}`}
                    aria-pressed={i === principale}
                    className={`h-14 w-12 shrink-0 rounded-xl sm:h-16 sm:w-14 bg-stone bg-cover bg-center transition-all duration-300 ${
                      i === principale ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundImage: `url(${image})` }}
                  />
                ))}
              </div>
            )}
          </PhotoEntiere>
        </div>

        <div className="min-w-0 md:pt-1.5">
          {/* La référence reste une affaire de boutique : la cliente ne la voit pas. */}
          <span className="text-xs font-bold uppercase tracking-[.1em] text-rose">{product.category}</span>

          <h1 className="mt-3 text-[28px] font-extrabold leading-[1.08] tracking-[-.03em] sm:text-[34px] lg:mt-3.5 lg:text-[40px]">
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
              className={`text-[26px] font-extrabold tracking-[-.03em] sm:text-[30px] ${
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
                : "En stock"
              : /* Aucune date de retour n'est connue : on n'en promet pas. */
                "Épuisé dans cette taille"}
          </div>

          {/* Au doigt, le bouton d'achat prend toute la ligne ; WhatsApp et le
              favori passent dessous. */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={ajouter}
              disabled={!enStock || envoi}
              className="w-full rounded-full sm:w-auto sm:flex-1 bg-rose py-4.5 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(224,65,127,.65)] transition-all hover:-translate-y-[3px] active:scale-97 disabled:opacity-50"
            >
              {enStock ? (envoi ? "Ajout…" : "Ajouter au panier") : "Épuisé"}
            </button>
            <a
              href={waLink(
                messageCommande(
                  [
                    {
                      nom: product.name,
                      option: variante
                        ? [`Taille ${variante.taille_valeur}`, variante.coloris_nom]
                            .filter(Boolean)
                            .join(" · ")
                        : undefined,
                      quantite: 1,
                      prixUnitaire: product.price,
                      lien: origine ? `${origine}/p/${product.slug}` : undefined,
                    },
                  ],
                  { compte: account, adresse: defaultAddress },
                ),
                reglages.telephone,
              )}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-full border-[1.5px] border-[#e5d9de] bg-white px-6 py-4 text-center text-[15px] font-bold sm:flex-none sm:py-4.5"
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

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted">
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
        <div className="pt-14 lg:pt-17">
          <h2 className="mb-5 text-[26px] font-extrabold tracking-[-.03em] sm:text-[32px]">Dans le même esprit</h2>
          <div className="grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-4">
            {similaires.map((p, i) => (
              <ProductCard key={p.id} product={p} delay={i * 60} />
            ))}
          </div>
        </div>
      )}

      {/* Les avis ferment la fiche, sous les recommandations : c’est là que la
          page d’avis renvoie les clientes. */}
      <section id="avis" className="scroll-mt-28 pt-14 lg:pt-17">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[26px] font-extrabold tracking-[-.03em] sm:text-[32px]">Avis sur cet article</h2>
          {note.count > 0 && (
            <span className="flex items-center gap-2.5 text-[13.5px] text-muted">
              <StarRow rating={note.average} />
              {String(note.average).replace(".", ",")}/5 · {note.count} avis
            </span>
          )}
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[1.35fr_.95fr] lg:gap-14">
          {/* Avant la réponse du serveur on ne sait pas encore ce qui existe. */}
          <div>{avisPrets && <ReviewList reviews={avis} />}</div>

          <div className="rounded-3xl border border-line bg-mist p-5 sm:p-6">
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
