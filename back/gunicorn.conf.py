"""
Réglages du serveur d'application en production.

Gunicorn lit ce fichier tout seul s'il s'appelle `gunicorn.conf.py` et se
trouve dans le répertoire courant. La commande de démarrage de l'hébergeur
tourne depuis `back/`, donc il est pris en compte sans rien régler dans le
tableau de bord — et le réglage voyage par git, au lieu de vivre dans une case
d'interface que personne ne pense à relire.

── Le délai ────────────────────────────────────────────────────────────────
Un worker synchrone lit lui-même le corps de la requête : tant qu'une image
monte, il ne « répond » pas, et gunicorn l'abat au bout de 30 secondes par
défaut. Une photo de plusieurs mégaoctets envoyée depuis une connexion
sénégalaise vers l'Oregon dépasse largement ce délai. Le navigateur signale
alors une erreur CORS trompeuse : la page 502 du répartiteur ne porte pas
d'en-tête `Access-Control-Allow-Origin`, et le vrai motif — le temps mort —
reste masqué par un faux.
"""

# Deux minutes : assez pour un envoi lent depuis le back-office, assez court
# pour qu'un worker réellement bloqué finisse par être recyclé.
timeout = 120

# Laisse une requête en cours se terminer pendant un redéploiement, plutôt que
# de couper l'envoi de la gérante en pleine mise en ligne.
graceful_timeout = 60

# ── Workers ─────────────────────────────────────────────────────────────────
# Des threads, pas des processus : attendre un envoi ou un aller-retour vers R2
# est du temps passé à ne rien faire, et un thread endormi ne coûte pas de
# processeur. Deux workers seulement — l'instance gratuite a 512 Mo, et un
# processus Django avec Pillow chargé en occupe 150 à 200.
worker_class = "gthread"
workers = 2
threads = 4

# Le traitement d'images fragmente la mémoire à la longue. Recycler les workers
# rend ce terrain ; le décalage évite qu'ils repartent tous en même temps.
max_requests = 300
max_requests_jitter = 60

# Sur la sortie standard : c'est là que l'hébergeur va chercher les journaux.
accesslog = "-"
errorlog = "-"


# ── Variantes web des photos déjà en ligne ──────────────────────────────────
# Lancé ici et non dans `build.sh` : le disque persistant n'est monté qu'au
# démarrage du service, jamais pendant la construction. La commande n'y
# trouvait donc aucune photo. Dans un processus à part, pour ne retarder ni
# bloquer aucun worker ; elle ne refait rien pour une photo déjà traitée.
def when_ready(server):
    import os
    import subprocess
    import sys

    subprocess.Popen(
        [sys.executable, "manage.py", "compresser_photheque"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )
