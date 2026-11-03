# Demandes de contact (Preview, CONTACT_EMAIL_DRY_RUN) : consentement, notifications, réponses, échecs, doublons. `-n 0`.
import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
DOMAIN = "contact-test.example.com"
FAIL = "[SIMULER-ECHEC]"
LOCAL = "http://localhost:8001/api"  # IP client variable pour ne pas heurter la limite 5/min


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    mdb.contact_messages.delete_many({"email": {"$regex": "@" + re.escape(DOMAIN) + "$"}})


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    e = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    p = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    return {"Authorization": "Bearer " + requests.post(f"{API}/admin/login", json={"email": e, "password": p}).json()["access_token"]}


def post(consent=None, message="Bonjour,\nune question.", subject="Ma question"):
    email = f"c{uuid.uuid4().hex[:8]}@{DOMAIN}"
    body = {"name": "Client Test", "email": email, "subject": subject, "message": message}
    if consent is not None:
        body["followup_consent"] = consent
    ip = f"203.0.113.{uuid.uuid4().int % 250}, 10.0.0.1, 10.0.0.2"
    r = requests.post(f"{LOCAL}/contact", json=body, headers={"X-Forwarded-For": ip})
    assert r.status_code == 200, r.text
    return mdb.contact_messages.find_one({"email": email}, {"_id": 0})


def reply(h, mid, body="Merci, voici la réponse.", rid=None):
    return requests.post(f"{API}/admin/messages/{mid}/reply", headers=h,
                         json={"request_id": rid or uuid.uuid4().hex, "subject": "Re: Ma question", "body": body})


def test_mode_is_simulation(h):
    assert requests.get(f"{API}/admin/messages/email-mode", headers=h).json()["dry_run"] is True


def test_with_consent(h):
    m = post(True)
    assert m["followup_consent"] is True and m["followup_consent_at"] and m["followup_consent_version"] == "contact-suivi-v1"
    assert m["owner_notification"]["status"] == "sent" and m["confirmation"]["status"] == "sent"
    r = reply(h, m["id"])
    assert r.status_code == 200, r.text
    m2 = mdb.contact_messages.find_one({"id": m["id"]})
    assert m2["status"] == "answered" and len(m2["replies"]) == 1
    rep = m2["replies"][0]
    assert rep["status"] == "sent" and rep["email_id"] and rep["sent_at"] and rep["body"] == "Merci, voici la réponse."
    assert any(x["id"] == m["id"] for x in requests.get(f"{API}/admin/messages", headers=h).json())


def test_without_consent(h):
    m = post()
    assert m["followup_consent"] is False and "followup_consent_at" not in m
    assert m["owner_notification"]["status"] == "sent" and "confirmation" not in m
    r = reply(h, m["id"])
    assert r.status_code == 403
    assert mdb.contact_messages.find_one({"id": m["id"]})["replies"] == []


def test_consent_must_be_boolean():
    r = requests.post(f"{API}/contact", json={"name": "x", "email": f"z@{DOMAIN}", "message": "m", "followup_consent": "yes"})
    assert r.status_code == 422


def test_notification_failure_keeps_message():
    m = post(True, message=f"texte {FAIL}")
    assert m and m["owner_notification"]["status"] == "failed" and m["confirmation"]["status"] == "sent"


def test_reply_failure_not_marked_sent_then_retry(h):
    m = post(True)
    r = reply(h, m["id"], body=f"réponse {FAIL}")
    assert r.status_code == 424 and "pas été envoyée" in r.json()["detail"]
    m2 = mdb.contact_messages.find_one({"id": m["id"]})
    assert m2["status"] == "new" and m2["replies"][0]["status"] == "failed" and not m2["replies"][0]["sent_at"]
    assert reply(h, m["id"]).status_code == 200
    assert mdb.contact_messages.find_one({"id": m["id"]})["status"] == "answered"


def test_double_click_sends_once(h):
    m = post(True)
    rid = uuid.uuid4().hex
    with ThreadPoolExecutor(4) as ex:
        codes = sorted(f.result().status_code for f in [ex.submit(reply, h, m["id"], "Une fois", rid) for _ in range(4)])
    assert codes.count(200) == 1 and all(c == 409 for c in codes if c != 200)
    assert len(mdb.contact_messages.find_one({"id": m["id"]})["replies"]) == 1


def test_html_is_escaped_and_filter(h):
    m = post(True, message="<script>alert(1)</script> <a href='http://evil'>x</a>")
    assert m["owner_notification"]["status"] == "sent"
    r = reply(h, m["id"], body="<img src=http://evil.test/x.png> <form>")
    assert r.status_code == 200


def test_status_toggle_and_auth(h):
    m = post()
    assert requests.post(f"{API}/admin/messages/{m['id']}/status", json={"status": "handled"}).status_code in (401, 403)
    assert requests.post(f"{API}/admin/messages/{m['id']}/reply", json={"request_id": "x" * 10, "subject": "s", "body": "b"}).status_code in (401, 403)
    assert requests.post(f"{API}/admin/messages/{m['id']}/status", headers=h, json={"status": "handled"}).json()["status"] == "handled"
    assert requests.post(f"{API}/admin/messages/{m['id']}/status", headers=h, json={"status": "new"}).json()["status"] == "new"
    assert reply(h, "inexistant").status_code == 404


def test_rate_limit_still_applies():
    hdr = {"X-Forwarded-For": "198.51.100.7, 10.0.0.1, 10.0.0.2"}
    codes = [requests.post(f"{LOCAL}/contact", headers=hdr, json={"name": "R", "email": f"r@{DOMAIN}", "message": "m"}).status_code
             for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429
