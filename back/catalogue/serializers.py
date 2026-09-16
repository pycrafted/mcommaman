"""
Ce que la vitrine lit et ce que le back-office écrit.

Deux sérialiseurs par objet quand les besoins divergent : la vitrine veut une
fiche prête à afficher, le back-office veut les champs bruts qu'il modifie. Les
mélanger obligerait la vitrine à recevoir le stock et le statut, qui ne la
regardent pas.
"""

from rest_framework import serializers

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


# ------------------------------------------------------------------ référentiels

def _texte_propre(valeur: str) -> str:
    """Évite que des espaces invisibles créent deux entrées apparemment identiques."""
    return " ".join(valeur.split())


def _refuser_doublon(serializer, queryset, champ: str, valeur: str, message: str) -> str:
    recherche = {f"{champ}__iexact": valeur}
    doublons = queryset.filter(**recherche)
    if serializer.instance:
        doublons = doublons.exclude(pk=serializer.instance.pk)
    if doublons.exists():
        raise serializers.ValidationError(message)
    return valeur

class TailleSerializer(serializers.ModelSerializer):
    # Posé par la vue du back-office ; absent de la vitrine, d'où le défaut.
    nombre_produits = serializers.IntegerField(read_only=True, default=0)

    def validate_valeur(self, valeur):
        valeur = _texte_propre(valeur)
        return _refuser_doublon(
            self,
            Taille.objects.all(),
            "valeur",
            valeur,
            "Cette taille existe déjà.",
        )

    class Meta:
        model = Taille
        fields = ["id", "valeur", "repere", "ordre", "nombre_produits"]


class ColorisSerializer(serializers.ModelSerializer):
    nombre_produits = serializers.IntegerField(read_only=True, default=0)

    def validate_nom(self, valeur):
        valeur = _texte_propre(valeur)
        return _refuser_doublon(
            self,
            Coloris.objects.all(),
            "nom",
            valeur,
            "Ce coloris existe déjà.",
        )

    def validate_hexa(self, valeur):
        valeur = valeur.lower()
        return _refuser_doublon(
            self,
            Coloris.objects.all(),
            "hexa",
            valeur,
            "Cette teinte est déjà utilisée par un autre coloris.",
        )

    class Meta:
        model = Coloris
        fields = ["id", "nom", "hexa", "nombre_produits"]


class MatiereSerializer(serializers.ModelSerializer):
    def validate_nom(self, valeur):
        valeur = _texte_propre(valeur)
        return _refuser_doublon(
            self,
            Matiere.objects.all(),
            "nom",
            valeur,
            "Cette matière existe déjà.",
        )

    class Meta:
        model = Matiere
        fields = ["id", "nom"]


class MediaSerializer(serializers.ModelSerializer):
    """
    Une image de la photothèque, envoyée ou pointée.

    `fichier` n'est pas obligatoire, `url` non plus — mais il en faut un des
    deux, sinon on enregistre une entrée qui ne montre rien.
    """

    usages = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = ["id", "fichier", "url", "nom", "largeur", "hauteur", "ajoute_le", "usages"]
        read_only_fields = ["ajoute_le"]
        extra_kwargs = {
            "fichier": {"required": False, "write_only": True},
            "url": {"required": False},
        }

    def validate(self, donnees):
        fichier = donnees.get("fichier")
        adresse = (donnees.get("url") or "").strip()
        if not fichier and not adresse:
            raise serializers.ValidationError(
                {"fichier": ["Envoyez une image ou collez son adresse."]}
            )
        return donnees

    def get_usages(self, obj) -> int:
        """Combien de fiches et de rayons s'en servent — une image utilisée ne se supprime pas."""
        return obj.utilisations.count() + obj.rayons_illustres.count() + obj.bandeaux.count()


class SousRayonSerializer(serializers.ModelSerializer):
    """Une sous-catégorie, telle qu'elle apparaît sous sa parente."""

    nombre_produits = serializers.SerializerMethodField()
    # Le visuel choisi dans le back-office. La page d'accueil en fait ses
    # tuiles : sans lui, elle retomberait sur des photos écrites dans le code.
    image_url = serializers.CharField(source="image.url", read_only=True, default="")

    class Meta:
        model = Rayon
        fields = ["id", "nom", "slug", "description", "image_url", "ordre", "nombre_produits"]

    def get_nombre_produits(self, obj) -> int:
        return obj.produits.filter(statut=Produit.Statut.PUBLIE).count()


class RayonSerializer(serializers.ModelSerializer):
    image_url = serializers.CharField(source="image.url", read_only=True, default="")
    parents_slugs = serializers.SerializerMethodField()
    parents_noms = serializers.SerializerMethodField()
    enfants = SousRayonSerializer(many=True, read_only=True)
    nombre_produits = serializers.SerializerMethodField()

    class Meta:
        model = Rayon
        fields = [
            "id", "nom", "slug", "parents", "parents_slugs", "parents_noms", "enfants",
            "univers", "description", "image", "image_url",
            "visible", "ordre", "nombre_produits",
        ]
        # Le back-office ne demande pas l'univers : une sous-catégorie prend
        # celui de la catégorie où on la range (voir `_reprendre_univers`).
        # Il reste modifiable par l'API pour le peuplement et l'admin Django.
        read_only_fields = ["slug"]

    def get_parents_slugs(self, obj) -> list[str]:
        return [p.slug for p in obj.parents.all()]

    def get_parents_noms(self, obj) -> list[str]:
        return [p.nom for p in obj.parents.all()]

    def get_nombre_produits(self, obj) -> int:
        """Le rayon et tout ce qu'il contient : une parente compte ses enfants."""
        rayons = [obj.pk] + [enfant.pk for enfant in obj.enfants.all()]
        return Produit.objects.filter(
            rayon_id__in=rayons, statut=Produit.Statut.PUBLIE
        ).count()

    def validate_parents(self, parents):
        """
        Deux niveaux, et pas de boucle.

        Une sous-catégorie peut appartenir à plusieurs catégories — c'est
        l'intérêt de la liaison multiple. Mais aucune de ces catégories ne doit
        elle-même en avoir une, sinon on gagne un troisième étage sans l'avoir
        demandé.
        """
        if self.instance and any(p.pk == self.instance.pk for p in parents):
            raise serializers.ValidationError("Une catégorie ne peut pas être sa propre parente.")

        deja_enfants = [p.nom for p in parents if p.parents.exists()]
        if deja_enfants:
            raise serializers.ValidationError(
                "Deux niveaux suffisent : {} {} déjà une sous-catégorie.".format(
                    ", ".join(deja_enfants),
                    "sont" if len(deja_enfants) > 1 else "est",
                )
            )

        # Ranger une catégorie qui a des enfants sous une autre ferait de ses
        # enfants un troisième niveau.
        if parents and self.instance and self.instance.enfants.exists():
            raise serializers.ValidationError(
                "Cette catégorie contient déjà des sous-catégories : "
                "elle ne peut pas en devenir une."
            )
        return parents

    def create(self, donnees):
        rayon = super().create(donnees)
        self._reprendre_univers(rayon)
        return rayon

    def update(self, rayon, donnees):
        rayon = super().update(rayon, donnees)
        self._reprendre_univers(rayon)
        return rayon

    @staticmethod
    def _reprendre_univers(rayon):
        """
        Une sous-catégorie appartient au monde de la catégorie qui la contient.

        La reprise se fait après coup, pas dans `save()` : les liaisons multiples
        ne sont posées qu'une fois la ligne écrite, donc au moment du `save()`
        le rayon n'a pas encore de parente à interroger.
        """
        premiere = rayon.parents.first()
        if premiere and rayon.univers != premiere.univers:
            rayon.univers = premiere.univers
            rayon.save(update_fields=["univers"])


# ------------------------------------------------------------------ variantes

class VarianteSerializer(serializers.ModelSerializer):
    taille_valeur = serializers.CharField(source="taille.valeur", read_only=True)
    taille_repere = serializers.CharField(source="taille.repere", read_only=True)
    coloris_nom = serializers.CharField(source="coloris.nom", read_only=True, default="")
    coloris_hexa = serializers.CharField(source="coloris.hexa", read_only=True, default="")
    disponible = serializers.BooleanField(read_only=True)

    class Meta:
        model = Variante
        # `produit` est en écriture : sans lui, créer une variante violait la
        # contrainte de la base au lieu d'être refusé proprement.
        fields = [
            "id", "produit", "sku", "taille", "taille_valeur", "taille_repere",
            "coloris", "coloris_nom", "coloris_hexa", "stock", "disponible",
        ]


# ------------------------------------------------------------------ vitrine

class _PrixDuJour:
    """Le prix du jour d'un article et la campagne qui le fait, pour les sérialiseurs vitrine."""

    def _remise(self, obj):
        """
        La remise en cours sur cet article.

        Les campagnes sont posées une fois dans le contexte par la vue, pour ne
        pas les redemander à la base à chaque article d'une liste.
        """
        from ventes.remises import remise_pour

        if not hasattr(self, "_cache_remises"):
            self._cache_remises = {}
        if obj.pk not in self._cache_remises:
            self._cache_remises[obj.pk] = remise_pour(obj, self.context.get("campagnes"))
        return self._cache_remises[obj.pk]

    def get_prix_public(self, obj) -> int:
        """Ce qu'on paie aujourd'hui. C'est ce prix que la caisse retiendra."""
        remise = self._remise(obj)
        return remise.prix_remise if remise else obj.prix

    def get_prix_avant(self, obj) -> int | None:
        """
        Le prix à barrer, s'il y a lieu.

        Une campagne prime sur le prix barré saisi à la main : les deux
        afficheraient deux remises différentes sur la même étiquette.
        """
        remise = self._remise(obj)
        if remise:
            return remise.prix_initial
        return obj.prix_barre

    def get_promotion(self, obj) -> dict | None:
        remise = self._remise(obj)
        if not remise:
            return None
        return {
            "libelle": remise.campagne.libelle,
            "pourcentage": remise.pourcentage,
            "economie": remise.economie,
            "jusquau": remise.campagne.date_fin,
        }


class ProduitCarteSerializer(_PrixDuJour, serializers.ModelSerializer):
    """
    Un article tel qu'une liste le montre : de quoi dessiner une carte, rien de plus.

    Ni description, ni photos, ni tailles : la fiche les porte. La photo et la
    disponibilité viennent d'annotations posées par la vue (`image_url`,
    `a_du_stock`) — les lire article par article coûterait deux requêtes chacun.
    """

    rayon_nom = serializers.CharField(source="rayon.nom", read_only=True)
    rayon_slug = serializers.CharField(source="rayon.slug", read_only=True)
    image = serializers.SerializerMethodField()
    en_rupture = serializers.SerializerMethodField()
    prix_public = serializers.SerializerMethodField()
    prix_avant = serializers.SerializerMethodField()
    promotion = serializers.SerializerMethodField()

    class Meta:
        model = Produit
        fields = [
            "id", "slug", "nom", "prix_public", "prix_avant", "promotion",
            "rayon_nom", "rayon_slug", "image", "en_rupture",
        ]

    def get_image(self, obj) -> str:
        if hasattr(obj, "image_url"):
            return obj.image_url or ""
        photo = obj.photo_principale
        return photo.media.url if photo else ""

    def get_en_rupture(self, obj) -> bool:
        if hasattr(obj, "a_du_stock"):
            return not obj.a_du_stock
        return obj.stock_total == 0


class ProduitVitrineSerializer(_PrixDuJour, serializers.ModelSerializer):
    """
    La fiche telle que la cliente la voit.

    Ni stock ni statut : le premier ne regarde qu'un chiffre — disponible ou
    non —, le second ne devrait jamais franchir la porte du back-office.
    """

    rayon_nom = serializers.CharField(source="rayon.nom", read_only=True)
    rayon_slug = serializers.CharField(source="rayon.slug", read_only=True)
    univers = serializers.CharField(source="rayon.univers", read_only=True)
    matiere = serializers.CharField(source="composition", read_only=True)
    image = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    tailles = serializers.SerializerMethodField()
    coloris = serializers.SerializerMethodField()
    en_rupture = serializers.SerializerMethodField()
    prix_public = serializers.SerializerMethodField()
    prix_avant = serializers.SerializerMethodField()
    promotion = serializers.SerializerMethodField()

    class Meta:
        model = Produit
        fields = [
            "id", "slug", "nom", "prix", "prix_barre", "description", "matiere",
            "prix_public", "prix_avant", "promotion",
            "rayon_nom", "rayon_slug", "univers",
            "image", "photos", "tailles", "coloris", "en_rupture",
        ]

    def get_image(self, obj) -> str:
        photo = obj.photo_principale
        return photo.media.url if photo else ""

    def get_photos(self, obj) -> list[str]:
        return [p.media.url for p in obj.photos.select_related("media").order_by("position")]

    def get_tailles(self, obj) -> list[dict]:
        """Une taille par variante, avec sa disponibilité — c'est ce qui grise le bouton."""
        vues = {}
        for variante in obj.variantes.select_related("taille"):
            entree = vues.setdefault(
                variante.taille.valeur,
                {"valeur": variante.taille.valeur, "repere": variante.taille.repere,
                 "disponible": False, "ordre": variante.taille.ordre},
            )
            entree["disponible"] = entree["disponible"] or variante.stock > 0
        return sorted(vues.values(), key=lambda t: t["ordre"])

    def get_coloris(self, obj) -> list[dict]:
        vus = {}
        for variante in obj.variantes.select_related("coloris"):
            if variante.coloris:
                vus[variante.coloris.nom] = {
                    "nom": variante.coloris.nom, "hexa": variante.coloris.hexa
                }
        return list(vus.values())

    def get_en_rupture(self, obj) -> bool:
        return obj.stock_total == 0


class ProduitDetailVitrineSerializer(ProduitVitrineSerializer):
    """La fiche complète : les variantes servent à choisir ce qu'on met au panier."""

    variantes = serializers.SerializerMethodField()

    class Meta(ProduitVitrineSerializer.Meta):
        fields = ProduitVitrineSerializer.Meta.fields + ["variantes"]

    def get_variantes(self, obj) -> list[dict]:
        selection = obj.variantes.select_related("taille", "coloris")
        return VarianteSerializer(selection, many=True).data


# ------------------------------------------------------------------ back-office

class PhotoProduitSerializer(serializers.ModelSerializer):
    url = serializers.CharField(source="media.url", read_only=True)

    class Meta:
        model = PhotoProduit
        # `produit` est en écriture : sans lui, on ne peut rattacher une photo à
        # aucune fiche, et une fiche sans photo ne se publie jamais.
        fields = ["id", "produit", "media", "url", "position"]


class ProduitGestionListeSerializer(serializers.ModelSerializer):
    """
    Une ligne de la liste des produits du back-office.

    Le stock et la photo viennent d'annotations de la vue : la liste n'a pas
    besoin des variantes ni de la galerie, qui restent dans la fiche.
    """

    rayon_nom = serializers.CharField(source="rayon.nom", read_only=True)
    image = serializers.CharField(source="image_url", read_only=True, default="")
    stock_total = serializers.IntegerField(source="stock_somme", read_only=True, default=0)
    matieres_noms = serializers.SlugRelatedField(
        source="matieres", many=True, read_only=True, slug_field="nom"
    )

    class Meta:
        model = Produit
        fields = [
            "id", "slug", "nom", "sku", "prix", "statut", "rayon", "rayon_nom",
            "image", "stock_total", "matieres_noms", "cree_le", "modifie_le",
        ]


class ProduitAdminSerializer(serializers.ModelSerializer):
    """La fiche côté gestion : tout, y compris ce qui empêche de publier."""

    photos = PhotoProduitSerializer(many=True, read_only=True)
    variantes = VarianteSerializer(many=True, read_only=True)
    rayon_nom = serializers.CharField(source="rayon.nom", read_only=True)
    univers = serializers.CharField(source="rayon.univers", read_only=True)
    matieres_noms = serializers.SlugRelatedField(
        source="matieres", many=True, read_only=True, slug_field="nom"
    )
    stock_total = serializers.IntegerField(read_only=True)
    manques = serializers.SerializerMethodField()
    publiable = serializers.BooleanField(read_only=True)

    class Meta:
        model = Produit
        fields = [
            "id", "slug", "nom", "sku", "prix", "prix_barre", "description",
            "rayon", "rayon_nom", "univers", "matieres", "matieres_noms", "statut",
            "photos", "variantes", "stock_total", "manques", "publiable",
            "cree_le", "modifie_le",
        ]
        read_only_fields = ["cree_le", "modifie_le"]

    def get_manques(self, obj) -> list[str]:
        return obj.manque_pour_publier()

    def validate(self, donnees):
        """
        Le garde-fou de l'audit, appliqué là où il compte.

        Le back-office affiche déjà la liste de ce qui manque ; ici elle devient
        opposable : une fiche incomplète ne passe pas en « publié », quelle que
        soit la façon dont on appelle l'API.
        """
        statut = donnees.get("statut", getattr(self.instance, "statut", None))
        if statut != Produit.Statut.PUBLIE:
            return donnees

        # On éprouve la fiche telle qu'elle sera après écriture, pas telle
        # qu'elle est aujourd'hui.
        candidat = self.instance or Produit()
        for champ, valeur in donnees.items():
            setattr(candidat, champ, valeur)
        manques = candidat.manque_pour_publier()
        if manques:
            raise serializers.ValidationError(
                {"statut": ["Il manque encore : " + ", ".join(manques) + "."]}
            )
        return donnees


class MouvementStockSerializer(serializers.ModelSerializer):
    variante_libelle = serializers.CharField(source="variante.__str__", read_only=True)
    auteur_nom = serializers.CharField(source="auteur.nom", read_only=True, default="")

    class Meta:
        model = MouvementStock
        fields = [
            "id", "variante", "variante_libelle", "quantite", "motif",
            "reference", "reste", "auteur_nom", "date",
        ]
        read_only_fields = ["reste", "date"]


class RayonGestionSerializer(RayonSerializer):
    """
    Un rayon vu du back-office : combien de fiches y sont rangées directement.

    Les nombres viennent d'annotations de la vue — les compter rayon par rayon
    coûterait deux requêtes chacun.
    """

    fiches = serializers.IntegerField(read_only=True, default=0)
    fiches_brouillons = serializers.IntegerField(read_only=True, default=0)

    class Meta(RayonSerializer.Meta):
        fields = RayonSerializer.Meta.fields + ["fiches", "fiches_brouillons"]

