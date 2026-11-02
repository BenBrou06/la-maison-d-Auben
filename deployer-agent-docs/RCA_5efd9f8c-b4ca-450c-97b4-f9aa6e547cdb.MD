# Read-only dry-run report — products collection & backfill_product_refs.py

App: https://la-maison-dauben.com  | deployment: auben-preview-shop | active run: 5efd9f8c-b4ca-450c-97b4-f9aa6e547cdb
DB (resolved server-side by mongo_query): `auben-preview-shop-test_database`
Mode: STRICTLY READ-ONLY. No writes to DB, no secret changes, no Stripe create/modify, backfill NOT applied.

## 1) products — per document (6 found, as expected)

| slug | price | status | lookup_key | currency | download_storage_path present | download_is_placeholder | download_filename |
|---|---|---|---|---|---|---|---|
| budget-mensuel | 6.99 | available | exists = "budget_mensuel" | exists = "eur" | yes | false | "Budget_mensuel.zip" |
| suivi-sportif | 5.99 | available | ABSENT | ABSENT | yes | false | "Suivi-Sport.xlsx" |
| travel-manager | null | coming_soon | ABSENT | ABSENT | no | (absent) | (absent) |
| car-cost | null | coming_soon | ABSENT | ABSENT | no | (absent) | (absent) |
| first-apartment | null | coming_soon | ABSENT | ABSENT | no | (absent) | (absent) |
| budget-couple | null | coming_soon | ABSENT | ABSENT | no | (absent) | (absent) |

## 2) backfill_product_refs.py — SIMULATION (no flags)
Could NOT run against prod DB: eph sandbox has no production secrets; its .env is preview values.
Reproduced faithfully by feeding the real prod docs into the script's plan() + product_rules.py in the sandbox.
Script confirmed read-only without `--apply --confirm-db=<DB_NAME>` (main() refuses --apply unless --confirm-db matches DB_NAME).

Output (accents ASCII-flattened by harness; real script prints SIMULE as "SIMULÉ"):

Base : auben-preview-shop-test_database - 6 produits, 5 a completer, 0 ignores
  SIMULE   car-cost: {'lookup_key': 'car_cost', 'currency': 'eur'}
  SIMULE   suivi-sportif: {'lookup_key': 'suivi_sportif', 'currency': 'eur'}
  SIMULE   travel-manager: {'lookup_key': 'travel_manager', 'currency': 'eur'}
  SIMULE   first-apartment: {'lookup_key': 'first_apartment', 'currency': 'eur'}
  SIMULE   budget-couple: {'lookup_key': 'budget_couple', 'currency': 'eur'}
Simulation uniquement : aucune donnee modifiee.

- 5 docs would get lookup_key + currency="eur"; budget-mensuel untouched (already set); 0 skipped.
- DEFAULT_CURRENCY = "eur". derive_lookup = slug with '-'->'_' when slug matches ^[a-z0-9]+(?:-[a-z0-9]+)*$.
- price=null is treated as eligible for currency (condition: price is None OR price>0).

## 3) Uniqueness of lookup_key
No collisions. Stored lookup_key exists only on budget-mensuel ("budget_mensuel").
Effective keys (stored else derived): car_cost, suivi_sportif, budget_mensuel, travel_manager, first_apartment, budget_couple -> ALL DISTINCT, duplicates: NONE.
Backfill also guards against collisions (key in explicit or counts[key] > 1 -> skip).

## 4) Stripe LIVE read-only verification — NOT PERFORMED
Deployer agent has no Stripe tool, no access to production Stripe secret value, and the sandbox has no outbound Stripe access. Cannot report active price count / unit_amount / currency / tax_behavior / product name / metadata.emergent_product_id for budget_mensuel, suivi_sportif, travel_manager, car_cost, first_apartment, budget_couple. In particular the suivi_sportif "one active price = 599 EUR vs DB 5.99 EUR" check was NOT run. Must be executed by a party with Stripe live-key access. No Stripe endpoint was called.
