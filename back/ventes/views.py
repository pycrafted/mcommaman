"""
Les commandes.

Le paiement en ligne n'existe pas encore : une commande naît « en attente », et
c'est la gérante qui la fait avancer. Sur Dakar, le paiement à la livraison
suffit à ouvrir la boutique.
"""

from django.db import transaction
from django.db.models import Prefetch
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalogue.models import MouvementStock, Variante
from clientele.permissions import EstEquipe, EstGerante
from vitrine.models import EntreeJournal

from .models import Avis, Campagne, Commande, LigneCommande
from .serializers import (
    CampagnePubliqueSerializer,
    CampagneSerializer,
    CommandeGestionSerializer,
    CommandeSerializer,
    CreationCommandeSerializer,
    DevisSerializer,
)
from .tarification import ErreurTarification, chiffrer, prochaine_reference


def _rendre_le_stock(commande, auteur=None):
    """
    Remet en stock ce qu'une commande annulée avait retiré.

    Sans ce retour, chaque annulation ferait disparaître des articles du stock
    sans que personne ne comprenne pourquoi. Partagé par l'annulation de la
    gérante et par celle de la cliente : deux chemins, une seule règle.
    """
    for ligne in commande.lignes.select_related("variante"):
        if not ligne.variante:
            continue
        variante = Variante.objects.select_for_update().get(pk=ligne.variante.pk)
        variante.stock += ligne.quantite
        variante.save(update_fields=["stock"])
        MouvementStock.objects.create(
            variante=variante, quantite=ligne.quantite,
            motif=MouvementStock.Motif.ANNULATION,
            reference=commande.reference, reste=variante.stock, auteur=auteur,
        )


def _variantes_verrouillees(lignes_demandees):
    """
    Relit les variantes en les verrouillant.

    Deux commandes simultanées sur le dernier article liraient le même stock et
    le décrémenteraient deux fois. `select_for_update` fait attendre la seconde
    jusqu'à ce que la première ait fini.
    """
    identifiants = [ligne["variante"].pk for ligne in lignes_demandees]
    # `of=("self",)` verrouille la seule table des variantes. Sans lui,
    # PostgreSQL refuse : le coloris est facultatif, donc joint en externe, et
    # on ne verrouille pas le côté nullable d'une jointure externe.
    verrouillees = {
        variante.pk: variante
        for variante in Variante.objects.select_for_update(of=("self",))
        .select_related("produit", "taille", "coloris")
        .filter(pk__in=identifiants)
    }
    return [(verrouillees[ligne["variante"].pk], ligne["quantite"]) for ligne in lignes_demandees]


class DevisView(APIView):
    """
    Chiffre un panier sans rien enregistrer.

    Le tunnel l'appelle à chaque changement de zone ou de code : c'est le
    serveur qui annonce le prix, pas le navigateur qui le devine.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        # Pas de `partial=True` : il rendait facultatifs jusqu'aux champs des
        # lignes, si bien qu'un panier sans article passait la validation et
        # échouait ensuite en erreur serveur. Les champs vraiment facultatifs
        # sont désignés un par un.
        serializer = CreationCommandeSerializer(data=request.data)
        # Le devis n'a pas besoin de l'adresse complète : seule la zone compte.
        serializer.fields["nom_client"].required = False
        serializer.fields["telephone"].required = False
        serializer.fields["ville"].required = False
        serializer.fields["adresse"].required = False
        serializer.fields["moyen_paiement"].required = False
        serializer.is_valid(raise_exception=True)

        lignes = [(l["variante"], l["quantite"]) for l in serializer.validated_data["lignes"]]
        try:
            devis = chiffrer(
                lignes,
                zone=serializer.validated_data.get("zone", "dakar"),
                code_promo=serializer.validated_data.get("code_promo", ""),
                cliente=request.user,
            )
        except ErreurTarification as erreur:
            return Response({"detail": str(erreur)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(DevisSerializer(devis).data)


class CommandeViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Les commandes de la cliente.

    On crée, on lit — jamais on ne modifie ni ne supprime : une commande est un
    fait, pas un brouillon.

    La consultation par référence reste ouverte aux commandes passées sans
    compte : la référence seule ne suffit pas, il faut aussi le téléphone.
    """

    permission_classes = [AllowAny]
    serializer_class = CommandeSerializer
    lookup_field = "reference"

    def get_queryset(self):
        selection = Commande.objects.prefetch_related(
            Prefetch("lignes", queryset=LigneCommande.objects.all())
        )
        if self.action == "list":
            if not self.request.user.is_authenticated:
                return selection.none()
            return selection.filter(cliente=self.request.user)
        return selection

    def retrieve(self, request, reference=None):
        commande = self.get_object()

        if request.user.is_authenticated and commande.cliente_id == request.user.id:
            return Response(self.get_serializer(commande).data)

        # Suivi d'une commande passée sans compte : référence + téléphone. La
        # référence seule circule sur un ticket, elle ne prouve rien.
        telephone = request.query_params.get("telephone", "").replace(" ", "")
        if telephone and telephone == commande.telephone.replace(" ", ""):
            return Response(self.get_serializer(commande).data)

        return Response(
            {"detail": "Indiquez le téléphone utilisé lors de la commande."},
            status=status.HTTP_403_FORBIDDEN,
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def annuler(self, request, reference=None):
        """
        L'annulation par la cliente elle-même.

        Tant que la boutique n'a rien préparé, se raviser doit rester possible
        sans passer par un coup de téléphone. Dès la préparation lancée, non :
        les articles sont sortis, l'annulation appartient alors à la gérante.

        La commande doit être la sienne. Passée sans compte, la référence seule
        ne prouve rien — le téléphone est demandé, comme pour la consulter.
        """
        commande = self.get_object()

        sienne = request.user.is_authenticated and commande.cliente_id == request.user.id
        if not sienne:
            telephone = request.data.get("telephone", "").replace(" ", "")
            if not telephone or telephone != commande.telephone.replace(" ", ""):
                return Response(
                    {"detail": "Indiquez le téléphone utilisé lors de la commande."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if commande.statut == Commande.Statut.ANNULEE:
            return Response({"detail": "Cette commande est déjà annulée."},
                            status=status.HTTP_400_BAD_REQUEST)
        if commande.statut != Commande.Statut.EN_ATTENTE:
            return Response(
                {"detail": "Cette commande est déjà en préparation : appelez-nous pour l'annuler."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _rendre_le_stock(commande)
        commande.statut = Commande.Statut.ANNULEE
        commande.save(update_fields=["statut", "modifiee_le"])
        EntreeJournal.objects.create(
            auteur=request.user if request.user.is_authenticated else None,
            nom_auteur=commande.nom_client,
            action="a annulé sa commande", cible=commande.reference,
        )
        return Response(self.get_serializer(commande).data)

    @transaction.atomic
    def create(self, request):
        """
        Enregistre la commande.

        Trois choses s'y jouent en une seule transaction : le prix est refait,
        le stock est décrémenté, et la commande est écrite. Si l'une échoue, les
        trois sont annulées — jamais de stock retiré pour une commande absente.
        """
        serializer = CreationCommandeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        donnees = serializer.validated_data

        lignes = _variantes_verrouillees(donnees["lignes"])
        try:
            devis = chiffrer(
                lignes,
                zone=donnees["zone"],
                code_promo=donnees.get("code_promo", ""),
                cliente=request.user,
            )
        except ErreurTarification as erreur:
            return Response({"detail": str(erreur)}, status=status.HTTP_400_BAD_REQUEST)

        commande = Commande.objects.create(
            reference=prochaine_reference(),
            cliente=request.user if request.user.is_authenticated else None,
            nom_client=donnees["nom_client"],
            telephone=donnees["telephone"],
            email=donnees.get("email", ""),
            zone=donnees["zone"],
            ville=donnees["ville"],
            adresse=donnees["adresse"],
            notes=donnees.get("notes", ""),
            sous_total=devis.sous_total,
            frais_livraison=devis.frais_livraison,
            remise=devis.remise,
            code_promo=devis.code_promo,
            total=devis.total,
            moyen_paiement=donnees["moyen_paiement"],
            statut=Commande.Statut.EN_ATTENTE,
        )

        for ligne in devis.lignes:
            variante = ligne.variante
            photo = variante.produit.photo_principale
            LigneCommande.objects.create(
                commande=commande,
                variante=variante,
                nom_produit=variante.produit.nom,
                slug_produit=variante.produit.slug,
                url_image=photo.media.url if photo else "",
                libelle_option=variante.libelle_option,
                prix_unitaire=ligne.prix_unitaire,
                quantite=ligne.quantite,
            )
            variante.stock -= ligne.quantite
            variante.save(update_fields=["stock"])
            MouvementStock.objects.create(
                variante=variante,
                quantite=-ligne.quantite,
                motif=MouvementStock.Motif.VENTE,
                reference=commande.reference,
                reste=variante.stock,
            )

        # Le panier serveur a fait son office.
        if request.user.is_authenticated and hasattr(request.user, "panier"):
            request.user.panier.lignes.all().delete()

        return Response(
            CommandeSerializer(commande).data, status=status.HTTP_201_CREATED
        )


class CommandeGestionViewSet(viewsets.ReadOnlyModelViewSet):
    """Les commandes vues de la boutique, et leur avancement."""

    permission_classes = [EstEquipe]
    serializer_class = CommandeGestionSerializer
    lookup_field = "reference"
    queryset = Commande.objects.select_related("cliente").prefetch_related("lignes")

    def get_queryset(self):
        selection = super().get_queryset()
        params = self.request.query_params
        if statut := params.get("statut"):
            selection = selection.filter(statut=statut)
        if zone := params.get("zone"):
            selection = selection.filter(zone=zone)
        if requete := params.get("q"):
            from django.db.models import Q
            selection = selection.filter(
                Q(reference__icontains=requete)
                | Q(nom_client__unaccent__icontains=requete)
                | Q(telephone__icontains=requete)
            )
        return selection

    @action(detail=True, methods=["post"])
    def avancer(self, request, reference=None):
        """
        Fait passer la commande à l'étape suivante.

        L'ordre est imposé : on ne saute pas la préparation pour expédier. Une
        commande livrée ou annulée ne bouge plus.
        """
        commande = self.get_object()
        etapes = [
            Commande.Statut.EN_ATTENTE, Commande.Statut.PAYEE,
            Commande.Statut.PREPARATION, Commande.Statut.EXPEDIEE, Commande.Statut.LIVREE,
        ]
        if commande.statut not in etapes:
            return Response(
                {"detail": "Cette commande est annulée : elle ne peut plus avancer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        position = etapes.index(commande.statut)
        if position == len(etapes) - 1:
            return Response(
                {"detail": "Cette commande est déjà livrée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        commande.statut = etapes[position + 1]
        commande.save(update_fields=["statut", "modifiee_le"])
        EntreeJournal.objects.create(
            auteur=request.user, nom_auteur=request.user.nom,
            action=f"a passé en « {commande.get_statut_display()} »", cible=commande.reference,
        )
        return Response(self.get_serializer(commande).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def annuler(self, request, reference=None):
        """Annule la commande et remet le stock, à n'importe quelle étape."""
        commande = self.get_object()
        if commande.statut == Commande.Statut.ANNULEE:
            return Response({"detail": "Cette commande est déjà annulée."},
                            status=status.HTTP_400_BAD_REQUEST)
        if commande.statut == Commande.Statut.LIVREE:
            return Response({"detail": "Une commande livrée ne s'annule pas : passez par un retour."},
                            status=status.HTTP_400_BAD_REQUEST)

        _rendre_le_stock(commande, auteur=request.user)

        commande.statut = Commande.Statut.ANNULEE
        commande.save(update_fields=["statut", "modifiee_le"])
        EntreeJournal.objects.create(
            auteur=request.user, nom_auteur=request.user.nom,
            action="a annulé", cible=commande.reference,
        )
        return Response(self.get_serializer(commande).data)


class MesCommandesView(APIView):
    """Le raccourci de l'espace cliente : ses commandes, les plus récentes d'abord."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        commandes = (
            Commande.objects.filter(cliente=request.user).prefetch_related("lignes")
        )
        return Response(CommandeSerializer(commandes, many=True).data)


class CampagnePubliqueViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Les campagnes que la boutique annonce.

    Seulement celles qui courent aujourd'hui, et jamais les campagnes de
    commande à condition cachée : le bandeau d'accueil et le compte à rebours
    lisent ici. Sans cette porte, la vitrine ne connaissait des remises que ce
    que le prix des fiches en laissait deviner — c'est-à-dire rien des codes,
    qui ne s'appliquent pas d'eux-mêmes.

    La fenêtre se calcule en Python : `date_fin` se déduit de la durée, il n'y
    a pas de colonne à comparer en base.
    """

    permission_classes = [AllowAny]
    serializer_class = CampagnePubliqueSerializer
    pagination_class = None

    def get_queryset(self):
        candidates = Campagne.objects.filter(active=True).select_related("rayon", "produit")
        return candidates.filter(pk__in=[c.pk for c in candidates if c.en_cours])


class CampagneViewSet(viewsets.ModelViewSet):
    """Les campagnes de remise. Seule la gérante y touche : c'est de l'argent."""

    permission_classes = [EstGerante]
    serializer_class = CampagneSerializer
    queryset = Campagne.objects.select_related("rayon", "produit")


def _agregat(selection):
    """
    Le résumé d'un jeu d'avis publiés : combien, quelle moyenne, quelle
    répartition. La répartition sert la barre par note affichée sous la fiche.
    """
    from django.db.models import Avg, Count

    publies = selection.filter(etat=Avis.Etat.PUBLIE)
    resume = publies.aggregate(nombre=Count("id"), moyenne=Avg("note"))
    repartition = {str(note): 0 for note in range(1, 6)}
    for ligne in publies.values("note").annotate(total=Count("id")):
        repartition[str(ligne["note"])] = ligne["total"]
    return {
        "nombre": resume["nombre"] or 0,
        "moyenne": round(resume["moyenne"] or 0, 2),
        "repartition": repartition,
    }


class AvisViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Les avis.

    Lecture ouverte à tous, mais seulement sur les avis publiés : un avis en
    attente de modération n'est visible que de son autrice. Écriture réservée à
    qui a reçu sa commande.
    """

    permission_classes = [AllowAny]

    def get_queryset(self):
        selection = Avis.objects.select_related("auteur", "produit")
        if self.action in {"update", "partial_update", "destroy"}:
            # On ne modifie que le sien, et seulement si on est connectée.
            if not self.request.user.is_authenticated:
                return selection.none()
            return selection.filter(auteur=self.request.user)

        # Publiés pour tout le monde ; plus les siens, quel que soit leur état,
        # pour l'autrice connectée. Sans ça, un avis déposé disparaît sous les
        # yeux de qui vient de l'écrire, et un avis refusé reste invisible alors
        # qu'il occupe la place — un seul avis par achat — et empêche d'en
        # écrire un autre.
        if self.request.user.is_authenticated:
            from django.db.models import Q

            selection = selection.filter(
                Q(etat=Avis.Etat.PUBLIE) | Q(auteur=self.request.user)
            )
        else:
            selection = selection.filter(etat=Avis.Etat.PUBLIE)

        if produit := self.request.query_params.get("produit"):
            selection = selection.filter(produit_id=produit)
        elif self.request.query_params.get("boutique") == "1":
            # Les avis sur la boutique dans son ensemble.
            selection = selection.filter(produit__isnull=True)
        return selection

    def get_serializer_class(self):
        from .serializers import AvisSerializer, CreationAvisSerializer
        return CreationAvisSerializer if self.action == "create" else AvisSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "a_noter"}:
            return [IsAuthenticated()]
        return [AllowAny()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        avis = serializer.save()
        from .serializers import AvisSerializer
        return Response(
            {
                # Le contexte porte la requête : sans lui, l'avis qu'on vient
                # d'écrire reviendrait marqué comme n'étant pas le sien.
                **AvisSerializer(avis, context=self.get_serializer_context()).data,
                "detail": "Merci. Votre avis paraîtra après relecture.",
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"])
    def resume(self, request):
        """Le compteur et la moyenne, pour la fiche produit ou la page d'avis."""
        return Response(_agregat(self.get_queryset()))

    @action(detail=False, methods=["get"], url_path="a-noter")
    def a_noter(self, request):
        """
        Ce que la cliente peut encore noter.

        Ses commandes livrées, moins ce qu'elle a déjà noté. C'est cette liste
        qui alimente l'invitation « donnez votre avis » de l'espace client.
        """
        livrees = (
            Commande.objects.filter(cliente=request.user, statut=Commande.Statut.LIVREE)
            .prefetch_related("lignes__variante__produit")
        )
        deja = set(
            Avis.objects.filter(auteur=request.user).values_list("commande_id", "produit_id")
        )

        attendus = []
        for commande in livrees:
            for ligne in commande.lignes.all():
                produit = ligne.variante.produit if ligne.variante else None
                if produit is None or (commande.id, produit.id) in deja:
                    continue
                attendus.append({
                    # L'identifiant sert à déposer l'avis, la référence à le
                    # dire à la cliente. Ne rendre que la seconde obligeait la
                    # vitrine à deviner la première.
                    "commande": commande.id,
                    "commande_reference": commande.reference,
                    "livree_le": commande.modifiee_le,
                    "produit": produit.id,
                    "nom_produit": ligne.nom_produit,
                    "slug_produit": ligne.slug_produit,
                    "image": ligne.url_image,
                })
            # L'avis sur la boutique : une fois par commande livrée.
            if (commande.id, None) not in deja:
                attendus.append({
                    "commande": commande.id,
                    "commande_reference": commande.reference,
                    "livree_le": commande.modifiee_le,
                    "produit": None,
                    "nom_produit": "La boutique",
                    "slug_produit": "",
                    "image": "",
                })
        return Response(attendus)


class AvisGestionViewSet(viewsets.ReadOnlyModelViewSet):
    """La modération. Un avis ne paraît pas tant qu'il n'est pas approuvé."""

    permission_classes = [EstEquipe]
    queryset = Avis.objects.select_related("auteur", "produit", "commande")

    def get_serializer_class(self):
        from .serializers import AvisSerializer
        return AvisSerializer

    def get_queryset(self):
        selection = super().get_queryset()
        if etat := self.request.query_params.get("etat"):
            selection = selection.filter(etat=etat)
        return selection

    @action(detail=True, methods=["post"])
    def publier(self, request, pk=None):
        from django.utils import timezone
        avis = self.get_object()
        avis.etat = Avis.Etat.PUBLIE
        avis.modere_le = timezone.now()
        avis.save(update_fields=["etat", "modere_le"])
        return Response(self.get_serializer(avis).data)

    @action(detail=True, methods=["post"])
    def refuser(self, request, pk=None):
        from django.utils import timezone
        avis = self.get_object()
        avis.etat = Avis.Etat.REFUSE
        avis.modere_le = timezone.now()
        avis.save(update_fields=["etat", "modere_le"])
        return Response(self.get_serializer(avis).data)
