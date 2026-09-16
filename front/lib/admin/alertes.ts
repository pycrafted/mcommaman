/**
 * Le carillon du back-office : deux notes quand une commande arrive.
 *
 * Joué par le navigateur lui-même (Web Audio), sans fichier son à livrer.
 * Il peut rester muet tant que la page n'a reçu aucun clic — règle des
 * navigateurs — ; la cloche et le bandeau suffisent alors.
 */
export function jouerCarillon() {
  try {
    const Contexte =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexte) return;
    const audio = new Contexte();
    const notes = [880, 1318.5];
    notes.forEach((frequence, i) => {
      const debut = audio.currentTime + i * 0.18;
      const oscillateur = audio.createOscillator();
      const volume = audio.createGain();
      oscillateur.type = "sine";
      oscillateur.frequency.value = frequence;
      volume.gain.setValueAtTime(0.0001, debut);
      volume.gain.exponentialRampToValueAtTime(0.25, debut + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, debut + 0.45);
      oscillateur.connect(volume).connect(audio.destination);
      oscillateur.start(debut);
      oscillateur.stop(debut + 0.5);
    });
    window.setTimeout(() => void audio.close(), 1200);
  } catch {
    /* Le son n'est qu'un plus : la cloche suffit. */
  }
}
