# Compliance (RGPD / withdrawal waiver / newsletter consent / SEO files) regression tests
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
CANON = "https://la-maison-dauben.com"
WVER = "retractation-v1-2026-06"

mongo = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _creds():
    txt = open("/app/memory/test_credentials.md").read()
    import re
    email = re.search(r"Email: `([^`]+)`", txt).group(1)
    pwd = re.search(r"Password: `([^`]+)`", txt).group(1)
    return email, pwd


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


@pytest.fixture(scope="module")
def admin_headers(s):
    e, p = _creds()
    r = s.post(f"{API}/admin/login", json={"email": e, "password": p})
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def created_sessions():
    sids = []
    yield sids
    if sids:
        mongo.payment_transactions.delete_many({"session_id": {"$in": sids}})


@pytest.fixture(scope="module")
def qa_email():
    em = f"qa-{uuid.uuid4().hex[:8]}@example.com"
    yield em
    mongo.newsletter.delete_many({"email": em})


# ---------------- Checkout withdrawal waiver ----------------
class TestCheckoutWaiver:
    def test_missing_waiver_400(self, s):
        r = s.post(f"{API}/payments/checkout", json={"lookup_key": "budget_mensuel", "origin_url": "x"})
        assert r.status_code == 400, r.text

    def test_false_waiver_400(self, s):
        r = s.post(f"{API}/payments/checkout", json={"lookup_key": "budget_mensuel", "origin_url": "x",
                                                      "withdrawal_waiver": False, "withdrawal_consent_version": WVER})
        assert r.status_code == 400

    def test_wrong_version_400(self, s):
        r = s.post(f"{API}/payments/checkout", json={"lookup_key": "budget_mensuel", "origin_url": "x",
                                                      "withdrawal_waiver": True, "withdrawal_consent_version": "v0"})
        assert r.status_code == 400

    def test_string_waiver_422(self, s):
        r = s.post(f"{API}/payments/checkout", json={"lookup_key": "budget_mensuel", "origin_url": "x",
                                                      "withdrawal_waiver": "true", "withdrawal_consent_version": WVER})
        assert r.status_code == 422

    def test_missing_origin_422(self, s):
        r = s.post(f"{API}/payments/checkout", json={"lookup_key": "budget_mensuel",
                                                      "withdrawal_waiver": True, "withdrawal_consent_version": WVER})
        assert r.status_code == 422

    def test_coming_soon_409(self, s):
        p = mongo.products.find_one({"slug": "budget-couple"}, {"lookup_key": 1})
        r = s.post(f"{API}/payments/checkout", json={"lookup_key": (p or {}).get("lookup_key") or "budget_couple",
                                                      "origin_url": "x", "withdrawal_waiver": True,
                                                      "withdrawal_consent_version": WVER})
        assert r.status_code == 409

    def test_valid_checkout_stores_consent(self, s, created_sessions):
        import stripe
        stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
        r = s.post(f"{API}/payments/checkout", json={"lookup_key": "budget_mensuel", "origin_url": "https://evil.example.com",
                                                      "withdrawal_waiver": True, "withdrawal_consent_version": WVER},
                   headers={"User-Agent": "QA-Agent/1.0"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"].startswith("cs_test_")
        assert "checkout.stripe.com" in d["checkout_url"]
        created_sessions.append(d["session_id"])
        tx = mongo.payment_transactions.find_one({"session_id": d["session_id"]})
        wc = tx["withdrawal_consent"]
        assert wc["accepted"] is True and wc["text_version"] == WVER
        assert wc["accepted_at"] and wc["text"] and wc["ip"]
        assert wc["user_agent"] == "QA-Agent/1.0"
        assert tx["amount"] == s.get(f"{API}/products/budget-mensuel").json()["price"]
        sess = stripe.checkout.Session.retrieve(d["session_id"])
        assert sess.metadata["withdrawal_consent_version"] == WVER
        assert "evil.example.com" not in sess.success_url
        assert sess.success_url.startswith(os.environ["PUBLIC_BASE_URL"].rstrip("/"))


# ---------------- Newsletter consent / unsubscribe ----------------
class TestNewsletter:
    def test_missing_consent_422(self, s, qa_email):
        assert s.post(f"{API}/newsletter", json={"email": qa_email}).status_code == 422

    def test_string_consent_422(self, s, qa_email):
        assert s.post(f"{API}/newsletter", json={"email": qa_email, "consent": "true"}).status_code == 422

    def test_false_consent_400(self, s, qa_email):
        assert s.post(f"{API}/newsletter", json={"email": qa_email, "consent": False}).status_code == 400
        assert mongo.newsletter.find_one({"email": qa_email}) is None

    def test_subscribe_unsubscribe_resubscribe(self, s, qa_email, admin_headers):
        r = s.post(f"{API}/newsletter", json={"email": qa_email.upper(), "consent": True})
        assert r.status_code == 200 and r.json()["status"] == "ok"
        doc = mongo.newsletter.find_one({"email": qa_email})
        assert doc["status"] == "subscribed" and doc["consent_at"]
        assert doc["consent_text_version"] and doc["unsubscribe_token"]
        token = doc["unsubscribe_token"]
        r = s.post(f"{API}/newsletter", json={"email": qa_email, "consent": True})
        assert r.json()["status"] == "already"
        # admin listing
        assert s.get(f"{API}/admin/newsletter").status_code == 401
        lst = s.get(f"{API}/admin/newsletter", headers=admin_headers).json()
        me = [x for x in lst if x["email"] == qa_email][0]
        assert me["status"] == "subscribed"
        assert me["unsubscribe_url"].endswith(f"/newsletter/desinscription?token={token}")
        # unsubscribe
        assert s.post(f"{API}/newsletter/unsubscribe", json={"token": "bad-token"}).status_code == 404
        assert s.post(f"{API}/newsletter/unsubscribe", json={"token": ""}).status_code == 404
        r = s.post(f"{API}/newsletter/unsubscribe", json={"token": token})
        assert r.status_code == 200
        assert mongo.newsletter.find_one({"email": qa_email})["status"] == "unsubscribed"
        assert s.post(f"{API}/newsletter/unsubscribe", json={"token": token}).status_code == 200
        lst = s.get(f"{API}/admin/newsletter", headers=admin_headers).json()
        assert [x for x in lst if x["email"] == qa_email][0]["status"] == "unsubscribed"
        # resubscribe
        r = s.post(f"{API}/newsletter", json={"email": qa_email, "consent": True})
        assert r.json()["status"] == "ok"
        assert mongo.newsletter.find_one({"email": qa_email})["status"] == "subscribed"


# ---------------- SEO files ----------------
class TestSeoFiles:
    def test_robots(self, s):
        t = s.get(f"{BASE_URL}/robots.txt").text
        assert f"{CANON}/sitemap.xml" in t
        assert "emergentagent" not in t

    def test_sitemap(self, s):
        t = s.get(f"{BASE_URL}/sitemap.xml").text
        assert CANON in t and "emergentagent" not in t
        for bad in ["/admin", "/paiement", "/telechargement", "desinscription"]:
            assert bad not in t, bad

    def test_index_no_posthog(self, s):
        # Preview ingress injects its own overlay script; check the app's own source template.
        t = open("/app/frontend/public/index.html").read().lower()
        assert "posthog" not in t and "ap.emergent.sh" not in t
        assert "fonts.googleapis" not in t

    def test_product_price_unchanged(self, s):
        p = s.get(f"{API}/products/budget-mensuel").json()
        assert p["price"] == 6.99
