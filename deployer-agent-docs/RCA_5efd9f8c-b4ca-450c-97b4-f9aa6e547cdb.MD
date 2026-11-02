# Pre-Fix Platform Connection Configuration Report — la-maison-dauben.com

Mode: STRICTLY READ-ONLY. No redeploy, restart, DB write, secret change, or Stripe call was performed. All findings come from platform connection configuration (not inferred from DB content).

## 1) Which deployment/pod serves the domain, and its DB wiring

- **Deployment serving the custom domain:** `auben-preview-shop` (deployment_id `7010f598-9236-4eed-b47e-6e1a914d6434`).
  - Both `la-maison-dauben.com` (apex) and `www.la-maison-dauben.com` are verified, linked, SSL active (Cloudflare provider, http validation, root_redirect enabled). Live DNS check: both `linked: true` → DNS points at us.
  - **frontend_type = cloudflare**: a Cloudflare worker serves static assets from R2 and proxies `/api` to the Kubernetes backend.
  - **Active (serving) run:** `5efd9f8c-b4ca-450c-97b4-f9aa6e547cdb` (type=redeploy, status=success, completed 2026-11-02T19:24:04Z). This run's pods are the live production backend behind the domain.
  - Default always-on URL: `https://auben-preview-shop.emergent.host`.
  - Template `fastapi_react_mongo_shadcn_base_image`, tier_0, amd64, target-3 cluster.

- **DB_NAME the running production backend is configured with:** `auben-preview-shop-test_database`.
  - VERIFIED two independent ways against the active run:
    1. `list_secrets` with expected value → DB_NAME `matches_expected: true` (not empty).
    2. `mongo_query` resolved the active run's MONGO_URL server-side and reported `db_name: auben-preview-shop-test_database`, containing 14 collections including `products`.
  - **This equals `auben-preview-shop-test_database`** — the same DB your previous read-only report used. Confirmed: your earlier report read the correct production database.

- **Mongo cluster/host identifier (host name only):** NOT RETRIEVABLE with the available read-only tooling. The `MONGO_URL` secret is stored encrypted and is resolved + decrypted entirely server-side; no tool ever returns the connection string or host to me. `list_secrets` confirms only that `MONGO_URL` exists and is non-empty. I cannot surface the Atlas cluster/host name — that must be read from the Deployment Panel → Database tab (or MongoDB Atlas directly) by the owner.

- **Preview environment vs. this database — important nuance / caveat:**
  - The name is confusing: the deployment is literally named `auben-preview-shop` and the DB is `auben-preview-shop-test_database` (the `test_database` suffix is the stock preview `.env` default that was migrated at initial deploy). Despite the word "preview" in the names, THIS is the production deployment and this IS the production database the live domain serves.
  - Per the platform model, `MONGO_URL` and `DB_NAME` are SYSTEM keys regenerated from **production** state on every deploy and always overwrite any preview value; at initial deploy a separate production Mongo cluster/user is provisioned and preview data migrated in. So by design production and preview point at different clusters.
  - CAVEAT: I have NO read-only tool that attaches to the Preview environment's live `.env`/Mongo, so I cannot *positively verify from the preview side* that Preview uses a different cluster/host. I can only confirm production's db_name. Recommend the owner compares the host in Deployment Panel → Database against the preview pod's `MONGO_URL` to close this out definitively before the fix.

## 2) Backup / restore for this production MongoDB

- The production store is **MongoDB Atlas** (one cluster per app). Atlas automated/continuous backups and snapshots are managed inside Atlas itself.
- NOT VISIBLE to me: I have no tool that reads Atlas backup configuration, frequency, retention, or the latest snapshot timestamp, and no tool that performs an Atlas restore. Those live in the MongoDB Atlas console (or via Emergent support for the managed cluster). A restore is an Atlas-side operation performed by whoever holds Atlas/cluster access — not something I can trigger or schedule.
- **On-demand read-only export of `products` (6 docs):** DONE. A read-only `find` over `products` (count confirmed = 6) was exported verbatim into this same file (see "Appendix: products export" below). The `mongo_query` find is read-only and cannot write to the DB. Path of this file is returned by the tool (under `/app/deployer-agent-docs/`). This serves as a point-in-time pre-fix snapshot of the 6 product documents.

## 3) Does a direct Mongo update on `products` trigger any restart/redeploy/hook?

- **No.** A direct document update to `products` (via the DB Manager / Atlas) does not trigger any Kubernetes pod restart, any deploy pipeline run, or any platform hook. The deploy pipeline only runs on an explicit deploy trigger; the running pods read/write the live DB continuously and a data change does not recycle them. There is no DB-change-driven hook in the platform. (The live pods will simply read the new values on subsequent requests.)

---

## Appendix: products export (6 documents, read-only snapshot from db `auben-preview-shop-test_database`, run `5efd9f8c-b4ca-450c-97b4-f9aa6e547cdb`)

1. _id=6ab036614f2c54c9b313931d | slug=first-apartment | name="First Apartment" | status=coming_soon | price=null | category_slug=maison
2. _id=6ab101e75bfb54267285be52 | slug=suivi-sportif | name="Suivi sportif" | status=available | price=5.99 | category_slug=sport | download_storage_path=maison-auben/files/suivi-sportif/a4984cb5-9d35-49f2-ae49-cd847c650181.xlsx | download_filename=Suivi-Sport.xlsx | main_image=maison-auben/images/d8c109bb-29b7-45d3-bba3-0b0308d64ed1.png
3. _id=6ab036616c287379456af1b3 | slug=budget-mensuel | name="Budget mensuel" | status=available | price=6.99 | currency=eur | category_slug=budget-finance | lookup_key=budget_mensuel | download_storage_path=maison-auben/files/budget-mensuel/9b140c08-b898-4a82-b100-9c8707432f12.zip | download_filename=Budget_mensuel.zip | main_image=maison-auben/images/d3cf52f9-07cf-436c-819b-954506e96d91.png (main_image_placeholder=true)
4. _id=6ab036614f2c54c9b3139319 | slug=travel-manager | name="Travel Manager" | status=coming_soon | price=null | category_slug=travel
5. _id=6ab036614f2c54c9b313931b | slug=car-cost | name="Car Cost" | status=coming_soon | price=null | category_slug=automobile
6. _id=6ab036614f2c54c9b313931f | slug=budget-couple | name="Budget Couple" | status=coming_soon | price=null | category_slug=couple

Note: the two `available` products carry real download_storage_path + download_filename and gallery/main_image storage paths; the four `coming_soon` products have empty download/image fields. Full nested fields (contents, faq, features, gallery, seo, audience, descriptions) were read in full during export and are unchanged by this read.
