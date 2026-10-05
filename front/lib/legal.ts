export type LegalPage = { slug: string; title: string; required: boolean; body: string };

export const LEGAL_PAGES: LegalPage[] = [
  {
    slug: "cgv",
    title: "Conditions générales de vente",
    required: true,
    body: `1. Objet
Les présentes conditions régissent les ventes conclues sur mcommaman.com entre M comme Maman, boutique établie à Dakar, et toute personne effectuant un achat sur le site.

2. Prix
Les prix sont indiqués en francs CFA, taxes comprises. Les frais de livraison sont annoncés avant la validation de la commande et dépendent de la zone choisie.

3. Commande
La commande est ferme dès confirmation du paiement par notre prestataire, ou dès validation téléphonique pour un paiement à la livraison. Un récapitulatif est envoyé par e-mail et par SMS.

4. Paiement
Wave, Orange Money, Free Money, carte bancaire et paiement à la livraison sont acceptés. Aucun numéro de carte n'est stocké par la boutique : le règlement s'effectue sur la page sécurisée du prestataire.

5. Disponibilité
En cas d'indisponibilité constatée après commande, la cliente est prévenue sous 24 heures et remboursée intégralement.`,
  },
  {
    slug: "mentions-legales",
    title: "Mentions légales",
    required: true,
    body: `Éditeur
M comme Maman, commerce de détail d'articles d'habillement pour enfants.
Dakar, Sénégal.
Téléphone : +221 76 208 02 02
Courriel : mamand202122@gmail.com
NINEA : à compléter
Registre du commerce : à compléter

Directrice de la publication
À compléter

Hébergement
Site hébergé sur une infrastructure européenne, accessible via un réseau de diffusion mondial.

Propriété intellectuelle
Les photographies, textes et éléments graphiques présents sur ce site sont la propriété de M comme Maman. Toute reproduction sans accord écrit est interdite.`,
  },
  {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    required: true,
    body: `Données collectées
Nom, téléphone, adresse de livraison, adresse électronique, historique de commandes. Ces données servent uniquement à traiter et livrer les commandes.

Paiement
Aucune donnée bancaire ne transite par nos serveurs. Les règlements par carte ou mobile money sont traités par le prestataire de paiement sur sa propre page sécurisée.

Conservation
Les données de commande sont conservées cinq ans à des fins comptables. Un compte client inactif depuis trois ans est supprimé.

Vos droits
Vous pouvez demander l'accès, la rectification ou la suppression de vos données en écrivant à mamand202122@gmail.com. Réponse sous trente jours.

Cookies
Seuls les cookies nécessaires au panier et à la mesure d'audience anonyme sont déposés.`,
  },
  {
    slug: "retours",
    title: "Retours et échanges",
    required: false,
    body: `Délai
Vous disposez de sept jours après réception pour demander un échange ou un remboursement.

État de l'article
L'article doit être non porté, non lavé, étiquette d'origine attachée. Les sous-vêtements et les bodys déballés ne sont pas repris pour raisons d'hygiène.

Procédure
Écrivez-nous sur WhatsApp au +221 76 208 02 02 avec votre numéro de commande. Nous convenons d'un point de récupération à Dakar, ou vous renvoyez le colis à vos frais depuis la région.

Remboursement
Sous cinq jours ouvrés après réception de l'article, par le même moyen que le paiement initial. Pour un paiement à la livraison, le remboursement s'effectue par Wave ou Orange Money.

Article défectueux
Frais de retour à notre charge, remplacement ou remboursement intégral au choix.`,
  },
  {
    slug: "livraison",
    title: "Livraison",
    required: false,
    body: `Dakar et banlieue
Livraison sous 24 heures ouvrées. 2 000 F, offerte dès 25 000 F d'achat. Le livreur vous appelle avant de passer.

Régions
Thiès, Mbour, Saint-Louis, Touba, Kaolack, Ziguinchor : 2 à 4 jours, 3 500 F, via transporteur partenaire.

Point de repère
L'adresse au Sénégal passe par le quartier et le point de repère. Le formulaire de commande prévoit un champ dédié : indiquez-y le commerce ou le bâtiment le plus visible.

Suivi
Un message WhatsApp est envoyé à chaque changement de statut : préparation, expédition, livraison.

Retard
En cas de retard supérieur à 48 heures sur Dakar, les frais de livraison sont remboursés.`,
  },
  {
    slug: "faq",
    title: "Questions fréquentes",
    required: false,
    body: `Comment choisir la taille ?
Les tailles suivent l'âge, mais taillent légèrement petit sur les ensembles en molleton. En cas de doute, prenez la taille au-dessus ou écrivez-nous : nous avons les mensurations exactes de chaque pièce.

Puis-je payer à la livraison ?
Oui, sur Dakar et banlieue. Le montant est réglé en espèces ou par Wave au livreur.

Puis-je commander sans compte ?
Oui. Le tunnel fonctionne en invité, seul le téléphone est obligatoire.

Les articles sont-ils en stock ?
Le stock affiché est le stock réel. Un article épuisé apparaît grisé et ne peut pas être ajouté au panier.

Proposez-vous des tailles adulte ?
Pas encore. La sélection couvre 0 à 15 ans.`,
  },
];

export const legalBySlug = (slug: string) => LEGAL_PAGES.find((p) => p.slug === slug);
