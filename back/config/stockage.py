"""
Stockage des visuels de la photothèque sur Cloudflare R2.

Pourquoi pas le disque de l'hébergeur : une instance Render sans disque
persistant reconstruit son système de fichiers à chaque livraison. Les images
envoyées depuis le back-office disparaîtraient au premier déploiement suivant.
R2 est un entrepôt d'objets — ce qui y est écrit y reste, et sort par le CDN
Cloudflare sans frais de bande passante.

Le basculement se fait dans `settings.STORAGES` :
    — R2 dès que les cinq variables CLOUDFLARE_R2_* sont renseignées ;
    — le disque local sinon, en développement.

R2 ne transforme rien : il rend le fichier tel qu'il a été envoyé. C'est
pourquoi la photothèque y range, à côté de l'original, trois variantes web
réduites — voir `catalogue/imaging.py`.
"""

from django.conf import settings
from storages.backends.s3 import S3Storage


class R2MediaStorage(S3Storage):
    """Photothèque : images envoyées depuis le back-office."""

    def __init__(self, **kwargs):
        super().__init__(
            bucket_name=settings.R2_BUCKET_NAME,
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            access_key=settings.R2_ACCESS_KEY_ID,
            secret_key=settings.R2_SECRET_ACCESS_KEY,
            # Le domaine public branché sur le bucket : c'est l'adresse que
            # voient les visiteurs, et celle que `Media.url` enregistre.
            custom_domain=settings.R2_PUBLIC_DOMAIN,
            # Bucket public par ce domaine : pas d'URL signée. Une adresse qui
            # expire ne peut pas être rangée en base ni mise en cache.
            querystring_auth=False,
            # R2 ignore les ACL S3 : les envoyer ferait échouer la requête.
            default_acl=None,
            # Deux fichiers homonymes ne doivent pas s'écraser. C'est aussi ce
            # qui rend une adresse d'image immuable, donc cachable un an.
            file_overwrite=False,
            region_name="auto",
            signature_version="s3v4",
            object_parameters={"CacheControl": "public, max-age=31536000, immutable"},
            **kwargs,
        )
