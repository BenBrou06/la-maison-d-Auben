# Renouvellement des liens de téléchargement (Preview, commandes synthétiques). Lancer avec `-n 0`.
import asyncio
import os
import re
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import requests
import stripe
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
import download_renewal as dr  # noqa: E402

BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PFX = "test-renew-"


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    e = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    p = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    return {"Authorization": "Bearer " + requests.post(f"{API}/admin/login", json={"email": e, "password": p}).json()["access_token"]}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    ids = [o["id"] for o in mdb.orders.find({"id": {"$regex": "^" + PFX}}, {"id": 1})]
    mdb.orders.delete_many({"id": {"$in": ids}})
    mdb.download_renewals.delete_many({"order_id": {"$in": ids}})
    mdb.products.delete_many({"slug": PFX + "sans-fichier"})


def order(slug="budget-mensuel", sid=None, expired=True, status="paid", token=True, email=None, count=0):
    oid = PFX + uuid.uuid4().hex[:10]
    doc = {"id": oid, "session_id": sid or f"cs_test_{PFX.replace('-', '')}{uuid.uuid4().hex}", "product_slug": slug,
           "product_name": "Budget mensuel", "amount": 7.99, "currency": "eur", "status": status,
           "customer_email": email or f"{oid}@example.com", "download_count": count, "download_limit": 25,
           "download_expires_at": (datetime.now(timezone.utc) + timedelta(days=-3 if expired else 10)).isoformat(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    if token:
        doc["download_token"] = "old-" + uuid.uuid4().hex
    mdb.orders.insert_one(dict(doc))
    return doc


def renew(h, oid, **body):
    return requests.post(f"{API}/admin/orders/{oid}/renew-download", headers=h, json=body)


EXC = {"exception_confirmation": "RENOUVELER", "exception_reason": "Paiement vu dans Stripe (test automatisé)"}


# ---------- vérification Stripe (lecture seule, simulée) ----------
def fake_session(paid=True, refunded=False, partial=False, disputed=False, pi=True):
    charge = SimpleNamespace(refunded=refunded, amount_refunded=100 if (refunded or partial) else 0, disputed=disputed)
    return SimpleNamespace(payment_status="paid" if paid else "unpaid",
                           payment_intent=SimpleNamespace(latest_charge=charge) if pi else None)


@pytest.mark.parametrize("kw,expected", [
    ({}, "ok"), ({"pi": False}, "ok"), ({"paid": False}, "refused"), ({"refunded": True}, "refused"),
    ({"partial": True}, "refused"), ({"disputed": True}, "refused")])
def test_verify_payment_outcomes(monkeypatch, kw, expected):
    monkeypatch.setattr(stripe.checkout.Session, "retrieve", lambda *a, **k: fake_session(**kw))
    assert expected in dr.verify_payment({"session_id": "cs_test_x"})


def test_verify_payment_unverifiable(monkeypatch):
    def boom(*a, **k):
        raise stripe.error.InvalidRequestError("No such checkout.session", "id")
    monkeypatch.setattr(stripe.checkout.Session, "retrieve", boom)
    assert "unverifiable" in dr.verify_payment({"session_id": "cs_test_x"})
    assert "unverifiable" in dr.verify_payment({"session_id": ""})


def test_states_and_blockers():
    p = {"download_storage_path": "x"}
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert dr.download_state({"download_token": "t", "download_expires_at": future}, p) == "valid"
    assert dr.download_state({"download_token": "t", "download_expires_at": past}, p) == "expired"
    assert dr.download_state({"download_token": "t", "download_expires_at": future, "download_count": 25}, p) == "exhausted"
    assert dr.download_state({"download_expires_at": future}, p) == "invalid"
    assert dr.download_state({"download_token": "t", "download_expires_at": future}, {}) == "file_missing"
    assert dr.renew_blocker({"status": "pending", "session_id": "cs_test_a"})
    assert "réelle" in dr.renew_blocker({"status": "paid", "session_id": "cs_live_a"})  # Preview = environnement TEST
    assert dr.renew_blocker({"status": "paid", "session_id": "cs_test_a"}) is None


# ---------- API ----------
def test_requires_admin():
    o = order()
    assert renew({}, o["id"]).status_code in (401, 403)
    assert requests.post(f"{API}/admin/orders/{o['id']}/send-download-link").status_code in (401, 403)


def test_unverifiable_needs_exception_then_renews_and_old_token_dies(h):
    o = order(count=25)
    assert requests.get(f"{API}/download-info/{o['download_token']}").json()["expired"] is True
    r = renew(h, o["id"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "needs_exception"
    assert renew(h, o["id"], exception_confirmation="renouveler", exception_reason="motif assez long").status_code == 409
    assert renew(h, o["id"], exception_confirmation="RENOUVELER", exception_reason="court").status_code == 409
    r = renew(h, o["id"], **EXC)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["download_state"] == "valid" and d["download_count"] == 0 and d["download_limit"] == 25
    assert d["download_token"] != o["download_token"] and len(d["download_token"]) >= 40
    assert d["download_url"] == f"{dr.PUBLIC_BASE_URL}/telechargement/{d['download_token']}"
    exp = datetime.fromisoformat(d["download_expires_at"]) - datetime.now(timezone.utc)
    assert timedelta(days=29, hours=23) < exp <= timedelta(days=30)
    assert d["download_renewal_count"] == 1 and d["renewal_method"] == "exception"
    assert requests.get(f"{API}/download/{o['download_token']}").status_code == 404
    f = requests.get(f"{API}/download/{d['download_token']}")
    assert f.status_code == 200 and len(f.content) > 1000
    db_o = mdb.orders.find_one({"id": o["id"]})
    assert db_o["download_count"] == 1 and db_o["status"] == "paid" and db_o["amount"] == 7.99
    assert db_o["session_id"] == o["session_id"] and db_o["download_renewals"][0]["reason"] == EXC["exception_reason"]
    logs = list(mdb.download_renewals.find({"order_id": o["id"]}, {"_id": 0}))
    assert any(x["result"] == "renewed" for x in logs) and not any("old-" in str(x) or d["download_token"] in str(x) for x in logs)
    assert mdb.orders.count_documents({"session_id": o["session_id"]}) == 1


def test_missing_token_order_can_be_renewed(h):
    o = order(token=False, expired=False)
    assert renew(h, o["id"], **EXC).status_code == 200


def test_blocked_cases(h):
    assert renew(h, order(status="pending")["id"], **EXC).status_code == 403
    assert renew(h, order(sid="cs_live_" + uuid.uuid4().hex)["id"], **EXC).status_code == 403
    mdb.products.insert_one({"slug": PFX + "sans-fichier", "name": "Sans fichier", "status": "available"})
    r = renew(h, order(slug=PFX + "sans-fichier")["id"], **EXC)
    assert r.status_code == 409 and "fichier" in r.json()["detail"]
    assert renew(h, "inconnue").status_code == 404


def test_concurrent_renewals_single_winner(h):
    o = order()
    with ThreadPoolExecutor(6) as ex:
        codes = list(ex.map(lambda _: renew(h, o["id"], **EXC).status_code, range(6)))
    assert codes.count(200) == 1 and all(c in (200, 409) for c in codes)
    doc = mdb.orders.find_one({"id": o["id"]})
    assert doc["download_renewal_count"] == 1 and len(doc["download_renewals"]) == 1


def test_send_link_success_failure_and_retry(h):
    o = order()
    url = f"{API}/admin/orders/{o['id']}/send-download-link"
    assert requests.post(url, headers=h).status_code == 409  # lien expiré : renouveler d'abord
    tok = renew(h, o["id"], **EXC).json()["download_token"]
    r = requests.post(url, headers=h)
    assert r.status_code == 200 and r.json()["simulated"] is True
    assert mdb.orders.find_one({"id": o["id"]})["link_email_status"] == "sent"
    bad = order(email=f"client{SIMFAIL}@example.com")
    renew(h, bad["id"], **EXC)
    burl = f"{API}/admin/orders/{bad['id']}/send-download-link"
    assert requests.post(burl, headers=h).status_code == 424
    doc = mdb.orders.find_one({"id": bad["id"]})
    assert doc["link_email_status"] == "failed" and doc["download_token"] and dr.download_state(doc, {"download_storage_path": "x"}) == "valid"
    assert requests.post(burl, headers=h).status_code == 424  # nouvel essai possible
    assert mdb.orders.find_one({"id": o["id"]})["download_token"] == tok


SIMFAIL = dr.SIM_FAIL.strip("@")


def test_admin_orders_list_fields(h):
    o = order()
    row = next(x for x in requests.get(f"{API}/admin/orders", headers=h).json() if x["id"] == o["id"])
    assert row["download_state"] == "expired" and row["payment_mode"] == "test" and row["renew_blocker"] is None
    assert "download_storage_path" not in row
