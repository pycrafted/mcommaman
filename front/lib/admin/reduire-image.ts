/**
 * Réduit une photo AVANT de l'envoyer au serveur.
 *
 * Une photo de téléphone pèse 3 à 10 Mo. Le serveur n'en tire jamais plus de
 * 1600 px (voir `back/catalogue/imaging.py`) : transporter l'original depuis
 * une connexion mobile, c'est attendre pour rien, et risquer que l'envoi
 * dépasse le délai de la requête.
 *
 * `createImageBitmap(blob, { resizeWidth })` demande au décodeur de ne rendre
 * que la taille voulue, sans décoder toute l'image en mémoire. Un repli en
 * `<img>` + canvas existe pour les navigateurs qui refusent ces options.
 * La réduction est un confort : en cas d'échec, on envoie l'original.
 */

/** Grand côté conservé : le serveur n'en tire jamais plus de 1600. */
const MAX_COTE = 2400;

/** Au-delà, le fichier grossit sans que l'œil y gagne. */
const QUALITE = 0.85;

/** En dessous, l'image est déjà légère : la recompresser ne ferait que l'abîmer. */
const SEUIL_OCTETS = 600 * 1024;

/* Un PNG détouré deviendrait noir en JPEG : on ne touche qu'aux photos. */
const RECOMPRESSABLE = ["image/jpeg", "image/jpg", "image/webp"];

const echelle = (l: number, h: number) => Math.min(1, MAX_COTE / Math.max(l, h));

function dessiner(source: CanvasImageSource, largeur: number, hauteur: number) {
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  toile.getContext("2d")?.drawImage(source, 0, 0, largeur, hauteur);
  return toile;
}

function enFichier(toile: HTMLCanvasElement, nom: string): Promise<File | null> {
  const nomJpeg = nom.replace(/\.[^.]+$/, "") + ".jpg";
  return new Promise((resoudre) => {
    toile.toBlob(
      (blob) => resoudre(blob ? new File([blob], nomJpeg, { type: "image/jpeg" }) : null),
      "image/jpeg",
      QUALITE,
    );
  });
}

/* Repli : décodage complet puis canvas. Plus gourmand en mémoire. */
function parBalise(fichier: File): Promise<File | null> {
  return new Promise((resoudre) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const e = echelle(img.width, img.height);
      if (e >= 1) return resoudre(null);
      resoudre(await enFichier(dessiner(img, Math.round(img.width * e), Math.round(img.height * e)), fichier.name));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resoudre(null);
    };
    img.src = url;
  });
}

/** La version réduite, ou le fichier d'origine si la réduction n'a pas lieu d'être. */
export async function reduirePourEnvoi(fichier: File): Promise<File> {
  if (fichier.size <= SEUIL_OCTETS) return fichier;
  if (!RECOMPRESSABLE.includes(fichier.type.toLowerCase())) return fichier;

  let reduit: File | null = null;
  try {
    const sonde = await createImageBitmap(fichier);
    const { width, height } = sonde;
    sonde.close();

    const e = echelle(width, height);
    if (e >= 1) return fichier;

    const bitmap = await createImageBitmap(fichier, {
      resizeWidth: Math.round(width * e),
      resizeHeight: Math.round(height * e),
      resizeQuality: "high",
    });
    reduit = await enFichier(dessiner(bitmap, bitmap.width, bitmap.height), fichier.name);
    bitmap.close();
  } catch {
    try {
      reduit = await parBalise(fichier);
    } catch {
      reduit = null;
    }
  }

  // Une réduction qui alourdit le fichier n'en est pas une.
  return reduit && reduit.size < fichier.size ? reduit : fichier;
}
