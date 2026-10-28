import { LEGAL_PAGES, LEGAL_UPDATED } from "@/content/legal";

// Valeurs par défaut = textes actuels du site. La base ne stocke que les champs modifiés dans l'admin.
const seo = (title, description) => [
  { name: "seo_title", label: "Titre SEO", type: "text", default: title },
  { name: "seo_description", label: "Meta description", type: "textarea", default: description },
];

const legalToSections = (page) =>
  page.sections.map((s) => {
    const paras = s.p ? (Array.isArray(s.p) ? s.p : [s.p]) : [];
    const list = (s.list || []).map((li) => `- ${li}`).join("\n");
    return { title: s.h, body: [...paras, ...(list ? [list] : [])].join("\n\n") };
  });

const legalPage = (key, label) => ({
  key: `legal-${key}`, label, path: `/${key}`, legal: true,
  fields: [
    ...seo(`${LEGAL_PAGES[key].title} — La Maison d'Auben`, LEGAL_PAGES[key].intro),
    { name: "title", label: "Titre", type: "text", default: LEGAL_PAGES[key].title },
    { name: "intro", label: "Introduction", type: "textarea", default: LEGAL_PAGES[key].intro },
    { name: "updated", label: "Dernière mise à jour", type: "text", default: LEGAL_UPDATED },
    { name: "sections", label: "Sections", type: "list", item: [
      { name: "title", label: "Titre de section", type: "text" },
      { name: "body", label: "Texte", type: "textarea", rows: 6 },
    ], default: legalToSections(LEGAL_PAGES[key]) },
  ],
});

export const CONTENT_PAGES = [
  { key: "home", label: "Accueil", path: "/", fields: [
    ...seo("La Maison d'Auben — L'aubaine pour mieux s'organiser.", "Des outils numériques simples, beaux et intelligents pour mieux organiser votre vie, vos projets et vos envies."),
    { name: "hero_eyebrow", label: "Hero — surtitre", type: "text", default: "Produits numériques" },
    { name: "hero_title", label: "Hero — titre (retour à la ligne = saut de ligne)", type: "textarea", rows: 2, default: "L'aubaine pour\nmieux s'organiser." },
    { name: "hero_intro", label: "Hero — texte (vide = texte des réglages du site)", type: "textarea", default: "" },
    { name: "hero_cta_primary", label: "Hero — bouton principal", type: "text", default: "Découvrir les outils" },
    { name: "hero_cta_secondary", label: "Hero — bouton produit phare (vide = « Découvrir » + nom du produit)", type: "text", default: "" },
    { name: "hero_image", label: "Hero — visuel (vide = image du produit phare)", type: "image", default: "" },
    { name: "hero_caption", label: "Hero — légende du visuel (vide = nom du produit)", type: "text", default: "" },
    { name: "featured_slug", label: "Produit mis en avant (slug ; vide = 1er produit disponible)", type: "product", default: "" },
    { name: "featured_eyebrow", label: "Produit phare — surtitre", type: "text", default: "Produit phare" },
    { name: "featured_caption", label: "Produit phare — légende du visuel", type: "text", default: "Aperçu du produit" },
    { name: "featured_cta", label: "Produit phare — bouton", type: "text", default: "Découvrir le produit" },
    { name: "why_eyebrow", label: "Pourquoi — surtitre", type: "text", default: "Pourquoi La Maison d'Auben ?" },
    { name: "why_title", label: "Pourquoi — titre", type: "text", default: "De bons outils, pensés pour la vraie vie." },
    { name: "principles", label: "Pourquoi — avantages (4 cartes, icônes fixes dans l'ordre)", type: "list", fixed: true, item: [
      { name: "title", label: "Titre", type: "text" }, { name: "text", label: "Texte", type: "textarea", rows: 2 },
    ], default: [
      { title: "Simple", text: "Des outils faciles à prendre en main, sans être un expert d'Excel." },
      { title: "Utile", text: "Des fonctionnalités pensées pour répondre à de vrais besoins du quotidien." },
      { title: "Beau", text: "Des outils agréables à utiliser, que l'on a envie d'ouvrir chaque jour." },
      { title: "Accessible", text: "Des produits accessibles, sans abonnement compliqué." },
    ] },
    { name: "universe_eyebrow", label: "Univers — surtitre", type: "text", default: "Notre univers" },
    { name: "universe_title", label: "Univers — titre", type: "text", default: "Un outil pour chaque projet de vie." },
    { name: "universe_text", label: "Univers — texte", type: "text", default: "Aujourd'hui le budget. Demain, bien plus encore." },
    { name: "brand_eyebrow", label: "Bandeau marque — surtitre", type: "text", default: "Une marque qui évolue" },
    { name: "brand_text", label: "Bandeau marque — texte", type: "textarea", default: "Aujourd'hui, mieux gérer son budget. Demain, mieux organiser ses voyages, son appartement, sa voiture, ses projets — et bien plus encore." },
    { name: "brand_cta", label: "Bandeau marque — bouton", type: "text", default: "Découvrir la Maison" },
    { name: "resources_eyebrow", label: "Ressources — surtitre", type: "text", default: "Ressources" },
    { name: "resources_title", label: "Ressources — titre", type: "text", default: "Nos derniers conseils." },
    { name: "resources_link", label: "Ressources — lien", type: "text", default: "Tout voir" },
    { name: "newsletter_title", label: "Newsletter — titre (vide = réglages du site)", type: "text", default: "" },
    { name: "newsletter_text", label: "Newsletter — texte (vide = réglages du site)", type: "textarea", default: "" },
  ] },
  { key: "shop", label: "Boutique", path: "/boutique", fields: [
    ...seo("Boutique — La Maison d'Auben", "Découvrez tous nos outils numériques pour mieux organiser votre budget, vos voyages, votre maison et vos projets."),
    { name: "eyebrow", label: "Surtitre", type: "text", default: "Boutique" },
    { name: "title", label: "Titre", type: "text", default: "Tous nos outils" },
    { name: "intro", label: "Introduction", type: "textarea", default: "Des outils simples et beaux, conçus pour vous faciliter le quotidien. Filtrez par univers ou cherchez votre besoin." },
    { name: "empty_title", label: "Aucun résultat — titre", type: "text", default: "Aucun outil ne correspond à votre recherche." },
    { name: "empty_text", label: "Aucun résultat — texte", type: "text", default: "Essayez un autre mot-clé ou une autre catégorie." },
  ] },
  { key: "resources", label: "Ressources (liste)", path: "/ressources", fields: [
    ...seo("Ressources — La Maison d'Auben", "Nos conseils pour mieux organiser votre budget, vos voyages, votre maison et vos projets."),
    { name: "eyebrow", label: "Surtitre", type: "text", default: "Ressources" },
    { name: "title", label: "Titre", type: "text", default: "Nos conseils & idées" },
    { name: "intro", label: "Introduction", type: "textarea", default: "Des articles simples et concrets pour mieux vous organiser au quotidien." },
    { name: "read_more", label: "Lien « lire »", type: "text", default: "Lire l'article" },
    { name: "related_title", label: "Article — titre des produits associés", type: "text", default: "À découvrir" },
  ] },
  { key: "about", label: "À propos", path: "/a-propos", fields: [
    ...seo("À propos — La Maison d'Auben", "L'histoire de La Maison d'Auben : Aurélie + Ben, et l'envie de créer de bons outils."),
    { name: "eyebrow", label: "Surtitre", type: "text", default: "Notre histoire" },
    { name: "title", label: "Titre", type: "text", default: "Aurélie + Ben = " },
    { name: "title_highlight", label: "Titre — mot en couleur", type: "text", default: "Auben" },
    { name: "intro", label: "Introduction", type: "textarea", default: "La Maison d'Auben est née d'une idée simple : et si mieux s'organiser pouvait aussi être agréable ? Une belle aubaine pour reprendre la main sur son quotidien." },
    { name: "image", label: "Image", type: "image", default: "/images/about-maison.jpg" },
    { name: "image_alt", label: "Image — texte alternatif", type: "text", default: "Un bureau chaleureux" },
    { name: "story_title", label: "Histoire — titre", type: "text", default: "Pourquoi la Maison existe" },
    { name: "story_text", label: "Histoire — texte (ligne vide = nouveau paragraphe)", type: "textarea", rows: 8, default: "Nous avons cherché des outils simples pour gérer notre budget, préparer nos voyages, organiser notre foyer. Trop souvent : soit trop compliqués, soit trop moches, soit les deux.\n\nAlors nous avons décidé de les créer nous-mêmes. Des outils numériques pensés pour la vraie vie, accessibles à tous — pas seulement aux experts d'Excel.\n\nLa Maison d'Auben, c'est cet endroit où l'on rassemble ces outils, un par un, avec le même soin." },
    { name: "values", label: "Valeurs (3 cartes, icônes fixes dans l'ordre)", type: "list", fixed: true, item: [
      { name: "title", label: "Titre", type: "text" }, { name: "text", label: "Texte", type: "textarea", rows: 2 },
    ], default: [
      { title: "Beau & utile", text: "Nous croyons qu'un outil bien conçu donne envie de s'en servir — et change vraiment le quotidien." },
      { title: "Humain avant tout", text: "Derrière chaque produit, deux personnes qui créent des outils qu'elles auraient aimé avoir." },
      { title: "Qui grandit", text: "La Maison démarre avec le budget, mais s'agrandira au fil des projets de vie." },
    ] },
    { name: "final_title", label: "Bandeau final — titre", type: "text", default: "Ce que la Maison veut devenir" },
    { name: "final_text", label: "Bandeau final — texte", type: "textarea", default: "Un univers d'outils beaux et utiles pour chaque projet de vie. Le budget aujourd'hui, bien plus demain." },
    { name: "final_cta", label: "Bandeau final — bouton", type: "text", default: "Voir la boutique" },
  ] },
  { key: "faq", label: "FAQ (page)", path: "/faq", fields: [
    ...seo("FAQ — La Maison d'Auben", "Questions fréquentes sur nos produits numériques, le paiement et le téléchargement."),
    { name: "eyebrow", label: "Surtitre", type: "text", default: "FAQ" },
    { name: "title", label: "Titre", type: "text", default: "Vos questions, nos réponses" },
    { name: "intro", label: "Introduction (facultative)", type: "textarea", default: "" },
  ] },
  { key: "contact", label: "Contact", path: "/contact", fields: [
    ...seo("Contact — La Maison d'Auben", "Une question ? Écrivez-nous, nous répondons rapidement."),
    { name: "eyebrow", label: "Surtitre", type: "text", default: "Contact" },
    { name: "title", label: "Titre", type: "text", default: "Parlons-en" },
    { name: "intro", label: "Texte", type: "textarea", default: "Une question sur un produit, un souci de téléchargement, une idée ? Nous sommes une vraie petite équipe et nous lisons chaque message." },
    { name: "email", label: "E-mail affiché", type: "text", default: "lamaisondauben@gmail.com" },
    { name: "response_time", label: "Délai de réponse affiché", type: "text", default: "Réponse sous 48h ouvrées" },
    { name: "submit_label", label: "Bouton d'envoi", type: "text", default: "Envoyer le message" },
    { name: "success_title", label: "Confirmation — titre", type: "text", default: "Message envoyé !" },
    { name: "success_text", label: "Confirmation — texte", type: "text", default: "Merci, nous revenons vers vous très vite." },
  ] },
  { key: "header", label: "En-tête et onglet", path: "/", fields: [
    { name: "favicon", label: "Favicon (icône de l'onglet) — image carrée PNG, JPEG ou WebP ; vide = favicon d'origine", type: "image", default: "" },
    { name: "brand_line1", label: "Nom de la marque — 1re ligne", type: "text", default: "La Maison" },
    { name: "brand_line2", label: "Nom de la marque — 2e ligne (en couleur)", type: "text", default: "d'Auben" },
    { name: "nav_home", label: "Menu — Accueil", type: "text", default: "Accueil" },
    { name: "nav_shop", label: "Menu — Boutique", type: "text", default: "Boutique" },
    { name: "nav_resources", label: "Menu — Ressources", type: "text", default: "Ressources" },
    { name: "nav_about", label: "Menu — À propos", type: "text", default: "À propos" },
    { name: "nav_faq", label: "Menu — FAQ", type: "text", default: "FAQ" },
    { name: "nav_contact", label: "Menu mobile — Contact", type: "text", default: "Contact" },
    { name: "shop_cta", label: "Bouton de l'en-tête", type: "text", default: "Voir la boutique" },
  ] },
  { key: "footer", label: "Pied de page & newsletter", path: "/", fields: [
    { name: "tagline", label: "Présentation", type: "textarea", default: "Des outils numériques simples, beaux et intelligents pour mieux organiser votre vie et vos projets." },
    { name: "badge_payment", label: "Badge paiement", type: "text", default: "Paiement sécurisé" },
    { name: "badge_download", label: "Badge téléchargement", type: "text", default: "Téléchargement protégé" },
    { name: "newsletter_title", label: "Newsletter — titre", type: "text", default: "Recevez nos nouveaux outils et ressources gratuitement." },
    { name: "newsletter_text", label: "Newsletter — texte", type: "text", default: "Pas de spam, juste nos meilleures idées et nos nouveautés." },
    { name: "copyright", label: "Mention de copyright (après « © année »)", type: "text", default: "La Maison d'Auben. Tous droits réservés." },
    { name: "slogan", label: "Slogan", type: "text", default: "L'aubaine pour mieux s'organiser." },
  ] },
  legalPage("mentions-legales", "Mentions légales"),
  legalPage("cgv", "CGV"),
  legalPage("confidentialite", "Confidentialité"),
  legalPage("politique-cookies", "Politique cookies"),
  legalPage("produits-numeriques", "Produits numériques"),
];

export const PAGE_BY_KEY = Object.fromEntries(CONTENT_PAGES.map((p) => [p.key, p]));

export const defaultsFor = (key) =>
  Object.fromEntries((PAGE_BY_KEY[key]?.fields || []).map((f) => [f.name, f.default]));
