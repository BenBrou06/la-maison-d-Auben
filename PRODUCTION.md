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
OWNER_EMAIL=benbrou06@gmail.com        # notification vendeur
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
