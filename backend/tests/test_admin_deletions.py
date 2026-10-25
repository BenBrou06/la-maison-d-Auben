# Tests ciblés : consentement, retrait/restauration, suppressions définitives, garde-fous commandes, nettoyage.
# Données fictives uniquement (préfixe fictif-del-), supprimées en fin de module. Lancer avec `-n 0`.
import os
import re
import subprocess
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
P = "fictif-del-"
DOM = "@exemple-fictif.fr"


def _cleanup():
    mdb.newsletter.delete_many({"email": {"$regex": "^" + P}})
    mdb.contact_messages.delete_many({"id": {"$regex": "^" + P}})
    mdb.orders.delete_many({"id": {"$regex": "^" + P}})
    mdb.payment_transactions.delete_many({"session_id": {"$regex": "fictifdel"}})


@pytest.fixture(scope="module", autouse=True)
def data():
    _cleanup()
    yield
    _cleanup()


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    e = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    p = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    tok = requests.post(f"{API}/admin/login", json={"email": e, "password": p}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def _sub(email):
    return requests.post(f"{API}/newsletter", json={"email": email, "consent": True})


def _doc(email):
    return mdb.newsletter.find_one({"email": email})


class TestConsent:
    def test_incomplete_proof_is_regularised(self):
        email = f"{P}legacy{DOM}"
        mdb.newsletter.insert_one({"id": P + "legacy", "email": email, "consent": True, "confirmed": False,
                                   "created_at": "2026-01-01T00:00:00+00:00"})
        r = _sub(email)
        assert r.status_code == 200 and r.json()["status"] == "ok"
        d = _doc(email)
        assert d["consent_at"] and d["consent_text_version"] and d["consent_text"] and d["unsubscribe_token"]
        assert d["status"] == "subscribed" and d["id"] == P + "legacy"

    def test_valid_proof_is_kept(self):
        email = f"{P}valid{DOM}"
        assert _sub(email).json()["status"] == "ok"
        before = _doc(email)
        r = _sub(email)
        assert r.json()["status"] == "already"
        after = _doc(email)
        assert after["consent_at"] == before["consent_at"] and after["unsubscribe_token"] == before["unsubscribe_token"]

    def test_unsubscribe_then_resubscribe(self):
        email = f"{P}unsub{DOM}"
        _sub(email)
        tok = _doc(email)["unsubscribe_token"]
        assert requests.post(f"{API}/newsletter/unsubscribe", json={"token": tok}).status_code == 200
        assert _doc(email)["status"] == "unsubscribed"
        assert _sub(email).json()["status"] == "ok"
        assert _doc(email)["status"] == "subscribed"


class TestSubscriberAdmin:
    def test_remove_then_restore_keeps_proof(self, h):
        email = f"{P}restore{DOM}"
        _sub(email)
        d = _doc(email)
        assert requests.delete(f"{API}/admin/newsletter/{d['id']}", headers=h).status_code == 200
        assert _doc(email)["removed"] is True
        assert requests.post(f"{API}/admin/newsletter/{d['id']}/restore", headers=h).status_code == 200
        after = _doc(email)
        assert after["removed"] is False and after["consent_at"] == d["consent_at"]
        listed = {s["id"]: s for s in requests.get(f"{API}/admin/newsletter", headers=h).json()}
        assert listed[d["id"]]["eligible"] is True

    def test_purge_requires_word_then_allows_new_signup(self, h):
        email = f"{P}purge{DOM}"
        _sub(email)
        sid = _doc(email)["id"]
        assert requests.post(f"{API}/admin/newsletter/{sid}/delete-permanently", headers=h, json={"confirmation": "oui"}).status_code == 400
        assert _doc(email) is not None
        assert requests.post(f"{API}/admin/newsletter/{sid}/delete-permanently", headers=h, json={"confirmation": "SUPPRIMER"}).status_code == 200
        assert _doc(email) is None
        assert _sub(email).json()["status"] == "ok"
        assert mdb.newsletter.count_documents({"email": email}) == 1

    def test_requires_admin(self):
        assert requests.post(f"{API}/admin/newsletter/x/restore").status_code == 401
        assert requests.post(f"{API}/admin/newsletter/x/delete-permanently", json={"confirmation": "SUPPRIMER"}).status_code == 401


class TestMessages:
    def test_delete_single_message(self, h):
        for k in ("m1", "m2"):
            mdb.contact_messages.insert_one({"id": P + k, "name": "Fictif", "email": f"{P}{k}{DOM}", "message": "x",
                                             "created_at": "2026-01-01T00:00:00+00:00"})
        assert requests.post(f"{API}/admin/messages/{P}m1/delete-permanently", headers=h, json={"confirmation": "non"}).status_code == 400
        assert requests.post(f"{API}/admin/messages/{P}m1/delete-permanently", headers=h, json={"confirmation": "SUPPRIMER"}).status_code == 200
        assert mdb.contact_messages.find_one({"id": P + "m1"}) is None
        assert mdb.contact_messages.find_one({"id": P + "m2"}) is not None
        assert requests.post(f"{API}/admin/messages/{P}m1/delete-permanently", headers=h, json={"confirmation": "SUPPRIMER"}).status_code == 404
        assert requests.post(f"{API}/admin/messages/{P}m2/delete-permanently", json={"confirmation": "SUPPRIMER"}).status_code == 401


def _order(key, session_id, tx_sessions=(), livemode=None):
    o = {"id": P + key, "session_id": session_id, "customer_email": f"{P}{key}{DOM}", "amount": 6.99,
         "currency": "eur", "product_name": "Fictif", "status": "paid", "created_at": "2026-01-01T00:00:00+00:00"}
    if livemode is not None:
        o["livemode"] = livemode
    mdb.orders.insert_one(o)
    for s in tx_sessions:
        mdb.payment_transactions.insert_one({"session_id": s, "payment_status": "paid", "amount": 6.99})


class TestOrders:
    def _del(self, h, key, word="SUPPRIMER"):
        return requests.post(f"{API}/admin/orders/{P}{key}/delete-permanently", headers=h, json={"confirmation": word})

    def test_live_order_refused_even_confirmed(self, h):
        sid = "cs_live_fictifdelLIVE1"
        _order("live", sid, [sid])
        r = self._del(h, "live")
        assert r.status_code == 403 and "LIVE" in r.json()["detail"]
        assert mdb.orders.find_one({"id": P + "live"}) and mdb.payment_transactions.find_one({"session_id": sid})

    def test_ambiguous_orders_refused(self, h):
        _order("nosession", "")
        _order("weird", "pi_fictifdelWEIRD")
        _order("notx", "cs_test_fictifdelNOTX")
        _order("livemode", "cs_test_fictifdelLM", ["cs_test_fictifdelLM"], livemode=True)
        for k in ("nosession", "weird", "notx", "livemode"):
            assert self._del(h, k).status_code == 403, k
            assert mdb.orders.find_one({"id": P + k}), k
        listed = {o["id"]: o for o in requests.get(f"{API}/admin/orders", headers=h).json()}
        assert all(listed[P + k]["deletable"] is False and listed[P + k]["deletion_blockers"] for k in ("live", "nosession", "weird", "notx", "livemode"))

    def test_test_order_deleted_with_its_tx_only(self, h):
        sid = "cs_test_fictifdelOK1"
        _order("ok", sid, [sid])
        mdb.payment_transactions.insert_one({"session_id": "cs_live_fictifdelOTHER", "payment_status": "paid"})
        assert self._del(h, "ok", "supprimer").status_code == 400
        listed = {o["id"]: o for o in requests.get(f"{API}/admin/orders", headers=h).json()}
        assert listed[P + "ok"]["deletable"] is True
        r = self._del(h, "ok")
        assert r.status_code == 200 and r.json()["deleted_transactions"] == 1
        assert mdb.orders.find_one({"id": P + "ok"}) is None
        assert mdb.payment_transactions.find_one({"session_id": sid}) is None
        assert mdb.payment_transactions.find_one({"session_id": "cs_live_fictifdelOTHER"})
        assert mdb.payment_transactions.find_one({"session_id": "cs_live_fictifdelLIVE1"})

    def test_requires_admin(self):
        assert requests.post(f"{API}/admin/orders/x/delete-permanently", json={"confirmation": "SUPPRIMER"}).status_code == 401


class TestCleanupSimulation:
    def _counts(self):
        return tuple(mdb[c].count_documents({}) for c in ("newsletter", "contact_messages", "orders", "payment_transactions"))

    def test_simulation_changes_nothing_and_apply_needs_fingerprint(self):
        mdb.newsletter.insert_one({"id": P + "sim", "email": f"{P}sim-TEST{DOM}"})
        before = self._counts()
        out = subprocess.run(["python3", "cleanup_test_data.py"], cwd="/app/backend", capture_output=True, text=True).stdout
        assert f"{P}sim-TEST{DOM}" in out and "aucune donnée modifiée" in out and "Empreinte" in out
        assert self._counts() == before
        bad = subprocess.run(["python3", "cleanup_test_data.py", "--apply", "--fingerprint=" + uuid.uuid4().hex[:12]],
                             cwd="/app/backend", capture_output=True, text=True)
        assert bad.returncode == 1 and "REFUS" in bad.stdout
        assert self._counts() == before
