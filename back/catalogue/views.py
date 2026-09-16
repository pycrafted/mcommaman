"""
Le catalogue : ce que la vitrine lit, ce que le back-office écrit.

Deux jeux de routes distincts, sous `/api/catalogue/` pour la vitrine et
`/api/gestion/` pour le back-office. Séparer les adresses évite qu'un oubli de
permission expose un champ de gestion à la boutique.
"""

from django.db import transaction
from django.db.models import Count, Exists, F, Max, Min, OuterRef, Prefetch, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from clientele.permissions import EstEquipe

from .models import (
    Coloris,
    Matiere,
    Media,
    MouvementStock,
    PhotoProduit,
    Produit,
    Rayon,
    Taille,
    Variante,
)
from .recherche import filtrer
from .serializers import (
    ColorisSerializer,
    MatiereSerializer,
    MediaSerializer,
    MouvementStockSerializer,
    PhotoProduitSerializer,
    ProduitAdminSerializer,
    ProduitCarteSerializer,
    ProduitDetailVitrineSerializer,
    ProduitGestionListeSerializer,
    RayonGestionSerializer,
    RayonSerializer,
    TailleSerializer,
    VarianteSerializer,
)

TRIS = {
    "nouveautes": "-cree_le",
    "prix-croissant": "prix_effectif",
    "prix-decroissant": "-prix_effectif",
    "nom": "nom",
}


def _liste(parametre: str) -> list[str]:
    """`a,b,,c` → `["a", "b", "c"]`."""
    return [x.strip() for x in parametre.split(",") if x.strip()]


def _image_principale():
    """L'adresse de la première photo, en sous-requête : une par liste, pas une par article."""
    return Subquery(
        PhotoProduit.objects.filter(produit=OuterRef("pk"))
        .order_by("position")
        .values("media__url")[:1]
    )


def _du_stock():
    return Exists(Variante.objects.filter(produit=OuterRef("pk"), stock__gt=0))


def _dans_le_rayon(selection, slug: str):
    """Les articles d'une catégorie et de ses sous-catégories, sans doublon."""
    rayons = Rayon.objects.filter(Q(slug=slug) | Q(parents__slug=slug)).values("pk")
    return selection.filter(rayon__in=rayons)


class CatalogueViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Le catalogue public.

    Seuls les produits publiés en sortent : un brouillon n'a aucune raison de
    franchir cette porte, même en connaissant son adresse.
    """

    permission_classes = [AllowAny]

    def get_serializer_context(self):
        """
        Les campagnes en cours, lues une seule fois par requête.

        Sans ça, chaque article de la liste les redemanderait à la base : cent
        fiches feraient cent requêtes pour la même réponse.
        """
        from ventes.remises import campagnes_automatiques

        contexte = super().get_serializer_context()
        if not hasattr(self, "_campagnes"):
            self._campagnes = campagnes_automatiques()
        contexte["campagnes"] = self._campagnes
        return contexte

    lookup_field = "slug"

    def _publies(self):
        return Produit.objects.filter(statut=Produit.Statut.PUBLIE).select_related("rayon")

    def get_queryset(self):
        from ventes.remises import annoter_prix_effectif

        if self.action == "retrieve":
            return self._publies().prefetch_related(
                Prefetch("photos", queryset=PhotoProduit.objects.select_related("media").order_by("position")),
                Prefetch("variantes", queryset=Variante.objects.select_related("taille", "coloris")),
                "matieres",
                "rayon__parents",
            )

        # Une liste ne lit que ce qu'une carte affiche : la photo et la
        # disponibilité en annotations, les parentes du rayon pour les remises.
        selection = (
            self._publies()
            .prefetch_related("rayon__parents")
            .annotate(image_url=_image_principale(), a_du_stock=_du_stock())
        )
        selection = annoter_prix_effectif(selection, self.get_serializer_context()["campagnes"])
        params = self.request.query_params

        # Une poignée de fiches désignées par leur identifiant : ce que la page
        # des favoris demande pour dessiner ses cartes.
        voulus = [int(x) for x in _liste(params.get("ids", "")) if x.isdigit()][:100]
        if voulus:
            return selection.filter(pk__in=voulus)

        return self.filtrer(selection, params).order_by(
            TRIS.get(params.get("tri", ""), "-cree_le"), "-pk"
        )

    @staticmethod
    def filtrer(selection, params, sans=()):
        """
        Les filtres de la boutique, tous appliqués en base.

        `sans` écarte des filtres : les facettes comptent une catégorie sans se
        restreindre elles-mêmes.
        """
        if univers := params.get("univers"):
            selection = selection.filter(rayon__univers=univers)
        # Choisir « Coin Maman » ramène ses tissus et ses voiles : le rayon et
        # ses sous-catégories.
        if rayon := params.get("rayon"):
            selection = _dans_le_rayon(selection, rayon)
        # Plusieurs sous-catégories cochées s'additionnent.
        if "sous" not in sans and (sous := _liste(params.get("sous", ""))):
            selection = selection.filter(rayon__slug__in=sous)
        # Une taille ne compte que si elle est encore en stock.
        if "taille" not in sans and (tailles := _liste(params.get("taille", ""))):
            selection = selection.filter(
                Exists(Variante.objects.filter(
                    produit=OuterRef("pk"), stock__gt=0, taille__valeur__in=tailles
                ))
            )
        # Le prix filtré est celui du jour, remise comprise.
        if "prix" not in sans:
            if (prix_min := params.get("prix_min", "")).isdigit():
                selection = selection.filter(prix_effectif__gte=int(prix_min))
            if (prix_max := params.get("prix_max", "")).isdigit():
                selection = selection.filter(prix_effectif__lte=int(prix_max))
        if params.get("promo") == "1":
            selection = selection.filter(
                Q(prix_effectif__lt=F("prix")) | Q(prix_barre__gt=F("prix"))
            )
        if params.get("disponible") == "1":
            selection = selection.filter(a_du_stock=True)
        if requete := params.get("q"):
            selection = filtrer(selection, requete)
        return selection

    def get_serializer_class(self):
        return ProduitDetailVitrineSerializer if self.action == "retrieve" else ProduitCarteSerializer

    @action(detail=False, methods=["get"], url_path="facettes")
    def facettes(self, request):
        """
        De quoi dessiner les filtres d'une catégorie, sans en charger les articles.

        Chaque facette se compte sans son propre filtre — cocher « 4 ans » ne
        doit pas faire disparaître « 6 ans » —, mais avec tous les autres.
        """
        from ventes.remises import annoter_prix_effectif

        params = request.query_params
        campagnes = self.get_serializer_context()["campagnes"]
        base = annoter_prix_effectif(
            self._publies().annotate(a_du_stock=_du_stock()), campagnes
        )

        selection = self.filtrer(base, params)
        pour_sous = self.filtrer(base, params, sans=("sous",))
        pour_tailles = self.filtrer(base, params, sans=("taille",))
        pour_prix = self.filtrer(base, params, sans=("prix",))

        bornes = pour_prix.aggregate(minimum=Min("prix_effectif"), maximum=Max("prix_effectif"))
        sous = (
            pour_sous.values("rayon__slug")
            .annotate(nombre=Count("pk"))
            .order_by()
        )
        tailles = (
            Variante.objects.filter(stock__gt=0, produit__in=pour_tailles.values("pk"))
            .values("taille__valeur", "taille__ordre")
            .annotate(nombre=Count("produit", distinct=True))
            .order_by("taille__ordre", "taille__valeur")
        )
        return Response({
            "total": selection.count(),
            "prix_min": bornes["minimum"] or 0,
            "prix_max": bornes["maximum"] or 0,
            "sous_categories": {ligne["rayon__slug"]: ligne["nombre"] for ligne in sous},
            "tailles": [
                {"valeur": ligne["taille__valeur"], "nombre": ligne["nombre"]} for ligne in tailles
            ],
        })

    @action(detail=True, methods=["get"], url_path="similaires")
    def similaires(self, request, slug=None):
        """Du même rayon, hors la fiche courante. Quatre suffisent sous une fiche."""
        produit = self.get_object()
        voisins = (
            self._publies()
            .filter(rayon=produit.rayon)
            .exclude(pk=produit.pk)
            .prefetch_related("rayon__parents")
            .annotate(image_url=_image_principale(), a_du_stock=_du_stock())
            .order_by("-cree_le")[:4]
        )
        return Response(
            ProduitCarteSerializer(voisins, many=True, context=self.get_serializer_context()).data
        )


class RayonPublicViewSet(viewsets.ReadOnlyModelViewSet):
    """Les rayons visibles, pour le menu et les filtres de la boutique."""

    permission_classes = [AllowAny]
    serializer_class = RayonSerializer
    lookup_field = "slug"
    pagination_class = None

    def get_queryset(self):
        selection = (
            Rayon.objects.filter(visible=True)
            .select_related("image")
            .prefetch_related(
                "parents",
                # Une sous-catégorie masquée depuis le back-office ne doit pas
                # reparaître dans les filtres de la boutique. Le filtre est posé
                # ici et non dans le sérialiseur : celui-ci sert aussi au
                # back-office, à qui il faut continuer de montrer ce qu'il a
                # masqué. Le décompte de fiches suit, puisqu'il lit la même
                # liste d'enfants.
                Prefetch(
                    "enfants",
                    queryset=Rayon.objects.filter(visible=True).select_related("image"),
                ),
            )
        )
        params = self.request.query_params
        if univers := params.get("univers"):
            selection = selection.filter(univers=univers)
        # Par défaut le menu ne veut que le premier niveau : les sous-catégories
        # viennent avec leur parente, dans `enfants`.
        if params.get("tous") != "1":
            selection = selection.filter(parents__isnull=True)
        return selection


class ReferentielsView(viewsets.ViewSet):
    """
    Le vocabulaire de la boutique en une seule réponse.

    La vitrine en a besoin au chargement des filtres : trois appels séparés pour
    trois listes de vingt lignes ne se justifient pas.
    """

    permission_classes = [AllowAny]

    def list(self, request):
        return Response({
            "tailles": TailleSerializer(Taille.objects.all(), many=True).data,
            "coloris": ColorisSerializer(Coloris.objects.all(), many=True).data,
            "matieres": MatiereSerializer(Matiere.objects.all(), many=True).data,
        })


# ------------------------------------------------------------------ back-office

class ProduitGestionViewSet(viewsets.ModelViewSet):
    """
    Les fiches vues du back-office : brouillons compris.

    Publier passe par l'action dédiée, qui refait le contrôle des cinq
    conditions — c'est ce garde-fou qui manquait quand « Safari enfant » est
    parti en ligne à 0 F.
    """

    permission_classes = [EstEquipe]
    serializer_class = ProduitAdminSerializer

    def get_serializer_class(self):
        # La liste n'emporte ni variantes ni galerie : la fiche les porte.
        return ProduitGestionListeSerializer if self.action == "list" else ProduitAdminSerializer

    def get_queryset(self):
        if self.action != "list":
            return Produit.objects.select_related("rayon").prefetch_related(
                "photos__media", "variantes__taille", "variantes__coloris", "matieres"
            )

        selection = (
            Produit.objects.select_related("rayon")
            .prefetch_related("matieres")
            .annotate(
                image_url=_image_principale(),
                stock_somme=Coalesce(Sum("variantes__stock"), 0),
            )
        )
        params = self.request.query_params
        if slugs := _liste(params.get("slug", "")):
            selection = selection.filter(slug__in=slugs)
        if skus := _liste(params.get("sku", "")):
            selection = selection.filter(sku__in=skus)
        if ids := [int(x) for x in _liste(params.get("ids", "")) if x.isdigit()]:
            selection = selection.filter(pk__in=ids)
        if statut := params.get("statut"):
            selection = selection.filter(statut=statut)
        # Un article publié qui n'a plus rien à vendre.
        if params.get("rupture") == "1":
            selection = selection.filter(statut=Produit.Statut.PUBLIE, stock_somme__lte=0)
        if rayon := params.get("rayon"):
            selection = _dans_le_rayon(selection, rayon)
        if requete := params.get("q"):
            selection = selection.filter(
                Q(nom__unaccent__icontains=requete)
                | Q(sku__icontains=requete)
                | Q(rayon__nom__unaccent__icontains=requete)
            )
        if params.get("stock_bas") == "1":
            from vitrine.models import Reglages
            seuil = Reglages.actuels().seuil_stock_bas
            selection = selection.filter(statut=Produit.Statut.PUBLIE, stock_somme__lte=seuil)
            return selection.order_by("stock_somme", "nom")
        # Par date de création : trier sur la modification ferait remonter la
        # fiche à chaque stock corrigé, et la liste bougerait pendant un inventaire.
        return selection.order_by("-cree_le", "-pk")

    @action(detail=False, methods=["get"])
    def disponibilite(self, request):
        """
        La première référence libre pour un nom, et si son adresse est déjà prise.

        L'éditeur de fiche proposait la référence en parcourant tout le
        catalogue chargé dans le navigateur ; le serveur la trouve seul.
        `exclure` écarte la fiche en cours de modification.
        """
        import re

        from django.utils.text import slugify

        nom = request.query_params.get("nom", "")
        exclure = request.query_params.get("exclure", "")
        autres = Produit.objects.all()
        if exclure.isdigit():
            autres = autres.exclude(pk=int(exclure))

        lettres = re.sub(r"[^A-Za-z]", "", slugify(nom)).upper()[:3] or "REF"
        lettres = lettres.ljust(3, "X")
        prises = set(
            autres.filter(sku__startswith=f"{lettres}-").values_list("sku", flat=True)
        )
        reference = next(
            (f"{lettres}-{n:04}" for n in range(1, 10_000) if f"{lettres}-{n:04}" not in prises),
            f"{lettres}-{Produit.objects.count() + 1}",
        )
        adresse = slugify(nom)
        return Response({
            "reference": reference,
            "slug": adresse,
            "slug_pris": bool(adresse) and autres.filter(slug=adresse).exists(),
        })

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        """Les chiffres des onglets et du tableau de bord, sans lire une seule fiche."""
        from vitrine.models import Reglages

        stocks = Produit.objects.annotate(stock_somme=Coalesce(Sum("variantes__stock"), 0))
        publies = stocks.filter(statut=Produit.Statut.PUBLIE)
        return Response({
            "tous": Produit.objects.count(),
            "publie": publies.count(),
            "brouillon": Produit.objects.filter(statut=Produit.Statut.BROUILLON).count(),
            "archive": Produit.objects.filter(statut=Produit.Statut.ARCHIVE).count(),
            "rupture": publies.filter(stock_somme__lte=0).count(),
            "stock_bas": publies.filter(stock_somme__lte=Reglages.actuels().seuil_stock_bas).count(),
        })

    @action(detail=True, methods=["post"])
    def publier(self, request, pk=None):
        produit = self.get_object()
        manques = produit.manque_pour_publier()
        if manques:
            return Response(
                {"detail": "Il manque encore : " + ", ".join(manques) + ".", "manques": manques},
                status=status.HTTP_400_BAD_REQUEST,
            )
        produit.statut = Produit.Statut.PUBLIE
        produit.save(update_fields=["statut", "modifie_le"])
        self._journaliser(request, "a publié", produit.nom)
        return Response(self.get_serializer(produit).data)

    @action(detail=True, methods=["post"])
    def archiver(self, request, pk=None):
        """
        On archive, on ne supprime pas.

        Une fiche supprimée emporterait l'historique des commandes qui la
        citent ; archivée, elle disparaît de la boutique et rien d'autre.
        """
        produit = self.get_object()
        produit.statut = Produit.Statut.ARCHIVE
        produit.save(update_fields=["statut", "modifie_le"])
        self._journaliser(request, "a archivé", produit.nom)
        return Response(self.get_serializer(produit).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def dupliquer(self, request, pk=None):
        """Copie la fiche et ses variantes, en brouillon, stock à zéro."""
        source = self.get_object()
        suffixe = Produit.objects.count() + 1
        copie = Produit.objects.create(
            nom=f"{source.nom} (copie)",
            slug=f"{source.slug}-copie-{suffixe}",
            sku=f"{source.sku}-C{suffixe}",
            prix=source.prix, prix_barre=source.prix_barre,
            description=source.description,
            rayon=source.rayon,
            statut=Produit.Statut.BROUILLON,
        )
        copie.matieres.set(source.matieres.all())
        for photo in source.photos.all():
            PhotoProduit.objects.create(produit=copie, media=photo.media, position=photo.position)
        for variante in source.variantes.all():
            Variante.objects.create(
                produit=copie, taille=variante.taille, coloris=variante.coloris,
                sku=f"{copie.sku}-{variante.taille.valeur}", stock=0,
            )
        self._journaliser(request, "a dupliqué", source.nom)
        return Response(self.get_serializer(copie).data, status=status.HTTP_201_CREATED)

    def _journaliser(self, request, action_faite, cible):
        from vitrine.models import EntreeJournal
        EntreeJournal.objects.create(
            auteur=request.user, nom_auteur=request.user.nom, action=action_faite, cible=cible
        )


class VarianteViewSet(viewsets.ModelViewSet):
    """
    Les variantes et leur stock.

    Toute correction de stock passe par `ajuster` : écrire directement dans le
    champ laisserait une variation sans trace, et une erreur de stock sans trace
    est impossible à expliquer.
    """

    permission_classes = [EstEquipe]
    serializer_class = VarianteSerializer
    queryset = Variante.objects.select_related("produit", "taille", "coloris")

    def get_queryset(self):
        selection = super().get_queryset()
        if produit := self.request.query_params.get("produit"):
            selection = selection.filter(produit_id=produit)
        return selection

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def ajuster(self, request, pk=None):
        variante = Variante.objects.select_for_update().get(pk=self.get_object().pk)
        try:
            quantite = int(request.data.get("quantite"))
        except (TypeError, ValueError):
            return Response({"quantite": ["Un nombre entier est attendu."]},
                            status=status.HTTP_400_BAD_REQUEST)

        motif = request.data.get("motif", MouvementStock.Motif.AJUSTEMENT)
        nouveau = variante.stock + quantite
        if nouveau < 0:
            return Response(
                {"detail": f"Stock insuffisant : il en reste {variante.stock}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        variante.stock = nouveau
        variante.save(update_fields=["stock"])
        MouvementStock.objects.create(
            variante=variante, quantite=quantite, motif=motif,
            reference=request.data.get("reference", ""), reste=nouveau, auteur=request.user,
        )
        return Response(self.get_serializer(variante).data)


class MouvementStockViewSet(viewsets.ReadOnlyModelViewSet):
    """Le journal des mouvements, en lecture seule : il ne se réécrit pas."""

    permission_classes = [EstEquipe]
    serializer_class = MouvementStockSerializer
    queryset = MouvementStock.objects.select_related("variante__produit", "auteur")

    def get_queryset(self):
        selection = super().get_queryset()
        if variante := self.request.query_params.get("variante"):
            selection = selection.filter(variante_id=variante)
        return selection


class PhotoProduitViewSet(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = PhotoProduitSerializer
    queryset = PhotoProduit.objects.select_related("media", "produit")


class RayonGestionViewSet(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = RayonGestionSerializer
    queryset = (
        Rayon.objects.select_related("image")
        .prefetch_related("parents", "enfants")
        .annotate(
            fiches=Count("produits", distinct=True),
            fiches_brouillons=Count(
                "produits", filter=Q(produits__statut=Produit.Statut.BROUILLON), distinct=True
            ),
        )
    )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """Supprime un rayon vide ou traite explicitement ses seuls brouillons."""
        from rest_framework.exceptions import ValidationError

        instance = self.get_object()
        if instance.enfants.exists():
            raise ValidationError(
                {"detail": "Cette catégorie contient des sous-catégories. Retirez-les d'abord."}
            )
        if instance.produits.filter(statut=Produit.Statut.PUBLIE).exists():
            raise ValidationError(
                {"detail": "Une catégorie contenant un produit publié ne peut pas être supprimée."}
            )

        brouillons = instance.produits.filter(statut=Produit.Statut.BROUILLON)
        mode = request.query_params.get("brouillons")
        if brouillons.exists():
            if mode == "supprimer":
                brouillons.delete()
            elif mode == "deplacer":
                destination_id = request.query_params.get("destination")
                try:
                    destination = Rayon.objects.exclude(pk=instance.pk).get(pk=destination_id)
                except (Rayon.DoesNotExist, ValueError, TypeError):
                    raise ValidationError({"detail": "Choisissez une catégorie de destination."})
                brouillons.update(rayon=destination)
            else:
                raise ValidationError(
                    {"detail": "Choisissez de déplacer ou de supprimer les produits en brouillon."}
                )

        # Les anciennes fiches archivées restent une trace et ne sont jamais
        # supprimées implicitement.
        if instance.produits.exists():
            raise ValidationError({"detail": "Cette catégorie contient encore des produits."})
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TailleViewSet(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = TailleSerializer
    # Combien de fiches s'en servent : on ne supprime pas à l'aveugle.
    queryset = Taille.objects.annotate(nombre_produits=Count("variantes__produit", distinct=True))
    pagination_class = None


class ColorisViewSet(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = ColorisSerializer
    queryset = Coloris.objects.annotate(nombre_produits=Count("variantes__produit", distinct=True))
    pagination_class = None


class MatiereViewSet(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = MatiereSerializer
    queryset = Matiere.objects.all()
    pagination_class = None

    def perform_destroy(self, instance):
        if instance.produits.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "Cette matière est utilisée par une ou plusieurs fiches."})
        instance.delete()


class MediaViewSet(viewsets.ModelViewSet):
    """La photothèque. Une image en service ne se supprime pas."""

    permission_classes = [EstEquipe]
    serializer_class = MediaSerializer
    queryset = Media.objects.all()

    def perform_destroy(self, instance):
        usages = (
            instance.utilisations.count()
            + instance.rayons_illustres.count()
            + instance.bandeaux.count()
        )
        if usages:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"detail": f"Cette image est utilisée à {usages} endroit(s). Retirez-la d'abord."}
            )
        instance.delete()
