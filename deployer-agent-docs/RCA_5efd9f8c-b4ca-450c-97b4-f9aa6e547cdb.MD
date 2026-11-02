# Owner-Authorized Production Data Fix — EXECUTION BLOCKED (read-only tooling)

App: https://la-maison-dauben.com
Deployment: auben-preview-shop
DB: auben-preview-shop-test_database
Collection: products
Active run: 5efd9f8c-b4ca-450c-97b4-f9aa6e547cdb

## OUTCOME
STEP A (pre-check) completed and PASSED all conditions.
STEP B (write) CANNOT be performed by the Deployer Agent: the only DB tool available (mongo_query) is strictly READ-ONLY (find/count/distinct/list_collections/list_indexes). There is no updateOne/write capability. STEP C (post-check/diff) is therefore not applicable yet.
No write, no retry, no rollback was attempted. No other collection touched. Nothing redeployed/restarted; no secret/Stripe/code change.

## STEP A — PRE-CHECK RESULT: PASS
- Exactly 6 product documents: PASS (count=6)
- budget-mensuel: lookup_key="budget_mensuel" AND currency="eur": PASS
- suivi-sportif: price == 5.99 AND status=="available": PASS
- price null AND status=="coming_soon" for travel-manager, car-cost, first-apartment, budget-couple: PASS (all 4)
- lookup_key AND currency both ABSENT for suivi-sportif, travel-manager, car-cost, first-apartment, budget-couple: PASS (all 5 — neither field present on any)
- No document anywhere has lookup_key in [suivi_sportif, travel_manager, car_cost, first_apartment, budget_couple]: PASS (only budget-mensuel carries lookup_key, value "budget_mensuel")

Conclusion: the data is in exactly the expected pre-state. The 10 conditional updates in STEP B are safe to apply AS SPECIFIED by a tool capable of writing.

## WHO MUST APPLY THE WRITE
This must be executed via DB Manager (Deployment Panel -> Database) or by E1/main agent with write access, using the exact 10 conditional updateOne operations specified, each filtered on {field:{$in:[null,""]}} so a missing field is required (no overwrite), $set only, no upsert. After applying, re-read all 6 docs for the post-check diff (expected: exactly 10 added fields — lookup_key + currency on the 5 slugs; zero modified/removed; budget-mensuel identical; suivi-sportif price still 5.99).

## "BEFORE" SNAPSHOT (verbatim, all 6 documents, all fields)

### 1. slug=car-cost (_id 6ab036614f2c54c9b313931b)
name="Car Cost", price=null, status="coming_soon", category_slug="automobile", badge="", main_image="", short_description="Le vrai coût de votre voiture, enfin clair.", created_at="2026-09-20T19:39:13.538132+00:00", lookup_key=ABSENT, currency=ABSENT.
audience, compatibility (3), contents (5), description, faq (3), features (6), gallery (3 slots), seo{title,description} present.

### 2. slug=suivi-sportif (_id 6ab101e75bfb54267285be52)
name="Suivi sportif", price=5.99, status="available", category_slug="sport", badge="Nouveau", main_image="maison-auben/images/d8c109bb-29b7-45d3-bba3-0b0308d64ed1.png", download_filename="Suivi-Sport.xlsx", download_is_placeholder=false, download_storage_path="maison-auben/files/suivi-sportif/a4984cb5-9d35-49f2-ae49-cd847c650181.xlsx", created_at="2026-09-21T10:07:35.367579+00:00", lookup_key=ABSENT, currency=ABSENT.
audience, compatibility (2), contents (5), description, faq (3), features (6), gallery (4 slots), seo present.

### 3. slug=budget-mensuel (_id 6ab036616c287379456af1b3) — DO NOT TOUCH
name="Budget mensuel", price=6.99, status="available", category_slug="budget-finance", badge="", currency="eur", lookup_key="budget_mensuel", main_image="maison-auben/images/d3cf52f9-07cf-436c-819b-954506e96d91.png", main_image_placeholder=true, download_filename="Budget_mensuel.zip", download_is_placeholder=false, download_storage_path="maison-auben/files/budget-mensuel/9b140c08-b898-4a82-b100-9c8707432f12.zip", created_at="2026-09-20T19:39:13.527540+00:00".
audience, compatibility (2), contents (6), description, faq (4), features (6), gallery (4 slots), seo present.

### 4. slug=travel-manager (_id 6ab036614f2c54c9b3139319)
name="Travel Manager", price=null, status="coming_soon", category_slug="travel", badge="", main_image="", created_at="2026-09-20T19:39:13.537627+00:00", lookup_key=ABSENT, currency=ABSENT.
audience, compatibility (3), contents (5), description, faq (3), features (6), gallery (3 slots), seo present.

### 5. slug=first-apartment (_id 6ab036614f2c54c9b313931d)
name="First Apartment", price=null, status="coming_soon", category_slug="maison", badge="", main_image="", created_at="2026-09-20T19:39:13.538431+00:00", lookup_key=ABSENT, currency=ABSENT.
audience, compatibility (3), contents (5), description, faq (3), features (6), gallery (3 slots), seo present.

### 6. slug=budget-couple (_id 6ab036614f2c54c9b313931f)
name="Budget Couple", price=null, status="coming_soon", category_slug="couple", badge="", main_image="", created_at="2026-09-20T19:39:13.538715+00:00", lookup_key=ABSENT, currency=ABSENT.
audience, compatibility (3), contents (5), description, faq (3), features (6), gallery (3 slots), seo present.

NOTE: Full nested field contents (every faq/feature/gallery entry) were read verbatim from the live DB during pre-check and matched the expected structure; abbreviated here for the doc. The pre-state is confirmed safe for the specified writes.
