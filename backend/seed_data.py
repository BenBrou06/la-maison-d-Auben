import io
import os
from datetime import datetime, timezone

# Fichier Excel par défaut réel pour « Budget mensuel » (fourni par la marque).
DEFAULT_XLSX_PATH = os.path.join(os.path.dirname(__file__), "assets", "Budget-mensuel-DEFAULT.xlsx")
DEFAULT_XLSX_FILENAME = "Budget-mensuel.xlsx"


def load_default_xlsx() -> bytes:
    """Lit le vrai fichier Excel par défaut livré avec l'application."""
    with open(DEFAULT_XLSX_PATH, "rb") as f:
        return f.read()


# ---------------------------------------------------------------------------
# Contenu initial (source de vérité data-driven — ajouter un produit ne demande
# pas de toucher au code des pages).
# ---------------------------------------------------------------------------

SETTINGS = {
    "id": "site",
    "brand_name": "La Maison d'Auben",
    "tagline": "L'aubaine pour mieux s'organiser.",
    "slogans": [
        "L'aubaine pour mieux s'organiser.",
        "Des outils qui font la différence.",
        "De bonnes idées. De bons outils. Une belle aubaine.",
    ],
    "hero_intro": "Des outils numériques simples, beaux et intelligents pour mieux organiser votre vie, vos projets et vos envies. Le premier d'une longue série.",
    "newsletter_title": "Recevez nos nouveaux outils et ressources gratuitement.",
    "newsletter_text": "Pas de spam, juste nos meilleures idées pour mieux vous organiser, et nos nouveautés en avant-première.",
    "currency": "eur",
}

CATEGORIES = [
    {"slug": "budget-finance", "name": "Budget & Finance", "icon": "Wallet", "order": 1,
     "description": "Reprenez le contrôle de votre argent, simplement."},
    {"slug": "travel", "name": "Travel", "icon": "Plane", "order": 2,
     "description": "Préparez vos voyages et roadtrips l'esprit léger."},
    {"slug": "maison", "name": "Maison & Vie quotidienne", "icon": "Home", "order": 3,
     "description": "Organisez votre foyer et votre quotidien."},
    {"slug": "automobile", "name": "Automobile", "icon": "Car", "order": 4,
     "description": "Suivez le vrai coût de votre véhicule."},
    {"slug": "sport", "name": "Sport", "icon": "Dumbbell", "order": 5,
     "description": "Suivez vos entraînements et vos progrès."},
    {"slug": "couple", "name": "Couple", "icon": "Heart", "order": 6,
     "description": "Gérez vos projets et votre budget à deux."},
    {"slug": "lifestyle", "name": "Lifestyle", "icon": "Backpack", "order": 7,
     "description": "Des outils pour vos projets de vie."},
    {"slug": "loisirs", "name": "Loisirs", "icon": "Dices", "order": 8,
     "description": "Collections, randonnée, JDR et plus encore."},
]

GALLERY_SLOTS = [
    {"key": "dashboard", "caption": "Tableau de bord", "placeholder": True},
    {"key": "revenus", "caption": "Revenus", "placeholder": True},
    {"key": "depenses", "caption": "Dépenses", "placeholder": True},
    {"key": "historique", "caption": "Historique des opérations", "placeholder": True},
    {"key": "analyse", "caption": "Analyse du budget", "placeholder": True},
    {"key": "graphiques", "caption": "Graphiques", "placeholder": True},
]

PRODUCTS = [
    {
        "slug": "budget-mensuel",
        "name": "Budget mensuel",
        "category_slug": "budget-finance",
        "lookup_key": "budget_mensuel",
        "price": 7.99,
        "currency": "eur",
        "badge": "Nouveau",
        "status": "available",
        "short_description": "Le tableau de bord simple pour reprendre le contrôle de son budget.",
        "description": "Un outil simple et complet pour suivre ses revenus, ses dépenses, son épargne et ses objectifs, et mieux comprendre son budget au quotidien.",
        "audience": "Que vous soyez étudiant, jeune actif, en couple ou en famille, Budget mensuel vous aide à voir clair dans vos finances sans être un expert d'Excel. Aucune connaissance technique requise.",
        "features": [
            {"icon": "Wallet", "title": "Revenus", "text": "Enregistrez toutes vos rentrées d'argent en un coup d'œil."},
            {"icon": "Receipt", "title": "Dépenses", "text": "Dépenses fixes et variables, catégorisées automatiquement."},
            {"icon": "PiggyBank", "title": "Épargne", "text": "Suivez votre épargne mois après mois."},
            {"icon": "Target", "title": "Objectifs", "text": "Fixez des objectifs et mesurez votre progression."},
            {"icon": "Calendar", "title": "Suivi mensuel", "text": "Une vue claire pour chaque mois de l'année."},
            {"icon": "BarChart3", "title": "Analyse annuelle", "text": "Graphiques et indicateurs pour comprendre vos tendances."},
        ],
        "contents": [
            "Un fichier Excel prêt à l'emploi (compatible Google Sheets)",
            "Un tableau de bord automatisé avec graphiques",
            "Des feuilles Revenus, Dépenses, Épargne, Objectifs",
            "Un suivi mensuel et annuel",
            "Un guide de démarrage rapide",
        ],
        "compatibility": [
            "Microsoft Excel (Windows & Mac)",
            "Google Sheets",
            "LibreOffice Calc",
        ],
        "faq": [
            {"q": "Ai-je besoin de connaître Excel ?", "a": "Non. Le fichier est pensé pour les débutants : vous remplissez, tout se calcule automatiquement."},
            {"q": "Le fichier fonctionne-t-il sur Mac ?", "a": "Oui, il fonctionne sur Excel Windows et Mac, ainsi que sur Google Sheets."},
            {"q": "Puis-je le personnaliser ?", "a": "Bien sûr. Catégories, couleurs et intitulés sont entièrement modifiables."},
            {"q": "Comment je reçois le fichier ?", "a": "Immédiatement après le paiement, via un lien de téléchargement sécurisé et par e-mail."},
        ],
        "seo": {
            "title": "Budget mensuel — Template Excel pour gérer son budget | La Maison d'Auben",
            "description": "Un template Excel simple et complet pour suivre vos revenus, dépenses, épargne et objectifs. Reprenez le contrôle de votre budget dès 7,99 €.",
        },
        "gallery": GALLERY_SLOTS,
        "main_image_placeholder": True,
    },
]

# Produits « Bientôt disponible » (ambition de la marque, sans tromper l'utilisateur).
# Fiches complètes et data-driven : dès qu'un fichier + un prix sont ajoutés via l'admin,
# le produit devient automatiquement achetable, sans toucher au code.
def _cs_gallery(*captions):
    return [{"key": f"slot-{i}", "caption": c, "placeholder": True} for i, c in enumerate(captions)]


COMING_SOON = [
    {
        "slug": "travel-manager", "name": "Travel Manager", "category_slug": "travel",
        "lookup_key": "travel_manager", "status": "coming_soon", "price": None, "currency": "eur",
        "short_description": "Planifiez chaque voyage, du budget à l'itinéraire.",
        "description": "Travel Manager réunit au même endroit le budget, l'itinéraire, les réservations et les checklists de vos voyages. Fini les notes éparpillées : préparez chaque départ sereinement et profitez pleinement une fois sur place.",
        "audience": "Pour les voyageurs solo, en couple ou en famille qui veulent un voyage bien organisé sans y passer des heures. Aucune compétence Excel requise.",
        "features": [
            {"icon": "Compass", "title": "Itinéraire jour par jour", "text": "Organisez vos étapes, vols et trajets dans une vue claire."},
            {"icon": "Wallet", "title": "Budget voyage", "text": "Estimez et suivez vos dépenses par poste et par jour."},
            {"icon": "Calendar", "title": "Réservations", "text": "Centralisez hébergements, activités et confirmations."},
            {"icon": "Luggage", "title": "Checklists", "text": "Listes de bagages et de préparatifs pour ne rien oublier."},
            {"icon": "Target", "title": "Épargne voyage", "text": "Préparez le financement de votre prochain départ."},
            {"icon": "BarChart3", "title": "Bilan post-voyage", "text": "Comparez le budget prévu et les dépenses réelles."},
        ],
        "contents": [
            "Un fichier Excel prêt à l'emploi (compatible Google Sheets)",
            "Un planificateur d'itinéraire multi-jours",
            "Un budget voyage détaillé par poste",
            "Des checklists de préparation et de bagages",
            "Un suivi des réservations et confirmations",
        ],
        "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
        "faq": [
            {"q": "Puis-je gérer plusieurs voyages ?", "a": "Oui, il suffira de dupliquer l'onglet voyage pour chaque nouveau départ."},
            {"q": "Faut-il une connexion Internet ?", "a": "Non, le fichier fonctionne hors ligne une fois téléchargé."},
            {"q": "Quand sera-t-il disponible ?", "a": "Travel Manager arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier."},
        ],
        "seo": {"title": "Travel Manager — Organisez vos voyages | La Maison d'Auben",
                "description": "Budget, itinéraire, réservations et checklists de voyage réunis dans un seul fichier Excel. Bientôt disponible."},
        "gallery": _cs_gallery("Itinéraire", "Budget voyage", "Checklist bagages"),
        "main_image_placeholder": True,
    },
    {
        "slug": "car-cost", "name": "Car Cost", "category_slug": "automobile",
        "lookup_key": "car_cost", "status": "coming_soon", "price": None, "currency": "eur",
        "short_description": "Le vrai coût de votre voiture, enfin clair.",
        "description": "Car Cost révèle le coût réel de votre véhicule : achat, carburant, assurance, entretien, décote… Vous savez enfin ce que votre voiture vous coûte vraiment, au mois comme à l'année.",
        "audience": "Pour tout automobiliste qui veut maîtriser son budget auto et décider d'acheter, garder ou revendre en connaissance de cause.",
        "features": [
            {"icon": "Car", "title": "Coût total de possession", "text": "Rassemblez tous les postes de dépense dans un tableau unique."},
            {"icon": "Fuel", "title": "Carburant", "text": "Suivez vos pleins et votre consommation moyenne."},
            {"icon": "Wrench", "title": "Entretien & réparations", "text": "Révisions, pneus, réparations : rien n'est oublié."},
            {"icon": "Wallet", "title": "Assurance & taxes", "text": "Intégrez primes, contrôle technique et stationnement."},
            {"icon": "TrendingUp", "title": "Décote", "text": "Estimez la perte de valeur de votre véhicule dans le temps."},
            {"icon": "BarChart3", "title": "Coût par mois & par km", "text": "Visualisez combien vous coûte réellement chaque kilomètre."},
        ],
        "contents": [
            "Un fichier Excel prêt à l'emploi (compatible Google Sheets)",
            "Un calcul du coût total de possession",
            "Un suivi carburant et entretien",
            "Une estimation de la décote",
            "Un comparateur pour plusieurs véhicules",
        ],
        "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
        "faq": [
            {"q": "Dois-je connaître toutes mes dépenses ?", "a": "Non, vous remplissez ce que vous avez : les totaux et moyennes se calculent automatiquement."},
            {"q": "Puis-je comparer plusieurs voitures ?", "a": "Oui, l'outil permettra de comparer le coût réel de plusieurs véhicules."},
            {"q": "Quand sera-t-il disponible ?", "a": "Car Cost arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier."},
        ],
        "seo": {"title": "Car Cost — Le coût réel de votre voiture | La Maison d'Auben",
                "description": "Calculez le coût total de votre véhicule : carburant, entretien, assurance, décote. Bientôt disponible."},
        "gallery": _cs_gallery("Coût total", "Carburant & entretien", "Comparaison"),
        "main_image_placeholder": True,
    },
    {
        "slug": "first-apartment", "name": "First Apartment", "category_slug": "maison",
        "lookup_key": "first_apartment", "status": "coming_soon", "price": None, "currency": "eur",
        "short_description": "Préparez votre premier appartement sereinement.",
        "description": "First Apartment vous accompagne pour votre premier logement : budget d'installation, checklist d'emménagement, inventaire et suivi des charges mensuelles. Emménagez l'esprit tranquille.",
        "audience": "Pour les étudiants et jeunes actifs qui s'installent pour la première fois et veulent tout anticiper, sans mauvaise surprise.",
        "features": [
            {"icon": "Home", "title": "Budget d'installation", "text": "Chiffrez meubles, électroménager et premiers achats."},
            {"icon": "Wallet", "title": "Charges mensuelles", "text": "Loyer, énergie, Internet, assurance : tout au même endroit."},
            {"icon": "ClipboardList", "title": "Checklist d'emménagement", "text": "Les démarches et achats à ne pas oublier."},
            {"icon": "Boxes", "title": "Inventaire", "text": "Recensez ce que vous avez et ce qu'il reste à acheter."},
            {"icon": "PiggyBank", "title": "Dépôt de garantie", "text": "Anticipez la caution et les frais d'entrée."},
            {"icon": "Calendar", "title": "Échéancier", "text": "Planifiez vos démarches dans le temps."},
        ],
        "contents": [
            "Un fichier Excel prêt à l'emploi (compatible Google Sheets)",
            "Un budget d'installation détaillé",
            "Une checklist d'emménagement",
            "Un inventaire par pièce",
            "Un suivi des charges mensuelles",
        ],
        "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
        "faq": [
            {"q": "C'est utile même pour un studio ?", "a": "Oui, l'outil s'adapte à toutes les tailles de logement."},
            {"q": "Puis-je l'utiliser en colocation ?", "a": "Oui, vous pourrez répartir les charges entre colocataires."},
            {"q": "Quand sera-t-il disponible ?", "a": "First Apartment arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier."},
        ],
        "seo": {"title": "First Apartment — Réussir son premier logement | La Maison d'Auben",
                "description": "Budget d'installation, checklist d'emménagement et suivi des charges pour votre premier appartement. Bientôt disponible."},
        "gallery": _cs_gallery("Budget d'installation", "Checklist", "Charges"),
        "main_image_placeholder": True,
    },
    {
        "slug": "budget-couple", "name": "Budget Couple", "category_slug": "couple",
        "lookup_key": "budget_couple", "status": "coming_soon", "price": None, "currency": "eur",
        "short_description": "Gérez votre budget à deux, en toute transparence.",
        "description": "Budget Couple aide à gérer l'argent à deux en toute transparence : revenus, dépenses communes, répartition équitable et projets partagés. Moins de tensions, plus de projets.",
        "audience": "Pour les couples qui veulent organiser leurs finances communes simplement, quelle que soit leur organisation (compte commun ou comptes séparés).",
        "features": [
            {"icon": "Heart", "title": "Dépenses communes", "text": "Centralisez toutes les dépenses du foyer."},
            {"icon": "Users", "title": "Répartition équitable", "text": "Répartissez les dépenses au prorata des revenus ou à parts égales."},
            {"icon": "PiggyBank", "title": "Épargne commune", "text": "Suivez votre épargne et vos réserves à deux."},
            {"icon": "Target", "title": "Projets à deux", "text": "Fixez et financez vos projets communs (voyage, logement…)."},
            {"icon": "Receipt", "title": "Qui a payé quoi", "text": "Gardez une trace claire des avances de chacun."},
            {"icon": "BarChart3", "title": "Vue d'ensemble", "text": "Une synthèse claire du budget du couple."},
        ],
        "contents": [
            "Un fichier Excel prêt à l'emploi (compatible Google Sheets)",
            "Un suivi des revenus et dépenses du couple",
            "Une répartition équitable automatique",
            "Un suivi de l'épargne commune",
            "Un espace projets partagés",
        ],
        "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
        "faq": [
            {"q": "Faut-il un compte commun ?", "a": "Non, l'outil fonctionne que vous ayez un compte commun, des comptes séparés ou les deux."},
            {"q": "Comment se fait la répartition ?", "a": "Vous choisirez : à parts égales ou au prorata des revenus de chacun."},
            {"q": "Quand sera-t-il disponible ?", "a": "Budget Couple arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier."},
        ],
        "seo": {"title": "Budget Couple — Gérer son argent à deux | La Maison d'Auben",
                "description": "Dépenses communes, répartition équitable et projets partagés dans un seul fichier Excel. Bientôt disponible."},
        "gallery": _cs_gallery("Dépenses communes", "Répartition", "Projets"),
        "main_image_placeholder": True,
    },
    {
        "slug": "suivi-sportif", "name": "Suivi sportif", "category_slug": "sport",
        "lookup_key": "suivi_sportif", "status": "coming_soon", "price": None, "currency": "eur",
        "short_description": "Planifiez vos séances et suivez vos progrès semaine après semaine.",
        "description": "Suivi sportif vous aide à planifier vos séances, suivre vos performances et visualiser vos progrès semaine après semaine. Restez motivé·e et régulier·ère, à la salle comme à la maison.",
        "audience": "Pour les sportifs de tout niveau qui veulent structurer leurs entraînements et mesurer concrètement leurs progrès.",
        "features": [
            {"icon": "Dumbbell", "title": "Programme d'entraînement", "text": "Construisez vos séances par exercice, série et répétition."},
            {"icon": "Calendar", "title": "Planning des séances", "text": "Organisez votre semaine d'entraînement d'un coup d'œil."},
            {"icon": "Target", "title": "Objectifs", "text": "Fixez des objectifs de poids, de reps ou de régularité."},
            {"icon": "Activity", "title": "Suivi des performances", "text": "Notez vos charges, temps et sensations à chaque séance."},
            {"icon": "BarChart3", "title": "Progression", "text": "Visualisez vos courbes de progrès dans le temps."},
            {"icon": "Heart", "title": "Suivi santé", "text": "Poids, mensurations et bien-être au fil des semaines."},
        ],
        "contents": [
            "Un fichier Excel prêt à l'emploi (compatible Google Sheets)",
            "Un planificateur de séances hebdomadaire",
            "Un suivi des performances par exercice",
            "Des graphiques de progression",
            "Un suivi poids & mensurations",
        ],
        "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
        "faq": [
            {"q": "C'est adapté aux débutants ?", "a": "Oui, l'outil convient à tous les niveaux, de la découverte à la pratique confirmée."},
            {"q": "Est-ce lié à une salle précise ?", "a": "Non, il s'utilise pour tout type d'entraînement, en salle ou à la maison."},
            {"q": "Quand sera-t-il disponible ?", "a": "Suivi sportif arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier."},
        ],
        "seo": {"title": "Suivi sportif — Planifiez et suivez vos progrès | La Maison d'Auben",
                "description": "Programme d'entraînement, suivi des performances et progression dans un seul fichier Excel. Bientôt disponible."},
        "gallery": _cs_gallery("Programme", "Progression", "Suivi santé"),
        "main_image_placeholder": True,
    },
]

ARTICLES = [
    {
        "slug": "comment-faire-son-budget-mensuel",
        "title": "Comment faire son budget mensuel ?",
        "category": "Budget & Finance",
        "excerpt": "La méthode simple pour poser son budget en 30 minutes, même quand on part de zéro.",
        "read_time": 6,
        "cover_image": "https://images.unsplash.com/photo-1564510714747-69c3bc1fab41?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "related_product_slugs": ["budget-mensuel"],
        "published_at": "2026-01-15T09:00:00+00:00",
        "content": [
            {"type": "p", "text": "Faire son budget n'a rien de compliqué. L'objectif n'est pas de tout contrôler au centime près, mais de voir clair : combien entre, combien sort, et ce qu'il reste."},
            {"type": "h2", "text": "1. Faites la liste de vos revenus"},
            {"type": "p", "text": "Commencez par le plus simple : tout l'argent qui rentre chaque mois. Salaire, aides, revenus complémentaires. Notez le montant net, celui que vous recevez réellement."},
            {"type": "h2", "text": "2. Séparez dépenses fixes et variables"},
            {"type": "p", "text": "Les dépenses fixes (loyer, abonnements, assurances) tombent chaque mois. Les variables (courses, sorties, imprévus) bougent. Les distinguer change tout."},
            {"type": "h2", "text": "3. Fixez un objectif d'épargne"},
            {"type": "p", "text": "Même petit, un objectif régulier fait la différence. Payez-vous en premier : mettez de côté dès le début du mois, pas avec ce qu'il reste à la fin."},
        ],
        "cta_text": "Vous souhaitez aller plus loin ? Découvrez Budget mensuel.",
    },
    {
        "slug": "combien-coute-reellement-une-voiture",
        "title": "Combien coûte réellement une voiture ?",
        "category": "Automobile",
        "excerpt": "Au-delà du prix d'achat, voici tous les coûts qu'on oublie trop souvent.",
        "read_time": 7,
        "cover_image": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "related_product_slugs": [],
        "published_at": "2026-01-10T09:00:00+00:00",
        "content": [
            {"type": "p", "text": "Le prix affiché n'est que la partie visible de l'iceberg. Une voiture coûte bien plus que son ticket d'achat."},
            {"type": "h2", "text": "Les coûts cachés"},
            {"type": "p", "text": "Assurance, carburant, entretien, pneus, décote, stationnement... Additionnés sur une année, ces postes dépassent souvent la mensualité de crédit."},
        ],
        "cta_text": "Car Cost arrive bientôt dans la Maison.",
    },
    {
        "slug": "comment-commencer-a-epargner",
        "title": "Comment commencer à épargner ?",
        "category": "Budget & Finance",
        "excerpt": "Trois habitudes simples pour se constituer une épargne, sans se priver.",
        "read_time": 5,
        "cover_image": "https://images.pexels.com/photos/8251157/pexels-photo-8251157.jpeg?auto=compress&cs=tinysrgb&w=1200",
        "related_product_slugs": ["budget-mensuel"],
        "published_at": "2026-01-05T09:00:00+00:00",
        "content": [
            {"type": "p", "text": "Épargner, ce n'est pas gagner plus. C'est surtout organiser ce que l'on a déjà."},
            {"type": "h2", "text": "Automatisez"},
            {"type": "p", "text": "Programmez un virement automatique le jour de la paie. Ce que vous ne voyez pas, vous ne le dépensez pas."},
        ],
        "cta_text": "Vous souhaitez aller plus loin ? Découvrez Budget mensuel.",
    },
]

GLOBAL_FAQ = [
    {"question": "Comment vais-je recevoir mon produit ?", "answer": "Dès votre paiement validé, vous accédez immédiatement à un lien de téléchargement sécurisé, et vous recevez également un e-mail de confirmation avec ce lien.", "order": 1},
    {"question": "Les paiements sont-ils sécurisés ?", "answer": "Oui. Les paiements sont traités par Stripe, un acteur de référence mondial. Nous ne stockons aucune donnée bancaire.", "order": 2},
    {"question": "Ai-je besoin d'un compte pour acheter ?", "answer": "Non. Vous pouvez acheter et télécharger votre produit sans créer de compte.", "order": 3},
    {"question": "Puis-je être remboursé ?", "answer": "Nos produits étant numériques et téléchargeables immédiatement, les conditions de remboursement sont précisées dans nos CGV. Contactez-nous en cas de problème, nous cherchons toujours une solution.", "order": 4},
    {"question": "Sur quels logiciels fonctionnent les fichiers ?", "answer": "Nos templates fonctionnent avec Microsoft Excel, Google Sheets et LibreOffice Calc. La compatibilité précise est indiquée sur chaque fiche produit.", "order": 5},
]


def build_placeholder_xlsx() -> bytes:
    """Fichier Excel PLACEHOLDER, clairement identifié comme tel, remplaçable
    par le vrai fichier via l'administration."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    wb = Workbook()
    ws = wb.active
    ws.title = "Budget mensuel"
    green = PatternFill(start_color="1E3A2B", end_color="1E3A2B", fill_type="solid")
    ws["B2"] = "La Maison d'Auben — Budget mensuel"
    ws["B2"].font = Font(bold=True, size=16, color="1E3A2B")
    ws["B4"] = "FICHIER PLACEHOLDER"
    ws["B4"].font = Font(bold=True, color="FFFFFF")
    ws["B4"].fill = green
    ws["B6"] = "Ceci est un fichier de démonstration."
    ws["B7"] = "Remplacez-le par le vrai fichier Excel depuis l'administration."
    for i, h in enumerate(["Mois", "Revenus", "Dépenses fixes", "Dépenses variables", "Épargne"]):
        c = ws.cell(row=10, column=2 + i, value=h)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = green
        c.alignment = Alignment(horizontal="center")
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
