# Admin newsletter sending: eligibility, soft remove, test marking, preview, send (dry-run), campaigns, unsubscribe
# Shares state across classes: run serially with `-n 0`.
import os
import re
import time
import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
P = "fictif-qa-"
NOW = "2026-06-01T10:00:00+00:00"
VER = "newsletter-v1-2026-06"

mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
CREATED_CAMPAIGNS = []


def _ok(n):
    return dict(id=f"{P}{n}", email=f"{P}{n}@exemple-fictif.fr", status="subscribed", consent=True,
                consent_at=NOW, consent_text_version=VER, unsubscribe_token=f"{P}tok-{n}", created_at=NOW)


@pytest.fixture(scope="module", autouse=True)
def seed():
    mdb.newsletter.delete_many({"$or": [{"id": {"$regex": "^" + P}}, {"email": {"$regex": "^" + P}}]})
    docs = [_ok("ok1"), _ok("ok2"), _ok("ok3"), _ok("ok4"), _ok("unsubme"),
            dict(_ok("unsub"), status="unsubscribed", consent=False),
            dict(id=f"{P}legacy", email=f"{P}legacy@exemple-fictif.fr", consent=True,
                 unsubscribe_token=f"{P}tok-legacy", created_at=NOW),
            dict(_ok("nover"), consent_text_version=None),
            dict(_ok("removed"), removed=True, removed_at=NOW),
            dict(_ok("flagged"), is_test=True)]
    mdb.newsletter.insert_many(docs)
    yield
    mdb.newsletter.delete_many({"$or": [{"id": {"$regex": "^" + P}}, {"email": {"$regex": "^" + P}}]})
    if CREATED_CAMPAIGNS:
        mdb.newsletter_campaigns.delete_many({"id": {"$in": CREATED_CAMPAIGNS}})


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    email = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    pw = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    r = requests.post(f"{API}/admin/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return {"Authorization": "Bearer " + r.json()["access_token"]}


def _subs(h):
    return {s["id"]: s for s in requests.get(f"{API}/admin/newsletter", headers=h).json() if s["id"].startswith(P)}


def _wait_campaign(h, cid, timeout=15):
    for _ in range(timeout * 2):
        camp = [c for c in requests.get(f"{API}/admin/newsletter/campaigns", headers=h).json() if c["id"] == cid]
        if camp and camp[0]["status"] != "sending":
            return camp[0]
        time.sleep(0.5)
    return camp[0] if camp else None


def _send(h, **kw):
    payload = {"subject": "TEST_QA campagne", "body": "Bonjour", "recipient_ids": [], "confirmation": "ENVOYER"}
    payload.update(kw)
    r = requests.post(f"{API}/admin/newsletter/send", headers=h, json=payload)
    if r.status_code == 200:
        CREATED_CAMPAIGNS.append(r.json()["campaign_id"])
    return r


class TestAuthRequired:
    @pytest.mark.parametrize("method,path", [
        ("get", "/admin/newsletter"), ("get", "/admin/newsletter/settings"), ("get", "/admin/newsletter/campaigns"),
        ("delete", f"/admin/newsletter/{P}ok1"),
        ("post", "/admin/newsletter/preview"), ("post", "/admin/newsletter/send"), ("post", "/admin/newsletter/test")])
    def test_401(self, method, path):
        r = getattr(requests, method)(f"{API}{path}", json={"is_test": True, "subject": "s", "body": "b", "confirmation": "ENVOYER"})
        assert r.status_code == 401


class TestListAndSettings:
    def test_settings_dry_run(self, h):
        d = requests.get(f"{API}/admin/newsletter/settings", headers=h).json()
        assert d["dry_run"] is True and d["confirm_word"] == "ENVOYER" and d["owner_email_configured"] is True

    def test_eligibility_reasons(self, h):
        s = _subs(h)
        assert s[f"{P}ok1"]["eligible"] is True and s[f"{P}ok1"]["ineligible_reason"] is None
        assert s[f"{P}unsub"]["ineligible_reason"] == "Désinscrit"
        assert s[f"{P}legacy"]["ineligible_reason"] == "Consentement non prouvé"
        assert s[f"{P}nover"]["ineligible_reason"] == "Consentement non prouvé"
        assert s[f"{P}removed"]["ineligible_reason"] == "Retiré de la liste"
        assert s[f"{P}flagged"]["eligible"] is True  # l'ancien marquage « test » n'a plus d'effet
        assert "_id" not in s[f"{P}ok1"]
        assert "/newsletter/desinscription?token=" in s[f"{P}ok1"]["unsubscribe_url"]


class TestPatchRemove:
    def test_patch_endpoint_removed(self, h):
        assert requests.patch(f"{API}/admin/newsletter/{P}ok4", headers=h, json={"is_test": True}).status_code == 405

    def test_soft_remove_keeps_proof(self, h):
        assert requests.delete(f"{API}/admin/newsletter/{P}ok3", headers=h).status_code == 200
        doc = mdb.newsletter.find_one({"id": f"{P}ok3"})
        assert doc["removed"] is True and doc["removed_at"]
        assert doc["consent_at"] == NOW and doc["consent_text_version"] == VER and doc["consent"] is True
        assert _subs(h)[f"{P}ok3"]["eligible"] is False
        # idempotent
        assert requests.delete(f"{API}/admin/newsletter/{P}ok3", headers=h).status_code == 200

    def test_remove_404(self, h):
        assert requests.delete(f"{API}/admin/newsletter/{P}nope", headers=h).status_code == 404


class TestPreview:
    def test_preview_html(self, h):
        body = "Bonjour,\n\nNouveautés :\n- Budget https://la-maison-dauben.com/boutique.\n- <script>alert(1)</script>"
        r = requests.post(f"{API}/admin/newsletter/preview", headers=h, json={"subject": "Objet <b>x</b>", "body": body})
        assert r.status_code == 200
        html = r.json()["html"]
        assert "<ul" in html and html.count("<li") == 2
        assert "<script>" not in html and "&lt;script&gt;" in html
        assert "Objet &lt;b&gt;x&lt;/b&gt;" in html
        assert 'href="https://la-maison-dauben.com/boutique"' in html
        assert "/newsletter/desinscription?token=" in html and "SIRET" in html and "La Maison d" in html

    def test_preview_validation(self, h):
        assert requests.post(f"{API}/admin/newsletter/preview", headers=h, json={"subject": "", "body": "x"}).status_code == 422


class TestSend:
    def test_bad_confirmation(self, h):
        assert _send(h, recipient_ids=[f"{P}ok1"], confirmation="envoyer").status_code == 400

    def test_no_eligible(self, h):
        r = _send(h, recipient_ids=[f"{P}unsub", f"{P}legacy", f"{P}removed", f"{P}nover"])
        assert r.status_code == 400

    def test_server_refilters(self, h):
        ids = [f"{P}ok1", f"{P}ok2", f"{P}unsub", f"{P}legacy", f"{P}removed", f"{P}nover", f"{P}ok3"]
        r = _send(h, recipient_ids=ids)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["recipients"] == 2 and d["excluded"] == 5 and d["mode"] == "dry_run"
        c = _wait_campaign(h, d["campaign_id"])
        assert c["status"] == "done" and c["kind"] == "campaign"
        assert c["counts"]["simulated"] == 2 and c["counts"]["sent"] == 0
        assert sorted(x["email"] for x in c["results"]) == [f"{P}ok1@exemple-fictif.fr", f"{P}ok2@exemple-fictif.fr"]
        assert all(x["status"] == "simulated" for x in c["results"])

    def test_unsubscribe_then_skipped(self, h):
        r = requests.post(f"{API}/newsletter/unsubscribe", json={"token": f"{P}tok-unsubme"})
        assert r.status_code == 200
        s = _subs(h)[f"{P}unsubme"]
        assert s["eligible"] is False and s["ineligible_reason"] == "Désinscrit"
        assert _send(h, recipient_ids=[f"{P}unsubme"]).status_code == 400

    def test_empty_selection_rejected(self, h):
        assert _send(h, recipient_ids=[]).status_code == 400
        assert _send(h, all_eligible=True).status_code == 400  # plus d'envoi « à tous » implicite

    def test_select_all_eligible(self, h):
        eligible = [s for s in requests.get(f"{API}/admin/newsletter", headers=h).json() if s["eligible"]]
        r = _send(h, recipient_ids=[s["id"] for s in eligible] + [f"{P}unsub", f"{P}legacy"])
        assert r.status_code == 200
        assert r.json()["recipients"] == len(eligible)
        c = _wait_campaign(h, r.json()["campaign_id"], timeout=30)
        assert c["status"] == "done"
        emails = {x["email"] for x in c["results"]}
        assert f"{P}ok1@exemple-fictif.fr" in emails
        assert not any(e.startswith(f"{P}") and e.split("@")[0][len(P):] in ("unsub", "legacy", "removed", "nover", "ok3", "unsubme") for e in emails)
        assert all(x["status"] == "simulated" for x in c["results"])

    def test_send_test_owner(self, h):
        r = requests.post(f"{API}/admin/newsletter/test", headers=h, json={"subject": "TEST_QA test", "body": "Bonjour"})
        assert r.status_code == 200 and r.json()["status"] == "simulated"
        camp = [c for c in requests.get(f"{API}/admin/newsletter/campaigns", headers=h).json()
                if c["kind"] == "test" and c["subject"] == "TEST_QA test"]
        assert camp
        CREATED_CAMPAIGNS.extend(c["id"] for c in camp)
        assert camp[0]["results"][0]["email"] == os.environ["OWNER_EMAIL"]
        assert camp[0]["results"][0]["status"] == "simulated" and len(camp[0]["results"]) == 1


class TestRegression:
    def test_public_signup_requires_consent(self):
        r = requests.post(f"{API}/newsletter", json={"email": f"{P}pub@exemple-fictif.fr"})
        assert r.status_code in (400, 422)
        r = requests.post(f"{API}/newsletter", json={"email": f"{P}pub@exemple-fictif.fr", "consent": False})
        assert r.status_code in (400, 422)
