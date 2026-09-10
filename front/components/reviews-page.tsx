"use client";

import Link from "next/link";
import { useAvis, useDerniersAvisArticles } from "./reviews-context";
import { ReviewForm, ReviewList, StarRow } from "./review-form";
import { SectionCard } from "./form-kit";
import { IconQuote } from "./icons";

const SHELL = "mx-auto w-full max-w-[1180px] px-5 md:px-8 lg:px-10";

export function ReviewsPage() {
  /* Deux lectures distinctes : les avis sur la boutique, et les derniers avis
     déposés sur des articles. Le serveur sait faire la différence — la vitrine
     n'a plus à trier une liste qu'elle tenait entière. */
  const { avis: surLaBoutique, resume: note, pret } = useAvis({ kind: "shop" });
  const { avis: surLesArticles } = useDerniersAvisArticles(6);

  /* Éviter la division par zéro quand aucun avis n'existe encore. */
  const total = note.count || 1;

  return (
    <div className={`${SHELL} pb-22 pt-10`}>
      <div className="mb-8 text-center">
        <span className="text-[11px] font-bold uppercase tracking-[.16em] text-rose">
          Paroles de clientes
        </span>
        <h1 className="mt-3 text-[clamp(2rem,4.6vw,2.9rem)] font-extrabold leading-[1.05] tracking-[-.035em]">
          Avis sur M comme Maman
        </h1>
        <p className="mx-auto mt-2.5 max-w-[54ch] text-[14.5px] leading-relaxed text-muted text-pretty">
          Le choix des pièces, la livraison, les conseils de taille : dites-nous ce qui va et ce qui
          manque.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          <SectionCard
            title={`La boutique vue par ses clientes${note.count > 0 ? ` (${note.count})` : ""}`}
            description={
              note.count > 0
                ? "Avis laissés par des clientes dont la commande a été reçue."
                : "Les avis apparaîtront ici dès la première réception."
            }
          >
            {note.count > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-7 rounded-2xl bg-mist px-5 py-5">
                <div className="text-center">
                  <p className="text-4xl font-extrabold leading-none tabular-nums">
                    {String(note.average).replace(".", ",")}
                  </p>
                  <StarRow rating={note.average} className="mt-2 block" />
                  <p className="mt-1.5 text-[11px] text-muted">
                    {note.count} avis
                  </p>
                </div>

                <ul className="min-w-[180px] flex-1">
                  {[5, 4, 3, 2, 1].map((etoile) => (
                    <li key={etoile} className="flex items-center gap-2 py-0.5 text-[12px] text-muted">
                      <span className="w-3 text-right tabular-nums">{etoile}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone">
                        <span
                          className="block h-full rounded-full bg-gold transition-[width] duration-700 ease-soft"
                          style={{ width: `${((note.distribution[etoile] ?? 0) / total) * 100}%` }}
                        />
                      </span>
                      <span className="w-5 tabular-nums">{note.distribution[etoile] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Avant la réponse du serveur on ne sait pas encore ce qui existe. */}
            {pret && <ReviewList reviews={surLaBoutique} />}
          </SectionCard>

          {surLesArticles.length > 0 && (
            <SectionCard
              title="Derniers avis sur les articles"
              description="Retrouvez-les aussi sur chaque fiche produit."
            >
              <ul className="flex flex-col gap-3">
                {surLesArticles.map((avis) => {
                  return (
                    <li key={avis.id} className="rounded-2xl border border-line bg-mist p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {avis.productSlug ? (
                          <Link
                            href={`/p/${avis.productSlug}`}
                            className="text-[13.5px] font-bold transition-colors hover:text-rose"
                          >
                            {avis.productName}
                          </Link>
                        ) : (
                          <span className="text-[13.5px] text-muted">Article retiré du catalogue</span>
                        )}
                        <StarRow rating={avis.rating} />
                      </div>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-[#3d2f35]">{avis.comment}</p>
                      <p className="mt-2 text-[11px] text-muted">
                        {avis.authorName} · achat vérifié
                      </p>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}
        </div>

        <div className="lg:sticky lg:top-[104px]">
          <SectionCard
            title="Votre avis sur nos services"
            description="Un seul par cliente, modifiable à tout moment."
          >
            <p className="mb-5 flex gap-2.5 rounded-2xl bg-gold-soft px-4 py-3.5 text-[12px] leading-relaxed text-[#5c4a2a]">
              <IconQuote className="mt-0.5 h-4 w-4 shrink-0" />
              Pour noter un article en particulier, rendez-vous sur sa fiche : le formulaire s&apos;y
              trouve sous les recommandations.
            </p>

            <ReviewForm target={{ kind: "shop" }} titre="Votre note globale" />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
