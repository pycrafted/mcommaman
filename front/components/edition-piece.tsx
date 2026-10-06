"use client";

import { useCallback, useRef } from "react";
import { AdminProvider, useAdmin } from "@/lib/admin/store";
import { useFicheProduit } from "@/lib/admin/produits";
import { ProductForm } from "./product-form";
import { Modal } from "./admin/ui";

/**
 * Modifier ou créer une pièce sans quitter la boutique.
 *
 * Repris de Golden Pousso : un crayon posé sur chaque carte, visible des seuls
 * comptes de l'équipe, ouvre le formulaire produit du back-office dans une
 * fenêtre, en modification ; le « + » du dock ouvre le même formulaire, vide,
 * pour créer une pièce. Le formulaire est celui de `/admin/produits`, à
 * l'identique : une seule façon de décrire une fiche.
 *
 * Il a besoin des données du back-office (rayons, matières, coloris,
 * tailles) : la fenêtre monte donc son propre `AdminProvider`, qui les lit à
 * l'ouverture. Ce code n'est chargé qu'au premier clic (`next/dynamic` chez
 * l'appelant) : les visiteuses ne téléchargent pas le back-office.
 *
 * La fenêtre reste ouverte après « Enregistrer » ; c'est la gérante qui la
 * ferme. À la fermeture, s'il y a eu un enregistrement, la page est prévenue
 * par l'événement `mcm:catalogue-modifie` et relit ses cartes.
 */

/** L'événement que la boutique écoute pour relire son catalogue. */
export const CATALOGUE_MODIFIE = "mcm:catalogue-modifie";

function Contenu({
  produitId,
  onSaved,
  onClose,
}: {
  produitId?: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { hydrated, notification, enCours } = useAdmin();
  const fiche = useFicheProduit(produitId ?? "");

  if (!hydrated || (produitId && fiche === undefined)) {
    return <p className="py-10 text-center text-[13px] text-muted">Ouverture de la fiche…</p>;
  }
  if (produitId && !fiche) {
    return <p className="py-10 text-center text-[13px] text-muted">Cette pièce est introuvable.</p>;
  }
  return (
    <>
      {/* Le mot du back-office (« Modifications enregistrées », ou l'erreur) :
          il s'affiche dans son cadre à lui ; ici, c'est la fenêtre qui le dit. */}
      {(enCours || notification) && (
        <p
          role={notification?.type === "error" ? "alert" : "status"}
          className={`anim-pop-in mb-4 rounded-2xl px-4 py-3 text-[13px] font-semibold ${
            notification?.type === "error" ? "bg-[#fbe6ef] text-[#b3306a]" : "bg-[#eaf6ef] text-[#2e7d52]"
          }`}
        >
          {enCours ? "Enregistrement…" : notification?.message}
        </p>
      )}
      <ProductForm key={fiche?.id ?? "nouvelle"} product={fiche ?? undefined} onSaved={onSaved} onClose={onClose} />
    </>
  );
}

export function EditionPiece({
  produitId,
  onClose,
}: {
  /** Vide : on crée une pièce. */
  produitId?: string;
  onClose: () => void;
}) {
  const modifie = useRef(false);

  const fermer = useCallback(() => {
    onClose();
    if (modifie.current) window.dispatchEvent(new CustomEvent(CATALOGUE_MODIFIE));
  }, [onClose]);

  return (
    <Modal open onClose={fermer} title={produitId ? "Modifier la pièce" : "Nouvelle pièce"} wide>
      <AdminProvider>
        <Contenu
          produitId={produitId}
          onSaved={() => {
            modifie.current = true;
          }}
          onClose={fermer}
        />
      </AdminProvider>
    </Modal>
  );
}
