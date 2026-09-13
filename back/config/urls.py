"""
Point d'entrée du serveur.

Tout ce qui est API vit sous `/api/`. L'admin Django reste à part : il sert
l'équipe technique, pas la gérante — elle, elle a le back-office de la vitrine.
"""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/compte/", include("clientele.urls")),
    path("api/gestion/", include("clientele.urls_gestion")),
    path("api/", include("catalogue.urls")),
    path("api/", include("vitrine.urls")),
    path("api/", include("ventes.urls")),
]

# Les images envoyées depuis le back-office sont servies par Django, en
# développement comme en production. Ce n'est pas ce qu'on fait de mieux — un
# serveur de fichiers ou un CDN irait plus vite — mais la boutique n'en a que
# quelques centaines et cela évite un service de plus à installer.
#
# À savoir : `media/` ne survit aux livraisons que parce qu'un disque persistant
# de l'hébergeur y est monté (point de montage = `MEDIA_ROOT`). Si ce disque
# est détaché, ou monté ailleurs, le dossier est reconstruit à chaque livraison
# et les visuels du back-office disparaissent — brancher R2 avant, dans ce cas.
urlpatterns += [
    re_path(
        rf"^{settings.MEDIA_URL.lstrip('/')}(?P<path>.*)$",
        serve,
        {"document_root": settings.MEDIA_ROOT},
    ),
]

admin.site.site_header = "M comme Maman — administration technique"
admin.site.site_title = "M comme Maman"
admin.site.index_title = "Données de la boutique"
