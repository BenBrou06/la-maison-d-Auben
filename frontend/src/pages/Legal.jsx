import React from "react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { WITHDRAWAL_CONSENT_TEXT } from "@/lib/site";

// Pages légales — décrivent uniquement les traitements réellement implémentés sur le site.
const UPDATED = "juin 2026";
const EMAIL = "lamaisondauben@gmail.com";

const PAGES = {
  "mentions-legales": {
    title: "Mentions légales",
    intro: "Informations légales relatives à l'éditeur et à l'hébergeur du site La Maison d'Auben.",
    sections: [
      {
        h: "Éditeur du site",
        p: [
          "Le site La Maison d'Auben (https://la-maison-dauben.com) est édité par BROU, entrepreneur individuel sous le régime de la micro-entreprise.",
          "Activité : vente de produits numériques téléchargeables (modèles Excel, outils de gestion et tableaux de bord).",
        ],
        list: [
          "Nom commercial : La Maison d'Auben",
          "Forme juridique : entrepreneur individuel / micro-entrepreneur",
          "Adresse : 885 Chemin de la Sine, 06140 Vence, France",
          "SIREN : 130 351 562",
          "SIRET : 130 351 562 00017",
          `Adresse e-mail : ${EMAIL}`,
          "TVA : TVA non applicable, article 293 B du Code général des impôts (franchise en base)",
        ],
      },
      { h: "Directeur de la publication", p: "Le directeur de la publication est BROU, en qualité d'éditeur du site." },
      {
        h: "Hébergement",
        p: [
          "Le site, sa base de données, le stockage des fichiers et l'envoi des e-mails transactionnels reposent sur la plateforme Emergent, exploitée par Emergent Labs Inc. (États-Unis).",
          "Contact de l'hébergeur : support@emergent.sh.",
        ],
      },
      { h: "Contact", p: `Pour toute question, vous pouvez nous écrire à l'adresse : ${EMAIL}.` },
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
        p: "Les présentes CGV s'appliquent à toute commande de produits numériques passée sur le site par un client consommateur. Elles sont accessibles à tout moment sur le site et portées à la connaissance du client avant la validation de sa commande.",
      },
      {
        h: "2. Identification du vendeur",
        p: "Les produits sont vendus par :",
        list: [
          "La Maison d'Auben — BROU, entrepreneur individuel (micro-entreprise)",
          "885 Chemin de la Sine, 06140 Vence, France",
          "SIREN 130 351 562 — SIRET 130 351 562 00017",
          `E-mail : ${EMAIL}`,
        ],
      },
      {
        h: "3. Produits",
        p: "Les produits proposés sont des contenus numériques fournis sous forme de fichiers téléchargeables (notamment des modèles Excel). Leurs caractéristiques essentielles et leur compatibilité sont décrites sur chaque fiche produit. Les produits ne sont pas livrés sur un support matériel. Un produit signalé « Bientôt disponible » ne peut pas être commandé.",
      },
      {
        h: "4. Prix",
        p: "Les prix sont indiqués en euros, toutes taxes comprises. En application de l'article 293 B du Code général des impôts, la TVA n'est pas applicable (franchise en base). Le prix applicable est celui affiché sur la fiche produit et sur la page de paiement au moment de la commande. Aucun frais de livraison n'est facturé.",
      },
      {
        h: "5. Commande",
        p: [
          "Pour commander, le client sélectionne le produit sur sa fiche, coche la case relative à l'accès immédiat et au droit de rétractation (article 9), puis clique sur « Acheter » : il est alors redirigé vers la page de paiement sécurisée, où il peut vérifier le produit et le prix avant de payer.",
          "La commande est définitive après confirmation du paiement. Une confirmation est envoyée par e-mail à l'adresse indiquée lors du paiement.",
        ],
      },
      {
        h: "6. Paiement",
        p: "Le paiement s'effectue en ligne via notre prestataire de paiement Stripe. Aucune donnée de carte bancaire n'est collectée ni conservée par La Maison d'Auben. La commande n'est validée qu'après confirmation par Stripe de l'encaissement effectif du paiement.",
      },
      {
        h: "7. Fourniture du contenu numérique",
        p: "Après confirmation du paiement, un lien de téléchargement sécurisé est affiché à l'écran et envoyé par e-mail. Ce lien est personnel, valable pour une durée et un nombre de téléchargements limités. En cas de difficulté (lien expiré, fichier inaccessible), le client peut nous contacter pour obtenir un nouveau lien.",
      },
      {
        h: "8. Disponibilité",
        p: "Les produits numériques disponibles à la vente sont fournis sans limitation de stock. La Maison d'Auben peut retirer un produit de la vente à tout moment, sans effet sur les commandes déjà validées.",
      },
      {
        h: "9. Droit de rétractation",
        p: [
          "Le consommateur dispose en principe d'un délai de 14 jours pour se rétracter d'un contrat conclu à distance. Toutefois, conformément à l'article L.221-28, 13° du Code de la consommation, ce droit ne peut pas être exercé pour un contenu numérique non fourni sur un support matériel dont l'exécution a commencé après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation.",
          `Avant tout paiement, le client doit cocher la case suivante : « ${WITHDRAWAL_CONSENT_TEXT} ». Sans cette case cochée, la commande ne peut pas être passée. La date et l'heure de ce consentement, la version du texte accepté, l'adresse IP et le navigateur utilisés sont enregistrés et rattachés à la commande, et le texte accepté est rappelé dans l'e-mail de confirmation de commande.`,
          "Cette renonciation au droit de rétractation n'affecte pas les garanties légales décrites à l'article 10.",
        ],
      },
      {
        h: "10. Garantie légale de conformité",
        p: [
          "Le vendeur est tenu de fournir un contenu numérique conforme au contrat et répond des défauts de conformité existant au moment de la fourniture qui apparaissent dans un délai de deux ans à compter de celle-ci (articles L.224-25-12 et suivants du Code de la consommation).",
          "En cas de défaut de conformité (fichier corrompu, inutilisable, ne correspondant pas à sa description ou incompatible avec les logiciels annoncés), le client a droit à la mise en conformité du contenu numérique. À défaut de mise en conformité, ou si elle est impossible, il peut obtenir une réduction du prix ou la résolution du contrat avec remboursement intégral, dans les conditions prévues par la loi.",
          `Pour mettre en œuvre la garantie, il suffit d'écrire à ${EMAIL} en précisant le numéro de commande et le problème rencontré.`,
        ],
      },
      {
        h: "11. Responsabilité",
        p: "Les produits sont des outils d'aide à l'organisation et à la gestion. Ils ne constituent pas un conseil financier, juridique ou fiscal, et les décisions prises par le client sur leur fondement relèvent de sa seule appréciation. Cette clause ne limite en rien les garanties légales dont bénéficie le client.",
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
        h: "14. Service client et réclamations",
        p: `Pour toute question ou réclamation relative à une commande, le service client est joignable à l'adresse : ${EMAIL}.`,
      },
      {
        h: "15. Médiation de la consommation",
        p: [
          "Conformément aux articles L.612-1 et suivants du Code de la consommation, le consommateur a le droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un litige qui l'oppose au vendeur.",
          `Avant de saisir le médiateur, le consommateur doit avoir tenté de résoudre le litige directement auprès du vendeur par une réclamation écrite (${EMAIL}). Le médiateur peut être saisi dans un délai d'un an à compter de cette réclamation.`,
          "Le médiateur de la consommation dont relève La Maison d'Auben est :",
        ],
        list: [
          "Centre de la Médiation de la Consommation de Conciliateurs de Justice (CM2C)",
          "Adresse : 49 rue de Ponthieu, 75008 Paris, France",
          "Téléphone : 01 89 47 00 14",
          "Site internet : https://www.cm2c.net",
          "Saisine en ligne : https://www.cm2c.net/declarer-un-litige.php",
          "E-mail : litiges@cm2c.net",
        ],
      },
      {
        h: "16. Droit applicable",
        p: "Les présentes CGV sont soumises au droit français. À défaut de résolution amiable, le litige peut être porté devant les juridictions compétentes dans les conditions prévues par la loi. Le consommateur conserve, le cas échéant, la protection que lui assurent les dispositions impératives de la loi de son pays de résidence.",
      },
    ],
  },

  "confidentialite": {
    title: "Politique de confidentialité",
    intro: "Cette politique décrit les données personnelles réellement traitées par le site La Maison d'Auben, conformément au Règlement général sur la protection des données (RGPD).",
    sections: [
      {
        h: "Responsable du traitement",
        p: `Le responsable du traitement est BROU (La Maison d'Auben), 885 Chemin de la Sine, 06140 Vence, France. Contact : ${EMAIL}.`,
      },
      {
        h: "Données traitées, finalités et bases légales",
        list: [
          "Commande et téléchargement : adresse e-mail communiquée lors du paiement, produit, montant, identifiants de commande et de session de paiement, lien de téléchargement et nombre de téléchargements. Finalité : exécuter la vente, fournir le fichier et envoyer la confirmation de commande. Base légale : exécution du contrat.",
          "Preuve du consentement à l'exécution immédiate : date et heure, version du texte accepté, adresse IP et navigateur au moment de la commande. Finalité : prouver le renoncement exprès au droit de rétractation. Base légale : obligation légale et intérêt légitime à se constituer une preuve.",
          "Paiement : les données de carte sont saisies et traitées directement par Stripe ; elles ne sont jamais reçues ni stockées par nos soins.",
          "Formulaire de contact : nom, adresse e-mail, sujet et message. Finalité : répondre à votre demande. Base légale : intérêt légitime.",
          "Newsletter : adresse e-mail, date du consentement, version du texte de consentement et statut d'inscription. Finalité : vous informer de nos nouveautés. Base légale : votre consentement, retirable à tout moment.",
          "Sécurité : l'adresse IP est utilisée de façon temporaire (en mémoire, quelques minutes) pour limiter les abus sur les formulaires et le paiement. Base légale : intérêt légitime à sécuriser le site.",
        ],
      },
      {
        h: "Destinataires et sous-traitants",
        p: [
          "Vos données sont destinées à La Maison d'Auben. Elles sont traitées pour notre compte par :",
        ],
        list: [
          "Stripe : traitement des paiements et de la page de paiement.",
          "Emergent (Emergent Labs Inc., États-Unis) : hébergement du site, base de données, stockage des fichiers et acheminement des e-mails transactionnels.",
        ],
      },
      {
        h: "Transferts hors de l'Union européenne",
        p: "Selon les informations communiquées par notre hébergeur, les données hébergées sur la plateforme Emergent sont traitées et stockées aux États-Unis et en Inde. Stripe peut également traiter des données hors de l'Union européenne. Vous pouvez nous écrire pour obtenir des informations sur les garanties encadrant ces transferts.",
      },
      {
        h: "Durée de conservation",
        list: [
          "Commandes et preuves de consentement : 10 ans à compter de la commande (obligations comptables et preuve du contrat).",
          "Messages de contact : 3 ans à compter du dernier échange.",
          "Newsletter : jusqu'à votre désinscription ; l'adresse désinscrite est conservée avec la date de désinscription afin de respecter votre choix.",
        ],
      },
      {
        h: "Newsletter et désinscription",
        p: "L'inscription n'est possible qu'en cochant la case de consentement. Chaque envoi contient un lien de désinscription personnel ; vous pouvez aussi demander votre désinscription à tout moment par e-mail.",
      },
      {
        h: "Vos droits",
        p: `Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que du droit de retirer votre consentement à tout moment. Pour les exercer, écrivez à ${EMAIL}. Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).`,
      },
      {
        h: "Cookies",
        p: "Le site n'utilise aucun outil de mesure d'audience ni de publicité. Les cookies déposés par l'infrastructure d'hébergement sont décrits dans notre politique relative aux cookies.",
      },
    ],
  },

  "politique-cookies": {
    title: "Politique relative aux cookies",
    intro: "Cette page liste les cookies et éléments de stockage réellement utilisés sur le site.",
    sections: [
      {
        h: "Aucun traceur publicitaire ni de mesure d'audience",
        p: "Le site n'intègre aucun outil de mesure d'audience, d'enregistrement de session, de publicité ou de réseau social. Les polices de caractères et les images du site sont hébergées sur nos propres serveurs : aucune requête n'est envoyée à des services tiers lors de la navigation.",
      },
      {
        h: "Cookies déposés par l'hébergeur",
        p: "L'infrastructure d'hébergement (Emergent) dépose automatiquement deux cookies techniques sur le domaine du site. Leur finalité exacte est en cours de vérification auprès de l'hébergeur ; cette page sera mise à jour dès confirmation.",
        list: [
          "__emg_sid : durée 30 minutes.",
          "__emg_vid : durée 12 mois.",
        ],
      },
      {
        h: "Espace d'administration",
        p: "L'espace réservé à l'administrateur du site utilise le stockage local du navigateur pour conserver la session de connexion. Il ne concerne pas les visiteurs ni les clients.",
      },
      {
        h: "Paiement",
        p: "Lors du paiement, vous êtes redirigé·e vers les pages sécurisées de Stripe, sur son propre domaine, qui peut y déposer ses propres cookies, notamment pour la sécurité et la prévention de la fraude, conformément à sa politique.",
      },
    ],
  },

  "produits-numeriques": {
    title: "Informations sur les produits numériques",
    intro: "Tout ce qu'il faut savoir sur nos produits téléchargeables.",
    sections: [
      { h: "Nature des produits", p: "Nos produits sont des fichiers numériques (modèles Excel), fournis par téléchargement, sans support matériel." },
      { h: "Accès et téléchargement", p: "Avant le paiement, vous demandez l'accès immédiat au fichier en cochant la case prévue, ce qui entraîne la perte du droit de rétractation dès sa fourniture (voir nos CGV). Après paiement, un lien de téléchargement sécurisé s'affiche et vous est envoyé par e-mail. Le lien est personnel, à durée et à nombre de téléchargements limités." },
      { h: "Compatibilité", p: "La compatibilité avec les logiciels de tableur est indiquée sur chaque fiche produit." },
      { h: "Problème avec un fichier", p: `Si un fichier est défectueux ou ne correspond pas à sa description, écrivez-nous à ${EMAIL} : vous bénéficiez de la garantie légale de conformité.` },
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
          <p className="mt-2 text-xs text-[#626D66]">Dernière mise à jour : {UPDATED}</p>
        </Reveal>
        <div className="mt-10 space-y-8">
          {page.sections.map((s, i) => {
            const paras = s.p ? (Array.isArray(s.p) ? s.p : [s.p]) : [];
            return (
              <Reveal key={i} delay={i * 0.03}>
                <section data-testid={`legal-section-${pageKey}-${i}`}>
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
                </section>
              </Reveal>
            );
          })}
        </div>
      </div>
    </>
  );
}
