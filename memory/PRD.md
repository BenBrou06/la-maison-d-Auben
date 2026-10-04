# La Maison d'Auben — PRD

## Problème / Objectif
Construire une V1 e-commerce réellement exploitable pour la marque de produits numériques **La Maison d'Auben** (Aurélie + Ben, jeu de mots « aubaine »). Premier produit : **Budget mensuel** (template Excel) à **7,99 €**. Le site doit donner l'impression d'une vraie marque au premier produit d'un univers plus vaste, être chaleureux/premium, mobile-first, en français, et évolutif (catalogue data-driven).

## Stack & Architecture
- Frontend React (CRA/craco) + Tailwind + shadcn/ui + framer-motion. Palette verte (design tokens CSS). Fonts Playfair Display + Plus Jakarta Sans.
- Backend FastAPI (`/api`) + MongoDB (motor). Modules : server.py, auth.py (JWT Bearer admin), storage.py (Emergent Object Storage), emailer.py (Resend), seed_data.py.
- Paiement : **Stripe** (sandbox réclamable, France → Stripe gère taxe/conformité, mode SMP). Emails : **Resend** géré Emergent. Stockage fichiers : Emergent Object Storage (téléchargement sécurisé via backend, jamais d'URL storage exposée).
- i18n prêt (fr par défaut, architecture pour ajouter en).

## Personas
Jeunes adultes, étudiants, jeunes actifs, couples, familles, indépendants — tous ceux voulant mieux s'organiser sans être experts d'Excel.

## Implémenté (2026-06)
- **Homepage** : hero, produit phare, pourquoi (Simple/Utile/Beau/Accessible), univers (8 catégories), marque qui évolue, ressources, newsletter.
- **Boutique** : recherche, filtres catégories, tri, cartes produits, gestion coming_soon (« Bientôt disponible »).
- **Fiche produit** : hero + prix + Acheter, présentation, fonctionnalités, galerie + lightbox, contenu, compatibilité, FAQ produit, CTA final.
- **Checkout Stripe** : Produit → Stripe hosted → /paiement/succes (polling statut) → téléchargement + email ; /paiement/annule ; gestion erreurs ; idempotent (webhook + fallback polling).
- **Livraison numérique sécurisée** : token de téléchargement à durée limitée (30 j, max 25), servi par le backend ; page /telechargement/:token.
- **Emails transactionnels** : confirmation de commande Resend avec lien de téléchargement (template HTML, gate de sécurité).
- **Admin JWT protégé** : login, dashboard (Produits/Commandes/Newsletter/Messages), upload du vrai fichier Excel + images produit.
- **Blog/Ressources** : liste + article (contenu, CTA produit lié). **À propos**, **Contact**, **FAQ**.
- **Pages légales** avec placeholders : mentions légales, CGV, confidentialité, cookies, produits numériques.
- **Newsletter** (consentement RGPD), **bannière cookies**, **SEO** (title/meta/OG/canonical, robots.txt, sitemap.xml), animations reveal + prefers-reduced-motion.
- Catalogue data-driven : ajouter un produit = données en base, aucun code page à refaire.

## Fichier produit
Le fichier Excel « Budget mensuel » est actuellement un **PLACEHOLDER .xlsx** auto-généré, remplaçable en 1 clic via l'admin (onglet Produits → Fichier Excel).

## Tests
- iteration_1 : 22/22 backend pass, achat Stripe complet E2E, admin OK.
- iteration_6 : 52/52 pytest pass (sécurité prod : origin hostile ignoré, download atomique, idempotence, rate-limit, uploads, admin).

## Mise en PRODUCTION (2026-06-04) — LIVE
- Pages légales RÉELLES publiées (Mentions légales, CGV 16 sections, Confidentialité/RGPD, Cookies) avec infos : BROU, micro-entreprise, 885 Chemin de la Sine 06140 Vence, SIREN 130351562 / SIRET 13035156200017, lamaisondauben@gmail.com, TVA art. 293 B, hébergeur Emergent, directeur pub. BROU. Médiation = « INFORMATION À VENIR PROCHAINEMENT » (médiateur à désigner — action user).
- Page produit : mention consentement CGV + renoncement droit de rétractation (art. L.221-28).
- Fichier Excel par défaut remplacé par le fichier réel fourni (1,07 Mo) : en base + empaqueté dans `backend/assets/Budget-mensuel-DEFAULT.xlsx` (seed non destructif).
- Déploiement Emergent OK : https://auben-preview-shop.emergent.host (HTTP 200 stable après cold start initial).
- Stripe LIVE confirmé : checkout technique → `cs_live_…` (aucun paiement réel). Webhook LIVE /api/stripe/webhook (4 événements) configuré côté user ; backend LIVE démarré (donc whsec + PUBLIC_BASE_URL HTTPS valides).
- Continuité données : prod = même MONGO_URL/DB_NAME + EMERGENT_LLM_KEY → produit, image et fichier présents.

## Actions manuelles restantes (user)
- Adhérer à un médiateur de la consommation agréé puis renseigner nom + site dans les CGV.
- Par sécurité : régénérer (roll) la clé Stripe LIVE restreinte et le secret webhook (transités en clair en chat).
- Premier achat réel 7,99 € puis remboursement depuis Stripe pour valider la chaîne complète (webhook → commande → e-mails → téléchargement).

## Backlog (P1/P2)
- Version anglaise (i18n). Comptes clients + bibliothèque de commandes. Analytics avec consentement. Split routers backend.

## Admin produits & pages data-driven (2026-06-04) — Preview, NON déployé
- Fix critique: `PUT /admin/products/{slug}` faisait un écrasement complet (défauts Pydantic) → vidait description/features. Corrigé en mise à jour PARTIELLE (`ProductUpdateInput` + `exclude_unset`). C'était la cause du « Budget mensuel a perdu sa description ».
- Disponibilité pilotée par le fichier: champ calculé `purchasable` (vrai fichier non-placeholder + prix). Upload → status available + sync prix Stripe; suppression fichier (`DELETE /admin/products/{slug}/file`) → coming_soon.
- Checkout refuse (409, aucune session Stripe) tout produit sans fichier/prix.
- Prix éditable depuis /admin → resynchronise le Stripe Price (lookup_key, tax_behavior=inclusive) via `sync_stripe_price`. Le montant payé vient toujours de Stripe (session.amount_total). Le front n'impose jamais le prix (origin_url requis mais ignoré serveur).
- Pages produit riches et data-driven pour les 6 produits; le contenu riche s'affiche aussi pour les « bientôt disponibles » (sans prix ni bouton d'achat). 5 fiches coming_soon enrichies (seed + `migrate_coming_soon.py`).
- Admin Produits: prix éditable, upload/remplacement + suppression fichier, indicateur fichier, image, statut par produit.
- Tests iteration_7: 11/11 scénarios UI OK, aucune régression Stripe/contenu. Backend validé par curl (purchasable, 409, cs_test_, partial update sans écrasement, sync prix 499 inclusif).
- ⚠️ Non déployé: ces évolutions sont en Preview uniquement. Un déploiement est nécessaire pour les porter en production.
