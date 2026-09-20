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
- iteration_1 : 22/22 backend pass, achat Stripe complet E2E, admin OK. 100% backend / 100% frontend.

## Backlog (P1/P2)
- Remplacer le placeholder par le vrai fichier Excel + vraies captures d'écran (galerie).
- Compléter les mentions légales/CGV réelles.
- P2 : comptes clients + bibliothèque de commandes ; analytics avec consentement ; ajout produits via UI admin (formulaire complet) ; version anglaise (i18n).
- Split des routers backend (maintenabilité).
