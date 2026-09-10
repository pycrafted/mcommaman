import type { Metadata } from "next";
import { IconArrow, IconInstagram, IconPin, IconTikTok } from "@/components/icons";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { lireReglages } from "@/lib/reglages";
import {
  ADRESSE,
  INSTAGRAM,
  INSTAGRAM_URL,
  MAPS_EMBED,
  MAPS_URL,
  TIKTOK,
  TIKTOK_URL,
  waLink,
} from "@/lib/format";

export const metadata: Metadata = {
  title: "Nous écrire",
  description:
    "Une question sur une taille ou une commande ? Écrivez-nous sur WhatsApp, réponse dans la journée.",
};

const FIELDS = [
  { l: "Nom", v: "Votre nom", span: 1, textarea: false },
  { l: "Téléphone", v: "+221 …", span: 1, textarea: false },
  { l: "Adresse e-mail", v: "vous@exemple.com", span: 2, textarea: false },
  { l: "Numéro de commande (facultatif)", v: "MCM-2026-…", span: 2, textarea: false },
  { l: "Votre message", v: "Bonjour, je cherche…", span: 2, textarea: true },
];

/* Le retrait sur place et l'adresse ont leur propre carte, cliquable : elle
   mène à Google Maps. Ne reste ici que ce qui ne s'ouvre nulle part. */
const CARDS = [{ t: "Horaires", v: "Lundi au samedi\n9 h – 19 h" }];

export default async function Page() {
  /* Le numéro affiché est celui des réglages : la gérante en change sans
     attendre une mise en production. */
  const reglages = await lireReglages();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1180px] px-10 pb-22 pt-10">
        <h1 className="text-5xl font-extrabold tracking-[-.035em]">Nous écrire</h1>
        <p className="mb-8.5 mt-2.5 max-w-[520px] text-[15px] text-muted">
          Une question sur une taille, une commande en cours, une pièce que vous cherchez : le plus
          rapide reste WhatsApp.
        </p>

        <div className="grid grid-cols-[1.1fr_.9fr] items-start gap-9">
          <form className="rounded-3xl border border-line p-7.5">
            <div className="grid grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.l} style={{ gridColumn: `span ${f.span}` }}>
                  <label className="mb-2 block text-[12.5px] font-bold">{f.l}</label>
                  {f.textarea ? (
                    <textarea
                      rows={4}
                      placeholder={f.v}
                      className="w-full resize-none rounded-2xl border-[1.5px] border-[#ece3e7] px-4 py-3.5 text-sm outline-none placeholder:text-[#9c8d93] focus:border-rose"
                    />
                  ) : (
                    <input
                      placeholder={f.v}
                      className="w-full rounded-2xl border-[1.5px] border-[#ece3e7] px-4 py-3.5 text-sm outline-none placeholder:text-[#9c8d93] focus:border-rose"
                    />
                  )}
                </div>
              ))}
            </div>

            <label className="mt-5 flex items-center gap-3 text-[13px] text-muted">
              <input type="checkbox" className="h-4.5 w-4.5 rounded-md border-[1.5px] border-[#e5d9de]" />
              Je ne suis pas un robot
            </label>

            <button
              type="submit"
              className="mt-5.5 rounded-full bg-rose px-7.5 py-4 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Envoyer le message
            </button>
          </form>

          <div className="flex flex-col gap-3.5">
            <a
              href={waLink("Bonjour, j'ai une question", reglages.telephone)}
              target="_blank"
              rel="noreferrer"
              className="block rounded-3xl bg-ink p-7 text-white transition-transform hover:-translate-y-0.5"
            >
              <div className="text-xs font-bold uppercase tracking-[.1em] text-gold">
                Réponse en quelques minutes
              </div>
              <div className="mt-2.5 text-2xl font-extrabold tracking-tight">
                WhatsApp
                <br />
                {reglages.telephone}
              </div>
            </a>

            {/* Instagram vient après WhatsApp : on écrit pour une question,
                on suit pour voir arriver les pièces. Deux gestes, deux places. */}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[20px] border border-line bg-white px-6 py-5.5 transition-colors hover:border-rose"
            >
              <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[.08em] text-rose">
                <IconInstagram className="h-4 w-4" />
                Les arrivages en premier
              </div>
              <div className="mt-2 text-[15px] font-semibold leading-relaxed">
                @{INSTAGRAM}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Les pièces sont photographiées dès leur arrivée, portées par de vrais enfants.
                Beaucoup partent avant même d&apos;être en ligne.
              </p>
            </a>

            {/* TikTok à la place du courriel : la boutique y répond, une boîte
                mail non. Même carte qu'Instagram, même geste. */}
            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[20px] border border-line bg-white px-6 py-5.5 transition-colors hover:border-rose"
            >
              <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[.08em] text-rose">
                <IconTikTok className="h-4 w-4" />
                Les pièces en vidéo
              </div>
              <div className="mt-2 text-[15px] font-semibold leading-relaxed">@{TIKTOK}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                La coupe et la tombée se voient mieux en mouvement : les nouveautés y sont
                filmées dès le déballage.
              </p>
            </a>

            {/* La localisation du magasin : l'adresse, puis le plan lui-même.
                Le plan est un <iframe> et non une image — la cliente zoome et
                fait glisser sans quitter la page. La carte entière ne peut donc
                pas être un lien : c'est la barre du bas qui ouvre Maps. */}
            <div className="overflow-hidden rounded-[20px] border border-line bg-white">
              <div className="px-6 pb-5 pt-5.5">
                <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[.08em] text-rose">
                  <IconPin className="h-4 w-4" />
                  Le magasin
                </div>
                <div className="mt-2 text-[15px] font-semibold leading-relaxed">{ADRESSE}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  Retrait sur place sur rendez-vous : prévenez sur WhatsApp avant de passer, la
                  pièce est mise de côté.
                </p>
              </div>

              {/* `loading="lazy"` : le plan est en bas de colonne, il ne doit
                  pas retarder l'affichage du formulaire. */}
              <div className="border-y border-line bg-mist">
                <iframe
                  src={MAPS_EMBED}
                  title={`Plan d'accès — ${ADRESSE}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  className="block h-[210px] w-full border-0"
                />
              </div>

              <a
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-2 px-6 py-4 text-[13px] font-bold text-rose transition-colors hover:bg-cream"
              >
                Ouvrir dans Google Maps
                <IconArrow className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>

            {CARDS.map((c) => (
              <div key={c.t} className="rounded-[20px] bg-mist px-6 py-5.5">
                <div className="text-[12.5px] font-bold uppercase tracking-[.08em] text-rose">{c.t}</div>
                <div className="mt-2 whitespace-pre-line text-[15px] font-semibold leading-relaxed">
                  {c.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
