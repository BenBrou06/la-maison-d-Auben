# Extra edge cases for testimonials v2: reports, verified-purchase lock, text_hash on edit, stable invite token, validation
import os
import sys
import uuid
import asyncio

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402
load_dotenv("/app/backend/.env")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
LOOP = asyncio.new_event_loop()
RUN = uuid.uuid4().hex[:8]
IDS, EMAILS, ORDERS = set(), set(), set()


def reset_rl():
    mdb.rate_hits.delete_many({"bucket": {"$in": ["review", "review-day", "review-report", "review-invite"]}})


def em(tag):
    e = f"test_x{tag}_{RUN}@example.com"
    EMAILS.add(e)
    return e


def payload(**kw):
    p = {"kind": "brand", "product_slug": "", "name": "TEST_X", "email": em(uuid.uuid4().hex[:4]), "rating": None,
         "text": f"TEST_ extra {uuid.uuid4().hex}", "consent": True, "invitation": "", "website": "", "elapsed_ms": 5000,
         "experience_month": "2026-10"}
    p.update(kw)
    return p


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/admin/login", json={"email": "admin@lamaisondauben.fr", "password": "Auben2026!"}, timeout=20)
    if r.status_code != 200:
        pytest.skip("login failed")
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    settings = mdb.site_config.find_one({"id": "testimonials"}, {"_id": 0})
    reset_rl()
    yield
    mdb.testimonials.delete_many({"id": {"$in": list(IDS)}})
    mdb.testimonials.delete_many({"email": {"$in": list(EMAILS)}})
    mdb.testimonials.delete_many({"order_id": {"$in": list(ORDERS)}})
    mdb.review_invites.delete_many({"order_id": {"$in": list(ORDERS)}})
    mdb.orders.delete_many({"id": {"$in": list(ORDERS)}, "test_fixture": True})
    if settings:
        mdb.site_config.update_one({"id": "testimonials"}, {"$set": settings})
    reset_rl()


def create(admin, **kw):
    p = {"name": "TEST_X", "text": f"TEST_ extra admin {uuid.uuid4().hex}", "kind": "brand", "product_slug": "",
         "email": em(uuid.uuid4().hex[:4]), "authentic": False, "source_note": "", "rating": 5}
    p.update(kw)
    r = admin.post(f"{API}/admin/testimonials", json=p)
    assert r.status_code == 200, r.text
    IDS.add(r.json()["id"])
    return r.json()


def publish(admin, tid):
    admin.put(f"{API}/admin/testimonials/{tid}/status", json={"status": "approved"})
    assert admin.put(f"{API}/admin/testimonials/{tid}/status", json={"status": "published"}).status_code == 200


def get_item(admin, tid):
    return next(t for t in admin.get(f"{API}/admin/testimonials").json()["items"] if t["id"] == tid)


class TestReports:
    def test_report_honeypot_pending_and_validation(self, admin):
        reset_rl()
        t = create(admin)
        # not published -> 404
        assert requests.post(f"{API}/testimonials/{t['id']}/report", json={"reason": "fake"}).status_code == 404
        publish(admin, t["id"])
        assert requests.post(f"{API}/testimonials/{t['id']}/report", json={"reason": "bogus"}).status_code == 422
        assert requests.post(f"{API}/testimonials/{t['id']}/report", json={"reason": "fake", "message": "x" * 501}).status_code == 422
        reset_rl()
        r = requests.post(f"{API}/testimonials/{t['id']}/report", json={"reason": "fake", "website": "http://bot"})
        assert r.status_code == 200
        assert get_item(admin, t["id"]).get("reports") == []
        reset_rl()

    def test_reports_count_new_after_seen(self, admin):
        reset_rl()
        t = create(admin)
        publish(admin, t["id"])
        assert requests.post(f"{API}/testimonials/{t['id']}/report", json={"reason": "abuse", "message": " a "}).status_code == 200
        v = admin.post(f"{API}/admin/testimonials/{t['id']}/reports-seen").json()
        assert v["new_reports"] == 0
        assert requests.post(f"{API}/testimonials/{t['id']}/report", json={"reason": "personal"}).status_code == 200
        v = get_item(admin, t["id"])
        assert v["new_reports"] == 1 and len(v["reports"]) == 2 and v["reports"][0]["message"] == "a"
        assert admin.post(f"{API}/admin/testimonials/nope/reports-seen").status_code == 404
        assert requests.post(f"{API}/admin/testimonials/{t['id']}/reports-seen").status_code in (401, 403)
        reset_rl()


class TestEditRules:
    def test_text_hash_recomputed_on_edit(self, admin):
        reset_rl()
        orig_text = f"TEST_ original texte {RUN}"
        e = em("hash")
        assert requests.post(f"{API}/reviews", json=payload(email=e, text=orig_text)).status_code == 200
        t = mdb.testimonials.find_one({"email": e}, {"_id": 0})
        new_text = f"TEST_ nouveau texte édité {RUN}"
        body = {"name": t["name"], "text": new_text, "rating": None, "kind": "brand", "product_slug": "", "email": e,
                "authentic": False, "source_note": ""}
        assert admin.put(f"{API}/admin/testimonials/{t['id']}", json=body).status_code == 200
        # the new text is now a duplicate, the original text is free again
        assert requests.post(f"{API}/reviews", json=payload(text=new_text.upper())).status_code == 409
        assert requests.post(f"{API}/reviews", json=payload(text=orig_text)).status_code == 200
        reset_rl()

    def test_admin_experience_month_validation(self, admin):
        r = admin.post(f"{API}/admin/testimonials", json={"name": "TEST_X", "text": "TEST_ abc def ghi", "kind": "brand",
                                                         "product_slug": "", "email": "", "authentic": False, "source_note": "",
                                                         "experience_month": "2026-13"})
        assert r.status_code == 422
        t = create(admin, experience_month="2025-03")
        assert t["experience_month"] == "2025-03"

    def test_verified_purchase_product_locked(self, admin):
        reset_rl()
        from reviews import create_invite
        oid = f"TEST-REVIEW-ORDER-X-{RUN}"
        ORDERS.add(oid)
        mail = f"buyer_x_{RUN}@example.com"
        mdb.orders.insert_one({"id": oid, "product_slug": "budget-mensuel", "customer_email": mail,
                               "session_id": f"cs_test_fakex_{oid}", "test_fixture": True})
        u1 = LOOP.run_until_complete(create_invite({"id": oid, "product_slug": "budget-mensuel"}, BASE_URL))["url"]
        u2 = LOOP.run_until_complete(create_invite({"id": oid, "product_slug": "budget-mensuel"}, BASE_URL))["url"]
        assert u1 == u2 and "invitation=" in u1  # stable token across resends
        token = u1.split("invitation=")[1]
        assert requests.post(f"{API}/reviews", json=payload(email=None, invitation=token)).status_code == 200
        t = mdb.testimonials.find_one({"order_id": oid}, {"_id": 0})
        assert t["verified_purchase"] is True
        body = {"name": t["name"], "text": t["text"], "rating": None, "kind": "product", "product_slug": "travel-manager",
                "email": t["email"], "authentic": True, "source_note": ""}
        assert admin.put(f"{API}/admin/testimonials/{t['id']}", json=body).status_code == 400
        assert admin.put(f"{API}/admin/testimonials/{t['id']}", json={**body, "kind": "brand", "product_slug": ""}).status_code == 400
        assert admin.put(f"{API}/admin/testimonials/{t['id']}", json={**body, "product_slug": "budget-mensuel"}).status_code == 200
        reset_rl()


class TestPublicOrder:
    def test_public_contains_dates_and_ben_untouched(self):
        pub = requests.get(f"{API}/testimonials", params={"place": "home"}).json()
        for x in pub:
            assert x["published_at"] and len(x["experience_month"]) == 7
        ben = mdb.testimonials.find_one({"name": "Ben"}, {"_id": 0})
        assert ben and ben["status"] == "published" and ben["text"] == "Test"
