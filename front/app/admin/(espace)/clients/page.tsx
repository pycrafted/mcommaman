"use client";

import { useEffect, useMemo, useState } from "react";
import { envoyer } from "@/lib/api";
import { formatXOF } from "@/lib/format";
import { SEGMENT_LABELS, computeCustomerStats, useAdmin } from "@/lib/admin/store";
import type { CustomerSegment, TeamMember } from "@/lib/admin/types";
import {
  Button,
  Chip,
  Field,
  Input,
  Kpi,
  Modal,
  OrderChip,
  PageHeader,
  Pills,
  SearchField,
  Table,
  Toggle,
  dateLongue,
  sansAccent,
} from "@/components/admin/ui";

/* Deux publics, une seule table côté serveur : ce qui les sépare est le rôle.
   L'onglet « Admins » montre les comptes qui ouvrent le back-office — toutes
   gérantes, la boutique ne distingue pas deux niveaux d'accès —, l'onglet
   « Clients » celles qui achètent. Une même personne n'est jamais dans les
   deux : son rôle la range d'un côté ou de l'autre. */
type Onglet = "admins" | "clients";

type Filtre = CustomerSegment | "toutes";

const TEINTES: Record<CustomerSegment, { bg: string; fg: string }> = {
  nouvelle: { bg: "#eef3fd", fg: "#33538f" },
  fidele: { bg: "#eaf6ef", fg: "#2e7d52" },
  vip: { bg: "#fbeaf1", fg: "#b3306a" },
  endormie: { bg: "#f4f1f2", fg: "#5d5157" },
};

/** Le formulaire, à vide. Pas de rôle à choisir : la boutique n'en a qu'un, et
    ouvrir un compte revient à donner le même accès que le sien. */
const NEUF = { id: "", name: "", email: "", phone: "" };

export default function Page() {
  const { customers, orders, team, hydrated, saveTeamMember, setTeamMemberActive, enCours, erreur } =
    useAdmin();

  const [onglet, setOnglet] = useState<Onglet>("admins");

  /* Qui est en train de regarder. Sert à deux choses : marquer sa propre ligne,
     et masquer le geste qui la fermerait — le serveur le refuse déjà, mais
     proposer un bouton voué à l'échec est une mauvaise manière. */
  const [moi, setMoi] = useState<number | null>(null);
  useEffect(() => {
    envoyer<{ utilisateur: { id: number } | null }>("/api/compte/moi/")
      .then((r) => setMoi(r.utilisateur?.id ?? null))
      .catch(() => setMoi(null));
  }, []);

  /* ---------------------------------------------------------------- clientes */

  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [recherche, setRecherche] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);

  /* La palette de commandes renvoie ici avec ?q=… : on lit l'adresse à la main
     plutôt qu'avec useSearchParams, qui obligerait à un <Suspense>. Une
     recherche venue de là vise une cliente : on ouvre l'onglet qui la montre. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setRecherche(q);
      setOnglet("clients");
    }
  }, []);

  const stats = useMemo(() => computeCustomerStats(customers, orders), [customers, orders]);

  const compte = (f: Filtre) =>
    f === "toutes" ? stats.length : stats.filter((s) => s.segment === f).length;

  const liste = useMemo(() => {
    const q = sansAccent(recherche);
    return stats
      .filter((s) => filtre === "toutes" || s.segment === filtre)
      .filter(
        (s) =>
          !q ||
          sansAccent(s.customer.name).includes(q) ||
          sansAccent(s.customer.city).includes(q) ||
          sansAccent(s.customer.email).includes(q)
      )
      /* La dernière inscrite en tête. Le serveur renvoie déjà cet ordre, mais
         s'y fier le rendrait fragile : un tri en amont suffirait à le perdre. */
      .sort((a, b) => b.customer.createdAt.localeCompare(a.customer.createdAt));
  }, [stats, filtre, recherche]);

  const fiche = stats.find((s) => s.customer.id === ouverte) ?? null;
  const sesCommandes = fiche
    ? orders
        .filter((o) => o.customerId === fiche.customer.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const total = stats.reduce((somme, s) => somme + s.spent, 0);

  /* ------------------------------------------------------------------ admins */

  const [rechercheAdmin, setRechercheAdmin] = useState("");
  const [edite, setEdite] = useState<typeof NEUF | null>(null);
  const [motDePasse, setMotDePasse] = useState("");

  const admins = useMemo(() => {
    const q = sansAccent(rechercheAdmin);
    return team
      .filter((m) => !q || sansAccent(m.name).includes(q) || sansAccent(m.email).includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [team, rechercheAdmin]);

  const actifs = team.filter((m) => m.active).length;
  const fermes = team.length - actifs;

  const ouvrir = (membre?: TeamMember) => {
    setEdite(
      membre
        ? {
            id: membre.id,
            name: membre.name,
            email: membre.email,
            phone: membre.phone,
          }
        : { ...NEUF }
    );
    setMotDePasse("");
  };

  const enregistrer = async () => {
    if (!edite) return;
    const ok = await saveTeamMember(edite, motDePasse);
    /* On ne referme que sur un succès : sinon la saisie partirait avec le
       message qui explique ce qui vient d'être refusé. */
    if (ok) {
      setEdite(null);
      setMotDePasse("");
    }
  };

  /* Le minimum pour que le bouton s'allume. Le serveur reste seul juge de la
     solidité du mot de passe et de l'unicité de l'adresse : redire ses règles
     ici finirait par mentir le jour où elles changent. */
  const complet =
    !!edite &&
    edite.name.trim().length > 0 &&
    edite.email.trim().length > 3 &&
    (!!edite.id || motDePasse.length > 0);

  if (!hydrated) return <p className="text-[13px] text-muted">Lecture des comptes…</p>;

  return (
    <>
      <PageHeader
        eyebrow="Comptes et accès"
        title="Utilisateurs"
        sub="L'équipe, qui entre dans le back-office, et la clientèle, qui achète. Un compte ne se supprime pas — il se ferme, pour que son nom reste lisible sur ce qu'il a fait."
      />

      {/* La bascule entre les deux mondes. Elle porte le compte de chaque côté :
          savoir qu'on a trois admins et quatre-vingts clientes se lit d'un coup,
          sans avoir à ouvrir l'onglet pour le découvrir. */}
      <div className="mb-5 inline-flex rounded-full border border-line bg-white p-1">
        {[
          { value: "admins" as Onglet, label: "Admins", n: team.length },
          { value: "clients" as Onglet, label: "Clients", n: customers.length },
        ].map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setOnglet(o.value)}
            aria-pressed={onglet === o.value}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold transition-colors duration-300 ${
              onglet === o.value ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                onglet === o.value ? "bg-white/20" : "bg-mist"
              }`}
            >
              {o.n}
            </span>
          </button>
        ))}
      </div>

      {onglet === "admins" ? (
        <>
          <div className="mb-4 grid gap-3.5 sm:grid-cols-2">
            <Kpi label="Comptes du back-office" value={String(team.length)} hint="toutes gérantes" />
            <Kpi
              label="Accès ouverts"
              value={String(actifs)}
              hint={
                fermes > 0
                  ? `${fermes} compte${fermes > 1 ? "s" : ""} fermé${fermes > 1 ? "s" : ""}`
                  : "aucun compte fermé"
              }
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchField
              value={rechercheAdmin}
              onChange={setRechercheAdmin}
              placeholder="Nom ou adresse e-mail…"
            />
            <Button variant="rose" className="ml-auto" onClick={() => ouvrir()}>
              Nouveau compte
            </Button>
          </div>

          <Table
            cols="1.9fr 1fr .9fr .8fr"
            head={["Compte", "Téléphone", "Ouvert le", "Accès"]}
            rows={admins}
            keyOf={(m) => m.id}
            pageSize={20}
            unite="comptes"
            onRow={(m) => ouvrir(m)}
            empty="Aucun compte ne correspond à ce filtre."
            cells={(m) => [
              <span key="n" className="block min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-bold">{m.name}</span>
                  {Number(m.id) === moi && (
                    <span className="shrink-0 rounded-full bg-mist px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">
                      vous
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-muted">{m.email}</span>
              </span>,
              <span key="t" className="truncate text-[13px] tabular-nums">
                {m.phone || "—"}
              </span>,
              <span key="d" className="text-[12.5px] text-muted">
                {dateLongue(m.createdAt)}
              </span>,
              <span
                key="a"
                className={`text-[12.5px] font-bold ${m.active ? "text-[#2e7d52]" : "text-muted"}`}
              >
                {m.active ? "Ouvert" : "Fermé"}
              </span>,
            ]}
          />
        </>
      ) : (
        <>
          <div className="mb-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi label="Clientes" value={String(customers.length)} />
            <Kpi
              label="Chiffre d'affaires cumulé"
              value={formatXOF(total)}
              hint="commandes encaissées"
            />
            <Kpi
              label="Panier moyen par cliente"
              value={formatXOF(stats.length ? Math.round(total / stats.length) : 0)}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchField
              value={recherche}
              onChange={setRecherche}
              placeholder="Nom, ville ou adresse e-mail…"
            />
            <Pills
              value={filtre}
              onChange={setFiltre}
              options={[
                { value: "toutes" as Filtre, label: "Toutes", count: compte("toutes") },
                ...(Object.keys(SEGMENT_LABELS) as CustomerSegment[]).map((s) => ({
                  value: s as Filtre,
                  label: SEGMENT_LABELS[s],
                  count: compte(s),
                })),
              ]}
            />
          </div>

          <Table
            cols="1.5fr 1fr .7fr .9fr 1fr .8fr"
            head={["Cliente", "Ville", "Commandes", "Dépensé", "Dernière", "Segment"]}
            rows={liste}
            keyOf={(s) => s.customer.id}
            pageSize={20}
            unite="clientes"
            onRow={(s) => setOuverte(s.customer.id)}
            empty="Aucune cliente ne correspond à ce filtre."
            cells={(s) => [
              <span key="n" className="block min-w-0">
                <span className="block truncate font-bold">{s.customer.name}</span>
                <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                  {s.customer.email}
                </span>
              </span>,
              <span key="v" className="truncate text-[13px]">
                {s.customer.city}
              </span>,
              <span key="c" className="font-extrabold tabular-nums">
                {s.orders}
              </span>,
              <span key="d" className="font-extrabold tabular-nums">
                {formatXOF(s.spent)}
              </span>,
              <span key="l" className="text-[12.5px] text-muted">
                {s.lastOrder ? dateLongue(s.lastOrder) : "jamais"}
              </span>,
              <Chip key="s" bg={TEINTES[s.segment].bg} fg={TEINTES[s.segment].fg}>
                {SEGMENT_LABELS[s.segment]}
              </Chip>,
            ]}
          />
        </>
      )}

      {/* ------------------------------------------------- fenêtre d'un compte */}

      {edite && (
        <Modal
          open
          onClose={() => setEdite(null)}
          title={edite.id ? "Modifier le compte" : "Nouveau compte du back-office"}
        >
          <div className="grid gap-4">
            <Field label="Nom complet">
              <Input
                value={edite.name}
                onChange={(v) => setEdite({ ...edite, name: v })}
                placeholder="Awa Ndiaye"
                autoFocus
              />
            </Field>

            <Field label="Adresse e-mail">
              <Input
                value={edite.email}
                onChange={(v) => setEdite({ ...edite, email: v })}
                type="email"
                autoComplete="off"
                placeholder="awa@mcommaman.com"
              />
            </Field>

            <Field label="Téléphone">
              <Input
                value={edite.phone}
                onChange={(v) => setEdite({ ...edite, phone: v })}
                placeholder="+221 …"
              />
            </Field>

            <Field label={edite.id ? "Nouveau mot de passe" : "Mot de passe"}>
              <Input
                value={motDePasse}
                onChange={setMotDePasse}
                type="password"
                autoComplete="new-password"
                placeholder={edite.id ? "Inchangé" : "Au moins 8 caractères"}
              />
            </Field>
            {edite.id && (
              <p className="-mt-2 text-[12.5px] leading-relaxed text-muted">
                Laissez ce champ vide pour garder le mot de passe actuel.
              </p>
            )}

            {/* L'accès ne se coupe que sur un compte déjà ouvert, et jamais sur
                le sien : le serveur le refuse, l'interface ne le propose pas. */}
            {edite.id && Number(edite.id) !== moi && (
              <div className="border-t border-line pt-4">
                <Toggle
                  checked={team.find((m) => m.id === edite.id)?.active ?? true}
                  onChange={(v) => setTeamMemberActive(edite.id, v)}
                  label="Accès au back-office ouvert"
                />
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  Un compte fermé ne peut plus se connecter, mais son nom reste sur les commandes
                  qu'il a traitées.
                </p>
              </div>
            )}

            {erreur && (
              <p className="rounded-2xl bg-[#fbeaf1] px-4 py-3 text-[12.5px] font-semibold leading-relaxed text-[#b3306a]">
                {erreur}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2.5 border-t border-line pt-4">
              <Button onClick={() => setEdite(null)}>Annuler</Button>
              <Button variant="rose" onClick={enregistrer} disabled={!complet || enCours}>
                {edite.id ? "Enregistrer" : "Ouvrir le compte"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------ fiche d'une cliente */}

      {fiche && (
        <Modal open onClose={() => setOuverte(null)} title={fiche.customer.name} wide>
          <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr] sm:items-start">
            <div className="rounded-2xl bg-mist p-4">
              <Chip bg={TEINTES[fiche.segment].bg} fg={TEINTES[fiche.segment].fg}>
                {SEGMENT_LABELS[fiche.segment]}
              </Chip>
              <p className="mt-3 text-[13px]">{fiche.customer.email}</p>
              <p className="mt-1 text-[13px] tabular-nums">{fiche.customer.phone}</p>
              <p className="mt-1 text-[13px] text-muted">{fiche.customer.city}</p>
              <p className="mt-3 border-t border-line pt-3 text-[12.5px] text-muted">
                Cliente depuis le {dateLongue(fiche.customer.createdAt)}
              </p>
              <p className="mt-3 border-t border-line pt-3 text-[13px]">
                <strong className="text-[17px] font-extrabold tabular-nums">
                  {formatXOF(fiche.spent)}
                </strong>
                <span className="block text-[12px] text-muted">
                  sur {fiche.orders} commande{fiche.orders > 1 ? "s" : ""}
                </span>
              </p>
            </div>

            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-muted">
                Ses commandes
              </p>
              {sesCommandes.length === 0 ? (
                <p className="text-[13px] text-muted">Aucune commande à son nom.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sesCommandes.map((o) => (
                    <li
                      key={o.id}
                      className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-mist px-4 py-3"
                    >
                      <span className="text-[13px] font-bold tabular-nums">{o.ref}</span>
                      <OrderChip status={o.status} />
                      <span className="text-[12px] text-muted">{dateLongue(o.createdAt)}</span>
                      <span className="ml-auto text-[13px] font-extrabold tabular-nums">
                        {formatXOF(o.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
