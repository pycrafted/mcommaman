#!/usr/bin/env bash
# Ce que l'hébergeur lance à chaque livraison, avant de démarrer le serveur.
#
#   Build Command  : ./build.sh
#   Start Command  : gunicorn config.wsgi:application
#
# `set -o errexit` : si une étape échoue, la livraison échoue. Mieux vaut une
# mise en ligne refusée qu'un serveur qui démarre sur un schéma à moitié migré.
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

# L'habillage de l'admin Django, ramassé là où WhiteNoise ira le chercher.
python manage.py collectstatic --no-input

# Le schéma, mis au niveau du code qu'on livre.
python manage.py migrate
