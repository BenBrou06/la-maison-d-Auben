# Merch features (promotions, Stripe checkout w/ promo, reassurance, testimonials, video upload) - API regression
# Run with: /etc/supervisor/emergent-env-exec pytest tests/test_merch_features.py -p no:xdist
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
    return url.rstrip("/")


BASE_URL = _base()
SLUG = "budget-mensuel"
ADMIN = {"email": "admin@lamaisondauben.fr", "password": "Auben2026!"}
CONSENT = "retractation-v1-2026-06"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def adm(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def mongo():
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    c = MongoClient(os.environ["MONGO_URL"])
    return c[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def stripe_mod():
    import stripe
    from stripe_keys import select_stripe_keys  # noqa
    keys = select_stripe_keys(os.environ)
    assert keys["secret"].startswith(("sk_test_", "rk_test_")), "Refusing: not a TEST key"
    stripe.api_key = keys["secret"]
    return stripe


@pytest.fixture(scope="module")
def original_promo(adm):
    r = adm.get(f"{BASE_URL}/api/admin/products/{SLUG}/promotion")
    assert r.status_code == 200
    promo = r.json()["promotion"]
    yield promo
    # restore exactly the promotion state we found
    body = {k: promo.get(k) for k in ("enabled", "type", "value", "starts_at", "ends_at")}
    body["type"] = body["type"] or "percent"
    body["value"] = body["value"] or 0
    body["enabled"] = bool(body["enabled"])
    rr = adm.put(f"{BASE_URL}/api/admin/products/{SLUG}/promotion", json=body)
    assert rr.status_code == 200


def _put_promo(adm, **kw):
    body = {"enabled": True, "type": "percent", "value": 20, "starts_at": None, "ends_at": None, **kw}
    return adm.put(f"{BASE_URL}/api/admin/products/{SLUG}/promotion", json=body)


# ---------- Public product pricing ----------
class TestPublicPricing:
    def test_list_has_pricing_no_raw_promo(self):
        r = requests.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        for p in r.json():
            assert "promotion" not in p
            assert set(["base", "final", "active"]) <= set(p["pricing"].keys())
            assert p["download_terms"] == {"days": 30, "limit": 25}

    def test_detail_has_reassurance(self):
        d = requests.get(f"{BASE_URL}/api/products/{SLUG}").json()
        assert "promotion" not in d
        assert isinstance(d["reassurance"], list) and len(d["reassurance"]) >= 3
        assert all("key" in i and "title" in i for i in d["reassurance"])
        assert "updates" not in [i["key"] for i in d["reassurance"]]

    def test_other_products_keep_price(self):
        items = {p["slug"]: p for p in requests.get(f"{BASE_URL}/api/products").json()}
        sv = items.get("suivi-sportif")
        if sv:
            assert sv["price"] == 4.99
            if not sv["pricing"]["active"]:
                assert sv["pricing"]["final"] == 4.99


# ---------- Promotions admin ----------
class TestPromotionAdmin:
    def test_requires_auth(self):
        assert requests.get(f"{BASE_URL}/api/admin/products/{SLUG}/promotion").status_code == 401

    @pytest.mark.parametrize("kw", [
        {"value": 0}, {"value": 95}, {"value": 12.5}, {"type": "amount", "value": 6.6},
        {"type": "amount", "value": 7.5}, {"type": "bogus"},
        {"starts_at": "2026-02-01T00:00:00Z", "ends_at": "2026-01-01T00:00:00Z"},
        {"starts_at": "not-a-date"},
    ])
    def test_validation_400(self, adm, original_promo, kw):
        r = _put_promo(adm, **kw)
        assert r.status_code == 400, r.text
        assert isinstance(r.json()["detail"], str)

    def test_status_cycle(self, adm, original_promo):
        now = datetime.now(timezone.utc)
        r = _put_promo(adm, starts_at=(now + timedelta(days=2)).isoformat())
        assert r.status_code == 200 and r.json()["status"] == "scheduled"
        assert requests.get(f"{BASE_URL}/api/products/{SLUG}").json()["pricing"]["final"] == 6.99
        r = _put_promo(adm, starts_at=(now - timedelta(days=3)).isoformat(), ends_at=(now - timedelta(days=1)).isoformat())
        assert r.json()["status"] == "expired"
        assert requests.get(f"{BASE_URL}/api/products/{SLUG}").json()["pricing"]["active"] is False
        r = _put_promo(adm, enabled=False)
        assert r.json()["status"] == "off"
        r = _put_promo(adm, type="amount", value=1)
        assert r.json()["status"] == "active" and r.json()["pricing"]["final"] == 5.99
        assert requests.get(f"{BASE_URL}/api/products/{SLUG}").json()["pricing"]["label"] == "-1,00 €"
        r = _put_promo(adm)  # 20 %
        p = requests.get(f"{BASE_URL}/api/products/{SLUG}").json()["pricing"]
        assert p == {**p, "base": 6.99, "final": 5.59, "active": True, "discount_cents": 140, "label": "-20 %"}


# ---------- Checkout with promotion (Stripe TEST) ----------
class TestCheckoutPromo:
    def _checkout(self, extra=None):
        body = {"lookup_key": "budget_mensuel", "origin_url": "x", "withdrawal_waiver": True,
                "withdrawal_consent_version": CONSENT, **(extra or {})}
        return requests.post(f"{BASE_URL}/api/payments/checkout", json=body)

    def test_checkout_with_promo(self, adm, original_promo, stripe_mod, mongo):
        assert _put_promo(adm).status_code == 200
        before = [p.id for p in stripe_mod.Price.list(lookup_keys=["budget_mensuel"], active=True).data]
        r = self._checkout({"amount": 1, "price": 0.5, "unit_amount": 50})
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]
        assert sid.startswith("cs_test_")
        s = stripe_mod.checkout.Session.retrieve(sid)
        assert s.amount_total == 559 and s.amount_subtotal == 699
        prices = stripe_mod.Price.list(lookup_keys=["budget_mensuel"], active=True).data
        assert [p.id for p in prices] == before and prices[0].unit_amount == 699
        c = stripe_mod.Coupon.retrieve("auben_budget_mensuel_eur_140")
        assert c.amount_off == 140
        tx = mongo.payment_transactions.find_one({"session_id": sid})
        assert tx["amount"] == 5.59 and tx["base_amount"] == 6.99 and tx["discount"] == 1.4
        stripe_mod.checkout.Session.expire(sid)

    def test_checkout_without_promo(self, adm, original_promo, stripe_mod):
        assert _put_promo(adm, enabled=False).status_code == 200
        r = self._checkout()
        assert r.status_code == 200, r.text
        s = stripe_mod.checkout.Session.retrieve(r.json()["session_id"])
        assert s.amount_total == 699
        stripe_mod.checkout.Session.expire(s.id)
        assert _put_promo(adm).status_code == 200

    def test_checkout_requires_waiver(self):
        r = self._checkout({"withdrawal_waiver": False})
        assert r.status_code == 400


# ---------- Reassurance ----------
class TestReassurance:
    def test_get_and_validation(self, adm):
        r = adm.get(f"{BASE_URL}/api/admin/reassurance")
        assert r.status_code == 200
        items = r.json()["items"]
        upd = [i for i in items if i["key"] == "updates"]
        assert upd and upd[0]["enabled"] is False
        bad = [dict(items[0]), dict(items[0])]
        assert adm.put(f"{BASE_URL}/api/admin/reassurance", json={"items": bad}).status_code == 400
        bad2 = [{**items[0], "enabled": True, "title": "  "}] + items[1:]
        assert adm.put(f"{BASE_URL}/api/admin/reassurance", json={"items": bad2}).status_code == 400

    def test_toggle_and_restore(self, adm):
        items = adm.get(f"{BASE_URL}/api/admin/reassurance").json()["items"]
        mod = [{**i, "enabled": False} if i["key"] == "support" else i for i in items]
        assert adm.put(f"{BASE_URL}/api/admin/reassurance", json={"items": mod}).status_code == 200
        keys = [i["key"] for i in requests.get(f"{BASE_URL}/api/products/{SLUG}").json()["reassurance"]]
        assert "support" not in keys
        assert adm.put(f"{BASE_URL}/api/admin/reassurance", json={"items": items}).status_code == 200

    def test_product_hidden_and_extra(self, adm):
        prod = requests.get(f"{BASE_URL}/api/products/{SLUG}").json()
        orig = {"reassurance_hidden": prod.get("reassurance_hidden") or [], "reassurance_extra": prod.get("reassurance_extra") or []}
        try:
            r = adm.put(f"{BASE_URL}/api/admin/products/{SLUG}", json={
                "reassurance_hidden": ["one_time"],
                "reassurance_extra": [{"icon": "Star", "title": "TEST_extra", "text": "t"}]})
            assert r.status_code == 200, r.text
            d = requests.get(f"{BASE_URL}/api/products/{SLUG}").json()
            keys = [i["key"] for i in d["reassurance"]]
            assert "one_time" not in keys and "TEST_extra" in [i["title"] for i in d["reassurance"]]
            assert d["price"] == 6.99
        finally:
            adm.put(f"{BASE_URL}/api/admin/products/{SLUG}", json=orig)


# ---------- Testimonials ----------
class TestTestimonials:
    def test_flow(self, adm):
        orig = adm.get(f"{BASE_URL}/api/admin/testimonials").json()
        created = []
        try:
            r = adm.post(f"{BASE_URL}/api/admin/testimonials", json={"name": "TEST_x", "text": "t", "published": True, "authentic": False})
            assert r.status_code == 400
            assert adm.post(f"{BASE_URL}/api/admin/testimonials", json={"name": "TEST_x", "text": "t", "rating": 6}).status_code == 422
            adm.put(f"{BASE_URL}/api/admin/testimonials/settings", json={"enabled": True, "show_home": True, "show_products": True})
            existing_pub = requests.get(f"{BASE_URL}/api/testimonials?place=home").json()
            a = adm.post(f"{BASE_URL}/api/admin/testimonials", json={"name": "TEST_A", "text": "Super", "rating": 5, "product_slug": SLUG,
                                                                     "authentic": True, "published": True, "source_note": "TEST_secret"}).json()
            created.append(a["id"])
            b = adm.post(f"{BASE_URL}/api/admin/testimonials", json={"name": "TEST_B", "text": "Brand", "product_slug": "",
                                                                     "authentic": True, "published": False}).json()
            created.append(b["id"])
            home = requests.get(f"{BASE_URL}/api/testimonials?place=home").json()
            ids = [t["id"] for t in home]
            assert a["id"] in ids and b["id"] not in ids
            for t in home:
                assert "source_note" not in t and "authentic" not in t and "published" not in t
            prod = requests.get(f"{BASE_URL}/api/testimonials?place=product&product={SLUG}").json()
            assert a["id"] in [t["id"] for t in prod]
            other = requests.get(f"{BASE_URL}/api/testimonials?place=product&product=suivi-sportif").json()
            assert a["id"] not in [t["id"] for t in other]
            # update -> publish B
            u = adm.put(f"{BASE_URL}/api/admin/testimonials/{b['id']}", json={"name": "TEST_B2", "text": "Brand", "authentic": True, "published": True})
            assert u.status_code == 200 and u.json()["name"] == "TEST_B2"
            assert b["id"] in [t["id"] for t in requests.get(f"{BASE_URL}/api/testimonials?place=product&product=suivi-sportif").json()]
            # reorder
            assert adm.post(f"{BASE_URL}/api/admin/testimonials/reorder", json={"ids": [b["id"], a["id"]]}).status_code == 200
            order = [i["id"] for i in adm.get(f"{BASE_URL}/api/admin/testimonials").json()["items"] if i["id"] in (a["id"], b["id"])]
            assert order == [b["id"], a["id"]]
            # place off
            adm.put(f"{BASE_URL}/api/admin/testimonials/settings", json={"enabled": True, "show_home": False, "show_products": True})
            assert requests.get(f"{BASE_URL}/api/testimonials?place=home").json() == []
            adm.put(f"{BASE_URL}/api/admin/testimonials/settings", json={"enabled": False, "show_home": True, "show_products": True})
            assert requests.get(f"{BASE_URL}/api/testimonials?place=product&product={SLUG}").json() == []
            assert existing_pub is not None
        finally:
            for tid in created:
                assert adm.delete(f"{BASE_URL}/api/admin/testimonials/{tid}").status_code == 200
            adm.put(f"{BASE_URL}/api/admin/testimonials/settings", json=orig["settings"])
        assert adm.delete(f"{BASE_URL}/api/admin/testimonials/{created[0]}").status_code == 404

    def test_enabled_no_items_empty(self, adm):
        orig = adm.get(f"{BASE_URL}/api/admin/testimonials").json()
        if any(i.get("authentic") and i.get("published") for i in orig["items"]):
            pytest.skip("real published testimonials exist")
        adm.put(f"{BASE_URL}/api/admin/testimonials/settings", json={"enabled": True, "show_home": True, "show_products": True})
        try:
            assert requests.get(f"{BASE_URL}/api/testimonials?place=home").json() == []
        finally:
            adm.put(f"{BASE_URL}/api/admin/testimonials/settings", json=orig["settings"])


# ---------- Video chunked upload + Range ----------
class TestVideo:
    def test_init_rejections(self, adm):
        r = adm.post(f"{BASE_URL}/api/admin/upload/video/init", json={"filename": "a.avi", "size": 100})
        assert r.status_code == 400 and "MP4" in r.json()["detail"]
        r = adm.post(f"{BASE_URL}/api/admin/upload/video/init", json={"filename": "a.mp4", "size": 81 * 1024 * 1024})
        assert r.status_code == 400 and "Taille maximale : 80 Mo" in r.json()["detail"]
        assert requests.post(f"{BASE_URL}/api/admin/upload/video/init", json={"filename": "a.mp4", "size": 10}).status_code == 401

    def _upload(self, adm, data, name):
        r = adm.post(f"{BASE_URL}/api/admin/upload/video/init", json={"filename": name, "size": len(data)})
        assert r.status_code == 200
        uid, cs = r.json()["upload_id"], r.json()["chunk_size"]
        for n in range(0, (len(data) + cs - 1) // cs):
            c = adm.put(f"{BASE_URL}/api/admin/upload/video/{uid}/chunk?index={n}", data=data[n * cs:(n + 1) * cs],
                        headers={"Content-Type": "application/octet-stream"})
            assert c.status_code == 200, c.text
        return adm.post(f"{BASE_URL}/api/admin/upload/video/{uid}/complete")

    def test_fake_rejected(self, adm):
        r = self._upload(adm, b"not a video at all, just text" * 10, "fake.mp4")
        assert r.status_code == 400

    def test_real_upload_and_range(self, adm):
        if not os.path.exists("/tmp/demo.mp4"):
            pytest.skip("Vidéo d'exemple /tmp/demo.mp4 absente")
        data = open("/tmp/demo.mp4", "rb").read()
        r = self._upload(adm, data, "TEST_demo.mp4")
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        assert path.endswith(".mp4")
        g = requests.get(f"{BASE_URL}/api/media/{path}", headers={"Range": "bytes=0-99"})
        assert g.status_code == 206
        assert g.headers.get("Content-Range") == f"bytes 0-99/{len(data)}"
        assert g.headers.get("Accept-Ranges") == "bytes" and len(g.content) == 100
        assert g.content == data[:100]
        full = requests.get(f"{BASE_URL}/api/media/{path}")
        assert full.status_code == 200 and len(full.content) == len(data)
        assert requests.get(f"{BASE_URL}/api/media/{path}", headers={"Range": f"bytes={len(data) + 10}-"}).status_code == 416
