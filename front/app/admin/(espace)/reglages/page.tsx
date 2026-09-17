"use client";

import { formatXOF } from "@/lib/format";
import { useAdmin } from "@/lib/admin/store";
import {
  Button,
  Field,
  Input,
  PageHeader,
  Section,
  Textarea,
  Toggle,
} from "@/components/admin/ui";
import { AccueilEditeur } from "@/components/admin/accueil-editeur";
import { Videotheque } from "@/components/admin/videotheque";

export default function Page() {
  const { settings, updateSettings, hydrated } = useAdmin();

  const nombre = (v: string) => Number(v.replace(/\D/g, "")) || 0;

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Réglages"
        sub="L'identité de la boutique, les frais de livraison, le bandeau et les photos d'accueil."
      />

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {/* -------------------------------------------------------- identité */}
        <Section title="Identité" sub="Ce qui s'affiche en tête de la vitrine et dans les e-mails.">
          <div className="flex flex-col gap-4">
            <Field label="Nom de la boutique">
              <Input
                value={settings.storeName}
                onChange={(v) => updateSettings({ storeName: v })}
              />
            </Field>
            <Field label="Signature" hint="La phrase qui suit le nom.">
              <Input value={settings.tagline} onChange={(v) => updateSettings({ tagline: v })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Adresse e-mail de contact">
                <Input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(v) => updateSettings({ contactEmail: v })}
                />
              </Field>
              <Field label="Téléphone">
                <Input value={settings.phone} onChange={(v) => updateSettings({ phone: v })} />
              </Field>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------- livraison */}
        <Section
          title="Livraison et stock"
          sub="Les mêmes montants que ceux affichés dans le tunnel de commande."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Livraison offerte à partir de"
              hint={`Aujourd'hui : ${formatXOF(settings.freeShippingThreshold)}`}
            >
              <Input
                value={String(settings.freeShippingThreshold)}
                onChange={(v) => updateSettings({ freeShippingThreshold: nombre(v) })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Seuil de stock faible" hint="En dessous, le produit remonte au tableau de bord.">
              <Input
                value={String(settings.lowStockThreshold)}
                onChange={(v) => updateSettings({ lowStockThreshold: nombre(v) })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Frais — Dakar">
              <Input
                value={String(settings.shippingDakar)}
                onChange={(v) => updateSettings({ shippingDakar: nombre(v) })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Frais — régions">
              <Input
                value={String(settings.shippingRegions)}
                onChange={(v) => updateSettings({ shippingRegions: nombre(v) })}
                inputMode="numeric"
              />
            </Field>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <Toggle
              checked={settings.acceptOrders}
              onChange={(v) => updateSettings({ acceptOrders: v })}
              label="La boutique accepte les commandes"
              hint="Décoché, le tunnel se ferme — à utiliser pendant un inventaire ou un congé."
            />
          </div>
        </Section>

        {/* ---------------------------------------------------------- bandeau */}
        <Section title="Bandeau d'annonce" sub="La bande qui court en haut de la vitrine.">
          <Toggle
            checked={settings.showPromoBanner}
            onChange={(v) => updateSettings({ showPromoBanner: v })}
            label="Afficher le bandeau"
          />
          <div className="mt-4">
            <Field label="Texte" hint="Court : il défile, il ne se lit pas deux fois.">
              <Textarea
                value={settings.promoBannerText}
                onChange={(v) => updateSettings({ promoBannerText: v })}
                rows={2}
              />
            </Field>
          </div>
          {settings.showPromoBanner && settings.promoBannerText && (
            <p className="mt-4 rounded-xl bg-ink px-4 py-2.5 text-center text-[12.5px] font-semibold text-white">
              {settings.promoBannerText}
            </p>
          )}
        </Section>

      </div>

      {/* ------------------------------------------------------- accueil */}
      <div className="mt-4">
        <AccueilEditeur />
      </div>
      <div className="mt-4">
        <Videotheque />
      </div>
    </>
  );
}
