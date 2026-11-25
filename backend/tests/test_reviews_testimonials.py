# Testimonials / reviews system (public form, invitation after purchase, admin moderation, retention, email block)
import os
import sys
import time
import uuid
import asyncio
import subprocess
from datetime import datetime, timezone, timedelta

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
CREATED_EMAILS = set()
CREATED_IDS = set()
ORDER_IDS = set()
_posts = {"n": 0}


def wait_backend():
    for _ in range(40):
        try:
            if requests.get(f"{API}/products", timeout=5).status_code == 200:
                return
        except Exception:
            pass
        time.sleep(1)


def reset_rl():
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], capture_output=True)
    time.sleep(4)
    wait_backend()
    _posts["n"] = 0


def post_review(payload, reset_if_needed=True):
    if reset_if_needed and _posts["n"] >= 3:
        reset_rl()
    _posts["n"] += 1
    if payload.get("email"):
        CREATED_EMAILS.add(str(payload["email"]).lower())
    return requests.post(f"{API}/reviews", json=payload, timeout=20)


def email(tag):
    return f"test_{tag}_{RUN}@example.com"


def base(**kw):
    p = {"kind": "brand", "product_slug": "", "name": "TEST_Reviewer", "email": email("x"), "rating": None,
         "text": f"TEST_ avis sincère {uuid.uuid4().hex}", "consent": True, "invitation": "", "website": "", "elapsed_ms": 5000}
    p.update(kw)
    return p


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/admin/login", json={"email": "admin@lamaisondauben.fr", "password": "Auben2026!"}, timeout=20)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    settings = mdb.site_config.find_one({"id": "testimonials"}, {"_id": 0})
    reset_rl()
    yield
    if CREATED_EMAILS:
        mdb.testimonials.delete_many({"email": {"$in": list(CREATED_EMAILS)}})
    if CREATED_IDS:
        mdb.testimonials.delete_many({"id": {"$in": list(CREATED_IDS)}})
    if ORDER_IDS:
        mdb.testimonials.delete_many({"order_id": {"$in": list(ORDER_IDS)}})
        mdb.review_invites.delete_many({"order_id": {"$in": list(ORDER_IDS)}})
        mdb.orders.delete_many({"id": {"$in": list(ORDER_IDS)}, "test_fixture": True})
    if settings:
        mdb.site_config.update_one({"id": "testimonials"}, {"$set": settings})


def stored(em):
    return list(mdb.testimonials.find({"email": em}, {"_id": 0}))


# ---------------- Public form ----------------
class TestPublicSubmit:
    def test_product_review_with_rating(self):
        em = email("prod")
        r = post_review(base(kind="product", product_slug="budget-mensuel", email=em, rating=4))
        assert r.status_code == 200 and r.json() == {"status": "ok"}
        docs = stored(em)
        assert len(docs) == 1
        d = docs[0]
        assert d["status"] == "pending" and d["source"] == "form" and d["verified_purchase"] is False
        assert d["authentic"] is False and d["kind"] == "product" and d["product_slug"] == "budget-mensuel" and d["rating"] == 4
        pub = requests.get(f"{API}/testimonials", params={"place": "product", "product": "budget-mensuel"}).json()
        assert d["id"] not in [t["id"] for t in pub]

    def test_brand_review_without_rating(self):
        em = email("brand")
        r = post_review(base(kind="brand", product_slug="budget-mensuel", email=em))
        assert r.status_code == 200
        d = stored(em)[0]
        assert d["kind"] == "brand" and d["product_slug"] == "" and d["rating"] is None and d["status"] == "pending"
        pub = requests.get(f"{API}/testimonials", params={"place": "home"}).json()
        assert d["id"] not in [t["id"] for t in pub]

    def test_honeypot(self):
        em = email("hp")
        r = post_review(base(email=em, website="http://spam"))
        assert r.status_code == 200 and r.json() == {"status": "ok"}
        assert stored(em) == []

    @pytest.mark.parametrize("over,code", [
        ({"email": "not-an-email"}, 422),
        ({"email": None}, 400),
        ({"consent": False}, 400),
        ({"text": "court"}, 400),
        ({"elapsed_ms": 1000}, 400),
        ({"kind": "product", "product_slug": "does-not-exist"}, 400),
    ])
    def test_validation(self, over, code):
        em = email("val" + uuid.uuid4().hex[:4])
        p = base(email=em)
        p.update(over)
        r = post_review(p)
        assert r.status_code == code, r.text
        assert mdb.testimonials.count_documents({"email": em}) == 0


class TestDuplicates:
    def test_same_email_same_product_409(self):
        em = email("dup")
        assert post_review(base(kind="product", product_slug="budget-mensuel", email=em)).status_code == 200
        r = post_review(base(kind="product", product_slug="budget-mensuel", email=em))
        assert r.status_code == 409
        assert post_review(base(kind="brand", email=em)).status_code == 200
        assert post_review(base(kind="brand", email=em)).status_code == 409

    def test_same_text_409(self):
        txt = f"TEST_ Texte identique pour doublon {RUN}"
        assert post_review(base(email=email("t1"), text=txt)).status_code == 200
        r = post_review(base(email=email("t2"), text="  " + txt.upper() + " !! "))
        assert r.status_code == 409

    def test_email_daily_limit_429(self):
        em = email("day")
        for slug in ("budget-mensuel", "travel-manager"):
            assert post_review(base(kind="product", product_slug=slug, email=em)).status_code == 200
        assert post_review(base(kind="brand", email=em)).status_code == 200
        r = post_review(base(kind="product", product_slug="car-cost", email=em))
        assert r.status_code == 429


class TestRateLimit:
    def test_ip_rate_limit(self):
        reset_rl()
        codes = [post_review(base(email=email("rl" + str(i)), elapsed_ms=100), reset_if_needed=False).status_code for i in range(4)]
        assert codes[:3] == [400, 400, 400] and codes[3] == 429, codes
        reset_rl()


# ---------------- Invitation after purchase ----------------
def make_invite(oid, slug="budget-mensuel", mail="Buyer_" + RUN + "@Example.com"):
    from reviews import create_invite
    ORDER_IDS.add(oid)
    mdb.orders.insert_one({"id": oid, "product_slug": slug, "customer_email": mail, "session_id": f"cs_test_fake_{oid}", "test_fixture": True})
    res = LOOP.run_until_complete(create_invite({"id": oid, "product_slug": slug}, BASE_URL))
    assert "invitation=" in res["url"]
    return res["url"].split("invitation=")[1], mail


class TestInvitation:
    def test_invitation_flow(self):
        oid = f"TEST-REVIEW-ORDER-{RUN}"
        token, mail = make_invite(oid)
        r = requests.get(f"{API}/reviews/invitation", params={"token": token})
        assert r.status_code == 200
        d = r.json()
        assert set(d) == {"product_slug", "product_name", "email_hint"}
        assert d["product_slug"] == "budget-mensuel" and "•••" in d["email_hint"] and mail.lower() not in d["email_hint"].lower()
        assert oid not in str(d)
        r = post_review(base(kind="brand", product_slug="travel-manager", email=email("ignored"), invitation=token))
        assert r.status_code == 200, r.text
        docs = list(mdb.testimonials.find({"order_id": oid}, {"_id": 0}))
        assert len(docs) == 1
        t = docs[0]
        assert t["email"] == mail.lower() and t["product_slug"] == "budget-mensuel" and t["kind"] == "product"
        assert t["source"] == "order" and t["verified_purchase"] is True and t["status"] == "pending"
        r2 = post_review(base(email=None, invitation=token))
        assert r2.status_code == 409
        assert requests.get(f"{API}/reviews/invitation", params={"token": token}).status_code == 409
        # after use, a new create_invite for same order+product returns non-token link
        from reviews import create_invite
        res = LOOP.run_until_complete(create_invite({"id": oid, "product_slug": "budget-mensuel"}, BASE_URL))
        assert "invitation=" not in res["url"] and "produit=budget-mensuel" in res["url"]

    def test_invalid_token(self):
        assert requests.get(f"{API}/reviews/invitation", params={"token": "bogus"}).status_code == 404
        assert post_review(base(email=None, invitation="bogus-token")).status_code == 404

    def test_expired_token(self):
        oid = f"TEST-REVIEW-ORDER-EXP-{RUN}"
        token, _ = make_invite(oid)
        mdb.review_invites.update_one({"order_id": oid}, {"$set": {"expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}})
        assert requests.get(f"{API}/reviews/invitation", params={"token": token}).status_code == 404
        assert post_review(base(email=None, invitation=token)).status_code == 404


# ---------------- Delivery email ----------------
class TestEmail:
    def test_review_block(self):
        import emailer
        from reviews import EMAIL_DEFAULTS
        rv = {**EMAIL_DEFAULTS, "url": f"{BASE_URL}/donner-mon-avis?invitation=abc"}
        html = emailer.order_confirmation_html(product_name="Budget mensuel", amount=7.99, currency="eur",
                                               download_url=f"{BASE_URL}/telechargement/x", order_id="ORD-1", review=rv)
        assert "Votre avis compte pour nous" in html and "Partager mon avis" in html
        assert html.index("Partager mon avis") > html.index("Télécharger mon produit")
        emailer._assert_safe_email("Votre commande Budget mensuel est confirmée", html)
        assert "Partager" not in emailer.order_confirmation_html(product_name="B", amount=1, currency="eur",
                                                                 download_url=f"{BASE_URL}/t/x", order_id="O")

    def test_email_texts_defaults(self):
        from reviews import email_texts, EMAIL_DEFAULTS
        doc = mdb.site_content.find_one({"key": "avis"})
        if not doc:
            assert LOOP.run_until_complete(email_texts()) == EMAIL_DEFAULTS


# ---------------- Admin moderation ----------------
def admin_create(admin, **kw):
    p = {"name": "TEST_Admin", "text": f"TEST_ avis admin {uuid.uuid4().hex}", "kind": "brand", "product_slug": "",
         "email": email("adm" + uuid.uuid4().hex[:4]), "authentic": False, "source_note": "note interne", "rating": 5}
    p.update(kw)
    r = admin.post(f"{API}/admin/testimonials", json=p)
    assert r.status_code == 200, r.text
    CREATED_IDS.add(r.json()["id"])
    return r.json()


def item(admin, tid):
    return next(t for t in admin.get(f"{API}/admin/testimonials").json()["items"] if t["id"] == tid)


class TestAdmin:
    def test_list_shape(self, admin):
        d = admin.get(f"{API}/admin/testimonials").json()
        assert "reasons" in d and "other" in d["reasons"] and d["retention_days"] == 90
        ben = [t for t in d["items"] if t["name"] == "Ben"]
        assert ben and ben[0]["status"] == "published" and "purge_at" not in ben[0]

    def test_create_and_transitions(self, admin):
        t = admin_create(admin)
        assert t["status"] == "pending" and t["source"] == "admin" and "purge_at" in t
        st = lambda s, **kw: admin.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": s, **kw})
        assert st("published").status_code == 400
        r = st("approved")
        assert r.status_code == 200 and r.json()["item"]["authentic"] is True
        assert st("published").status_code == 200
        pub = requests.get(f"{API}/testimonials", params={"place": "home"}).json()
        p = next(x for x in pub if x["id"] == t["id"])
        assert set(p) <= {"id", "name", "text", "product_slug", "verified_purchase", "rating"}
        assert st("approved").status_code == 200  # unpublish
        assert t["id"] not in [x["id"] for x in requests.get(f"{API}/testimonials", params={"place": "home"}).json()]
        assert st("rejected").status_code == 400
        assert st("rejected", reason="bogus").status_code == 400
        assert st("rejected", reason="other").status_code == 400
        r = st("rejected", reason="other", detail="TEST_ detail")
        assert r.status_code == 200 and r.json()["item"]["rejection_reason"] == "other"
        assert st("approved").status_code == 400
        assert st("pending").status_code == 200

    def test_reject_notify_once(self, admin):
        t = admin_create(admin)
        r = admin.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "rejected", "reason": "spam", "notify": True})
        assert r.status_code == 200, r.text
        print("notified:", r.json()["notified"])
        assert r.json()["notified"] is True
        first = r.json()["item"]["author_notified_at"]
        assert first
        admin.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "pending"})
        r2 = admin.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "rejected", "reason": "spam", "notify": True})
        assert r2.status_code == 200 and r2.json()["notified"] is None
        assert r2.json()["item"]["author_notified_at"] == first

    def test_edit_and_untick_authentic(self, admin):
        t = admin_create(admin)
        admin.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "approved"})
        admin.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "published"})
        body = {"name": "TEST_Edited", "text": "TEST_ texte modifié ici", "rating": 3, "kind": "product",
                "product_slug": "budget-mensuel", "email": t["email"], "authentic": True, "source_note": "n2"}
        r = admin.put(f"{API}/admin/testimonials/{t['id']}", json=body)
        assert r.status_code == 200 and r.json()["status"] == "published" and r.json()["name"] == "TEST_Edited"
        g = item(admin, t["id"])
        assert g["product_slug"] == "budget-mensuel" and g["rating"] == 3 and g["source_note"] == "n2"
        r = admin.put(f"{API}/admin/testimonials/{t['id']}", json={**body, "authentic": False})
        assert r.json()["status"] == "pending"

    def test_delete_permanently(self, admin):
        t = admin_create(admin)
        assert admin.post(f"{API}/admin/testimonials/{t['id']}/delete-permanently", json={"confirmation": "supprime"}).status_code == 400
        assert admin.delete(f"{API}/admin/testimonials/{t['id']}").status_code in (404, 405)
        assert admin.post(f"{API}/admin/testimonials/{t['id']}/delete-permanently", json={"confirmation": "SUPPRIMER"}).status_code == 200
        assert mdb.testimonials.count_documents({"id": t["id"]}) == 0

    def test_requires_auth(self):
        assert requests.get(f"{API}/admin/testimonials").status_code in (401, 403)

    def test_public_settings_and_no_private_fields(self, admin):
        t = admin_create(admin, kind="product", product_slug="budget-mensuel")
        admin.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "approved"})
        admin.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "published"})
        pub = requests.get(f"{API}/testimonials", params={"place": "product", "product": "budget-mensuel"}).json()
        for x in pub:
            assert not ({"email", "source_note", "order_id", "status"} & set(x))
        assert t["id"] in [x["id"] for x in pub]
        orig = mdb.site_config.find_one({"id": "testimonials"}, {"_id": 0})
        r = admin.put(f"{API}/admin/testimonials/settings", json={"enabled": False, "show_home": True, "show_products": True})
        assert r.status_code == 200
        assert requests.get(f"{API}/testimonials", params={"place": "home"}).json() == []
        admin.put(f"{API}/admin/testimonials/settings", json={k: orig[k] for k in ("enabled", "show_home", "show_products")})
        assert requests.get(f"{API}/testimonials", params={"place": "bad"}).status_code == 400

    def test_retention(self, admin):
        old = (datetime.now(timezone.utc) - timedelta(days=100)).isoformat()
        p = admin_create(admin)
        pub = admin_create(admin)
        admin.put(f"{API}/admin/testimonials/{pub['id']}/status", json={"status": "approved"})
        admin.put(f"{API}/admin/testimonials/{pub['id']}/status", json={"status": "published"})
        mdb.testimonials.update_many({"id": {"$in": [p["id"], pub["id"]]}}, {"$set": {"status_changed_at": old}})
        a = item(admin, p["id"])
        assert a["name"] == "Anonyme" and a["email"] == "" and a["text"] == "" and a["status"] == "rejected" and a["anonymized_at"]
        b = item(admin, pub["id"])
        assert b["status"] == "published" and b["name"] == "TEST_Admin" and not b.get("anonymized_at")
        assert admin.put(f"{API}/admin/testimonials/{p['id']}/status", json={"status": "pending"}).status_code == 400
