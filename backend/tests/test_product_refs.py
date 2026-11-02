# Références Stripe / devise / mise en vente (Preview, Stripe TEST). Produits synthétiques préfixe test-refs- supprimés. `-n 0`.
import os
import re
import sys

import pytest
import requests
import stripe
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
from backfill_product_refs import plan  # noqa: E402

load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
P = "test-refs-"
VERSION = re.search(r'WITHDRAWAL_CONSENT_VERSION = "([^"]+)"', open("/app/backend/server.py").read()).group(1)
FILE = {"download_storage_path": "x/files/test.xlsx", "download_is_placeholder": False}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    mdb.products.delete_many({"slug": {"$regex": "^" + P}})


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    e = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    p = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    return {"Authorization": "Bearer " + requests.post(f"{API}/admin/login", json={"email": e, "password": p}).json()["access_token"]}


def checkout(key):
    return requests.post(f"{API}/payments/checkout", json={"lookup_key": key, "origin_url": "x",
                         "withdrawal_waiver": True, "withdrawal_consent_version": VERSION})


def test_backfill_plan_rules():
    prods = [
        {"slug": "a-b", "lookup_key": "custom", "currency": "usd", "price": 3},
        {"slug": "c-d", "price": None},
        {"slug": "Bad_Slug", "price": 2},
        {"slug": "x-y", "price": 2}, {"slug": "z", "lookup_key": "x_y", "currency": "eur", "price": 1},
        {"slug": "neg", "lookup_key": "neg", "price": -1},
    ]
    changes, skipped = dict(plan(prods)[0]), plan(prods)[1]
    assert "a-b" not in changes
    assert changes["c-d"] == {"lookup_key": "c_d", "currency": "eur"}
    assert "lookup_key" not in changes.get("Bad_Slug", {}) and "lookup_key" not in changes.get("x-y", {})
    assert {(s, f) for s, f, _ in skipped} >= {("Bad_Slug", "lookup_key"), ("x-y", "lookup_key"), ("neg", "currency")}


def test_historic_products_complete():
    for slug in ["suivi-sportif", "travel-manager", "car-cost", "first-apartment", "budget-couple"]:
        p = mdb.products.find_one({"slug": slug})
        assert p["lookup_key"] == slug.replace("-", "_") and p["currency"] == "eur"


def test_create_duplicate_and_incomplete(h):
    r = requests.post(f"{API}/admin/products", headers=h, json={"name": "x", "category_slug": "sport", "slug": P + "dup", "lookup_key": "suivi_sportif", "status": "coming_soon"})
    assert r.status_code == 409 and "déjà utilisée" in r.json()["detail"]
    r = requests.post(f"{API}/admin/products", headers=h, json={"name": "x", "category_slug": "sport", "slug": P + "avail", "status": "available"})
    assert r.status_code == 400 and "incomplet" in r.json()["detail"]
    r = requests.post(f"{API}/admin/products", headers=h, json={"name": "x", "category_slug": "sport", "slug": P + "soon", "status": "coming_soon"})
    assert r.status_code == 200 and r.json()["lookup_key"] == "test_refs_soon" and r.json()["currency"] == "eur"


def test_update_rules(h):
    url = f"{API}/admin/products/{P}soon"
    assert requests.put(url, headers=h, json={"short_description": "brouillon"}).status_code == 200
    assert requests.put(url, headers=h, json={"lookup_key": "autre"}).status_code == 400
    assert requests.put(url, headers=h, json={"lookup_key": None, "currency": None}).status_code == 200
    p = mdb.products.find_one({"slug": P + "soon"})
    assert p["lookup_key"] == "test_refs_soon" and p["currency"] == "eur"
    r = requests.put(url, headers=h, json={"status": "available"})
    assert r.status_code == 400 and "fichier" in r.json()["detail"].lower()
    assert mdb.products.find_one({"slug": P + "soon"})["status"] == "coming_soon"
    mdb.products.insert_one({"slug": P + "nokey", "name": "y", "status": "coming_soon"})
    assert requests.put(f"{API}/admin/products/{P}nokey", headers=h, json={"lookup_key": "budget_mensuel"}).status_code == 409


def test_duplicate_blocks_checkout_and_health(h):
    assert checkout("budget_mensuel").status_code == 200
    mdb.products.insert_one({"slug": P + "clash", "name": "z", "lookup_key": "budget_mensuel", "price": 1.0, "currency": "eur", **FILE})
    try:
        r = checkout("budget_mensuel")
        assert r.status_code == 409 and "double" in r.json()["detail"]
        health = {x["slug"]: x for x in requests.get(f"{API}/admin/products/health", headers=h).json()}
        assert "duplicate" in [i["code"] for i in health["budget-mensuel"]["issues"]]
    finally:
        mdb.products.delete_one({"slug": P + "clash"})
    assert checkout("budget_mensuel").status_code == 200


def test_suivi_sportif_checkout_499():
    r = checkout("suivi_sportif")
    assert r.status_code == 200 and r.json()["checkout_url"].startswith("https://checkout.stripe.com/")
    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
    assert stripe.api_key.startswith("sk_test")
    s = stripe.checkout.Session.retrieve(r.json()["session_id"])
    assert s.amount_total == 499 and s.currency == "eur"


def test_coming_soon_and_waiver_still_blocked():
    assert checkout("car_cost").status_code == 409
    r = requests.post(f"{API}/payments/checkout", json={"lookup_key": "suivi_sportif", "origin_url": "x"})
    assert r.status_code == 400


def test_health_and_sync(h):
    r = requests.get(f"{API}/admin/products/health", headers=h)
    assert r.status_code == 200
    health = {x["slug"]: x for x in r.json()}
    assert health["suivi-sportif"]["ready"] and health["budget-mensuel"]["ready"]
    assert {"price", "file"} <= {i["code"] for i in health["car-cost"]["issues"]}
    assert requests.post(f"{API}/admin/products/car-cost/stripe-sync", headers=h).status_code == 400
    assert requests.get(f"{API}/admin/products/health").status_code == 401
