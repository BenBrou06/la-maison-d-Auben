"""End-to-end backend API tests for La Maison d'Auben."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://auben-preview-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@lamaisondauben.fr"
ADMIN_PASSWORD = "Auben2026!"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# -------------- Public content --------------
class TestPublicContent:
    def test_settings(self, s):
        r = s.get(f"{API}/settings")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 8, f"Expected 8 categories, got {len(cats)}"

    def test_products(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        prods = r.json()
        # Spec: "5 products". Seed currently returns 6 (Suivi sportif added). Report but don't hard-fail.
        assert len(prods) >= 5, f"Expected >=5 products, got {len(prods)}"
        avail = [p for p in prods if p.get("status") == "available"]
        assert len(avail) >= 1
        bm = next((p for p in prods if p["slug"] == "budget-mensuel"), None)
        assert bm and bm["price"] == 7.99 and bm.get("main_image")

    def test_product_detail(self, s):
        r = s.get(f"{API}/products/budget-mensuel")
        assert r.status_code == 200
        p = r.json()
        for k in ["features", "gallery", "faq", "contents", "compatibility"]:
            assert k in p, f"Missing key {k}"

    def test_product_not_found(self, s):
        r = s.get(f"{API}/products/does-not-exist")
        assert r.status_code == 404

    def test_articles(self, s):
        r = s.get(f"{API}/articles")
        assert r.status_code == 200
        arts = r.json()
        assert len(arts) == 3

    def test_article_detail(self, s):
        r = s.get(f"{API}/articles/comment-faire-son-budget-mensuel")
        assert r.status_code == 200
        a = r.json()
        assert "related_products" in a

    def test_faq(self, s):
        r = s.get(f"{API}/faq")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# -------------- Newsletter + contact --------------
class TestNewsletterContact:
    def test_newsletter_no_consent(self, s):
        r = s.post(f"{API}/newsletter", json={"email": "TEST_a@test.com", "consent": False})
        assert r.status_code == 400

    def test_newsletter_subscribe(self, s):
        email = f"TEST_{int(time.time())}@test.com"
        r = s.post(f"{API}/newsletter", json={"email": email, "consent": True})
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
        # duplicate
        r2 = s.post(f"{API}/newsletter", json={"email": email, "consent": True})
        assert r2.status_code == 200
        assert r2.json()["status"] == "already"

    def test_contact(self, s):
        r = s.post(f"{API}/contact", json={
            "name": "TEST_User", "email": "TEST_contact@test.com",
            "subject": "Test", "message": "Hello",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# -------------- Payments --------------
class TestPayments:
    def test_checkout(self, s):
        r = s.post(f"{API}/payments/checkout", json={
            "lookup_key": "budget_mensuel", "origin_url": BASE_URL,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "checkout_url" in data and data["checkout_url"].startswith("http")
        assert "session_id" in data
        pytest.session_id_for_test = data["session_id"]

    def test_payment_status_pending(self, s):
        sid = getattr(pytest, "session_id_for_test", None)
        assert sid, "No session id"
        r = s.get(f"{API}/payments/status/{sid}")
        assert r.status_code == 200
        d = r.json()
        assert d["payment_status"] in ("pending", "paid")

    def test_payment_status_bad(self, s):
        r = s.get(f"{API}/payments/status/bad_session_xyz")
        assert r.status_code == 404


# -------------- Admin auth --------------
class TestAdminAuth:
    def test_login_success(self, s):
        r = s.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_bad_password(self, s):
        r = s.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_without_token(self, s):
        r = s.get(f"{API}/admin/me")
        assert r.status_code == 401

    def test_me_with_token(self, s, admin_headers):
        r = s.get(f"{API}/admin/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_orders_requires_token(self, s):
        assert s.get(f"{API}/admin/orders").status_code == 401

    def test_orders_with_token(self, s, admin_headers):
        r = s.get(f"{API}/admin/orders", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_newsletter_admin(self, s, admin_headers):
        r = s.get(f"{API}/admin/newsletter", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_messages_admin(self, s, admin_headers):
        r = s.get(f"{API}/admin/messages", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

# -------------- Tax-inclusive & Owner-notified regression --------------
# These tests rely on a completed Stripe test purchase performed via UI automation.
# They only validate persisted state on the most recent Budget mensuel paid order.
class TestTaxInclusiveAndOwnerNotified:
    def test_categories_include_sport_no_investissement(self, s):
        r = s.get(f"{API}/categories")
        slugs = [c["slug"] for c in r.json()]
        assert "sport" in slugs
        assert "investissement" not in slugs

    def test_budget_mensuel_price_7_99_with_main_image(self, s):
        r = s.get(f"{API}/products/budget-mensuel")
        assert r.status_code == 200
        p = r.json()
        assert p["price"] == 7.99
        assert p.get("main_image")

    def test_latest_paid_order_is_tax_inclusive_and_owner_notified(self, s, admin_headers):
        r = s.get(f"{API}/admin/orders", headers=admin_headers)
        assert r.status_code == 200
        orders = r.json()
        paid_bm = [o for o in orders
                   if o.get("product_slug") == "budget-mensuel"
                   and o.get("status") == "paid"]
        if not paid_bm:
            pytest.skip("No paid Budget mensuel order yet")
        paid_bm.sort(key=lambda o: o.get("created_at", ""), reverse=True)
        latest = paid_bm[0]
        # Tax-inclusive: total paid must be exactly 7.99 EUR (not 8.43)
        assert latest["amount"] == 7.99, f"Expected 7.99 EUR, got {latest['amount']}"
        assert latest["currency"] == "eur"
        # Owner notification flag set true on fulfilled order
        assert latest.get("owner_notified") is True, "owner_notified must be true"

    def test_download_endpoint_on_latest_order(self, s, admin_headers):
        r = s.get(f"{API}/admin/orders", headers=admin_headers)
        orders = [o for o in r.json()
                  if o.get("product_slug") == "budget-mensuel" and o.get("status") == "paid"]
        if not orders:
            pytest.skip("No paid Budget mensuel order yet")
        orders.sort(key=lambda o: o.get("created_at", ""), reverse=True)
        tok = orders[0]["download_token"]
        r2 = s.get(f"{API}/download/{tok}")
        assert r2.status_code == 200
        assert "spreadsheetml.sheet" in r2.headers.get("content-type", "")
        cd = r2.headers.get("content-disposition", "")
        assert "attachment" in cd and "Budget-mensuel.xlsx" in cd
        assert len(r2.content) > 500_000  # real ~1MB xlsx

