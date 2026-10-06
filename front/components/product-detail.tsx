"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatXOF } from "@/lib/format";
import { envoyer, type ProduitApi } from "@/lib/api";
import type { Product } from "@/lib/products";
import { srcSetWeb, variante as varianteWeb } from "@/lib/images";
import { ProductCard } from "./product-card";
import { useCart } from "./cart-context";
import { IconBag, IconCheck } from "./icons";

/**
 * La fiche produit, reprise de la fiche de Golden Pousso.
 *
 * L'ossature : le rayon seul en tête de page, une grille 1,05 / 0,95, la
 * photo en 4/5 à gauche avec sa loupe et ses vues en surimpression, la
 * colonne d'achat à droite, « Dans le même esprit » en pied (nos cartes,
 * pas les siennes).
 *
 * La colonne dit, dans l'ordre : titre · prix · description · couleur ·
 * taille · quantité et panier · stock. La description est lue tôt, entre le
 * prix et les choix : on sait ce qu'on achète avant de choisir une taille.
 * Elle ne porte aucune information de service (livraison, retours,
 * paiement) ni de bouton WhatsApp : la commande se passe depuis le panier.
 *
 * Les coloris, les tailles et le stock viennent du serveur : ce qu'on ajoute
 * au panier est une variante précise, celle que la commande achètera.
 */

/* La loupe : de 125 % à 400 %, par pas de 25 %, à 150 % à l'ouverture. */
const LOUPE = { min: 1.25, defaut: 1.5, max: 4, pas: 0.25 };
const borner = (n: number) => Math.round(Math.min(LOUPE.max, Math.max(LOUPE.min, n)) * 100) / 100;

/** Pointeur fin (souris) ou doigt : la loupe ne se pilote pas pareil. */
const pointeurFin = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Le formulaire « prévenez-moi » d'une pièce épuisée. */
function AlerteStock({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<"repos" | "envoi" | "fait">("repos");
  const [erreur, setErreur] = useState("");

  const envoyerAlerte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || etat === "envoi") return;
    setEtat("envoi");
    setErreur("");
    try {
      await envoyer(`/api/catalogue/produits/${slug}/alerte-stock/`, "POST", { email: email.trim() });
      setEtat("fait");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "La demande n'a pas abouti, réessayez.");
      setEtat("repos");
    }
  };

  if (etat === "fait") {
    return (
      <p className="anim-fade-up flex items-center gap-2 py-3 text-[13.5px] font-semibold text-sage">
        <IconCheck className="h-4 w-4" />
        Vous serez prévenue dès le retour en stock.
      </p>
    );
  }

  return (
    <form onSubmit={envoyerAlerte} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="votre@email.sn"
        aria-label="Votre adresse e-mail"
        className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-3 text-[13.5px] outline-none transition-colors focus:border-accent"
      />
      <button
        type="submit"
        disabled={etat === "envoi"}
        className="rounded-full bg-ink px-5 py-3 text-[13.5px] font-bold text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {etat === "envoi" ? "Envoi…" : "Me prévenir"}
      </button>
      {erreur && <p className="text-[12.5px] text-accent-deep sm:basis-full">{erreur}</p>}
    </form>
  );
}

export function ProductDetail({
  product,
  fiche,
  similaires,
}: {
  product: Product;
  fiche: ProduitApi;
  similaires: Product[];
}) {
  const { add, erreur: erreurPanier } = useCart();

  const coloris = fiche.coloris ?? [];
  const tailles = fiche.tailles ?? [];
  const variantes = fiche.variantes ?? [];

  /* Rien n'est choisi au départ : la fiche parle du stock de la pièce, pas de
     celui d'une taille que personne n'a demandée. */
  const [taille, setTaille] = useState("");
  const [couleur, setCouleur] = useState("");
  const [quantite, setQuantite] = useState(1);
  const [message, setMessage] = useState("");
  const [etatAjout, setEtatAjout] = useState<"repos" | "envoi" | "ajoute">("repos");

  /* La variante n'existe que si on a choisi quelque chose. */
  const aChoisi = Boolean(taille || couleur);
  const variante = aChoisi
    ? variantes.find(
        (v) => (!taille || v.taille_valeur === taille) && (!couleur || v.coloris_nom === couleur),
      ) ?? null
    : null;

  const stockTotal = variantes.reduce((s, v) => s + (v.disponible ? v.stock : 0), 0);
  const stockDispo = variante ? (variante.disponible ? variante.stock : 0) : stockTotal;
  const epuise = stockDispo === 0;
  /* Sous ce seuil, le dire est une information ; au-dessus, c'est une ficelle. */
  const presqueEpuise = stockDispo > 0 && stockDispo <= 3;
  /* La quantité est bornée au rendu, pas remise à 1 par un effet : changer de
     taille change le stock, mais le choix de la cliente survit quand la
     nouvelle taille en a assez. */
  const qte = Math.min(quantite, Math.max(1, stockDispo));

  const remise = product.compareAt && product.compareAt > product.price
    ? Math.round((1 - product.price / product.compareAt) * 100)
    : 0;

  const ajouter = async () => {
    if (etatAjout !== "repos") return;
    if (tailles.length > 0 && !taille) {
      setMessage("Choisissez une taille.");
      return;
    }
    /* Une taille choisie sans couleur : la première variante servable de cette
       taille fera l'affaire, c'est ce que le panier facturera. */
    const cible =
      variante ??
      variantes.find((v) => (!taille || v.taille_valeur === taille) && v.disponible && v.stock > 0) ??
      null;
    if (!cible) {
      setMessage("Cette pièce n'est plus disponible.");
      return;
    }
    setMessage("");
    setEtatAjout("envoi");
    const resultat = await add(
      {
        variante: cible.id,
        produit: fiche.id,
        slug: fiche.slug,
        nom: fiche.nom,
        option: [cible.coloris_nom, cible.taille_valeur].filter(Boolean).join(" · "),
        image: fiche.image,
        prix_unitaire: fiche.prix,
        stock_restant: cible.stock,
      },
      qte,
    );
    if (!resultat.ok) {
      setEtatAjout("repos");
      return;
    }
    setEtatAjout("ajoute");
    window.setTimeout(() => setEtatAjout("repos"), 1400);
  };

  const changerQuantite = (delta: number) =>
    setQuantite(Math.min(Math.max(1, qte + delta), Math.max(1, stockDispo)));

  /* ------------------------------------------------------------- la photo */
  const vues = (fiche.photos?.length ? fiche.photos : [product.image]).filter(Boolean);
  const [vue, setVue] = useState(0);
  const courante = vues[vue] ?? product.image;

  /* La loupe. `zoom` : elle est active. `origine` : le point de la photo, en
     pourcentages, que le pointeur désigne — c'est l'origine de
     l'agrandissement, donc le détail reste sous le curseur. La haute
     définition n'est demandée qu'au premier agrandissement et le reste. */
  const [zoom, setZoom] = useState(false);
  /* Souris ou doigt : décidé après le montage, pour que le premier rendu
     soit le même que celui du serveur. */
  const [fin, setFin] = useState(false);
  useEffect(() => setFin(pointeurFin()), []);
  const [origine, setOrigine] = useState({ x: 50, y: 50 });
  const [hd, setHd] = useState(false);
  const [niveau, setNiveau] = useState(LOUPE.defaut);
  const niveauRef = useRef(niveau);
  useEffect(() => {
    niveauRef.current = niveau;
  }, [niveau]);
  const visuel = useRef<HTMLDivElement>(null);
  /* Le départ d'un geste tactile, pour distinguer une tape (qui bascule la
     loupe) d'un déplacement (qui promène la zone regardée). */
  const depart = useRef<{ x: number; y: number; bouge: boolean } | null>(null);

  const dansCommande = (cible: EventTarget | null) =>
    cible instanceof Element && Boolean(cible.closest("[data-vues], [data-loupe], [data-pastilles]"));

  /* La molette règle le niveau ; au bout de la plage elle rend la main à la
     page, pour ne pas bloquer le défilement tant que le pointeur est sur la
     photo. */
  useEffect(() => {
    const el = visuel.current;
    if (!el) return;
    const surRoue = (e: WheelEvent) => {
      if (!pointeurFin() || dansCommande(e.target)) return;
      const n = niveauRef.current;
      if ((e.deltaY > 0 && n <= LOUPE.min) || (e.deltaY < 0 && n >= LOUPE.max)) return;
      e.preventDefault();
      setNiveau(borner(n - e.deltaY * (LOUPE.pas / 100)));
      setZoom(true);
      setHd(true);
    };
    el.addEventListener("wheel", surRoue, { passive: false });
    return () => el.removeEventListener("wheel", surRoue);
  }, []);

  const pointEnPourcents = (x: number, y: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((y - r.top) / r.height) * 100)),
    };
  };

  const suivrePointeur = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pointeurFin()) return;
    if (dansCommande(e.target)) {
      if (!(e.target instanceof Element && e.target.closest("[data-loupe]"))) setZoom(false);
      return;
    }
    setOrigine(pointEnPourcents(e.clientX, e.clientY, e.currentTarget));
    setZoom(true);
    setHd(true);
  };

  const changerNiveau = (delta: number) => {
    setNiveau((n) => borner(n + delta));
    setZoom(true);
    setHd(true);
  };

  /* Au doigt : une tape agrandit au point touché, une seconde rend la vue
     d'ensemble, et le doigt posé déplace la zone regardée. */
  const toucheDebut = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pointeurFin() || dansCommande(e.target)) return;
    const t = e.touches[0];
    depart.current = { x: t.clientX, y: t.clientY, bouge: false };
    if (zoom) setOrigine(pointEnPourcents(t.clientX, t.clientY, e.currentTarget));
  };
  const toucheBouge = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!zoom || pointeurFin() || !depart.current) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - depart.current.x, t.clientY - depart.current.y) > 8) depart.current.bouge = true;
    setOrigine(pointEnPourcents(t.clientX, t.clientY, e.currentTarget));
  };
  const toucheFin = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pointeurFin()) return;
    const d = depart.current;
    depart.current = null;
    if (!d || d.bouge || dansCommande(e.target)) return;
    if (zoom) {
      setZoom(false);
      return;
    }
    const t = e.changedTouches[0];
    setOrigine(pointEnPourcents(t.clientX, t.clientY, e.currentTarget));
    setZoom(true);
    setHd(true);
  };

  /* ----------------------------------------------- la barre d'achat collante
     Au téléphone, le bouton d'origine est à deux écrans du haut : la barre
     porte le prix et l'action, et n'apparaît que lorsque le bouton a quitté
     l'écran. Jamais sur une pièce épuisée. */
  const actions = useRef<HTMLDivElement>(null);
  const [actionsVisibles, setActionsVisibles] = useState(true);
  useEffect(() => {
    const el = actions.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setActionsVisibles(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [epuise]);

  const classePilule = (actif: boolean) =>
    `rounded-full border px-5 py-2.5 text-[13.5px] font-semibold transition-[background-color,border-color,color,transform] duration-300 ease-back hover:-translate-y-0.5 active:scale-95 ${
      actif ? "border-[#e24f88] bg-[#e24f88] text-white" : "border-line bg-white text-ink hover:border-[#e24f88]"
    }`;

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-20 pt-6 md:px-8 md:pt-8 lg:px-10">
      {/* Le rayon, seul fil d'Ariane : l'accueil est dans le dock, et le
          dernier maillon répéterait le titre affiché deux lignes plus bas. */}
      <nav aria-label="Rayon">
        <Link
          href="/"
          className="text-[11px] font-bold uppercase tracking-[.16em] text-accent transition-colors hover:text-ink"
        >
          {product.category}
        </Link>
      </nav>

      <div className="grid items-start gap-6 pt-4 min-[900px]:grid-cols-[1.05fr_.95fr] min-[900px]:gap-10 lg:gap-14">
        {/* ------------------------------------------------------- galerie */}
        <div className="relative">
          <div
            ref={visuel}
            onMouseMove={suivrePointeur}
            onMouseLeave={() => setZoom(false)}
            onTouchStart={toucheDebut}
            onTouchMove={toucheBouge}
            onTouchEnd={toucheFin}
            onTouchCancel={() => {
              depart.current = null;
            }}
            style={{ "--zx": `${origine.x}%`, "--zy": `${origine.y}%`, "--zniveau": niveau } as React.CSSProperties}
            className={`relative aspect-4/5 overflow-hidden rounded-3xl bg-stone ${zoom ? "touch-none" : ""} ${fin ? "cursor-zoom-in" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={courante}
              srcSet={srcSetWeb(courante)}
              sizes="(max-width: 900px) 100vw, 50vw"
              alt={product.name}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover transition-[scale,opacity] duration-400 ease-soft"
              style={{ transformOrigin: "var(--zx) var(--zy)", scale: zoom ? "var(--zniveau)" : "1" }}
            />
            {/* La haute définition, montrée seulement agrandie : à plat elle
                n'apporte que le poids d'un second décodage. */}
            {hd && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={varianteWeb(courante, 1600)}
                alt=""
                aria-hidden
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${zoom ? "opacity-100" : "opacity-0"}`}
                style={{ transformOrigin: "var(--zx) var(--zy)", scale: zoom ? "var(--zniveau)" : "1" }}
              />
            )}

            {/* La commande de la loupe, en haut à gauche. */}
            <div
              data-loupe
              role="group"
              aria-label="Zoom de la photo"
              className="absolute left-3 top-3 z-10 inline-flex items-center gap-0.5 rounded-full bg-white/92 p-1 text-ink shadow-[0_8px_20px_-12px_rgba(36,26,32,.5)] backdrop-blur"
            >
              <button
                type="button"
                onClick={() => changerNiveau(-LOUPE.pas)}
                disabled={niveau <= LOUPE.min}
                aria-label="Diminuer le zoom"
                className="grid h-8 w-8 place-items-center rounded-full text-lg leading-none transition-colors hover:bg-accent-soft disabled:opacity-35"
              >
                −
              </button>
              <span aria-live="polite" className="min-w-[5ch] text-center text-[12px] font-bold tabular-nums">
                {Math.round(niveau * 100)} %
              </span>
              <button
                type="button"
                onClick={() => changerNiveau(LOUPE.pas)}
                disabled={niveau >= LOUPE.max}
                aria-label="Augmenter le zoom"
                className="grid h-8 w-8 place-items-center rounded-full text-lg leading-none transition-colors hover:bg-accent-soft disabled:opacity-35"
              >
                +
              </button>
            </div>

            {/* La pastille panier, en haut à droite de la photo : elle ajoute
                la taille et la quantité choisies, comme le bouton. */}
            {!epuise && (
              <div data-pastilles className="absolute right-3 top-3 z-10">
                <button
                  type="button"
                  onClick={ajouter}
                  aria-label={`Ajouter ${product.name} au panier`}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/92 text-ink shadow-[0_8px_20px_-12px_rgba(36,26,32,.5)] backdrop-blur transition-[transform,background-color,color] duration-300 ease-back hover:scale-110 hover:bg-[#e24f88] hover:text-white active:scale-95"
                >
                  {etatAjout === "ajoute" ? <IconCheck className="h-4 w-4" /> : <IconBag className="h-4 w-4" />}
                </button>
              </div>
            )}

            {/* Les vues, en surimpression sur le bas de la photo sur grand
                écran : elles ne prennent aucune hauteur. Le dégradé détache
                une miniature claire d'un tissu clair. */}
            {vues.length > 1 && (
              <div
                data-vues
                className="absolute inset-x-0 bottom-0 z-10 hidden gap-2 overflow-x-auto px-3 pb-3 pt-7 min-[900px]:flex"
                style={{ background: "linear-gradient(to top, rgba(36,26,32,.58), rgba(36,26,32,0))", scrollbarWidth: "none" }}
              >
                {vues.map((v, i) => (
                  <button
                    key={v + i}
                    type="button"
                    onClick={() => {
                      setVue(i);
                      setZoom(false);
                    }}
                    aria-label={`Afficher la vue ${i + 1} de ${product.name}`}
                    aria-current={vue === i}
                    className={`relative aspect-3/4 w-14 shrink-0 overflow-hidden rounded-[10px] bg-stone bg-cover bg-center transition-[opacity,box-shadow] duration-300 ${
                      vue === i ? "opacity-100 shadow-[0_0_0_2px_#e24f88]" : "opacity-80 shadow-[0_0_0_1.5px_rgba(255,255,255,.45)] hover:opacity-100"
                    }`}
                    style={{ backgroundImage: `url(${varianteWeb(v, 400)})` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Au téléphone, la bande sort de la photo et passe dessous : le
              quart inférieur d'un vêtement cadré en pied dit si la coupe
              tombe droit. */}
          {vues.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto min-[900px]:hidden" style={{ scrollbarWidth: "none" }}>
              {vues.map((v, i) => (
                <button
                  key={v + i}
                  type="button"
                  onClick={() => {
                    setVue(i);
                    setZoom(false);
                  }}
                  aria-label={`Afficher la vue ${i + 1} de ${product.name}`}
                  aria-current={vue === i}
                  className={`aspect-3/4 w-[52px] shrink-0 rounded-[10px] bg-stone bg-cover bg-center transition-opacity ${
                    vue === i ? "opacity-100 shadow-[0_0_0_2px_#e24f88]" : "opacity-80"
                  }`}
                  style={{ backgroundImage: `url(${varianteWeb(v, 400)})` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------ colonne d'achat */}
        <div className="min-w-0 pt-1">
          <h1 className="font-serif text-[clamp(1.75rem,3.2vw,2.5rem)] font-semibold uppercase leading-[1.1] tracking-[.02em] text-ink text-balance">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-[32px] font-semibold tracking-[-.02em] tabular-nums text-accent">
              {formatXOF(product.price)}
            </span>
            {remise > 0 && product.compareAt && (
              <span className="text-base text-muted line-through tabular-nums">
                <span className="sr-only">Ancien prix : </span>
                {formatXOF(product.compareAt)}
              </span>
            )}
            {remise > 0 && (
              <span className="rounded-full bg-[#e24f88] px-2.5 py-1 text-[11.5px] font-bold text-white">−{remise} %</span>
            )}
          </div>

          {/* La description, lue tôt : entre le prix et les choix. */}
          <div className="mt-5">
            <p className="whitespace-pre-line text-[15px] leading-[1.7] text-muted">
              {product.description || "Description à venir."}
            </p>
          </div>

          {coloris.length > 0 && (
            <div className="mt-7">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">Couleur</span>
                {couleur && <span className="text-[13px] text-ink">{couleur}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {coloris.map((c) => (
                  <button
                    key={c.nom}
                    type="button"
                    onClick={() => setCouleur(couleur === c.nom ? "" : c.nom)}
                    aria-pressed={couleur === c.nom}
                    className={`${classePilule(couleur === c.nom)} inline-flex items-center gap-2`}
                  >
                    <span aria-hidden className="h-3 w-3 rounded-full border border-black/10" style={{ background: c.hexa }} />
                    {c.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tailles.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">Taille</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tailles.map((t) => (
                  <button
                    key={t.valeur}
                    type="button"
                    onClick={() => {
                      setTaille(taille === t.valeur ? "" : t.valeur);
                      setMessage("");
                    }}
                    aria-pressed={taille === t.valeur}
                    title={t.repere || undefined}
                    className={classePilule(taille === t.valeur)}
                  >
                    {t.valeur}
                  </button>
                ))}
              </div>
            </div>
          )}

          {epuise ? (
            <div className="mt-6 rounded-3xl border border-line bg-mist p-5">
              <p className="text-[15px] font-semibold text-ink">
                {taille ? `Taille ${taille} épuisée pour le moment.` : "Pièce épuisée pour le moment."}
              </p>
              <p className="mb-4 mt-1.5 text-[12.5px] text-muted">
                Laissez votre e-mail : vous serez prévenue dès le retour en stock.
              </p>
              <AlerteStock slug={fiche.slug} />
            </div>
          ) : (
            <>
              <div ref={actions} className="mt-6 flex items-stretch gap-3">
                <div role="group" aria-label="Quantité" className="flex shrink-0 items-center overflow-hidden rounded-full border border-line bg-white">
                  <button
                    type="button"
                    onClick={() => changerQuantite(-1)}
                    disabled={qte <= 1}
                    aria-label="Retirer une pièce"
                    className="h-12 w-11 text-lg leading-none transition-colors hover:bg-blush disabled:opacity-30"
                  >
                    −
                  </button>
                  <span aria-live="polite" className="min-w-[2rem] text-center text-[15px] font-semibold tabular-nums">
                    {qte}
                  </span>
                  <button
                    type="button"
                    onClick={() => changerQuantite(1)}
                    disabled={qte >= stockDispo}
                    aria-label="Ajouter une pièce"
                    className="h-12 w-11 text-lg leading-none transition-colors hover:bg-blush disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={ajouter}
                  disabled={etatAjout === "envoi"}
                  className={`shine flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-bold text-white transition-[transform,background-color] duration-300 ease-back hover:-translate-y-0.5 active:scale-[.98] disabled:translate-y-0 ${
                    etatAjout === "ajoute" ? "bg-sage" : "bg-[#e24f88] shadow-[0_12px_28px_-12px_rgba(226,79,136,.9)] hover:bg-[#d4467c]"
                  }`}
                >
                  {etatAjout === "ajoute" ? (
                    <>
                      <IconCheck className="h-4 w-4" />
                      Ajouté au panier
                    </>
                  ) : etatAjout === "envoi" ? (
                    "Ajout…"
                  ) : (
                    "Ajouter au panier"
                  )}
                </button>
              </div>

              {(message || erreurPanier) && (
                <p className="mt-3 text-[13px] font-semibold text-accent-deep">{message || erreurPanier}</p>
              )}

              {presqueEpuise && (
                <p className="mt-3 text-[12.5px] font-semibold text-accent-deep">
                  Plus que {stockDispo} {stockDispo > 1 ? "pièces disponibles" : "pièce disponible"}
                  {taille ? ` en taille ${taille}` : ""}.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* La barre d'achat collante, sous 900 px, quand le bouton a quitté
          l'écran : le montant à gauche, l'action à droite. */}
      {!epuise && !actionsVisibles && (
        <div
          role="group"
          aria-label="Acheter"
          className="anim-fade-up fixed inset-x-0 bottom-0 z-70 flex items-center gap-3 border-t border-line bg-cream/95 px-5 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur min-[900px]:hidden"
        >
          <span className="whitespace-nowrap font-serif text-[19px] font-bold tabular-nums text-accent">
            {formatXOF(product.price)}
            {qte > 1 && <span className="text-[14px] text-muted"> × {qte}</span>}
          </span>
          <button
            type="button"
            onClick={ajouter}
            className="min-w-0 flex-1 rounded-full bg-[#e24f88] py-3 text-[14.5px] font-bold text-white hover:bg-[#d4467c]"
          >
            Ajouter au panier
          </button>
        </div>
      )}

      {/* « Dans le même esprit », avec nos cartes, et pas au téléphone. */}
      {similaires.length > 0 && (
        <div className="hidden pt-14 md:block lg:pt-17">
          <h2 className="mb-5 font-serif text-[clamp(1.6rem,2.6vw,2rem)] font-semibold tracking-tight">Dans le même esprit</h2>
          <div className="grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-4">
            {similaires.map((p, i) => (
              <ProductCard key={p.id} product={p} delay={i * 60} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
