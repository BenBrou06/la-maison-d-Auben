// Architecture i18n prête pour l'anglais. V1 = français uniquement.
// Les composants lisent les chaînes via t("clé"). Ajouter "en" plus tard.

export const DEFAULT_LOCALE = "fr";

const strings = {
  fr: {
    "nav.home": "Accueil",
    "nav.shop": "Boutique",
    "nav.resources": "Ressources",
    "nav.about": "À propos",
    "nav.faq": "FAQ",
    "nav.contact": "Contact",
    "cta.shop": "Voir la boutique",
    "cta.discover_tools": "Découvrir les outils",
    "cta.discover_product": "Découvrir Budget mensuel",
    "cta.discover": "Découvrir",
    "cta.buy": "Acheter maintenant",
    "cta.buy_processing": "Redirection sécurisée…",
    "badge.coming_soon": "Bientôt disponible",
    "price.from": "à partir de",
    "footer.tagline": "L'aubaine pour mieux s'organiser.",
    "newsletter.cta": "Je m'inscris",
    "newsletter.placeholder": "votre@email.fr",
    "newsletter.consent": "J'accepte de recevoir la newsletter et j'ai lu la politique de confidentialité.",
  },
};

export function formatPrice(amount, currency = "eur") {
  if (amount == null) return "";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(amount);
}

export function t(key, locale = DEFAULT_LOCALE) {
  return (strings[locale] && strings[locale][key]) || key;
}
