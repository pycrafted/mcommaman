"""
Le catalogue : ce que la vitrine lit, ce que le back-office écrit.

Deux jeux de routes distincts, sous `/api/catalogue/` pour la vitrine et
`/api/gestion/` pour le back-office. Séparer les adresses évite qu'un oubli de
permission expose un champ de gestion à la boutique.
"""

from django.db import transaction
from django.db.models import Count, F, Prefetch, Q
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
    ProduitDetailVitrineSerializer,
    ProduitVitrineSerializer,
    RayonSerializer,
    TailleSerializer,
    VarianteSerializer,
)

TRIS = {
    "nouveautes": "-cree_le",
    "prix-croissant": "prix",
    "prix-decroissant": "-prix",
    "nom": "nom",
}


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
        contexte["campagnes"] = campagnes_automatiques()
        return contexte
    lookup_field = "slug"

    def get_queryset(self):
        selection = (
            Produit.objects.filter(statut=Produit.Statut.PUBLIE)
            .select_related("rayon")
            .prefetch_related(
                Prefetch("photos", queryset=PhotoProduit.objects.select_related("media").order_by("position")),
                Prefetch("variantes", queryset=Variante.objects.select_related("taille", "coloris")),
                "matieres",
            )
        )

        params = self.request.query_params

        # Par défaut, la grille de la boutique montre le vestiaire enfant : le
        # Coin Maman a sa propre entrée, et mélanger tissus et pyjamas
        # appliquerait des filtres d'âge à des coupons de tissu.
        #
        # Le filtre ne vaut que pour la liste. Une fiche doit rester atteignable
        # par son adresse quel que soit son univers, sinon un lien vers un
        # coupon de bazin renverrait « page introuvable ».
        # Une poignée de fiches désignées par leur identifiant : ce que la page
        # des favoris demande pour dessiner ses cartes. Elle traverse les deux
        # univers — on peut mettre de côté un pyjama et un coupon de bazin —,
        # d'où le filtre d'univers écarté dans ce cas.
        demandes = params.get("ids", "")
        voulus = [int(x) for x in demandes.split(",") if x.strip().isdigit()][:100]

        if self.action == "list" and not voulus:
            selection = selection.filter(rayon__univers=params.get("univers", "enfant"))
        elif voulus:
            selection = selection.filter(pk__in=voulus)

        # Choisir « Coin Maman » doit ramener ses tissus et ses voiles : on
        # filtre sur le rayon **et** ses sous-catégories. Le `distinct` compte :
        # une sous-catégorie rangée sous deux parentes ferait remonter ses
        # produits deux fois.
        if rayon := params.get("rayon"):
            selection = selection.filter(
                Q(rayon__slug=rayon) | Q(rayon__parents__slug=rayon)
            ).distinct()
        if taille := params.get("taille"):
            selection = selection.filter(variantes__taille__valeur=taille).distinct()

        if prix_min := params.get("prix_min"):
            selection = selection.filter(prix__gte=prix_min)
        if prix_max := params.get("prix_max"):
            selection = selection.filter(prix__lte=prix_max)

        # Les articles en promotion : ceux qui portent un prix barré, et ceux
        # qu'une campagne en cours remise. La seconde moitié ne s'exprime pas en
        # SQL — la portée d'une campagne se lit article par article —, d'où le
        # passage par les identifiants.
        if params.get("promo") == "1":
            from ventes.remises import campagnes_automatiques, remise_pour

            barres = Q(prix_barre__isnull=False, prix_barre__gt=F("prix"))
            campagnes = campagnes_automatiques()
            if campagnes:
                remises = [
                    produit.pk
                    for produit in selection.select_related("rayon")
                    if remise_pour(produit, campagnes)
                ]
                selection = selection.filter(barres | Q(pk__in=remises))
            else:
                selection = selection.filter(barres)

        if params.get("disponible") == "1":
            selection = selection.filter(variantes__stock__gt=0).distinct()

        if requete := params.get("q"):
            selection = filtrer(selection, requete)

        return selection.order_by(TRIS.get(params.get("tri", ""), "-cree_le"))

    def get_serializer_class(self):
        return ProduitDetailVitrineSerializer if self.action == "retrieve" else ProduitVitrineSerializer

    @action(detail=True, methods=["get"], url_path="similaires")
    def similaires(self, request, slug=None):
        """Du même rayon, hors la fiche courante. Quatre suffisent sous une fiche."""
        produit = self.get_object()
        voisins = (
            Produit.objects.filter(statut=Produit.Statut.PUBLIE, rayon=produit.rayon)
            .exclude(pk=produit.pk)
            .select_related("rayon")
            .prefetch_related("photos__media", "variantes__taille", "variantes__coloris")[:4]
        )
        return Response(ProduitVitrineSerializer(voisins, many=True).data)


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
    queryset = (
        Produit.objects.select_related("rayon")
        .prefetch_related("photos__media", "variantes__taille", "variantes__coloris", "matieres")
    )

    def get_queryset(self):
        selection = super().get_queryset()
        params = self.request.query_params
        if statut := params.get("statut"):
            selection = selection.filter(statut=statut)
        # Choisir « Coin Maman » doit ramener ses tissus et ses voiles : on
        # filtre sur le rayon **et** ses sous-catégories. Le `distinct` compte :
        # une sous-catégorie rangée sous deux parentes ferait remonter ses
        # produits deux fois.
        if rayon := params.get("rayon"):
            selection = selection.filter(
                Q(rayon__slug=rayon) | Q(rayon__parents__slug=rayon)
            ).distinct()
        if requete := params.get("q"):
            selection = selection.filter(
                Q(nom__unaccent__icontains=requete) | Q(sku__icontains=requete)
            )
        if params.get("stock_bas") == "1":
            from vitrine.models import Reglages
            seuil = Reglages.actuels().seuil_stock_bas
            selection = selection.annotate(
                disponibles=Count("variantes", filter=Q(variantes__stock__gt=0))
            ).filter(disponibles__lte=seuil)
        return selection.order_by("-modifie_le")

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
    serializer_class = RayonSerializer
    queryset = Rayon.objects.select_related("image").prefetch_related("parents", "enfants")

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
    queryset = Taille.objects.all()
    pagination_class = None


class ColorisViewSet(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = ColorisSerializer
    queryset = Coloris.objects.all()
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
