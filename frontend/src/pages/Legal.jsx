import React from "react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";

// Pages légales — contenu réel pour La Maison d'Auben (micro-entreprise FR,
// vente de produits numériques téléchargeables à des particuliers).
// Les rares informations encore manquantes sont signalées via `warn: true`.
const UPDATED = "juin 2026";

const PAGES = {
  "mentions-legales": {
    title: "Mentions légales",
    intro: "Informations légales relatives à l'éditeur et à l'hébergeur du site La Maison d'Auben.",
    sections: [
      {
        h: "Éditeur du site",
        p: [
          "Le site La Maison d'Auben est édité par BROU, entrepreneur individuel sous le régime de la micro-entreprise.",
          "Activité : vente de produits numériques téléchargeables (modèles Excel, outils de gestion et tableaux de bord).",
        ],
        list: [
          "Nom commercial : La Maison d'Auben",
          "Forme juridique : entrepreneur individuel / micro-entrepreneur",
          "Adresse : 885 Chemin de la Sine, 06140 Vence, France",
          "SIREN : 130 351 562",
          "SIRET : 130 351 562 00017",
          "Adresse e-mail : lamaisondauben@gmail.com",
          "TVA : TVA non applicable, article 293 B du Code général des impôts (franchise en base)",
        ],
      },
      { h: "Directeur de la publication", p: "Le directeur de la publication est BROU, en qualité d'éditeur du site." },
      {
        h: "Hébergement",
        p: [
          "Le site est hébergé sur l'infrastructure Emergent et accessible à l'adresse de production du site.",
          "Pour toute question relative à l'hébergement, vous pouvez nous contacter à l'adresse lamaisondauben@gmail.com.",
        ],
      },
      { h: "Contact", p: "Pour toute question, vous pouvez nous écrire à l'adresse : lamaisondauben@gmail.com." },
      {
        h: "Propriété intellectuelle",
        p: "L'ensemble des contenus du site (textes, visuels, logo, mise en page) ainsi que les fichiers numériques vendus sont protégés par le droit de la propriété intellectuelle. Toute reproduction ou diffusion non autorisée est interdite.",
      },
    ],
  },

  "cgv": {
    title: "Conditions générales de vente",
    intro: "Les présentes conditions générales de vente (CGV) encadrent la vente de produits numériques téléchargeables par La Maison d'Auben à des consommateurs.",
    sections: [
      {
        h: "1. Objet et champ d'application",
        p: "Les présentes CGV s'appliquent à toute commande de produits numériques passée sur le site par un client consommateur. Le fait de passer commande implique l'acceptation pleine et entière des présentes CGV, portées à la connaissance du client avant la validation de sa commande.",
      },
      {
        h: "2. Identification du vendeur",
        p: "Les produits sont vendus par :",
        list: [
          "La Maison d'Auben — BROU, entrepreneur individuel (micro-entreprise)",
          "885 Chemin de la Sine, 06140 Vence, France",
          "SIREN 130 351 562 — SIRET 130 351 562 00017",
          "E-mail : lamaisondauben@gmail.com",
        ],
      },
      {
        h: "3. Produits",
        p: "Les produits proposés sont des fichiers numériques téléchargeables (notamment des modèles Excel, compatibles Google Sheets et LibreOffice Calc). Leurs caractéristiques essentielles sont décrites sur chaque fiche produit. Les produits ne sont pas livrés sur un support matériel.",
      },
      {
        h: "4. Prix",
        p: "Les prix sont indiqués en euros, toutes taxes comprises. En application de l'article 293 B du Code général des impôts, la TVA n'est pas applicable (franchise en base) : les prix ne comportent donc pas de TVA. Le prix applicable est celui affiché sur la fiche produit au moment de la commande.",
      },
      {
        h: "5. Commande",
        p: "La commande est passée directement en ligne. Le client sélectionne le produit puis valide sa commande via la page de paiement sécurisée. La vente est considérée comme ferme après confirmation du paiement.",
      },
      {
        h: "6. Paiement",
        p: "Le paiement s'effectue en ligne de manière sécurisée via notre prestataire de paiement Stripe. Aucune donnée de carte bancaire n'est collectée ni conservée par La Maison d'Auben. La commande n'est validée qu'après encaissement effectif du paiement confirmé par Stripe.",
      },
      {
        h: "7. Livraison et téléchargement numérique",
        p: "Après confirmation du paiement, l'accès au téléchargement du fichier est fourni immédiatement : un lien de téléchargement sécurisé est affiché à l'écran et envoyé par e-mail à l'adresse communiquée lors du paiement. Ce lien est personnel, à durée et à nombre de téléchargements limités. En cas de difficulté, le client peut nous contacter pour obtenir un nouveau lien.",
      },
      {
        h: "8. Disponibilité",
        p: "Les produits numériques sont disponibles sans limitation de stock. La Maison d'Auben se réserve la possibilité de retirer un produit de la vente à tout moment, sans que cela n'affecte les commandes déjà validées.",
      },
      {
        h: "9. Droit de rétractation",
        p: [
          "Conformément à l'article L.221-28, 13° du Code de la consommation, le droit de rétractation ne peut être exercé pour les contenus numériques fournis sur un support immatériel dont l'exécution a commencé après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation.",
          "En finalisant sa commande et en accédant au téléchargement immédiat, le client demande expressément l'exécution immédiate de la prestation et reconnaît renoncer à son droit de rétractation dès le début du téléchargement. Aucun remboursement ne peut dès lors être réclamé au titre du droit de rétractation.",
          "En dehors de ce cas, et en cas de problème technique lié au fichier, le client est invité à nous contacter : nous cherchons toujours une solution.",
        ],
      },
      {
        h: "10. Garanties légales",
        p: "Le client bénéficie des garanties légales applicables, notamment la garantie légale de conformité des contenus et services numériques (articles L.224-25-1 et suivants du Code de la consommation) et la garantie contre les vices cachés. En cas de non-conformité du fichier, le client peut nous contacter à lamaisondauben@gmail.com.",
      },
      {
        h: "11. Responsabilité",
        p: "Les produits sont des outils d'aide à l'organisation et à la gestion. Ils ne constituent pas un conseil financier, juridique ou fiscal. La Maison d'Auben ne saurait être tenue responsable de l'usage fait des fichiers par le client ni des décisions prises sur leur fondement.",
      },
      {
        h: "12. Propriété intellectuelle",
        p: "Les fichiers vendus sont destinés à un usage personnel du client. Toute revente, redistribution, mise à disposition publique ou reproduction à des fins commerciales est interdite sans autorisation écrite préalable.",
      },
      {
        h: "13. Données personnelles",
        p: "Les données personnelles collectées dans le cadre de la commande sont traitées conformément à notre politique de confidentialité, accessible sur le site.",
      },
      {
        h: "14. Service client",
        p: "Pour toute question relative à une commande, le service client est joignable à l'adresse : lamaisondauben@gmail.com.",
      },
      {
        h: "15. Droit applicable et litiges",
        p: "Les présentes CGV sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité avant toute action judiciaire. À défaut d'accord, les tribunaux français seront compétents dans les conditions prévues par la loi.",
      },
      {
        h: "16. Médiation de la consommation",
        warn: true,
        p: "Conformément aux articles L.612-1 et suivants du Code de la consommation, tout consommateur a le droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un litige qui l'oppose à un professionnel. Les coordonnées du médiateur de la consommation auquel le vendeur adhère seront communiquées prochainement.",
      },
    ],
  },

  "confidentialite": {
    title: "Politique de confidentialité",
    intro: "La Maison d'Auben applique une approche de minimisation des données et respecte le Règlement général sur la protection des données (RGPD).",
    sections: [
      {
        h: "Responsable du traitement",
        p: "Le responsable du traitement est BROU (La Maison d'Auben), 885 Chemin de la Sine, 06140 Vence, France. Contact : lamaisondauben@gmail.com.",
      },
      {
        h: "Données collectées",
        p: "Nous ne collectons que les données strictement nécessaires :",
        list: [
          "Commande : adresse e-mail du client et informations relatives à la commande (produit, montant), transmises par notre prestataire de paiement.",
          "Paiement : les données de paiement (carte bancaire) sont traitées directement par Stripe et ne sont jamais collectées ni stockées par nos soins.",
          "Formulaire de contact : nom, adresse e-mail, sujet et message.",
          "Newsletter : adresse e-mail et preuve de votre consentement, uniquement si vous vous y inscrivez.",
        ],
      },
      {
        h: "Finalités et bases légales",
        p: [
          "Traiter et suivre les commandes, fournir le lien de téléchargement et envoyer les e-mails de confirmation : exécution du contrat.",
          "Répondre aux demandes envoyées via le formulaire de contact : notre intérêt légitime à répondre à vos sollicitations.",
          "Envoyer la newsletter : votre consentement, que vous pouvez retirer à tout moment.",
        ],
      },
      {
        h: "Destinataires et sous-traitants",
        p: "Vos données sont destinées à La Maison d'Auben. Nous faisons appel à des sous-traitants techniques pour fournir le service : Stripe (traitement des paiements) et l'infrastructure Emergent (hébergement du site et acheminement des e-mails transactionnels). Ces prestataires n'utilisent vos données que pour l'exécution de ces prestations.",
      },
      {
        h: "Durée de conservation",
        p: "Les données de commande sont conservées le temps nécessaire au suivi de la vente et au respect de nos obligations légales (notamment comptables). Les messages de contact sont conservés le temps du traitement de la demande. Les inscriptions à la newsletter sont conservées jusqu'au retrait de votre consentement.",
      },
      {
        h: "Vos droits",
        p: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données. Vous pouvez exercer ces droits en nous écrivant à lamaisondauben@gmail.com. Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr).",
      },
      {
        h: "Cookies",
        p: "Le site utilise uniquement le stockage strictement nécessaire à son fonctionnement. Pour en savoir plus, consultez notre politique relative aux cookies.",
      },
    ],
  },

  "politique-cookies": {
    title: "Politique relative aux cookies",
    intro: "Nous limitons l'usage des cookies au strict nécessaire.",
    sections: [
      {
        h: "Cookies et stockage nécessaires",
        p: "Le site enregistre uniquement une préférence technique dans votre navigateur (stockage local) afin de mémoriser votre choix concernant cette information. Ce stockage est indispensable au bon fonctionnement du site et ne nécessite pas de consentement.",
      },
      {
        h: "Absence de cookies de suivi",
        p: "À ce jour, le site n'utilise aucun cookie publicitaire, aucun cookie de mesure d'audience ni aucun traceur tiers à des fins de suivi.",
      },
      {
        h: "Cookies du prestataire de paiement",
        p: "Lors du paiement, vous êtes redirigé·e vers les pages sécurisées de notre prestataire Stripe, qui peut déposer ses propres cookies strictement nécessaires à la sécurité et au traitement de la transaction, conformément à sa propre politique.",
      },
    ],
  },

  "produits-numeriques": {
    title: "Informations sur les produits numériques",
    intro: "Tout ce qu'il faut savoir sur nos produits téléchargeables.",
    sections: [
      { h: "Nature des produits", p: "Nos produits sont des fichiers numériques (modèles Excel, compatibles Google Sheets et LibreOffice Calc), livrés par téléchargement, sans support matériel." },
      { h: "Accès et téléchargement", p: "Après paiement, vous accédez immédiatement à un lien de téléchargement sécurisé, également envoyé par e-mail. Le lien est personnel, à durée et à nombre de téléchargements limités." },
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
      <div className="container-app mx-auto max-w-3xl py-14 sm:py-20" data-testid={`legal-page-${pageKey}`}>
        <Reveal>
          <h1 className="font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">{page.title}</h1>
          <p className="mt-4 text-[#626D66]">{page.intro}</p>
          <p className="mt-2 text-xs text-[#87A987]">Dernière mise à jour : {UPDATED}</p>
        </Reveal>
        <div className="mt-10 space-y-8">
          {page.sections.map((s, i) => {
            const paras = Array.isArray(s.p) ? s.p : [s.p];
            return (
              <Reveal key={i} delay={i * 0.03}>
                <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">{s.h}</h2>
                {paras.map((p, j) => (
                  <p key={j} className="mt-2 leading-relaxed text-[#2C332E]">{p}</p>
                ))}
                {s.list && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[#2C332E]">
                    {s.list.map((li, k) => (
                      <li key={k} className="leading-relaxed">{li}</li>
                    ))}
                  </ul>
                )}
                {s.warn && (
                  <div className="mt-3 rounded-xl bg-[#F2EDE4] px-4 py-3 text-sm font-medium text-[#87A987]" data-testid="legal-warn-note">
                    INFORMATION À VENIR PROCHAINEMENT.
                  </div>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </>
  );
}
