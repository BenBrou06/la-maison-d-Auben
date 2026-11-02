# Products BEFORE snapshot + validation report

- DB: `auben-preview-shop-test_database`
- Collection: `products`
- Run: `5efd9f8c-b4ca-450c-97b4-f9aa6e547cdb`
- Mode: STRICTLY READ-ONLY (no writes, no Stripe, no redeploy)
- Requested file name: `products_BEFORE_fix.json` — the deployer agent can only write to this fixed RCA path, so the verbatim snapshot is embedded below under "BEFORE snapshot (verbatim)". Treat this file as `products_BEFORE_fix.json`.

## Validation summary — ALL PASS

| Check | Result | Evidence |
|---|---|---|
| Exactly 6 documents | PASS | count = 6 |
| budget-mensuel lookup_key=="budget_mensuel" & currency=="eur" | PASS | lookup_key="budget_mensuel", currency="eur" |
| suivi-sportif price==5.99 & status=="available" | PASS | price=5.99, status="available" |
| travel-manager price null & status "coming_soon" | PASS | price=null, status="coming_soon" |
| car-cost price null & status "coming_soon" | PASS | price=null, status="coming_soon" |
| first-apartment price null & status "coming_soon" | PASS | price=null, status="coming_soon" |
| budget-couple price null & status "coming_soon" | PASS | price=null, status="coming_soon" |
| 5 slugs (suivi-sportif, travel-manager, car-cost, first-apartment, budget-couple) have lookup_key AND currency ABSENT | PASS | none of the 5 carry either key |
| No doc has lookup_key in [suivi_sportif, travel_manager, car_cost, first_apartment, budget_couple] | PASS | only doc with lookup_key is budget-mensuel = "budget_mensuel" |

## Per-document top-level field names (sorted)

**first-apartment** (First Apartment):
`_id, audience, badge, category_slug, compatibility, contents, created_at, description, faq, features, gallery, main_image, name, price, seo, short_description, slug, status`

**suivi-sportif** (Suivi sportif):
`_id, audience, badge, category_slug, compatibility, contents, created_at, description, download_filename, download_is_placeholder, download_storage_path, faq, features, gallery, main_image, name, price, seo, short_description, slug, status`

**budget-mensuel** (Budget mensuel):
`_id, audience, badge, category_slug, compatibility, contents, created_at, currency, description, download_filename, download_is_placeholder, download_storage_path, faq, features, gallery, lookup_key, main_image, main_image_placeholder, name, price, seo, short_description, slug, status`

**travel-manager** (Travel Manager):
`_id, audience, badge, category_slug, compatibility, contents, created_at, description, faq, features, gallery, main_image, name, price, seo, short_description, slug, status`

**car-cost** (Car Cost):
`_id, audience, badge, category_slug, compatibility, contents, created_at, description, faq, features, gallery, main_image, name, price, seo, short_description, slug, status`

**budget-couple** (Budget Couple):
`_id, audience, badge, category_slug, compatibility, contents, created_at, description, faq, features, gallery, main_image, name, price, seo, short_description, slug, status`

## BEFORE snapshot (verbatim) — products_BEFORE_fix.json

```json
[
  {
    "_id": "6ab036614f2c54c9b313931d",
    "audience": "Pour les étudiants et jeunes actifs qui s'installent pour la première fois et veulent tout anticiper, sans mauvaise surprise.",
    "badge": "",
    "category_slug": "maison",
    "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
    "contents": ["Un fichier Excel prêt à l'emploi (compatible Google Sheets)", "Un budget d'installation détaillé", "Une checklist d'emménagement", "Un inventaire par pièce", "Un suivi des charges mensuelles"],
    "created_at": "2026-09-20T19:39:13.538431+00:00",
    "description": "First Apartment vous accompagne pour votre premier logement : budget d'installation, checklist d'emménagement, inventaire et suivi des charges mensuelles. Emménagez l'esprit tranquille.",
    "faq": [{"a": "Oui, l'outil s'adapte à toutes les tailles de logement.", "q": "C'est utile même pour un studio ?"}, {"a": "Oui, vous pourrez répartir les charges entre colocataires.", "q": "Puis-je l'utiliser en colocation ?"}, {"a": "First Apartment arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier.", "q": "Quand sera-t-il disponible ?"}],
    "features": [{"icon": "Home", "text": "Chiffrez meubles, électroménager et premiers achats.", "title": "Budget d'installation"}, {"icon": "Wallet", "text": "Loyer, énergie, Internet, assurance : tout au même endroit.", "title": "Charges mensuelles"}, {"icon": "ClipboardList", "text": "Les démarches et achats à ne pas oublier.", "title": "Checklist d'emménagement"}, {"icon": "Boxes", "text": "Recensez ce que vous avez et ce qu'il reste à acheter.", "title": "Inventaire"}, {"icon": "PiggyBank", "text": "Anticipez la caution et les frais d'entrée.", "title": "Dépôt de garantie"}, {"icon": "Calendar", "text": "Planifiez vos démarches dans le temps.", "title": "Échéancier"}],
    "gallery": [{"caption": "Budget d'installation", "key": "slot-0", "storage_path": "", "url": ""}, {"caption": "Checklist", "key": "slot-1", "storage_path": "", "url": ""}, {"caption": "Charges", "key": "slot-2", "storage_path": "", "url": ""}],
    "main_image": "",
    "name": "First Apartment",
    "price": null,
    "seo": {"description": "Budget d'installation, checklist d'emménagement et suivi des charges pour votre premier appartement. Bientôt disponible.", "title": "First Apartment - Réussir son premier logement | La Maison d'Auben"},
    "short_description": "Préparez votre premier appartement sereinement.",
    "slug": "first-apartment",
    "status": "coming_soon"
  },
  {
    "_id": "6ab101e75bfb54267285be52",
    "audience": "Pour les sportifs de tout niveau qui veulent structurer leurs entraînements et mesurer concrètement leurs progrès.",
    "badge": "Nouveau",
    "category_slug": "sport",
    "compatibility": ["Microsoft Excel (Windows & Mac)", "LibreOffice Calc"],
    "contents": ["Un fichier Excel prêt à l'emploi", "Un planificateur de séances hebdomadaire", "Un suivi des performances par exercice", "Des graphiques de progression", "Un suivi poids"],
    "created_at": "2026-09-21T10:07:35.367579+00:00",
    "description": "Suivi sportif vous aide à planifier vos séances, suivre vos performances et visualiser vos progrès semaine après semaine. Restez motivé·e et régulier·ère, à la salle comme à la maison.",
    "download_filename": "Suivi-Sport.xlsx",
    "download_is_placeholder": false,
    "download_storage_path": "maison-auben/files/suivi-sportif/a4984cb5-9d35-49f2-ae49-cd847c650181.xlsx",
    "faq": [{"a": "Oui, l'outil convient à tous les niveaux, de la découverte à la pratique confirmée.", "q": "C'est adapté aux débutants ?"}, {"a": "Non, il s'utilise pour tout type d'entraînement, en salle, en plein air ou à la maison.", "q": "Est-ce lié à une salle précise ou de l'équipement précis ?"}, {"a": "Oui, l'outil permet de renseigner des informations comme le sexe, la taille, le poids, les objectifs et vous permet d'adapter votre suivi à vos besoin.", "q": "Puis-je adapter et paramétrer le suivi à mes objectifs personnels ?"}],
    "features": [{"icon": "Dumbbell", "text": "Construisez vos séances par exercice, série et répétition.", "title": "Programme d'entraînement"}, {"icon": "Calendar", "text": "Organisez votre semaine d'entraînement d'un coup d'œil.", "title": "Planning des séances"}, {"icon": "Target", "text": "Fixez des objectifs de poids, de reps ou de régularité.", "title": "Objectifs"}, {"icon": "Activity", "text": "Notez vos charges, temps et sensations à chaque séance.", "title": "Suivi des performances"}, {"icon": "BarChart3", "text": "Visualisez vos courbes de progrès dans le temps.", "title": "Progression"}, {"icon": "Heart", "text": "Poids et bien-être au fil des semaines.", "title": "Suivi santé"}],
    "gallery": [{"caption": "Profil sportif", "key": "slot-0", "storage_path": "maison-auben/images/05bf08b3-7a92-4017-ae15-5617969fc107.png", "url": ""}, {"caption": "Suivi", "key": "slot-2", "storage_path": "maison-auben/images/50d2e5c5-c94e-417c-8b57-f0303d8ca668.png", "url": ""}, {"caption": "Programmer tes séances", "key": "slot-1", "storage_path": "maison-auben/images/ad79f44b-294b-4ae3-9b68-a1c3f2ede577.png", "url": ""}, {"caption": "Analyse", "key": "slot-1793369871964", "storage_path": "maison-auben/images/2ccc3a05-9843-4c59-a25e-8c58016babb5.png", "url": ""}],
    "main_image": "maison-auben/images/d8c109bb-29b7-45d3-bba3-0b0308d64ed1.png",
    "name": "Suivi sportif",
    "price": 5.99,
    "seo": {"description": "Programme d'entraînement, suivi des performances et progression dans un seul fichier Excel. Disponible !", "title": "Suivi sportif - Planifiez et suivez vos progrès | La Maison d'Auben"},
    "short_description": "Planifiez vos séances et suivez vos progrès semaine après semaine.",
    "slug": "suivi-sportif",
    "status": "available"
  },
  {
    "_id": "6ab036616c287379456af1b3",
    "audience": "Que vous soyez étudiant, jeune actif, en couple ou en famille, Budget mensuel vous aide à voir clair dans vos finances sans être un expert d'Excel. Aucune connaissance technique requise !",
    "badge": "",
    "category_slug": "budget-finance",
    "compatibility": ["Microsoft Excel (Windows & Mac)", "LibreOffice Calc"],
    "contents": ["Un fichier Excel prêt à l'emploi", "Un tableau de bord automatisé avec graphiques", "Des catégories et sections personnalisables pour suivre ce qui compte vraiment pour vous", "Un suivi de vos différents investissements avec des objectifs concrets", "Un suivi mensuel précis et pilotable facilement", "Un guide de démarrage rapide"],
    "created_at": "2026-09-20T19:39:13.527540+00:00",
    "currency": "eur",
    "description": "Un outil simple et complet pour suivre ses revenus, ses dépenses, son épargne et ses objectifs, et mieux comprendre son budget au quotidien.",
    "download_filename": "Budget_mensuel.zip",
    "download_is_placeholder": false,
    "download_storage_path": "maison-auben/files/budget-mensuel/9b140c08-b898-4a82-b100-9c8707432f12.zip",
    "faq": [{"a": "Non. Le fichier est pensé pour les débutants : vous remplissez, tout se calcule automatiquement.", "q": "Ai-je besoin de connaître Excel ?"}, {"a": "Oui, il fonctionne sur Excel Windows et Mac, Google Sheets n'est pas encore compatible mais le sera très prochainement.", "q": "Le fichier fonctionne-t-il sur Mac ?"}, {"a": "Bien sûr. Catégories et intitulés sont entièrement modifiables. Ce qui en fait la force, c'est que c'est un outil adapté à VOS besoins", "q": "Puis-je le personnaliser ?"}, {"a": "Immédiatement après le paiement, via un lien de téléchargement sécurisé et par e-mail.", "q": "Comment je reçois le fichier ?"}],
    "features": [{"icon": "Wallet", "text": "Enregistrez toutes vos rentrées d'argent en un coup d'œil. Catégories et sections entièrement personnalisables.", "title": "Revenus"}, {"icon": "Receipt", "text": "Dépenses fixes et variables, catégorisées automatiquement.", "title": "Dépenses"}, {"icon": "PiggyBank", "text": "Suivez votre épargne jour après jour afin de ne pas perdre le compte.", "title": "Épargne et investissements"}, {"icon": "Target", "text": "Fixez des objectifs et mesurez votre progression.", "title": "Objectifs"}, {"icon": "Calendar", "text": "Une vue claire pour chaque mois de l'année.", "title": "Suivi mensuel"}, {"icon": "BarChart3", "text": "Graphiques et indicateurs pour comprendre vos tendances.", "title": "Analyse mensuelle et annuelle"}],
    "gallery": [{"caption": "Tableau de bord", "key": "dashboard", "storage_path": "maison-auben/images/82f605c5-33e6-4383-89c0-16323e22ab7e.png", "url": ""}, {"caption": "Historique des opérations", "key": "slot-1791400058905", "storage_path": "maison-auben/images/53123948-9dfc-454b-8f89-19b6b8404f83.png", "url": ""}, {"caption": "Analyse du budget", "key": "analyse", "storage_path": "maison-auben/images/60ca2fe2-56e8-45ac-ad75-0e452aab835a.png", "url": ""}, {"caption": "Suivi de l'épargne", "key": "slot-1792405515857", "storage_path": "maison-auben/images/b2d7463e-9a6c-485e-a180-25dc22a53b11.png", "url": ""}],
    "lookup_key": "budget_mensuel",
    "main_image": "maison-auben/images/d3cf52f9-07cf-436c-819b-954506e96d91.png",
    "main_image_placeholder": true,
    "name": "Budget mensuel",
    "price": 6.99,
    "seo": {"description": "Un template Excel simple et complet pour suivre vos revenus, dépenses, épargne et objectifs. Reprenez le contrôle de votre budget.", "title": "Budget mensuel - Savoir gérer son budget | La Maison d'Auben"},
    "short_description": "Le tableau de bord simple pour reprendre le contrôle de son budget.",
    "slug": "budget-mensuel",
    "status": "available"
  },
  {
    "_id": "6ab036614f2c54c9b3139319",
    "audience": "Pour les voyageurs solo, en couple ou en famille qui veulent un voyage bien organisé sans y passer des heures. Aucune compétence Excel requise.",
    "badge": "",
    "category_slug": "travel",
    "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
    "contents": ["Un fichier Excel prêt à l'emploi (compatible Google Sheets)", "Un planificateur d'itinéraire multi-jours", "Un budget voyage détaillé par poste", "Des checklists de préparation et de bagages", "Un suivi des réservations et confirmations"],
    "created_at": "2026-09-20T19:39:13.537627+00:00",
    "description": "Travel Manager réunit au même endroit le budget, l'itinéraire, les réservations et les checklists de vos voyages. Fini les notes éparpillées : préparez chaque départ sereinement et profitez pleinement une fois sur place.",
    "faq": [{"a": "Oui, il suffira de dupliquer l'onglet voyage pour chaque nouveau départ.", "q": "Puis-je gérer plusieurs voyages ?"}, {"a": "Non, le fichier fonctionne hors ligne une fois téléchargé.", "q": "Faut-il une connexion Internet ?"}, {"a": "Travel Manager arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier.", "q": "Quand sera-t-il disponible ?"}],
    "features": [{"icon": "Compass", "text": "Organisez vos étapes, vols et trajets dans une vue claire.", "title": "Itinéraire jour par jour"}, {"icon": "Wallet", "text": "Estimez et suivez vos dépenses par poste et par jour.", "title": "Budget voyage"}, {"icon": "Calendar", "text": "Centralisez hébergements, activités et confirmations.", "title": "Réservations"}, {"icon": "Luggage", "text": "Listes de bagages et de préparatifs pour ne rien oublier.", "title": "Checklists"}, {"icon": "Target", "text": "Préparez le financement de votre prochain départ.", "title": "Épargne voyage"}, {"icon": "BarChart3", "text": "Comparez le budget prévu et les dépenses réelles.", "title": "Bilan post-voyage"}],
    "gallery": [{"caption": "Itinéraire", "key": "slot-0", "storage_path": "", "url": ""}, {"caption": "Budget voyage", "key": "slot-1", "storage_path": "", "url": ""}, {"caption": "Checklist bagages", "key": "slot-2", "storage_path": "", "url": ""}],
    "main_image": "",
    "name": "Travel Manager",
    "price": null,
    "seo": {"description": "Budget, itinéraire, réservations et checklists de voyage réunis dans un seul fichier Excel. Bientôt disponible.", "title": "Travel Manager - Organisez vos voyages | La Maison d'Auben"},
    "short_description": "Planifiez chaque voyage, du budget à l'itinéraire.",
    "slug": "travel-manager",
    "status": "coming_soon"
  },
  {
    "_id": "6ab036614f2c54c9b313931b",
    "audience": "Pour tout automobiliste qui veut maîtriser son budget auto et décider d'acheter, garder ou revendre en connaissance de cause.",
    "badge": "",
    "category_slug": "automobile",
    "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
    "contents": ["Un fichier Excel prêt à l'emploi (compatible Google Sheets)", "Un calcul du coût total de possession", "Un suivi carburant et entretien", "Une estimation de la décote", "Un comparateur pour plusieurs véhicules"],
    "created_at": "2026-09-20T19:39:13.538132+00:00",
    "description": "Car Cost révèle le coût réel de votre véhicule : achat, carburant, assurance, entretien, décote… Vous savez enfin ce que votre voiture vous coûte vraiment, au mois comme à l'année.",
    "faq": [{"a": "Non, vous remplissez ce que vous avez : les totaux et moyennes se calculent automatiquement.", "q": "Dois-je connaître toutes mes dépenses ?"}, {"a": "Oui, l'outil permettra de comparer le coût réel de plusieurs véhicules.", "q": "Puis-je comparer plusieurs voitures ?"}, {"a": "Car Cost arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier.", "q": "Quand sera-t-il disponible ?"}],
    "features": [{"icon": "Car", "text": "Rassemblez tous les postes de dépense dans un tableau unique.", "title": "Coût total de possession"}, {"icon": "Fuel", "text": "Suivez vos pleins et votre consommation moyenne.", "title": "Carburant"}, {"icon": "Wrench", "text": "Révisions, pneus, réparations : rien n'est oublié.", "title": "Entretien & réparations"}, {"icon": "Wallet", "text": "Intégrez primes, contrôle technique et stationnement.", "title": "Assurance & taxes"}, {"icon": "TrendingUp", "text": "Estimez la perte de valeur de votre véhicule dans le temps.", "title": "Décote"}, {"icon": "BarChart3", "text": "Visualisez combien vous coûte réellement chaque kilomètre.", "title": "Coût par mois & par km"}],
    "gallery": [{"caption": "Coût total", "key": "slot-0", "storage_path": "", "url": ""}, {"caption": "Carburant & entretien", "key": "slot-1", "storage_path": "", "url": ""}, {"caption": "Comparaison", "key": "slot-2", "storage_path": "", "url": ""}],
    "main_image": "",
    "name": "Car Cost",
    "price": null,
    "seo": {"description": "Calculez le coût total de votre véhicule : carburant, entretien, assurance, décote. Bientôt disponible.", "title": "Car Cost - Le coût réel de votre voiture | La Maison d'Auben"},
    "short_description": "Le vrai coût de votre voiture, enfin clair.",
    "slug": "car-cost",
    "status": "coming_soon"
  },
  {
    "_id": "6ab036614f2c54c9b313931f",
    "audience": "Pour les couples qui veulent organiser leurs finances communes simplement, quelle que soit leur organisation (compte commun ou comptes séparés).",
    "badge": "",
    "category_slug": "couple",
    "compatibility": ["Microsoft Excel (Windows & Mac)", "Google Sheets", "LibreOffice Calc"],
    "contents": ["Un fichier Excel prêt à l'emploi (compatible Google Sheets)", "Un suivi des revenus et dépenses du couple", "Une répartition équitable automatique", "Un suivi de l'épargne commune", "Un espace projets partagés"],
    "created_at": "2026-09-20T19:39:13.538715+00:00",
    "description": "Budget Couple aide à gérer l'argent à deux en toute transparence : revenus, dépenses communes, répartition équitable et projets partagés. Moins de tensions, plus de projets.",
    "faq": [{"a": "Non, l'outil fonctionne que vous ayez un compte commun, des comptes séparés ou les deux.", "q": "Faut-il un compte commun ?"}, {"a": "Vous choisirez : à parts égales ou au prorata des revenus de chacun.", "q": "Comment se fait la répartition ?"}, {"a": "Budget Couple arrive bientôt. Inscrivez-vous à la newsletter pour être prévenu·e en premier.", "q": "Quand sera-t-il disponible ?"}],
    "features": [{"icon": "Heart", "text": "Centralisez toutes les dépenses du foyer.", "title": "Dépenses communes"}, {"icon": "Users", "text": "Répartissez les dépenses au prorata des revenus ou à parts égales.", "title": "Répartition équitable"}, {"icon": "PiggyBank", "text": "Suivez votre épargne et vos réserves à deux.", "title": "Épargne commune"}, {"icon": "Target", "text": "Fixez et financez vos projets communs (voyage, logement…).", "title": "Projets à deux"}, {"icon": "Receipt", "text": "Gardez une trace claire des avances de chacun.", "title": "Qui a payé quoi"}, {"icon": "BarChart3", "text": "Une synthèse claire du budget du couple.", "title": "Vue d'ensemble"}],
    "gallery": [{"caption": "Dépenses communes", "key": "slot-0", "storage_path": "", "url": ""}, {"caption": "Répartition", "key": "slot-1", "storage_path": "", "url": ""}, {"caption": "Projets", "key": "slot-2", "storage_path": "", "url": ""}],
    "main_image": "",
    "name": "Budget Couple",
    "price": null,
    "seo": {"description": "Dépenses communes, répartition équitable et projets partagés dans un seul fichier Excel. Bientôt disponible.", "title": "Budget Couple - Gérer son argent à deux | La Maison d'Auben"},
    "short_description": "Gérez votre budget à deux, en toute transparence.",
    "slug": "budget-couple",
    "status": "coming_soon"
  }
]
```
