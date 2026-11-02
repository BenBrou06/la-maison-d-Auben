"""Complète lookup_key / currency manquants sur les fiches produits (aucun autre champ).

Simulation par défaut :   python backfill_product_refs.py
Application explicite :   python backfill_product_refs.py --apply
Idempotent : seuls les champs absents/vides sont écrits, avec un filtre qui revérifie leur absence.
"""
import asyncio
import os
import sys
from collections import Counter

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from product_rules import DEFAULT_CURRENCY, derive_lookup, effective_lookup

MISSING = {"$in": [None, ""]}


def plan(products):
    counts = Counter(k for k in (effective_lookup(p) for p in products) if k)
    explicit = {p["lookup_key"] for p in products if p.get("lookup_key")}
    changes, skipped = [], []
    for p in products:
        slug, upd = p["slug"], {}
        if not p.get("lookup_key"):
            key = derive_lookup(slug)
            if not key:
                skipped.append((slug, "lookup_key", "slug non conforme, déduction ambiguë"))
            elif key in explicit or counts[key] > 1:
                skipped.append((slug, "lookup_key", f"'{key}' déjà utilisé par un autre produit"))
            else:
                upd["lookup_key"] = key
        if not p.get("currency"):
            price = p.get("price")
            if price is None or (isinstance(price, (int, float)) and price > 0):
                upd["currency"] = DEFAULT_CURRENCY
            else:
                skipped.append((slug, "currency", f"prix incohérent ({price!r})"))
        if upd:
            changes.append((slug, upd))
    return changes, skipped


async def main(apply: bool):
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    products = await db.products.find({}, {"_id": 0, "slug": 1, "lookup_key": 1, "currency": 1, "price": 1}).to_list(1000)
    changes, skipped = plan(products)
    print(f"Base : {os.environ['DB_NAME']} — {len(products)} produits, {len(changes)} à compléter, {len(skipped)} ignorés")
    for slug, upd in changes:
        print(f"  {'APPLIQUÉ' if apply else 'SIMULÉ '}  {slug}: {upd}")
    for slug, field, why in skipped:
        print(f"  IGNORÉ   {slug}.{field}: {why}")
    if apply:
        for slug, upd in changes:
            for field, value in upd.items():
                await db.products.update_one({"slug": slug, field: MISSING}, {"$set": {field: value}})
    elif changes:
        print("Simulation uniquement. Relancer avec --apply pour écrire.")


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv))
