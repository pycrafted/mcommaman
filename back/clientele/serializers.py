"""
Ce qui entre et ce qui sort des routes de compte.

Une règle tenue partout : le mot de passe entre, il ne ressort jamais. Aucun
sérialiseur de sortie n'expose `password`, et `Utilisateur` n'a de toute façon
que son empreinte.
"""

from django.contrib.auth import authenticate, get_user_model, password_validation
from django.core.exceptions import ValidationError as ErreurDjango
from rest_framework import serializers

from .models import Adresse, Favori

Utilisateur = get_user_model()


class AdresseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Adresse
        fields = ["id", "libelle", "zone", "ville", "adresse", "notes", "par_defaut"]

    def create(self, validated_data):
        cliente = self.context["request"].user
        # La première adresse enregistrée devient la principale : sans ça, la
        # cliente devrait cocher une case dont elle ne comprend pas l'utilité.
        if not cliente.adresses.exists():
            validated_data["par_defaut"] = True
        return Adresse.objects.create(cliente=cliente, **validated_data)


class UtilisateurSerializer(serializers.ModelSerializer):
    """Ce que le front connaît d'une personne connectée."""

    adresses = AdresseSerializer(many=True, read_only=True)
    est_equipe = serializers.BooleanField(read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id", "email", "nom", "telephone", "ville", "role", "est_equipe",
            "tailles_suivies", "date_creation", "adresses",
        ]
        read_only_fields = ["id", "email", "role", "est_equipe", "date_creation"]


class InscriptionSerializer(serializers.ModelSerializer):
    mot_de_passe = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = Utilisateur
        fields = ["email", "nom", "telephone", "ville", "mot_de_passe"]

    def validate_email(self, valeur):
        courriel = valeur.strip().lower()
        if Utilisateur.objects.filter(email__iexact=courriel).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse.")
        return courriel

    def validate_mot_de_passe(self, valeur):
        # Les règles de Django : longueur, mot trop courant, tout en chiffres.
        try:
            password_validation.validate_password(valeur)
        except ErreurDjango as erreur:
            raise serializers.ValidationError(list(erreur.messages))
        return valeur

    def create(self, validated_data):
        mot_de_passe = validated_data.pop("mot_de_passe")
        # Le rôle n'est jamais pris dans la requête : on ne se déclare pas gérante.
        return Utilisateur.objects.create_user(password=mot_de_passe, **validated_data)


class MembreEquipeSerializer(serializers.ModelSerializer):
    """
    Un compte du back-office, vu et ouvert depuis le back-office lui-même.

    Tous sont gérantes : la boutique ne distingue pas deux niveaux d'accès. Le
    rôle sort donc de la route mais n'y entre pas — il n'y a rien à choisir, et
    rien à changer après coup.

    Le mot de passe entre, il ne ressort pas — la règle du fichier vaut ici
    aussi. Il est obligatoire à l'ouverture du compte ; à la modification, un
    champ laissé vide garde celui en place, ce qui évite d'avoir à en inventer
    un nouveau pour corriger une faute dans un nom.
    """

    mot_de_passe = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = Utilisateur
        fields = [
            "id", "email", "nom", "telephone", "role",
            "is_active", "date_creation", "mot_de_passe",
        ]
        read_only_fields = ["id", "role", "date_creation"]
        # Sans cela, le validateur d'unicité posé d'office par DRF répond avant
        # `validate_email` et sort le message brut de Django. On le retire pour
        # garder la phrase écrite ici — et la comparaison sans égard à la casse.
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, valeur):
        courriel = valeur.strip().lower()
        occupe = Utilisateur.objects.filter(email__iexact=courriel)
        # A la modification, sa propre adresse ne se compte pas comme un doublon.
        if self.instance:
            occupe = occupe.exclude(pk=self.instance.pk)
        if occupe.exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse.")
        return courriel

    def validate_mot_de_passe(self, valeur):
        if not valeur:
            return valeur
        # Les mêmes règles que pour une cliente : longueur, mot trop courant,
        # tout en chiffres. Un accès au back-office ne mérite pas moins.
        try:
            password_validation.validate_password(valeur)
        except ErreurDjango as erreur:
            raise serializers.ValidationError(list(erreur.messages))
        return valeur

    def validate(self, donnees):
        if self.instance is None and not donnees.get("mot_de_passe"):
            raise serializers.ValidationError(
                {"mot_de_passe": "Un mot de passe est nécessaire pour ouvrir le compte."}
            )
        return donnees

    def create(self, validated_data):
        mot_de_passe = validated_data.pop("mot_de_passe")
        # La boutique n'a qu'un rôle de back-office : gérante. Ouvrir un compte,
        # c'est donner le même accès que le sien — il n'y a pas de demi-mesure à
        # choisir, donc pas de champ à remplir. Le rôle est écrit ici et nulle
        # part ailleurs ; `create_user` mettrait « cliente » par défaut.
        #
        # `is_staff` reste faux : l'admin Django sert l'équipe technique, pas
        # celle de la boutique, qui a ce back-office.
        return Utilisateur.objects.create_user(
            password=mot_de_passe, role=Utilisateur.Role.GERANTE, **validated_data
        )

    def update(self, instance, validated_data):
        mot_de_passe = validated_data.pop("mot_de_passe", "")
        membre = super().update(instance, validated_data)
        if mot_de_passe:
            membre.set_password(mot_de_passe)
            membre.save(update_fields=["password"])
        return membre


class ConnexionSerializer(serializers.Serializer):
    email = serializers.EmailField()
    mot_de_passe = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, donnees):
        email = donnees["email"].strip().lower()
        utilisateur = authenticate(
            request=self.context.get("request"),
            username=email,
            password=donnees["mot_de_passe"],
        )
        if utilisateur:
            donnees["utilisateur"] = utilisateur
            return donnees

        # `authenticate` répond `None` aussi bien pour un mot de passe faux que
        # pour un compte fermé : le backend de Django refuse les inactifs avant
        # même de comparer. Un compte qu'on a fermé mérite pourtant un autre
        # message que « mot de passe incorrect » — sinon la personne réessaie
        # dix fois en se croyant maladroite.
        #
        # On ne le dit qu'à qui connaît le mot de passe : sans cette condition,
        # le message trahirait quelles adresses ont un compte ici.
        ferme = Utilisateur.objects.filter(email__iexact=email, is_active=False).first()
        if ferme and ferme.check_password(donnees["mot_de_passe"]):
            raise serializers.ValidationError("Ce compte est désactivé.")

        # Un seul message pour tout le reste : dire « cette adresse est inconnue »
        # revient à confirmer quelles adresses ont un compte.
        raise serializers.ValidationError("Adresse ou mot de passe incorrect.")


class DemandeReinitialisationSerializer(serializers.Serializer):
    """
    Une adresse, et rien d'autre.

    On ne vérifie pas ici qu'elle existe : la vue répond la même chose dans
    tous les cas. Dire « ce compte est inconnu » livrerait la liste des
    adresses inscrites à qui prend la peine de demander.
    """

    email = serializers.EmailField()

    def validate_email(self, valeur):
        return valeur.strip().lower()


class ReinitialisationSerializer(serializers.Serializer):
    """
    Le lien reçu par courriel, plus le nouveau mot de passe.

    Le jeton vient de `default_token_generator` : il porte l'empreinte du mot de
    passe actuel et la date de dernière connexion. S'en servir une fois le
    changement fait l'invalide de lui-même, sans rien à ranger côté serveur.
    """

    uid = serializers.CharField()
    jeton = serializers.CharField()
    nouveau = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, donnees):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        # Un lien abîmé, expiré ou déjà utilisé donne la même erreur : inutile
        # de préciser laquelle des trois, et le préciser renseignerait.
        invalide = serializers.ValidationError(
            {"jeton": ["Ce lien n'est plus valable. Demandez-en un nouveau."]}
        )

        try:
            identifiant = force_str(urlsafe_base64_decode(donnees["uid"]))
            utilisateur = Utilisateur.objects.get(pk=identifiant)
        except (TypeError, ValueError, OverflowError, Utilisateur.DoesNotExist):
            raise invalide

        if not default_token_generator.check_token(utilisateur, donnees["jeton"]):
            raise invalide

        try:
            password_validation.validate_password(donnees["nouveau"], utilisateur)
        except ErreurDjango as erreur:
            raise serializers.ValidationError({"nouveau": list(erreur.messages)})

        donnees["utilisateur"] = utilisateur
        return donnees

    def save(self):
        utilisateur = self.validated_data["utilisateur"]
        utilisateur.set_password(self.validated_data["nouveau"])
        utilisateur.save(update_fields=["password"])
        return utilisateur


class ChangementMotDePasseSerializer(serializers.Serializer):
    actuel = serializers.CharField(write_only=True, style={"input_type": "password"})
    nouveau = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_actuel(self, valeur):
        if not self.context["request"].user.check_password(valeur):
            raise serializers.ValidationError("Le mot de passe actuel ne correspond pas.")
        return valeur

    def validate_nouveau(self, valeur):
        try:
            password_validation.validate_password(valeur, self.context["request"].user)
        except ErreurDjango as erreur:
            raise serializers.ValidationError(list(erreur.messages))
        return valeur

    def save(self):
        utilisateur = self.context["request"].user
        utilisateur.set_password(self.validated_data["nouveau"])
        utilisateur.save(update_fields=["password"])
        return utilisateur


class FavoriSerializer(serializers.ModelSerializer):
    """Un favori, avec de quoi dessiner la carte sans second appel."""

    slug = serializers.CharField(source="produit.slug", read_only=True)
    nom = serializers.CharField(source="produit.nom", read_only=True)
    prix = serializers.IntegerField(source="produit.prix", read_only=True)
    prix_barre = serializers.IntegerField(source="produit.prix_barre", read_only=True)
    image = serializers.SerializerMethodField()
    disponible = serializers.SerializerMethodField()

    class Meta:
        model = Favori
        fields = ["id", "produit", "slug", "nom", "prix", "prix_barre",
                  "image", "disponible", "ajoute_le"]

    def get_image(self, obj) -> str:
        photo = obj.produit.photo_principale
        return photo.media.url if photo else ""

    def get_disponible(self, obj) -> bool:
        return obj.produit.stock_total > 0

    def validate_produit(self, produit):
        # Mettre de côté un brouillon n'aurait pas de sens : la cliente ne peut
        # pas l'avoir vu.
        if produit.statut != produit.Statut.PUBLIE:
            raise serializers.ValidationError("Cet article n'est pas en vente.")
        return produit

    def create(self, validated_data):
        cliente = self.context["request"].user
        # Deux clics sur le cœur ne doivent pas lever d'erreur : le second ne
        # fait rien, et c'est exactement ce que la cliente attend.
        favori, _ = Favori.objects.get_or_create(cliente=cliente, produit=validated_data["produit"])
        return favori
