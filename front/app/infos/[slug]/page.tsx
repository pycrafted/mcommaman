import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { LEGAL_PAGES, legalBySlug } from "@/lib/legal";

export function generateStaticParams() {
  return LEGAL_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = legalBySlug(slug);
  return page ? { title: page.title } : { title: "Page introuvable" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = legalBySlug(slug);
  if (!page) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1180px] px-5 pb-22 pt-6 md:px-8 md:pt-10 lg:px-10">
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-.035em] sm:text-[42px] lg:text-5xl">
          Informations légales
        </h1>
        <p className="mb-7.5 mt-2.5 max-w-[560px] text-[15px] text-muted">
          Aucune de ces pages n&apos;existait sur l&apos;ancien site. Trois d&apos;entre elles sont
          obligatoires pour vendre en ligne.
        </p>

        <div className="grid items-start gap-6 lg:grid-cols-[250px_1fr] lg:gap-10">
          {/* Au doigt, les rubriques défilent en ligne au-dessus du texte. */}
          <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {LEGAL_PAGES.map((p) => {
              const active = p.slug === page.slug;
              return (
                <Link
                  key={p.slug}
                  href={`/infos/${p.slug}`}
                  className={`flex shrink-0 items-center justify-between gap-2.5 whitespace-nowrap rounded-2xl px-4 py-3 text-sm transition-colors lg:py-3.5 ${
                    active ? "bg-ink font-bold text-white" : "bg-mist font-medium text-[#4a3a41]"
                  }`}
                >
                  {p.title}
                  {p.required && (
                    <span
                      className={`text-[10.5px] font-bold uppercase tracking-[.06em] ${
                        active ? "text-gold" : "text-rose-deep"
                      }`}
                    >
                      Obligatoire
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <article className="anim-fade-up rounded-3xl border border-line px-5 py-6 sm:px-8 sm:py-8 lg:px-10.5 lg:py-9.5">
            <h2 className="text-[24px] font-extrabold tracking-[-.025em] sm:text-[28px]">{page.title}</h2>
            <p className="mt-2 text-[12.5px] text-[#9c8d93]">Dernière mise à jour : 14 août 2026</p>
            <div className="mt-6 whitespace-pre-line text-[15px] leading-[1.75] text-[#4a3a41]">
              {page.body}
            </div>
          </article>
        </div>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
