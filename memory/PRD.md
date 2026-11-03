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

## Lightbox galerie produit — agrandissement + ratio cohérent (2026-06-04) — Preview, NON déployé
- `frontend/src/pages/ProductDetail.jsx` (lightbox uniquement) : ratio aligné sur la vignette (**16:11**, avant 16:10), `object-contain` (avant `object-cover` via Screenshot) → image entière visible sans découpe ni déformation. Conteneur agrandi de `max-w-3xl` à `min(90vw, calc(85vh*16/11))` → image ~1335×918 (desktop), centrée, responsive (≤90vw, aucun débordement mobile). Légende + navigation (←/→) + fermeture conservées. Vignettes et composant Screenshot inchangés.
- Testé (desktop) : image nettement plus grande, ratio 16:11, coins/bords visibles, nav/close OK. Mobile validé par construction CSS (outil screenshot force 1920, mesure réelle impossible).
- Nouvel onglet `Contenu` (Produits | **Contenu** | Commandes | Newsletter | Messages) : édition data-driven du contenu éditorial de CHAQUE produit (titre, accroche, badge, description, présentation/audience, fonctionnalités, galerie d'images, « ce que vous recevez », compatibilité, FAQ, SEO, image principale).
- 100% frontend : réutilise `PUT /api/admin/products/{slug}` (exclude_unset, partiel) + `POST /api/admin/upload/image`. **Aucune nouvelle route backend. Aucun changement Stripe/checkout/webhook/commandes/téléchargements.**
- Fichiers : `frontend/src/pages/admin/ContentPanel.jsx` (nouveau), `frontend/src/pages/admin/AdminDashboard.jsx` (TABS + rendu), `frontend/src/lib/api.js` (adminUploadImage).
- L'édition de contenu n'affecte jamais prix / disponibilité / fichier (gérés dans l'onglet Produits). Galerie : upload/remplacement/suppression/réordonnancement, rendu via `storage_path`→`mediaUrl` sur la page publique (fallback « Capture à venir »).
- Bouton « Voir la page » → /boutique/{slug}. Aperçu immédiat après enregistrement.
- Tests iteration_8 : **14/14 scénarios UI OK**, 0 bug. Sécurité : PUT admin sans token → 401 ; upload non-image → 400. Non-régression : budget-mensuel 7,99 € + fichier + checkout cs_test_ intacts ; budget-couple reste « Bientôt disponible » non achetable. budget-couple restauré à l'état seed après tests.
- Inclut aussi le correctif backfill (pages produit vides en prod) de la vague précédente.
- Fix critique: `PUT /admin/products/{slug}` faisait un écrasement complet (défauts Pydantic) → vidait description/features. Corrigé en mise à jour PARTIELLE (`ProductUpdateInput` + `exclude_unset`). C'était la cause du « Budget mensuel a perdu sa description ».
- Disponibilité pilotée par le fichier: champ calculé `purchasable` (vrai fichier non-placeholder + prix). Upload → status available + sync prix Stripe; suppression fichier (`DELETE /admin/products/{slug}/file`) → coming_soon.
- Checkout refuse (409, aucune session Stripe) tout produit sans fichier/prix.
- Prix éditable depuis /admin → resynchronise le Stripe Price (lookup_key, tax_behavior=inclusive) via `sync_stripe_price`. Le montant payé vient toujours de Stripe (session.amount_total). Le front n'impose jamais le prix (origin_url requis mais ignoré serveur).
- Pages produit riches et data-driven pour les 6 produits; le contenu riche s'affiche aussi pour les « bientôt disponibles » (sans prix ni bouton d'achat). 5 fiches coming_soon enrichies (seed + `migrate_coming_soon.py`).
- Admin Produits: prix éditable, upload/remplacement + suppression fichier, indicateur fichier, image, statut par produit.
- Tests iteration_7: 11/11 scénarios UI OK, aucune régression Stripe/contenu. Backend validé par curl (purchasable, 409, cs_test_, partial update sans écrasement, sync prix 499 inclusif).
- ⚠️ Non déployé: ces évolutions sont en Preview uniquement. Un déploiement est nécessaire pour les porter en production.

## 2026-06 — Mission conformité (Preview uniquement, NON déployée)
- PostHog supprimé ; emergent-main.js chargé seulement sur *.preview.emergentagent.com ; polices + images auto-hébergées (/fonts, /images) ; migration au démarrage des couvertures d'articles distantes → locales (seed_data.LEGACY_COVER_IMAGES).
- Bandeau cookies supprimé (aucun stockage soumis à consentement côté visiteur). Cookies hébergeur __emg_vid (12 mois) / __emg_sid (30 min) déposés par l'infra Emergent : finalité NON confirmée (support : pas de doc) → à vérifier via support@emergent.sh.
- Renonciation rétractation : case obligatoire (WithdrawalConsent.jsx), serveur exige withdrawal_waiver=true + version "retractation-v1-2026-06" (400 sinon) ; preuve (date, version, texte, IP, UA) dans payment_transactions.withdrawal_consent → copiée dans orders ; métadonnées Stripe ; rappel dans l'e-mail de confirmation.
- Newsletter : consent StrictBool obligatoire, consent_at/version/texte/status, unsubscribe_token (backfill au démarrage), POST /api/newsletter/unsubscribe, page /newsletter/desinscription, admin : statut + lien.
- Legal.jsx réécrit : CM2C, garantie légale de conformité, suppression clause « aucun remboursement », confidentialité basée sur traitements réels (transferts US/Inde déclarés), cookies réels, hébergeur Emergent Labs Inc.
- SEO : canonical fixe https://la-maison-dauben.com (lib/site.js), robots/sitemap prod, noindex admin/paiement/désinscription.
- A11y : skip link, lightbox role=dialog + Échap, labels newsletter/contact.
- Tests : backend/tests/test_compliance_rgpd.py 15/15 ; iteration_9.json frontend OK (souci images tierces corrigé ensuite, vérifié par capture).
- Points ouverts : adresse/téléphone hébergeur ; finalité cookies __emg ; Emergent déclaré « pas encore conforme RGPD » par son support ; Stripe managed_payments (vendeur de référence ?) à vérifier ; purge automatique des données non implémentée ; X-Forwarded-For contournable pour le rate limit.

## 2026-06 — Fix décalage prix site/Stripe (Preview, NON déployé)
- Cause : ensure_stripe_catalog() (exécuté à chaque démarrage/déploiement) resynchronisait Stripe sur le prix codé en dur du seed (7,99) au lieu du prix en base modifié via l'admin (6,99).
- Correctif : ensure_stripe_catalog async lit les produits en base ; create_checkout vérifie que le Price Stripe == prix en base et resynchronise sinon (503 si impossible). Taxes inclusive, webhooks, e-mails, téléchargements, case de renonciation inchangés.
- Preview : prix budget-mensuel = 6,99 ; sessions test amount_total=699 vérifiées (après redémarrage et en cas de désynchronisation forcée). Tests 15/15.

## 2026-06 — Envoi de newsletters depuis l'admin (Preview, NON déployé)
- backend/newsletter_admin.py (router /api/admin/newsletter) : liste + éligibilité (retiré / désinscrit / test manuel / consentement non prouvé / token manquant), PATCH is_test, DELETE = retrait doux (removed, removed_at, preuve conservée), preview, test (OWNER_EMAIL seul), send (confirmation "ENVOYER", re-filtrage serveur, 1 e-mail par destinataire, re-vérification de chaque abonné juste avant envoi, tâche async + verrou), historique newsletter_campaigns (résultats par destinataire), campagnes "sending" marquées "interrupted" au démarrage.
- E-mail : gabarit Maison d'Auben, texte simple auto-formaté (paragraphes, listes, liens https), pied : date de consentement, lien de désinscription personnel, identité légale. Contrôle de sécurité _assert_safe_email appliqué aussi en aperçu/simulation.
- NEWSLETTER_DRY_RUN="true" dans backend/.env Preview → statut "simulated", aucun envoi. En production, absent = envois réels.
- Frontend : pages/admin/NewsletterPanel.jsx + pages/admin/newsletter/*.
- Tests : backend/tests/test_newsletter_admin.py 23/23 (lancer avec -n 0), iteration_10.json UI OK ; bug "le test réinitialise la sélection" corrigé, date FR dans le pied.

## 2026-06 — Newsletter : sélection explicite + nettoyage données de test (Preview, NON déployé)
- Suppression du marquage « Adresse de test » (UI, PATCH, règle d'exclusion) et du mode all_eligible. Sélection explicite par case « Destinataire » + « Tout sélectionner / Tout désélectionner » ; serveur ne prend que recipient_ids éligibles (consentement prouvé, non désinscrit, non retiré).
- backend/cleanup_test_data.py (simulation par défaut, --apply) : supprime newsletter / messages (e-mail ou nom contenant « test ») et commandes dont l'e-mail contient « test » ET session cs_test_ (+ transactions de test associées) ; commandes non TEST signalées, jamais supprimées.
- Preview nettoyé : 60 abonnés, 35 messages, 4 commandes Stripe TEST + 4 transactions supprimés ; 2 commandes conservées ; 6 transactions cs_live_ (initiated/pending, sans commande) conservées.
- Tests : 37/37 backend (-n 0), iteration_11.json UI OK ; correctif retour à la ligne des e-mails sur mobile.

## 2026-06 — Correctifs ciblés newsletter / suppressions / nettoyage (Preview, NON déployé)
- subscribe_newsletter : preuve incomplète (consent, consent_at, version, texte) régularisée par nouvelle soumission consent:true ; preuve valide conservée (« déjà inscrit »). has_valid_consent partagé (newsletter_admin).
- Abonnés : Retirer réversible (POST /admin/newsletter/{id}/restore), suppression définitive POST /{id}/delete-permanently {confirmation:"SUPPRIMER"} (réinscription possible, index unique email OK).
- Messages : POST /admin/messages/{id}/delete-permanently. Commandes : POST /admin/orders/{id}/delete-permanently ; garde-fou order_guard.py (cs_test_ + transactions associées toutes cs_test_ + pas livemode ; sinon 403 avec raison) ; GET /admin/orders renvoie deletable/deletion_blockers. Aucun appel Stripe/e-mail.
- cleanup_test_data.py : simulation détaillée + empreinte ; --apply exige --fingerprint identique ; inclut transactions TEST non payées sans commande ; LIVE/ambigu signalés.
- Simulation Preview : 0 abonné/message/commande « test » ; 155 transactions TEST non payées sans commande ; 6 cs_live_ signalées. Empreinte c116096944db — EN ATTENTE de validation utilisateur. Prod DB non accessible.
- Tests : test_admin_deletions.py 12/12, test_newsletter_admin.py 22/22, test_compliance_rgpd.py 15/15 (chaque fichier séparément, -n 0, rate limit newsletter 10/min) ; iteration_12.json UI 20/20.

## 2026-06 — Google Search Console (Preview OK, NON déployé)
- frontend/public/google7a58bd32914ae521.html : fichier fourni, copié à l'identique (53 octets) → servi à /google7a58bd32914ae521.html.
- frontend/public/index.html : <meta name="google-site-verification" content="%REACT_APP_GOOGLE_SITE_VERIFICATION%" /> (valeur via secret frontend, injectée au build CRA, une seule occurrence).
- À vérifier après publication : présence du meta (sans %REACT_APP...%) et du fichier sur https://la-maison-dauben.com.

## 2026-06 — Fix menu mobile transparent après défilement (Preview, NON déployé)
- Cause : le header sticky reçoit backdrop-blur au défilement ; backdrop-filter crée un bloc conteneur pour ses descendants position:fixed → le tiroir mobile était confiné à la hauteur du header (70px), la page restait visible dessous.
- Fix (components/Header.jsx) : tiroir rendu via createPortal dans document.body + overflow-y-auto sur le panneau ; data-testid mobile-nav-contact / mobile-menu-shop-btn. Design inchangé, desktop inchangé.

## 2026-06 — Ressources cohérentes + administration éditoriale complète (Preview, NON déployé)
- Bug : GET /api/articles/{slug} renvoyait les produits liés sans with_purchasable → badge « Bientôt disponible » à tort. Corrigé à la source (server.py).
- Architecture : valeurs par défaut = textes actuels dans frontend/src/content/schema.js (+ content/legal.js, données légales identiques octet par octet) ; MongoDB `site_content` {key, fields} ne stocke que les surcharges ; hook useContent(key) (lib/content.js) ; RichText (paragraphes, listes « - », liens [texte](url), aucun HTML).
- Backend content_admin.py : GET /api/content (public), GET/PUT /api/admin/content/{key} (liste blanche de pages, partiel, null = retour au texte d'origine, anti-HTML/javascript:, validation images) ; GET/POST/PUT /api/admin/articles (brouillon/publication, slug validé + previous_slugs → redirect_to, SEO) ; GET/PUT /api/admin/faq (ajout/édition/suppression/ordre, ids uniques) ; GET /api/sitemap.xml dynamique (robots.txt pointe dessus). Anciennes routes POST/PUT articles et POST faq supprimées (remplacées).
- Seed : articles/FAQ de démo insérés une seule fois (collection seed_markers) → un article renommé ou une question supprimée n'est jamais recréé.
- Admin : onglets Pages, Articles, FAQ (pages/admin/site/*) ; « Contenu » renommé « Contenu produits ».
- Tests : test_site_content.py + test_site_content_edge.py 29/29, compliance 15/15, deletions 12/12, newsletter 22/22 ; iteration_13.json UI OK, correctifs appliqués ensuite (produit phare, brouillon admin, slug, retry 404, doublons FAQ, //images, liste blanche).

## 2026-06 — Suppression d'articles (Preview, NON déployé)
- Route existante réutilisée : DELETE /api/admin/articles/{slug} (auth admin) — exige désormais {confirmation:"SUPPRIMER"} (400 sinon), 404 si absent, delete_one sur le seul slug.
- Comportement : suppression réelle en base ; l'adresse et ses previous_slugs → 404 « Article introuvable » (pas de redirection) ; retiré du sitemap dynamique ; articles de démo non recréés (seed_markers).
- UI ArticlesPanel : bouton « Supprimer l'article » + ConfirmDeleteDialog (titre affiché) ; liste actualisée, sélection du 1er article ou état vide ; en cas d'erreur, dialogue et article conservés.
- Tests : test_site_content.py (TestArticleDeletion) + edge 30/30 ; compliance 15/15, deletions 12/12, newsletter 22/22 ; parcours UI annuler/supprimer vérifié.

## 2026-06 — Audit correctif (Preview, NON déployé)
- Sitemap unique : public/sitemap.xml = index → /api/sitemap.xml ; robots inchangé (pointe /api/sitemap.xml).
- SEO : canonical générique retiré de index.html ; Seo.jsx ajoute og:url + JSON-LD unique (#seo-jsonld) ; Product/Offer (offre seulement si purchasable) ; BlogPosting ; NotFound.jsx (route *, noindex) ; « Article introuvable » noindex.
- Rate limit : IP = XFF[-3] (TRUSTED_PROXY_HOPS=2, chaîne client,CF,LB observée) ; spoof XFF ne contourne plus (prouvé).
- ContactInput : name ≤100, email ≤254, subject ≤200, message ≤5000, name/message non vides ; maxLength côté formulaire.
- En-têtes API : X-Frame-Options DENY, CSP frame-ancestors 'none', nosniff (middleware) ; HSTS/nosniff/Referrer-Policy déjà posés par Cloudflare ; pages HTML non configurables.
- Tests : test_audit_fixes.py 15/15 ; test_lamaisondauben.py mis à jour (renonciation, prix 6,99, limites par IP réelle, liens expirés, nettoyage) 52/52 ; autres suites vertes. Build frontend OK.
- Docs : PRODUCTION.md §8 (sitemap, SEO, redirections, rate limit, en-têtes, tests, sauvegardes Emergent).
- Preview : 26 sessions Stripe TEST non payées créées par la suite historique (tx 162→188), non supprimées.

## 2026-06 — Second audit (Preview, NON déployé)
- CORS : backend/cors_config.py ; live → jamais "*", fallback PUBLIC_BASE_URL + www ; allow_credentials=False ; méthodes/en-têtes explicites. Prod à configurer : CORS_ORIGINS=https://la-maison-dauben.com,https://www.la-maison-dauben.com.
- Logo commun : champ header.favicon = « Logo du site » → Logo.jsx (en-tête, pied, admin) + SiteFavicon ; défaut /images/logo-176.png (logo officiel). Aperçu 44/16/32 px.
- Tests : tests/test_second_audit.py 5/5 ; iteration_14 UI OK ; test_site_content 12/12, test_audit_fixes 15/15, compliance 15/15.
- PRODUCTION.md §9 : CORS, règles Cloudflare (anti-iframe, 301), dépendances (starlette 0.37.2 à mettre à jour), hébergeur, questions sauvegardes.

## 2026-06 — Admin Pages/Articles : mode édition et suivi (Preview, NON déployé)
- content/adminLabels.js : groupes, intitulés clairs, aides « Visible : … » (présentation uniquement, schema.js inchangé).
- SitePagesPanel : Modifier/Terminer, fieldset en lecture seule, « Texte d origine » + Enregistrer/Annuler seulement en édition ; suivi modif. inchangé.
- ArticlesPanel : encadré Statut / Date de publication / Dernière modification ; Modifier/Terminer ; « modifié » par champ ; Enregistrer (X) ; Annuler. Backend inchangé (updated_at à chaque enregistrement, published_at intact).
- fields.jsx : style des champs désactivés.
- Tests : test_site_content 13/13 (TestArticleEditTracking) ; iteration_15 UI 100%.

## 2026-06 — Suivi des modifications harmonisé (Contenu produits, Pages, Articles, FAQ) (Preview, NON déployé)
- site/editTracking.jsx : useEditSession commun ; référence = dernière version enregistrée (commit() après succès, rechargement identique ignoré) ; confirmLeave() pour changement d onglet admin.
- Consultation : aucun indicateur ; édition : « modifié », « Annuler ce changement » (ex « Texte d origine »), Enregistrer (n), Annuler les modifications ; compteur gauche « n non enregistré(s) ».
- Confirmation avant abandon : Terminer, changement d élément, changement d onglet, Retour à la liste produits.
- Produits : envoi des seuls champs modifiés (prix/statut/fichier jamais touchés). FAQ : suivi par question + note suppressions/ordre.
- Tests : iteration_16 frontend 100 % ; aucun historique persistant ajouté ; aucun déploiement.


## 2026-06 — Incident paiement « Suivi sportif » (Preview corrigé, NON publié)
- Cause : en Production le document produit suivi-sportif n'a ni lookup_key ni currency → front envoie lookup_key undefined → 422 (6× dans les logs, confirmé par le deployer en lecture seule).
- Correctif server.py : lookup_of(p) (clé dérivée du slug si absente, même règle que la création admin) dans with_purchasable, ensure_stripe_catalog, upload fichier ; checkout retrouve le produit par slug si lookup_key absent ; currency `or "eur"` ; erreur Stripe journalisée (type/code/message, sans secret) → 502.
- ProductDetail.jsx : refuse toute réponse sans URL checkout.stripe.com ; messages distincts réseau / 409 / 400 / autre ; détails techniques en console hors production uniquement.
- Preview : suivi-sportif mis à 4,99 € + fichier TEST + lookup_key/currency retirés pour reproduire la Prod. Session TEST 499 EUR, redirection Stripe OK desktop + mobile ; budget 699 OK ; coming_soon 409 ; sans case 400 ; aucune commande créée.
- À noter : l'API publique produit expose download_storage_path (à masquer plus tard).

## 2026-06 — Prévention fiches produits incomplètes (Preview uniquement, NON publié)
- backend/product_rules.py : derive_lookup (slug conforme seulement), valid_lookup, effective_lookup/currency (avertissement ANOMALIE journalisé : 1×/produit/démarrage pour l'affichage, à chaque checkout), commercial_issues, lookup_owners (unicité référence effective).
- backend/backfill_product_refs.py : simulation par défaut, `--apply` ; ne remplit que les champs absents, idempotent. Appliqué en Preview aux 5 produits historiques. NON exécuté en Production.
- server.py : achetable = prix>0 + devise + référence valide + vrai fichier ; checkout 409 si référence en double ; create/update : référence jamais écrasée/effacée, doublon 409, passage « available » incomplet 400 ; GET /api/admin/products/health ; POST /api/admin/products/{slug}/stripe-sync (seulement si seul le prix Stripe manque/diffère).
- Admin Produits : bloc anomalies / « Prêt à la vente » + bouton « Synchroniser avec Stripe ».
- Tests : tests/test_product_refs.py 8/8, régression 42/42, testing agent iteration_17 OK.
- 2026-06 (suite) : bouton « Synchroniser » avec confirmation (window.confirm, montant affiché) ; sync idempotente vérifiée (conforme → 400 « Rien à synchroniser », aucun prix créé). Script : `--apply` exige `--confirm-db=<DB_NAME>`, jamais importé par le serveur. En Preview les 5 fiches historiques ont été REMISES sans lookup_key/currency : simulation présentée, application en attente d'accord utilisateur.
- À signaler : la synchro Stripe existante au démarrage (ensure_stripe_catalog) et au checkout crée/aligne toujours les prix automatiquement (comportement antérieur, non modifié).
- 2026-06 : correction APPLIQUÉE en Preview (5 fiches, avant/après : seuls lookup_key+currency ajoutés ; 2e exécution 0 changement ; tests 23/23). Simulation Production en lecture seule (deployer, plan() sur docs réels) : 5 à compléter, 0 ignorés, aucune collision ; suivi-sportif 5,99 € fichier Suivi-Sport.xlsx. Stripe LIVE non lu directement par le deployer. Production NON modifiée.
- 2026-06 : CORRECTION PRODUCTION APPLIQUÉE (accord explicite) via PUT /api/admin/products/{slug} {lookup_key,currency} sur les 5 fiches ; aucun appel Stripe ; diff BEFORE/AFTER (memory/prod_products_BEFORE_fix.md / _AFTER_fix.md) : exactement 10 champs ajoutés, 0 modifié/supprimé, budget-mensuel identique, suivi-sportif 5,99 €. Secrets PROD_ADMIN_EMAIL/PASSWORD ajoutés en Preview pour l'opération : à supprimer + changer le mot de passe admin Prod.

## 2026-11 — Messagerie contact (Preview uniquement, non publié)
- backend/contact_admin.py : consentement par demande (contact-suivi-v1, horodaté), notification OWNER_EMAIL systématique, confirmation + réponses seulement si consentement, reply_to = OWNER_EMAIL, historique `replies` (status sending/sent/failed, email_id), anti-doublon request_id atomique, statut new/answered/handled, 424 en échec d'envoi.
- CONTACT_EMAIL_DRY_RUN="true" dans backend/.env Preview, actif seulement si PUBLIC_BASE_URL est un domaine preview ; marqueur [SIMULER-ECHEC] = échec simulé.
- Front : Contact.jsx (case facultative), admin/MessagesPanel.jsx (extrait d'AdminDashboard).
- Tests : backend/tests/test_contact_messages.py 10 passed (-n 0, via localhost avec X-Forwarded-For varié) ; iteration_18 frontend 8/8 ; 1 vrai e-mail d'essai (modèle réponse) envoyé à OWNER_EMAIL.

## 2026-11 — Messagerie contact v2 (Preview uniquement, non publié)
- Case de consentement supprimée ; mention d'information sous le bouton (notice_version contact-mention-v1). Politique de confidentialité (legal.js) : base légale mesures précontractuelles / intérêt légitime.
- Tous les messages sont répondables ; anciens champs followup_consent* conservés, affichés « Ancien formulaire ».
- File persistante dans le document : owner_notification / confirmation {status pending|sending|sent|failed|uncertain, attempts, next_at, started_at}. Envoi lancé en tâche de fond + worker toutes les 20 s (start_contact_worker au startup). Erreur temporaire : 3 essais auto (60 s, 300 s).
- CONTACT_SEND_TIMEOUT_SECONDS (défaut 300) : sending trop ancien -> uncertain ; renvoi manuel avec confirm_duplicate_risk.
- emailer.send_email_result (classification temporary/refused/refused_local) ; send_email inchangé pour commandes/newsletter.
- Filtre de sécurité : notification admin renvoyée sans nom/sujet/contenu ; confirmation sans nom/sujet ; réponse admin refusée -> message explicite, pas de renvoi.
- Marqueurs simulation : [SIMULER-ECHEC], [SIMULER-REFUS], [SIMULER-LENT].
- Tests : test_contact_messages.py 12 passed ; iteration_19 frontend 100 % ; essai réel vers lamaisondauben@gmail.com (notification + confirmation + réponse acceptées par le fournisseur) ; redémarrage pendant envoi vérifié.
