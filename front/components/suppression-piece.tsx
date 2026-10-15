"use client";

import { useCallback, useState } from "react";
import { envoyer } from "@/lib/api";
import { Button, Modal } from "./admin/ui";
import { IconTrash } from "./admin/icons";

/** Chargé au clic sur la poubelle, sans lire les référentiels du formulaire. */
export function SuppressionPiece({
  produitId,
  nom,
  onClose,
  onDeleted,
}: {
  produitId: string;
  nom: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const fermer = useCallback(() => {
    if (!enCours) onClose();
  }, [enCours, onClose]);

  const supprimer = async () => {
    if (enCours) return;
    setEnCours(true);
    setErreur("");
    try {
      await envoyer(`/api/gestion/produits/${produitId}/`, "DELETE");
      window.dispatchEvent(new CustomEvent("mcm:catalogue-modifie"));
      onDeleted();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La suppression a échoué. Réessayez.");
      setEnCours(false);
    }
  };

  return (
    <Modal open onClose={fermer} title="Supprimer cette pièce ?">
      <p className="text-sm leading-relaxed text-muted">
        La pièce « {nom} » sera supprimée du catalogue. Cette action est définitive.
      </p>
      {erreur && <p role="alert" className="mt-4 text-sm text-accent-deep">{erreur}</p>}
      <div className="mt-6 flex justify-end gap-2.5">
        <Button variant="ghost" disabled={enCours} onClick={fermer}>Annuler</Button>
        <Button variant="danger" disabled={enCours} onClick={() => void supprimer()}>
          <IconTrash className="h-4 w-4" />
          {enCours ? "Suppression…" : "Supprimer"}
        </Button>
      </div>
    </Modal>
  );
}
