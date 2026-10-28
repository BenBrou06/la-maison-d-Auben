# La Maison d'Auben — Préparation à la PRODUCTION

> Ce document décrit la mise en production. Aucune clé secrète réelle ne doit figurer ici
> ni dans aucun fichier versionné. Les secrets se renseignent uniquement dans les
> **Secrets du déploiement**.

## 1. Séparation stricte des environnements
| | Preview / dev | Production |
|---|---|---|
| STRIPE_MODE | `test` | `live` |
| Clé Stripe | `sk_test_...` (sandbox) | `rk_live_...` |
| Paiements | fictifs (carte 4242) | réels |
| PUBLIC_BASE_URL | URL preview | `https://auben-preview-shop.emergent.host` |

Le backend **refuse de démarrer** (échec explicite, aucun fallback TEST) si :
- `STRIPE_SECRET_KEY` est absente ;
- `STRIPE_MODE=live` avec une clé non-live ;
- une clé LIVE est présente alors que `STRIPE_MODE != live` (override volontaire : `STRIPE_ALLOW_LIVE=1`).

## 2. Secrets de production (à renseigner dans le déploiement)
Obligatoires :
```
MONGO_URL=...            # BD de production
DB_NAME=...
CORS_ORIGINS=*
STRIPE_MODE=live
STRIPE_SECRET_KEY=rk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # du webhook LIVE (étape 1 ci-dessous)
PUBLIC_BASE_URL=https://auben-preview-shop.emergent.host
EMERGENT_EMAIL_KEY=...                 # e-mails (infra Emergent)
EMAIL_FROM_NAME=La Maison d'Auben
OWNER_EMAIL=lamaisondauben@gmail.com   # notification vendeur
EMERGENT_LLM_KEY=...                   # stockage fichiers/images (infra Emergent)
JWT_SECRET=...                         # long aléatoire
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```
Optionnelles : `STRIPE_PUBLISHABLE_KEY=pk_live_...` (non utilisée par le code : Checkout par redirection), `STRIPE_ACCOUNT_ID`, `EMAIL_REPLY_TO`.

Frontend : `REACT_APP_BACKEND_URL` uniquement — **aucun secret côté frontend**.

⚠️ **Continuité des données produit** : le vrai fichier `Budget-mensuel.xlsx` et l'image produit
sont stockés dans le stockage objet Emergent et **référencés dans MongoDB**. Pour qu'ils
apparaissent en production, la prod doit utiliser **le même `MONGO_URL`/`DB_NAME`** (références)
**et le même `EMERGENT_LLM_KEY`** (accès aux objets) que la preview. Sinon, ré-uploader le fichier
et l'image via l'**administration** (`/admin` → Produits) après déploiement, sans quoi le produit
retomberait sur le fichier placeholder.

## 3. Webhook Stripe LIVE
- URL : `https://auben-preview-shop.emergent.host/api/stripe/webhook`
- Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`
- Le `whsec_...` généré → `STRIPE_WEBHOOK_SECRET`.
- Le code vérifie la signature via `STRIPE_WEBHOOK_SECRET`. Un **fallback par polling**
  (`GET /api/payments/status/{id}`) valide la commande même si un webhook est manqué.

## 4. Procédure de déploiement (ordre validé)
1. Créer le webhook LIVE (URL + événements ci-dessus).
2. Copier son `whsec_...`.
3. Renseigner tous les Secrets de production (§2).
4. Déployer / republier.
5. Vérifier les logs : `Stripe initialisé | mode=live | cle=live`, aucune `CONFIG ERROR`.
6. Test Checkout sans payer → la session doit commencer par `cs_live_`.
7. Achat réel 7,99 €.
8. Vérifier la chaîne : webhook → commande unique → e-mail client → e-mail vendeur → téléchargement.
9. Rembourser le paiement de test depuis Stripe.

## 5. Garanties techniques en place
- **Montant** = `session.amount_total` de Stripe (jamais une valeur du frontend). TTC 7,99 €.
- **Idempotence** : index unique `orders.session_id` + upsert `$setOnInsert` + garde
  `DuplicateKeyError` → jamais de commande ni d'e-mail en double (webhook rejoué ou webhook+polling concurrents).
- **Téléchargement sécurisé** : `/api/download/{token}` (token 43 car. non devinable, expiration 30 j,
  limite de téléchargements). Le fichier payant n'est **pas** exposé via `/api/media` (images seulement).

## 6. Dépendances Emergent (migration future, hors périmètre actuel)
| Élément | État | Migration future |
|---|---|---|
| Stripe | ✅ Portable (SDK standard) | Aucune |
| Frontend (`REACT_APP_BACKEND_URL`) | ✅ Portable | Aucune |
| MongoDB | ⚠️ À héberger | MongoDB Atlas |
| E-mails (`emailer.py`) | 🔗 Emergent (`integrations.emergentagent.com` + `EMERGENT_EMAIL_KEY`) | Resend direct (`RESEND_API_KEY`) + domaine vérifié |
| Stockage fichiers/images (`storage.py`) | 🔗 Emergent (proxy + `EMERGENT_LLM_KEY`) | S3 / GCS + URLs signées |

Ces dépendances **ne bloquent pas** le déploiement actuel sur Emergent.

## 7. Note e-mails en production
En preview, le service e-mail Emergent n'accepte que l'adresse vendeur vérifiée (422 sur d'autres
adresses de test) — l'e-mail **vendeur** fonctionne. En production, **re-vérifier** que l'e-mail
**client** part bien vers l'adresse de l'acheteur réel (domaine d'envoi correctement configuré).
Les liens des e-mails utilisent l'origine réelle de l'achat / `PUBLIC_BASE_URL` — aucun domaine preview en dur.

## 8. Exploitation (audit 2026-06)

### Sitemap
- Source unique : `GET /api/sitemap.xml` (backend/content_admin.py) — pages publiques, toutes les fiches produits, articles publiés uniquement ; jamais admin, paiement, téléchargement, désinscription.
- `frontend/public/sitemap.xml` est un *index* qui pointe vers `/api/sitemap.xml` ; `robots.txt` déclare `Sitemap: https://la-maison-dauben.com/api/sitemap.xml`.
- À soumettre dans Google Search Console : `https://la-maison-dauben.com/api/sitemap.xml` (ou l'index `/sitemap.xml`).

### Métadonnées & données structurées
- `components/Seo.jsx` pose par page : title, description, canonical, og:url, robots (noindex sur paiement, téléchargement, désinscription, 404), et un JSON-LD unique (`#seo-jsonld`) retiré en quittant la page.
- Product (+ Offer seulement si le produit est réellement achetable : prix et fichier réels), BlogPosting pour les articles. Aucune note/avis.
- `index.html` ne contient plus de canonical générique (il pointait toutes les pages vers l'accueil).
- Rendu côté client : Google exécute le JavaScript ; un pré-rendu n'est pas mis en place (bénéfice à réévaluer si l'indexation pose problème dans Search Console).

### Redirections d'articles
- Slug modifié → l'ancien slug est conservé dans `previous_slugs` ; `GET /api/articles/{ancien}` renvoie `{"redirect_to": nouveau}` et le site redirige (remplacement d'historique, canonical = nouvelle URL).
- Pas de 301 HTTP possible : les pages du site sont servies par l'hébergeur (application monopage), le backend ne reçoit que `/api/*`. Un 301 nécessiterait une règle chez l'hébergeur/Cloudflare.
- Article supprimé ou inexistant → page « Article introuvable » en noindex ; URL inconnue → page 404 noindex. Jamais de redirection vers l'accueil.

### Limitation de débit
- En mémoire, par processus (1 worker) : remise à zéro au redémarrage, non partagée entre instances.
- Limites/minute/IP : connexion admin 5, contact 5, newsletter 10, désinscription 10, paiement 20.
- IP : 3e valeur en partant de la droite de `X-Forwarded-For` (posée par Cloudflare devant le load balancer, chaîne observée en Preview) ; les valeurs ajoutées par le client sont ignorées. Si l'infrastructure change (nombre de proxys), ajuster `TRUSTED_PROXY_HOPS` dans server.py.

### En-têtes de sécurité
- Hébergeur/Cloudflare (vérifié sur la-maison-dauben.com) : `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Application (réponses `/api/*` uniquement) : `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `nosniff`.
- Pages HTML : pas de protection anti-iframe ni de CSP (non configurables depuis l'application) → à demander à Emergent / règle Cloudflare.

### Tests (Preview uniquement, jamais contre la production)
- `cd backend && python -m pytest tests/<fichier>.py -q -n 0` — un fichier à la fois (limites de débit partagées par IP ; certains tests attendent 61 s).
- Fichiers : test_audit_fixes, test_site_content(+_edge), test_compliance_rgpd, test_admin_deletions, test_newsletter_admin, test_lamaisondauben (historique, mis à jour : renonciation obligatoire, prix 6,99).
- Données synthétiques préfixées (fictif-…, test_…@t.com) supprimées en fin de module ; paiements en mode Stripe TEST uniquement ; aucun e-mail réel (NEWSLETTER_DRY_RUN en Preview).

### Sauvegardes (selon le support Emergent, à faire confirmer par écrit)
- MongoDB de production : sauvegardes automatiques gérées par Emergent (horaires 7 j, quotidiennes 7 j, hebdomadaires 4 sem., mensuelles 12 mois, annuelle 1 an) + restauration à un instant précis sur 7 jours.
- Restauration : uniquement via support@emergent.sh (procédure non documentée publiquement). Le « rollback » du panneau de publication ne restaure que le code, pas les données.
- Object Storage (fichiers Excel, images) : chiffré, fichiers non supprimables, sauvegarde non documentée → à confirmer auprès d'Emergent.
- Code : GitHub (Save to GitHub).
