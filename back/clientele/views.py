"""
Comptes et sessions.

La session est portée par un cookie signé, posé par Django et jamais lisible en
JavaScript. Le front n'a donc aucun jeton à ranger : il appelle avec
`credentials: "include"`, et le navigateur fait le reste.
"""

from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import ROLES_EQUIPE, Adresse, Favori
from .permissions import EstEquipe, EstProprietaire
from .serializers import (
    AdresseSerializer,
    DemandeReinitialisationSerializer,
    FavoriSerializer,
    ChangementMotDePasseSerializer,
    ConnexionSerializer,
    InscriptionSerializer,
    MembreEquipeSerializer,
    ReinitialisationSerializer,
    UtilisateurSerializer,
)


@method_decorator(ensure_csrf_cookie, name="get")
class JetonCsrfView(APIView):
    """
    Pose le cookie CSRF.

    Le front l'appelle une fois au chargement : sans ce cookie, toute écriture
    est refusée. C'est le prix des sessions par cookie, et il vaut la peine —
    un jeton rangé dans le stockage local se vole en une ligne de script.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"jetonCsrf": get_token(request)})


class InscriptionView(APIView):
    """Crée le compte et ouvre la session dans la foulée."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "inscription"

    def post(self, request):
        serializer = InscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()
        login(request, utilisateur)
        return Response(
            UtilisateurSerializer(utilisateur).data, status=status.HTTP_201_CREATED
        )


class ConnexionView(APIView):
    """
    Ouvre une session.

    Limitée par `throttle_scope` : sans cette limite, un robot essaie mille mots
    de passe par minute sur une adresse connue.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "connexion"

    def post(self, request):
        serializer = ConnexionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.validated_data["utilisateur"]
        login(request, utilisateur)
        return Response(UtilisateurSerializer(utilisateur).data)


class DeconnexionView(APIView):
    """Ferme la session. Django fait tourner la clé : l'ancien cookie ne vaut plus rien."""

    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MoiView(APIView):
    """
    Qui est connecté.

    Répond 200 avec `null` plutôt que 401 quand personne ne l'est : la vitrine
    interroge cette route à chaque chargement, une erreur dans la console à
    chaque visite anonyme n'apprendrait rien à personne.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"utilisateur": None})
        return Response({"utilisateur": UtilisateurSerializer(request.user).data})

    def patch(self, request):
        """Modifie le profil : nom, téléphone, ville, préférences."""
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        serializer = UtilisateurSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MotDePasseView(APIView):
    """Change le mot de passe sans fermer la session en cours."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "connexion"

    def post(self, request):
        serializer = ChangementMotDePasseSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()
        # Changer le mot de passe invalide la session : on la rouvre, sinon la
        # cliente est déconnectée pour avoir fait ce qu'on lui demandait.
        login(request, utilisateur)
        return Response({"detail": "Mot de passe modifié."})


class OubliMotDePasseView(APIView):
    """
    Demande un lien de réinitialisation.

    Répond toujours la même chose, adresse connue ou non. Une réponse qui
    diffère transforme ce formulaire en annuaire : on saurait qui a un compte
    ici rien qu'en essayant des adresses.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "oubli"

    def post(self, request):
        from django.conf import settings
        from django.contrib.auth import get_user_model
        from django.contrib.auth.tokens import default_token_generator
        from django.core.mail import send_mail
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        serializer = DemandeReinitialisationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        utilisateur = (
            get_user_model().objects.filter(email__iexact=email, is_active=True).first()
        )
        if utilisateur:
            lien = "{}/compte/mot-de-passe?uid={}&jeton={}".format(
                settings.URL_VITRINE.rstrip("/"),
                urlsafe_base64_encode(force_bytes(utilisateur.pk)),
                default_token_generator.make_token(utilisateur),
            )
            send_mail(
                subject="Réinitialiser votre mot de passe — M comme Maman",
                message=(
                    "Bonjour {},\n\n"
                    "Vous avez demandé à changer votre mot de passe. Suivez ce lien :\n\n"
                    "{}\n\n"
                    "Il ne sert qu'une fois et cesse de fonctionner dès que le mot de passe "
                    "change. Si vous n'avez rien demandé, ce message ne demande aucune "
                    "réponse : votre mot de passe reste celui que vous connaissez.\n\n"
                    "M comme Maman"
                ).format(utilisateur.nom or "", lien),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[utilisateur.email],
                fail_silently=True,
            )

        return Response({
            "detail": "Si un compte existe pour cette adresse, un lien vient d'y être envoyé."
        })


class ReinitialisationMotDePasseView(APIView):
    """Pose le nouveau mot de passe à partir du lien reçu."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "connexion"

    def post(self, request):
        serializer = ReinitialisationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # On n'ouvre pas la session au passage : rien ne prouve que la personne
        # devant l'écran est celle qui a reçu le courriel. Elle se connecte.
        return Response({"detail": "Mot de passe modifié. Vous pouvez vous connecter."})


class AdresseViewSet(viewsets.ModelViewSet):
    """
    Le carnet d'adresses.

    Chacune n'appartient qu'à sa cliente : la liste est filtrée à la source, et
    la permission d'objet couvre le cas d'un identifiant deviné.
    """

    serializer_class = AdresseSerializer
    permission_classes = [IsAuthenticated, EstProprietaire]

    def get_queryset(self):
        return Adresse.objects.filter(cliente=self.request.user)

    def perform_create(self, serializer):
        if serializer.validated_data.get("par_defaut"):
            self._effacer_defaut()
        serializer.save()

    def perform_update(self, serializer):
        if serializer.validated_data.get("par_defaut"):
            self._effacer_defaut(sauf=serializer.instance.pk)
        serializer.save()

    def _effacer_defaut(self, sauf=None):
        """
        Retire l'ancienne adresse par défaut **avant** d'écrire la nouvelle.

        PostgreSQL vérifie la contrainte d'unicité à chaque instruction : écrire
        d'abord puis nettoyer ferait échouer l'enregistrement, et comme chaque
        requête est une transaction, la cliente n'aurait rien de ce qu'elle
        demandait.
        """
        selection = Adresse.objects.filter(cliente=self.request.user, par_defaut=True)
        if sauf is not None:
            selection = selection.exclude(pk=sauf)
        selection.update(par_defaut=False)


class FavoriViewSet(viewsets.ModelViewSet):
    """
    Les articles mis de côté.

    Comme le panier, les favoris d'une visiteuse non connectée restent dans son
    navigateur : lui demander un compte pour cliquer sur un cœur ferait perdre
    le geste. Ils remontent ici à la connexion.
    """

    serializer_class = FavoriSerializer
    permission_classes = [IsAuthenticated, EstProprietaire]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Favori.objects.filter(cliente=self.request.user)
            .select_related("produit")
            .prefetch_related("produit__photos__media", "produit__variantes")
        )

    @action(detail=False, methods=["delete"], url_path=r"produit/(?P<produit_id>[^/.]+)")
    def retirer_par_produit(self, request, produit_id=None):
        """
        Retire par identifiant de produit.

        La vitrine connaît le produit, pas la ligne de favori : lui imposer de
        chercher l'identifiant du favori d'abord ferait deux appels au lieu d'un.
        """
        supprimes, _ = Favori.objects.filter(cliente=request.user, produit_id=produit_id).delete()
        if not supprimes:
            return Response({"detail": "Cet article n'est pas dans vos favoris."},
                            status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"])
    def fusionner(self, request):
        """
        Reprend les favoris gardés dans le navigateur avant la connexion.

        Rien n'est effacé : on ajoute ce qui manque. Une cliente qui se
        reconnecte sur un autre appareil ne doit pas perdre ce qu'elle avait.
        """
        identifiants = request.data.get("produits", [])
        if not isinstance(identifiants, list):
            return Response({"produits": ["Une liste d'identifiants est attendue."]},
                            status=status.HTTP_400_BAD_REQUEST)

        from catalogue.models import Produit
        publies = Produit.objects.filter(id__in=identifiants, statut=Produit.Statut.PUBLIE)
        for produit in publies:
            Favori.objects.get_or_create(cliente=request.user, produit=produit)

        return Response(self.get_serializer(self.get_queryset(), many=True).data)


class ClienteGestionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Les clientes, vues du back-office.

    Lecture seule : l'équipe consulte, elle ne modifie pas un compte à la place
    de sa titulaire. Les membres de l'équipe n'y figurent pas — ce sont des
    collègues, pas des clientes.
    """

    permission_classes = [EstEquipe]
    serializer_class = UtilisateurSerializer

    def get_queryset(self):
        from django.contrib.auth import get_user_model

        selection = get_user_model().objects.filter(role="cliente").prefetch_related("adresses")
        if requete := self.request.query_params.get("q"):
            from django.db.models import Q
            selection = selection.filter(
                Q(nom__unaccent__icontains=requete)
                | Q(email__icontains=requete)
                | Q(telephone__icontains=requete)
            )
        if ville := self.request.query_params.get("ville"):
            selection = selection.filter(ville=ville)
        return selection.order_by("-date_creation")


class EquipeGestionViewSet(viewsets.ModelViewSet):
    """
    Les comptes qui ouvrent le back-office.

    Toutes gérantes : la boutique ne distingue pas deux niveaux d'accès, et une
    gérante en fait entrer une autre. C'est un choix assumé, pour une équipe de
    quelques personnes qui se connaissent — ouvrir un compte revient à partager
    le sien. Le jour où il faudra des accès partiels, c'est un rôle de plus dans
    `ROLES_EQUIPE` et un champ de plus dans le sérialiseur.

    Pas de suppression : un compte se désactive. Effacer une identité emporte
    avec elle ce qu'elle a fait — qui a validé quelle commande, qui a publié
    quelle fiche —, et un compte revenu de congé se réactive d'un geste.
    """

    permission_classes = [EstEquipe]
    serializer_class = MembreEquipeSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        from django.contrib.auth import get_user_model

        selection = get_user_model().objects.filter(role__in=ROLES_EQUIPE)
        if requete := self.request.query_params.get("q"):
            from django.db.models import Q

            selection = selection.filter(
                Q(nom__unaccent__icontains=requete)
                | Q(email__icontains=requete)
                | Q(telephone__icontains=requete)
            )
        if role := self.request.query_params.get("role"):
            selection = selection.filter(role=role)
        return selection.order_by("-date_creation")

    def perform_update(self, serializer):
        """
        Le garde-fou qui compte : ne pas se fermer la porte soi-même.

        Se désactiver laisserait la personne dehors dès son prochain appel, et
        avec elle la boutique si elle est la dernière gérante. Le rôle, lui, ne
        se change plus par cette route — le sérialiseur le tient en lecture
        seule, il n'y a donc rien à garder de ce côté.
        """
        from rest_framework.exceptions import ValidationError

        membre = serializer.instance
        if membre == self.request.user and serializer.validated_data.get("is_active") is False:
            raise ValidationError(
                {"is_active": "Vous ne pouvez pas désactiver votre propre compte."}
            )
        serializer.save()
