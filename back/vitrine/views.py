"""
Réglages de la boutique, bandeau d'accueil, journal.

La lecture est publique — la vitrine en a besoin à chaque page —, l'écriture est
réservée à la gérante : ce sont des décisions commerciales, pas des opérations
de préparation de commande.
"""

from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from clientele.permissions import EstEquipe, EstGerante

from .models import Bandeau, EntreeJournal, Reglages, Video
from .serializers import (
    BandeauSerializer,
    VideoAccueilSerializer,
    VideoSerializer,
    EntreeJournalSerializer,
    ReglagesPublicSerializer,
    ReglagesSerializer,
)


class ReglagesPublicView(APIView):
    """L'identité et les frais, tels que la boutique les affiche."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(ReglagesPublicSerializer(Reglages.actuels()).data)


class ReglagesGestionView(APIView):
    """Une seule ligne de réglages : pas de liste, pas de création."""

    permission_classes = [EstGerante]

    def get(self, request):
        return Response(ReglagesSerializer(Reglages.actuels()).data)

    def patch(self, request):
        serializer = ReglagesSerializer(Reglages.actuels(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        EntreeJournal.objects.create(
            auteur=request.user, nom_auteur=request.user.nom,
            action="a modifié", cible="les réglages de la boutique",
        )
        return Response(serializer.data)


class BandeauPublicViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Les photos actives du bandeau d'accueil.

    Vide, la vitrine retombe sur les trois photos livrées avec le site : la page
    d'accueil n'est jamais nue.
    """

    permission_classes = [AllowAny]
    serializer_class = BandeauSerializer
    pagination_class = None

    def get_queryset(self):
        return Bandeau.objects.filter(active=True).select_related("media", "produit_associe")


class BandeauGestionViewSet(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = BandeauSerializer
    queryset = Bandeau.objects.select_related("media", "produit_associe")
    pagination_class = None


class VideoAccueilViewSet(viewsets.ReadOnlyModelViewSet):
    """Les vidéos de l'accueil, dans l'ordre. Vide : la vitrine garde les siennes."""

    permission_classes = [AllowAny]
    serializer_class = VideoAccueilSerializer
    pagination_class = None

    def get_queryset(self):
        return Video.objects.filter(sur_accueil=True).select_related("produit")


class VideoGestionViewSet(viewsets.ModelViewSet):
    """La vidéothèque du back-office : envoi, choix pour l'accueil, ordre, retrait."""

    permission_classes = [EstEquipe]
    serializer_class = VideoSerializer
    queryset = Video.objects.select_related("produit")
    pagination_class = None


class JournalViewSet(viewsets.ReadOnlyModelViewSet):
    """Le journal ne se réécrit pas : c'est tout son intérêt."""

    permission_classes = [EstEquipe]
    serializer_class = EntreeJournalSerializer
    queryset = EntreeJournal.objects.all()
