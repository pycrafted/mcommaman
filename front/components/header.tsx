import { Dock } from "./dock";

/**
 * Ce que chaque page monte en haut de son arbre.
 *
 * Il n'y a plus de barre du haut : la navigation est le dock, collé en bas à
 * droite de l'écran (`components/dock.tsx`). Les pages continuent d'appeler
 * `<Header />`, c'est lui qui le pose.
 */
export function Header() {
  return <Dock />;
}
