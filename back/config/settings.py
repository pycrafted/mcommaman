"""
Configuration du serveur M comme Maman.

Rien n'est écrit en dur : tout ce qui change d'une machine à l'autre passe par
des variables d'environnement, lues dans le fichier `.env` en développement et
fournies par l'hébergeur en production. Le dépôt ne contient que `.env.example`.
"""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3000"]),
    EMAIL_BACKEND=(str, "django.core.mail.backends.console.EmailBackend"),
    DEFAULT_FROM_EMAIL=(str, "M comme Maman <bonjour@mcommaman.com>"),
    URL_VITRINE=(str, "http://localhost:3000"),
    URL_API=(str, "http://localhost:8000"),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# ---------------------------------------------------------------- applications

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Pour l'extension unaccent, dont dépend la recherche.
    "django.contrib.postgres",
    # Tiers
    "rest_framework",
    "corsheaders",
    # Métier
    "clientele",
    "catalogue",
    "ventes",
    "vitrine",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # Sert les fichiers statiques collectés (l'habillage de l'admin Django).
    # Juste après SecurityMiddleware, comme le demande sa documentation.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ------------------------------------------------------------------ base de données

# PostgreSQL, sans repli : une base de développement qui ne ressemble pas à la
# base de production finit toujours par masquer un problème.
DATABASES = {"default": env.db("DATABASE_URL")}

# Chaque requête HTTP est une transaction : une commande qui échoue à mi-course
# ne laisse ni ligne orpheline ni stock décrémenté pour rien.
DATABASES["default"]["ATOMIC_REQUESTS"] = True

# Sans délai, une base éteinte fait attendre les commandes de gestion jusqu'au
# temps mort du système. Trois secondes suffisent à savoir qu'elle ne répond pas.
DATABASES["default"].setdefault("OPTIONS", {})["connect_timeout"] = 3

# ------------------------------------------------------------------ identités

# Le modèle d'utilisateur est le nôtre dès le premier jour : en changer après la
# première migration coûte une reprise complète du schéma.
AUTH_USER_MODEL = "clientele.Utilisateur"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Argon2 en tête : c'est lui qui hachera les nouveaux mots de passe.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

# ------------------------------------------------------------------ API

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "config.pagination.Pagination",
    "PAGE_SIZE": 24,
    # Sans limite, un robot essaie mille mots de passe par minute sur une
    # adresse connue. Les deux portées sont posées sur les vues concernées.
    "DEFAULT_THROTTLE_RATES": {
        "connexion": "8/min",
        "inscription": "5/hour",
        # Une demande de réinitialisation envoie un courriel : sans limite,
        # on offre un moyen d'inonder une boîte qu'on ne possède pas.
        "oubli": "5/hour",
    },
}

# ---------------------------------------------------------------- courriel

# En développement, les messages s'écrivent dans la console : on lit le lien
# de réinitialisation sans dépendre d'un serveur d'envoi. En production, la
# variable pointe vers le vrai service.
EMAIL_BACKEND = env("EMAIL_BACKEND")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

# L'adresse publique de la vitrine, pour composer le lien du courriel. Le
# serveur ne la devine pas : il ne connaît que la sienne.
URL_VITRINE = env("URL_VITRINE")

# La sienne, justement : une image envoyée est rangée sur ce serveur, et la
# vitrine tourne ailleurs — son adresse doit être absolue pour y arriver.
URL_API = env("URL_API")

# La vitrine Next tourne sur un autre port : elle doit pouvoir appeler l'API et
# porter le cookie de session.
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# En développement, vitrine et serveur partagent `localhost` : deux ports d'un
# même site, un cookie « Lax » voyage sans problème. En ligne ils sont sur deux
# domaines distincts (Vercel d'un côté, Render de l'autre), et « Lax » ferait
# taire le cookie de session dès le premier appel du navigateur. « None » l'y
# autorise ; le navigateur ne l'accepte qu'accompagné de « Secure », donc
# jamais en développement où tout passe en clair.
if not DEBUG:
    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"

# Derrière le répartiteur de l'hébergeur, la requête arrive en HTTP même quand
# le visiteur est en HTTPS. Sans cet en-tête, Django se croit en clair et refuse
# de poser un cookie « Secure » — personne ne pourrait se connecter.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ------------------------------------------------------------------ localisation

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Dakar"
USE_I18N = True
USE_TZ = True

# ------------------------------------------------------------------ fichiers

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# WhiteNoise compresse et empreinte les fichiers collectés : le navigateur les
# garde en cache sans risquer de servir une version périmée après livraison.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# ------------------------------------------------- photothèque sur Cloudflare R2
#
# En ligne, un disque persistant (option payante de l'hébergeur) est monté sur
# `MEDIA_ROOT` : les visuels envoyés depuis le back-office survivent aux
# livraisons, et R2 n'est plus nécessaire à leur conservation. Il reste
# disponible comme option — un entrepôt d'objets derrière un CDN sert les
# images depuis un point proche de Dakar, là où le serveur, lui, est en Oregon.
# Sans le disque, tout ce qui est écrit dans `media/` disparaîtrait à la
# livraison suivante : c'est ce qu'il y avait avant, et ce qui a motivé R2.
#
# Les cinq variables vont ensemble : s'il en manque une, on retombe sur le
# disque local — le comportement de développement, où les fichiers déjà présents
# dans `back/media/` n'existent pas sur le bucket.

R2_ACCOUNT_ID = env("CLOUDFLARE_R2_ACCOUNT_ID", default="")
R2_ACCESS_KEY_ID = env("CLOUDFLARE_R2_ACCESS_KEY_ID", default="")
R2_SECRET_ACCESS_KEY = env("CLOUDFLARE_R2_SECRET_ACCESS_KEY", default="")
R2_BUCKET_NAME = env("CLOUDFLARE_R2_BUCKET", default="")
# Domaine public branché sur le bucket. L'adresse `pub-....r2.dev` convient pour
# démarrer ; un domaine personnalisé (media.mcommaman.com) est préférable en
# régime établi, celle de Cloudflare étant bridée en débit.
R2_PUBLIC_DOMAIN = env("CLOUDFLARE_R2_PUBLIC_DOMAIN", default="")

R2_ACTIF = all([
    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME, R2_PUBLIC_DOMAIN,
])

if R2_ACTIF:
    STORAGES["default"] = {"BACKEND": "config.stockage.R2MediaStorage"}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ------------------------------------------------------------------ métier

# Le franco de port et les frais par zone vivent ici, pas dans le code : ce sont
# des valeurs commerciales, la gérante doit pouvoir les changer sans livraison.
# Les Reglages en base les surchargent une fois la boutique installée.
FRANCO_DAKAR = 25_000
FRAIS_DAKAR = 2_000
FRAIS_REGIONS = 3_500
