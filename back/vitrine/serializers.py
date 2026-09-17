"""Ce que la gérante règle, et ce que la vitrine en lit."""

from rest_framework import serializers

from .models import Bandeau, EntreeJournal, Reglages, Video

#: Poids maximal d'une vidéo envoyée, en mégaoctets.
VIDEO_MAX_MO = 60
FORMATS_VIDEO = {"video/mp4", "video/webm", "video/quicktime"}


#: Au-delà, la carte du bandeau mettrait trop longtemps à faire le tour.
PRODUITS_EN_AVANT_MAX = 12


class ReglagesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reglages
        exclude = ["id"]
        read_only_fields = ["modifie_le"]

    def validate_hero_produits(self, produits):
        if len(produits) > PRODUITS_EN_AVANT_MAX:
            raise serializers.ValidationError(
                f"{PRODUITS_EN_AVANT_MAX} produits au plus dans le bandeau d'accueil."
            )
        return produits

    def to_representation(self, instance):
        donnees = super().to_representation(instance)
        # L'ordre choisi n'existe pas en base (liaison simple) : on garde celui
        # des identifiants, stable, plutôt qu'un ordre au hasard.
        donnees["hero_produits"] = sorted(donnees.get("hero_produits", []))
        return donnees


class ReglagesPublicSerializer(serializers.ModelSerializer):
    """
    Ce que la boutique a besoin de savoir.

    Ni seuil de stock ni identifiants : la vitrine n'affiche que l'identité, les
    frais de livraison et le bandeau promotionnel.
    """

    class Meta:
        model = Reglages
        fields = [
            "nom_boutique", "signature", "email_contact", "telephone", "devise",
            "franco_dakar", "frais_dakar", "frais_thies", "frais_regions",
            "accepte_commandes", "affiche_bandeau_promo", "texte_bandeau_promo",
            "hero_pastille", "hero_titre", "hero_accent", "hero_chapo",
            "hero_sceau", "hero_sceau_centre", "hero_sceau_legende", "hero_produits",
        ]

    hero_produits = serializers.SerializerMethodField()

    def get_hero_produits(self, obj) -> list[int]:
        """Seules les pièces encore en ligne : une fiche dépubliée ne s'annonce pas."""
        from catalogue.models import Produit

        return sorted(
            obj.hero_produits.filter(statut=Produit.Statut.PUBLIE).values_list("pk", flat=True)
        )


class BandeauSerializer(serializers.ModelSerializer):
    url = serializers.CharField(source="media.url", read_only=True)
    produit_slug = serializers.CharField(source="produit_associe.slug", read_only=True, default="")
    produit_nom = serializers.CharField(source="produit_associe.nom", read_only=True, default="")
    produit_prix = serializers.IntegerField(source="produit_associe.prix", read_only=True, default=0)

    class Meta:
        model = Bandeau
        fields = [
            "id", "titre", "accroche", "media", "url", "texte_alternatif", "cadrage",
            "etiquette", "produit_associe", "produit_slug", "produit_nom", "produit_prix",
            "active", "ordre",
        ]


class EntreeJournalSerializer(serializers.ModelSerializer):
    class Meta:
        model = EntreeJournal
        fields = ["id", "nom_auteur", "action", "cible", "date"]


class VideoSerializer(serializers.ModelSerializer):
    """Une vidéo, vue du back-office : le fichier s'envoie, l'adresse se lit."""

    produit_nom = serializers.CharField(source="produit.nom", read_only=True, default="")

    class Meta:
        model = Video
        fields = [
            "id", "fichier", "url", "titre", "produit", "produit_nom",
            "sur_accueil", "ordre", "ajoutee_le",
        ]
        read_only_fields = ["url", "ajoutee_le"]
        extra_kwargs = {"fichier": {"write_only": True}}

    def validate_fichier(self, fichier):
        if fichier.size > VIDEO_MAX_MO * 1024 * 1024:
            raise serializers.ValidationError(
                f"Cette vidéo dépasse {VIDEO_MAX_MO} Mo : raccourcissez-la ou compressez-la."
            )
        type_annonce = getattr(fichier, "content_type", "") or ""
        if type_annonce not in FORMATS_VIDEO:
            raise serializers.ValidationError("Format accepté : MP4, WebM ou MOV.")
        return fichier

    def validate(self, donnees):
        # Le fichier est exigé à la création, pas pour changer un titre.
        if self.instance is None and not donnees.get("fichier"):
            raise serializers.ValidationError({"fichier": ["Choisissez une vidéo."]})
        # Un envoi de fichier (multipart) lit une case absente comme décochée :
        # une vidéo nouvelle va sur l'accueil sauf demande contraire.
        if self.instance is None and "sur_accueil" not in self.initial_data:
            donnees["sur_accueil"] = True
        return donnees


class VideoAccueilSerializer(serializers.ModelSerializer):
    """
    Une vidéo telle que l'accueil la montre, avec la carte de sa pièce.

    La pièce n'est donnée que si elle est en ligne : une fiche dépubliée ne
    laisse pas une carte menant à une page introuvable.
    """

    produit = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = ["id", "url", "titre", "produit"]

    def get_produit(self, obj):
        from catalogue.models import Produit

        produit = obj.produit
        if not produit or produit.statut != Produit.Statut.PUBLIE:
            return None
        photo = produit.photo_principale
        return {
            "slug": produit.slug,
            "nom": produit.nom,
            "prix": produit.prix,
            "image": photo.media.url if photo else "",
        }

