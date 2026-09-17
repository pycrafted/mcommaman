"""
Ce qui entre et ce qui sort des commandes.

La commande entrante ne porte aucun montant : la cliente dit ce qu'elle veut et
où le livrer, le serveur dit ce que ça coûte.
"""

from rest_framework import serializers

from catalogue.models import Variante

from .models import Avis, Campagne, Commande, LigneCommande


class LigneCommandeSerializer(serializers.ModelSerializer):
    sous_total = serializers.IntegerField(read_only=True)

    class Meta:
        model = LigneCommande
        fields = [
            "id", "nom_produit", "slug_produit", "url_image", "libelle_option",
            "prix_unitaire", "quantite", "sous_total",
        ]


class CommandeSerializer(serializers.ModelSerializer):
    """La commande telle que la cliente la suit."""

    lignes = LigneCommandeSerializer(many=True, read_only=True)
    statut_cliente = serializers.CharField(read_only=True)
    moyen_paiement_libelle = serializers.CharField(source="get_moyen_paiement_display", read_only=True)

    class Meta:
        model = Commande
        fields = [
            "reference", "creee_le", "statut", "statut_cliente",
            "nom_client", "telephone", "email",
            "zone", "ville", "adresse", "notes",
            "sous_total", "frais_livraison", "remise", "total",
            "moyen_paiement", "moyen_paiement_libelle", "lignes",
        ]


class CommandeGestionSerializer(CommandeSerializer):
    """La même, plus ce qui n'intéresse que la gérante."""

    cliente_nom = serializers.CharField(source="cliente.nom", read_only=True, default="")
    encaissee = serializers.BooleanField(read_only=True)

    class Meta(CommandeSerializer.Meta):
        fields = CommandeSerializer.Meta.fields + ["cliente", "cliente_nom", "encaissee", "modifiee_le"]


class LigneDemandeeSerializer(serializers.Serializer):
    """Une ligne du panier envoyée à la caisse : un article, une quantité. Pas de prix."""

    variante = serializers.PrimaryKeyRelatedField(queryset=Variante.objects.all())
    quantite = serializers.IntegerField(min_value=1, max_value=20)


class CreationCommandeSerializer(serializers.Serializer):
    """
    Ce que le tunnel de commande envoie.

    Aucun montant n'y figure : ni sous-total, ni frais, ni total. Les accepter
    reviendrait à laisser le navigateur fixer ses prix.
    """

    lignes = LigneDemandeeSerializer(many=True, allow_empty=False)

    nom_client = serializers.CharField(max_length=120)
    telephone = serializers.CharField(max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)

    zone = serializers.ChoiceField(choices=["dakar", "thies", "regions"])
    ville = serializers.CharField(max_length=80)
    adresse = serializers.CharField(max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    # Les espèces en boutique ne se choisissent pas en ligne : l'équipe les saisit.
    moyen_paiement = serializers.ChoiceField(
        choices=[c for c in Commande.Paiement.choices if c[0] != Commande.Paiement.ESPECES]
    )

    def validate(self, donnees):
        # Le paiement à la livraison n'existe que sur Dakar. La base porte la
        # même contrainte ; ici le refus est explicable à la cliente.
        # Le moyen de paiement est absent du devis, qui ne chiffre qu'un panier.
        if (
            donnees.get("moyen_paiement") == Commande.Paiement.LIVRAISON
            and donnees.get("zone") != "dakar"
        ):
            raise serializers.ValidationError({
                "moyen_paiement": ["Le paiement à la livraison n'est proposé que sur Dakar."]
            })

        # Une même variante ne doit pas figurer deux fois : le stock serait
        # vérifié ligne par ligne, et deux fois cinq articles passeraient là où
        # il n'en reste que six.
        vues = [ligne["variante"].pk for ligne in donnees["lignes"]]
        if len(vues) != len(set(vues)):
            raise serializers.ValidationError({
                "lignes": ["Un même article apparaît deux fois : regroupez les quantités."]
            })
        return donnees


class SaisieCommandeSerializer(serializers.Serializer):
    """
    Une vente conclue hors du site — sur WhatsApp, au téléphone, à la boutique —
    et saisie par l'équipe.

    Comme au tunnel, aucun prix n'est accepté : seule une remise peut être
    accordée, en francs. Le retrait en boutique se passe d'adresse.
    """

    lignes = LigneDemandeeSerializer(many=True, allow_empty=False)
    nom_client = serializers.CharField(max_length=120)
    telephone = serializers.CharField(max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)
    zone = serializers.ChoiceField(choices=["dakar", "thies", "regions", "retrait"])
    ville = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    adresse = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    moyen_paiement = serializers.ChoiceField(choices=Commande.Paiement.choices)
    remise = serializers.IntegerField(min_value=0, required=False, default=0)

    def validate(self, donnees):
        zone = donnees.get("zone")
        moyen = donnees.get("moyen_paiement")
        if moyen == Commande.Paiement.LIVRAISON and zone != "dakar":
            raise serializers.ValidationError({
                "moyen_paiement": ["Le paiement à la livraison n'est proposé que sur Dakar."]
            })
        if moyen == Commande.Paiement.ESPECES and zone != "retrait":
            raise serializers.ValidationError({
                "moyen_paiement": ["Les espèces en boutique vont avec un retrait en boutique."]
            })
        # Le devis se demande en cours de saisie : l'adresse peut encore manquer.
        if zone and zone != "retrait" and not self.context.get("devis"):
            manques = {}
            if not donnees.get("ville", "").strip():
                manques["ville"] = ["Le quartier ou la ville de livraison."]
            if not donnees.get("adresse", "").strip():
                manques["adresse"] = ["Un point de repère pour le livreur."]
            if manques:
                raise serializers.ValidationError(manques)
        vues = [ligne["variante"].pk for ligne in donnees.get("lignes", [])]
        if len(vues) != len(set(vues)):
            raise serializers.ValidationError({
                "lignes": ["Un même article apparaît deux fois : regroupez les quantités."]
            })
        return donnees


class DevisSerializer(serializers.Serializer):
    """Le chiffrage renvoyé avant de valider — le récapitulatif du tunnel."""

    sous_total = serializers.IntegerField()
    frais_livraison = serializers.IntegerField()
    remise = serializers.IntegerField()
    # Le nom de la campagne qui fait la remise, pour la nommer au récapitulatif.
    remise_libelle = serializers.CharField(source="campagne.libelle", default="")
    total = serializers.IntegerField()


class CampagneSerializer(serializers.ModelSerializer):
    date_fin = serializers.DateField(read_only=True)
    en_cours = serializers.BooleanField(read_only=True)
    # Pour nommer l'article visé sans charger le catalogue.
    produit_nom = serializers.CharField(source="produit.nom", read_only=True, default="")

    class Meta:
        model = Campagne
        fields = [
            "id", "libelle", "type", "valeur", "date_effet", "duree_jours",
            "date_fin", "en_cours", "portee", "rayon", "produit", "produit_nom",
            "condition", "montant_minimum", "active", "note",
        ]


class CampagnePubliqueSerializer(serializers.ModelSerializer):
    """
    Une campagne telle que la boutique l'annonce.

    Ni la note interne ni la portée technique : de quoi écrire un bandeau et
    faire tourner un compte à rebours. La condition y figure, sinon la cliente
    découvre à la caisse que la remise ne la concernait pas.
    """

    date_fin = serializers.DateField(read_only=True)
    rayon_nom = serializers.CharField(source="rayon.nom", read_only=True, default="")
    produit_slug = serializers.CharField(source="produit.slug", read_only=True, default="")

    class Meta:
        model = Campagne
        fields = [
            "libelle", "type", "valeur", "date_fin",
            "portee", "rayon_nom", "produit_slug",
            "condition", "montant_minimum",
        ]


class AvisSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.CharField(source="auteur.nom", read_only=True)
    produit_nom = serializers.CharField(source="produit.nom", read_only=True, default="")
    produit_slug = serializers.CharField(source="produit.slug", read_only=True, default="")
    est_le_mien = serializers.SerializerMethodField()

    class Meta:
        model = Avis
        fields = [
            "id", "note", "commentaire", "auteur_nom", "produit", "produit_nom",
            "produit_slug", "est_le_mien", "commande", "etat", "ecrit_le",
        ]
        read_only_fields = ["etat", "ecrit_le"]

    def get_est_le_mien(self, obj) -> bool:
        """
        Le sien, à modifier ou à retirer.

        Reconnaître son avis au nom de l'autrice ne tiendrait pas : deux
        clientes peuvent s'appeler pareil, et le nom seul ne dit rien de la
        session en cours. L'identifiant du compte, lui, ne sort jamais d'ici.
        """
        requete = self.context.get("request")
        return bool(
            requete
            and requete.user.is_authenticated
            and obj.auteur_id == requete.user.id
        )

    # La référence de la commande n'est volontairement pas rendue : elle
    # circulerait publiquement sous chaque avis et donnerait le compte des
    # ventes à qui sait lire. « Achat vérifié » dit ce qu'il faut savoir.


class CreationAvisSerializer(serializers.ModelSerializer):
    """
    Déposer un avis.

    Le droit d'écrire ne se déclare pas : il se prouve. Il faut une commande
    **livrée**, qui appartienne à l'autrice, et qui contienne l'article noté.
    Sans cette vérification, n'importe qui note n'importe quoi.
    """

    class Meta:
        model = Avis
        fields = ["note", "commentaire", "produit", "commande"]

    def validate_note(self, valeur):
        if not 1 <= valeur <= 5:
            raise serializers.ValidationError("La note va de 1 à 5.")
        return valeur

    def validate(self, donnees):
        cliente = self.context["request"].user
        commande = donnees["commande"]
        produit = donnees.get("produit")

        if commande.cliente_id != cliente.id:
            raise serializers.ValidationError(
                {"commande": ["Cette commande n'est pas la vôtre."]}
            )
        if commande.statut != Commande.Statut.LIVREE:
            raise serializers.ValidationError(
                {"commande": ["Vous pourrez donner votre avis une fois la commande livrée."]}
            )

        # Avis sur un article : il doit figurer dans cette commande. Avis sur la
        # boutique : la commande livrée suffit.
        if produit is not None:
            achete = commande.lignes.filter(variante__produit=produit).exists()
            if not achete:
                raise serializers.ValidationError(
                    {"produit": ["Cet article ne figure pas dans cette commande."]}
                )

        if Avis.objects.filter(auteur=cliente, commande=commande, produit=produit).exists():
            raise serializers.ValidationError(
                "Vous avez déjà donné votre avis pour cet achat."
            )

        return donnees

    def create(self, validated_data):
        # L'avis attend la modération : il n'apparaît pas tant qu'il n'est pas
        # approuvé. C'est la règle que le front annonçait déjà.
        return Avis.objects.create(auteur=self.context["request"].user, **validated_data)


class AgregatSerializer(serializers.Serializer):
    """Le résumé affiché sous une fiche : combien d'avis, quelle moyenne."""

    nombre = serializers.IntegerField()
    moyenne = serializers.FloatField()
    repartition = serializers.DictField(child=serializers.IntegerField())


class AvisPossibleSerializer(serializers.Serializer):
    """Ce qu'une cliente peut encore noter, après livraison."""

    # L'identifiant, parce que c'est lui qu'il faudra renvoyer pour déposer
    # l'avis ; la référence en plus, parce que c'est elle qu'on montre.
    commande = serializers.IntegerField()
    commande_reference = serializers.CharField()
    livree_le = serializers.DateTimeField()
    produit = serializers.IntegerField(allow_null=True)
    nom_produit = serializers.CharField()
    slug_produit = serializers.CharField()
    image = serializers.CharField()
