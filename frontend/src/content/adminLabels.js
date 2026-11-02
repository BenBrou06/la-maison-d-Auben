// Présentation des champs dans l'admin (Pages) : groupes, intitulés clairs et aide.
// N'affecte ni les noms internes, ni les valeurs par défaut (content/schema.js), ni le site public.
const SEO = { title: "Référencement (Google)", where: "Onglet du navigateur et résultats de recherche", fields: {
  seo_title: ["Titre SEO", "Titre affiché dans l'onglet et dans Google."],
  seo_description: ["Meta description", "Résumé affiché sous le titre dans les résultats de recherche."],
} };
const LEGAL = [SEO,
  { title: "En-tête de la page", where: "Haut de la page légale", fields: {
    title: ["Titre de la page"], intro: ["Texte d'introduction"], updated: ["Date de dernière mise à jour affichée"] } },
  { title: "Contenu", where: "Corps de la page légale", fields: { sections: ["Sections", "Chaque section : un titre et son texte."] } },
];
const SIMPLE = (where) => [SEO, { title: "En-tête de la page", where, fields: {
  eyebrow: ["Petit texte au-dessus du titre"], title: ["Titre principal"], intro: ["Texte de présentation"] } }];

export const PAGE_UI = {
  home: [SEO,
    { title: "Bandeau principal de la page d'accueil", where: "Tout en haut de l'accueil", fields: {
      hero_eyebrow: ["Petit texte au-dessus du titre"],
      hero_title: ["Titre principal", "Un retour à la ligne crée un saut de ligne sur le site."],
      hero_intro: ["Texte de présentation", "Vide = texte des réglages du site."],
      hero_cta_primary: ["Texte du bouton principal", "Bouton vert qui mène à la boutique."],
      hero_cta_secondary: ["Texte du bouton du produit mis en avant", "Vide = « Découvrir » + nom du produit."],
      hero_image: ["Image du produit mis en avant", "Vide = image du produit phare."],
      hero_caption: ["Légende de l'image", "Vide = nom du produit."] } },
    { title: "Produit mis en avant", where: "Section « produit phare » sous le bandeau", fields: {
      featured_slug: ["Produit affiché", "Automatique = premier produit disponible."],
      featured_eyebrow: ["Petit texte au-dessus du produit"], featured_caption: ["Légende de l'image du produit"],
      featured_cta: ["Texte du bouton du produit"] } },
    { title: "Pourquoi nos outils", where: "Section des 4 avantages", fields: {
      why_eyebrow: ["Petit texte au-dessus du titre"], why_title: ["Titre de la section"],
      principles: ["Les 4 avantages", "Les icônes restent fixes, dans l'ordre."] } },
    { title: "Notre univers", where: "Section de présentation des catégories", fields: {
      universe_eyebrow: ["Petit texte au-dessus du titre"], universe_title: ["Titre de la section"], universe_text: ["Texte de la section"] } },
    { title: "Bandeau de la marque", where: "Bandeau vert de présentation de la marque", fields: {
      brand_eyebrow: ["Petit texte au-dessus"], brand_text: ["Texte du bandeau"], brand_cta: ["Texte du bouton"] } },
    { title: "Ressources", where: "Aperçu des derniers articles", fields: {
      resources_eyebrow: ["Petit texte au-dessus du titre"], resources_title: ["Titre de la section"], resources_link: ["Texte du lien « tout voir »"] } },
    { title: "Newsletter", where: "Encadré d'inscription en bas de l'accueil", fields: {
      newsletter_title: ["Titre", "Vide = réglages du site."], newsletter_text: ["Texte", "Vide = réglages du site."] } },
  ],
  shop: [...SIMPLE("Haut de la page Boutique"),
    { title: "Aucun résultat", where: "Affiché quand un filtre ne trouve aucun produit", fields: { empty_title: ["Titre"], empty_text: ["Texte"] } }],
  resources: [...SIMPLE("Haut de la page Ressources"),
    { title: "Liens et articles", where: "Liste des articles et page d'un article", fields: {
      read_more: ["Texte du lien vers un article"], related_title: ["Titre au-dessus des produits associés", "Sur la page d'un article."] } }],
  about: [SEO,
    { title: "En-tête de la page", where: "Haut de la page À propos", fields: {
      eyebrow: ["Petit texte au-dessus du titre"], title: ["Titre principal"], title_highlight: ["Mot du titre en couleur"],
      intro: ["Texte de présentation"], image: ["Image"], image_alt: ["Description de l'image", "Lue par les lecteurs d'écran et Google."] } },
    { title: "Notre histoire", where: "Section histoire", fields: {
      story_title: ["Titre"], story_text: ["Texte", "Une ligne vide = nouveau paragraphe."] } },
    { title: "Nos valeurs", where: "Les 3 cartes de valeurs", fields: { values: ["Les 3 valeurs", "Les icônes restent fixes, dans l'ordre."] } },
    { title: "Bandeau final", where: "Bas de la page À propos", fields: { final_title: ["Titre"], final_text: ["Texte"], final_cta: ["Texte du bouton"] } },
  ],
  faq: [SEO, { title: "En-tête de la page", where: "Haut de la page FAQ (questions : onglet FAQ)", fields: {
    eyebrow: ["Petit texte au-dessus du titre"], title: ["Titre principal"], intro: ["Texte d'introduction", "Facultatif."] } }],
  contact: [...SIMPLE("Haut de la page Contact"),
    { title: "Coordonnées affichées", where: "À côté du formulaire", fields: { email: ["E-mail affiché"], response_time: ["Délai de réponse affiché"] } },
    { title: "Formulaire", where: "Bouton et message après envoi", fields: {
      submit_label: ["Texte du bouton d'envoi"], success_title: ["Titre du message de confirmation"], success_text: ["Texte du message de confirmation"] } }],
  header: [
    { title: "Logo et onglet du navigateur", where: "En-tête, pied de page, admin et favicon", fields: {
      favicon: ["Logo du site", "Une seule image pour l'en-tête, le pied de page, l'admin et l'icône de l'onglet. Image carrée PNG, JPEG ou WebP ; vide = logo officiel."] } },
    { title: "Nom de la marque", where: "À côté du logo", fields: { brand_line1: ["1re ligne"], brand_line2: ["2e ligne (en couleur)"] } },
    { title: "Menu", where: "Liens de l'en-tête (et menu mobile)", fields: {
      nav_home: ["Accueil"], nav_shop: ["Boutique"], nav_resources: ["Ressources"], nav_about: ["À propos"], nav_faq: ["FAQ"],
      nav_contact: ["Contact", "Visible seulement dans le menu mobile."], shop_cta: ["Texte du bouton de l'en-tête"] } },
  ],
  footer: [
    { title: "Présentation", where: "Colonne de gauche du pied de page", fields: {
      tagline: ["Texte de présentation"], badge_payment: ["Badge paiement"], badge_download: ["Badge téléchargement"] } },
    { title: "Newsletter", where: "Encadré newsletter du pied de page", fields: { newsletter_title: ["Titre"], newsletter_text: ["Texte"] } },
    { title: "Bas de page", where: "Dernière ligne du site", fields: { copyright: ["Mention de copyright", "Affichée après « © année »."], slogan: ["Slogan"] } },
  ],
};

// Regroupe les champs d'une page ; tout champ non décrit reste visible dans « Autres réglages » avec son libellé d'origine.
export function groupFields(page) {
  const groups = page.legal ? LEGAL : PAGE_UI[page.key] || [];
  const used = new Set();
  const out = groups.map((g) => ({
    title: g.title, where: g.where,
    fields: page.fields.filter((f) => g.fields[f.name] && !used.has(f.name) && used.add(f.name))
      .map((f) => ({ ...f, uiLabel: g.fields[f.name][0], hint: g.fields[f.name][1] })),
  })).filter((g) => g.fields.length);
  const rest = page.fields.filter((f) => !used.has(f.name)).map((f) => ({ ...f, uiLabel: f.label }));
  if (rest.length) out.push({ title: "Autres réglages", where: "", fields: rest });
  return out;
}
