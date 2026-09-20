import React from "react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";

// Pages légales avec PLACEHOLDERS clairement identifiés — à compléter par la marque.
// Textes structurés pour être facilement remplacés.
const PAGES = {
  "mentions-legales": {
    title: "Mentions légales",
    intro: "Informations légales relatives à l'éditeur du site La Maison d'Auben.",
    sections: [
      { h: "Éditeur du site", p: "[Raison sociale à compléter] — [Statut juridique] — [Adresse] — [SIRET / immatriculation] — [Capital social le cas échéant]." },
      { h: "Directeur de la publication", p: "[Nom du responsable à compléter]." },
      { h: "Hébergement", p: "[Nom et coordonnées de l'hébergeur à compléter]." },
      { h: "Contact", p: "contact@lamaisondauben.fr [adresse à confirmer]." },
    ],
  },
  "cgv": {
    title: "Conditions générales de vente",
    intro: "Les présentes CGV encadrent la vente de produits numériques téléchargeables. Texte à faire valider juridiquement.",
    sections: [
      { h: "1. Objet", p: "Les présentes conditions régissent la vente des produits numériques proposés par La Maison d'Auben. [À compléter]." },
      { h: "2. Produits", p: "Les produits sont des fichiers numériques téléchargeables (ex. templates Excel). Les caractéristiques sont décrites sur chaque fiche produit." },
      { h: "3. Prix", p: "Les prix sont indiqués en euros. [Modalités de TVA à préciser selon le régime fiscal applicable]." },
      { h: "4. Commande et paiement", p: "Le paiement est réalisé de manière sécurisée via Stripe. La commande est confirmée après validation du paiement." },
      { h: "5. Livraison numérique", p: "Après paiement, l'accès au téléchargement est fourni immédiatement et par e-mail via un lien sécurisé." },
      { h: "6. Droit de rétractation", p: "Conformément à la réglementation applicable aux contenus numériques fournis immédiatement, le droit de rétractation peut ne pas s'appliquer dès lors que le client a consenti au téléchargement immédiat. [À préciser / faire valider]." },
      { h: "7. Remboursement", p: "[Politique de remboursement à préciser]. En cas de problème, contactez-nous : nous cherchons toujours une solution." },
    ],
  },
  "confidentialite": {
    title: "Politique de confidentialité",
    intro: "La Maison d'Auben respecte votre vie privée et applique une approche de minimisation des données (RGPD).",
    sections: [
      { h: "Données collectées", p: "Nous collectons uniquement les données nécessaires : e-mail (newsletter, commande), informations de paiement traitées par Stripe (jamais stockées par nos soins)." },
      { h: "Finalités", p: "Traitement des commandes, envoi des liens de téléchargement, e-mails transactionnels, et newsletter si vous y avez consenti." },
      { h: "Base légale & consentement", p: "La newsletter repose sur votre consentement explicite, retirable à tout moment." },
      { h: "Conservation", p: "Les données sont conservées le temps nécessaire aux finalités décrites. [Durées à préciser]." },
      { h: "Vos droits", p: "Vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition. Contact : contact@lamaisondauben.fr [à confirmer]." },
    ],
  },
  "politique-cookies": {
    title: "Politique cookies",
    intro: "Nous utilisons les cookies avec parcimonie et dans le respect du consentement.",
    sections: [
      { h: "Cookies nécessaires", p: "Indispensables au fonctionnement du site (panier, session). Ils ne nécessitent pas de consentement." },
      { h: "Cookies de mesure d'audience", p: "Utilisés uniquement avec votre consentement, de manière compatible avec les exigences européennes." },
      { h: "Gestion", p: "Vous pouvez modifier vos choix à tout moment via la bannière de consentement." },
    ],
  },
  "produits-numeriques": {
    title: "Informations sur les produits numériques",
    intro: "Tout ce qu'il faut savoir sur nos produits téléchargeables.",
    sections: [
      { h: "Nature des produits", p: "Nos produits sont des fichiers numériques (templates Excel/Google Sheets), livrés par téléchargement." },
      { h: "Accès et téléchargement", p: "Après paiement, vous accédez immédiatement à un lien sécurisé, également envoyé par e-mail. Le lien est personnel et à durée limitée." },
      { h: "Compatibilité", p: "La compatibilité (Excel, Google Sheets, LibreOffice) est indiquée sur chaque fiche produit." },
      { h: "Mises à jour", p: "En cas de mise à jour d'un produit, nous pouvons vous en informer par e-mail." },
    ],
  },
};

export default function Legal({ pageKey }) {
  const page = PAGES[pageKey];
  if (!page) return <div className="container-app py-24 text-center text-[#626D66]">Page introuvable.</div>;
  return (
    <>
      <Seo title={`${page.title} — La Maison d'Auben`} description={page.intro} path={`/${pageKey}`} />
      <div className="container-app mx-auto max-w-3xl py-14 sm:py-20">
        <Reveal>
          <h1 className="font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">{page.title}</h1>
          <p className="mt-4 text-[#626D66]">{page.intro}</p>
          <div className="mt-6 rounded-xl bg-[#F2EDE4] px-5 py-3 text-sm text-[#87A987]">
            ⚠️ Contenu provisoire — les mentions entre crochets [ ] doivent être complétées et validées juridiquement.
          </div>
        </Reveal>
        <div className="mt-10 space-y-8">
          {page.sections.map((s, i) => (
            <Reveal key={i} delay={i * 0.04}>
              <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">{s.h}</h2>
              <p className="mt-2 leading-relaxed text-[#2C332E]">{s.p}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  );
}
