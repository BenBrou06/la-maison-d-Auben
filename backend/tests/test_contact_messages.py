# Demandes de contact (Preview, CONTACT_EMAIL_DRY_RUN) : sans case, file d'envoi, réponses, échecs, blocages, doublons. `-n 0`.
import os
import re
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
LOCAL = "http://localhost:8001/api"  # IP client variable pour ne pas heurter la limite 5/min
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
DOMAIN = "contact-test.example.com"


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


def get(mid):
    return mdb.contact_messages.find_one({"id": mid}, {"_id": 0})


def wait(mid, pred, timeout=8):
    end = time.time() + timeout
    while time.time() < end:
        m = get(mid)
        if pred(m):
            return m
        time.sleep(0.3)
    return get(mid)


def post(message="Bonjour,\nune question.", subject="Ma question", extra=None):
    email = f"c{uuid.uuid4().hex[:8]}@{DOMAIN}"
    body = {"name": "Client Test", "email": email, "subject": subject, "message": message, **(extra or {})}
    ip = f"203.0.113.{uuid.uuid4().int % 250}, 10.0.0.1, 10.0.0.2"
    t = time.time()
    r = requests.post(f"{LOCAL}/contact", json=body, headers={"X-Forwarded-For": ip})
    assert r.status_code == 200, r.text
    return mdb.contact_messages.find_one({"email": email}, {"_id": 0}), time.time() - t


def done(m):
    return all(m[k]["status"] not in ("pending", "sending") for k in ("owner_notification", "confirmation"))


def reply(h, mid, body="Merci, voici la réponse.", rid=None):
    return requests.post(f"{API}/admin/messages/{mid}/reply", headers=h,
                         json={"request_id": rid or uuid.uuid4().hex, "subject": "Re: Ma question", "body": body})


def old_iso(sec=3600):
    return (datetime.now(timezone.utc) - timedelta(seconds=sec)).isoformat()


def test_mode_is_simulation(h):
    assert requests.get(f"{API}/admin/messages/email-mode", headers=h).json()["dry_run"] is True


def test_form_without_checkbox_async_and_both_notifications(h):
    m, elapsed = post(extra={"followup_consent": True})  # champ obsolète ignoré
    assert "followup_consent" not in m and m["notice_version"] == "contact-mention-v1"
    assert m["owner_notification"]["status"] in ("pending", "sending", "sent")
    assert elapsed < 1.0
    m = wait(m["id"], done)
    assert m["owner_notification"]["status"] == "sent" and m["confirmation"]["status"] == "sent"
    r = reply(h, m["id"])
    assert r.status_code == 200, r.text
    m2 = get(m["id"])
    assert m2["status"] == "answered" and m2["replies"][0]["status"] == "sent" and m2["replies"][0]["email_id"]


def test_legacy_messages_repliable_history_untouched(h):
    t = datetime.now(timezone.utc).isoformat()
    legacy = [
        {"id": f"legacy-{uuid.uuid4().hex[:6]}", "name": "Ancien", "email": f"old1@{DOMAIN}", "subject": "",
         "message": "ancien format", "created_at": t},
        {"id": f"legacy-{uuid.uuid4().hex[:6]}", "name": "Ancien2", "email": f"old2@{DOMAIN}", "subject": "s",
         "message": "case non cochée", "created_at": t, "status": "new", "followup_consent": False, "replies": []},
    ]
    mdb.contact_messages.insert_many([dict(x) for x in legacy])
    for x in legacy:
        assert reply(h, x["id"]).status_code == 200
        after = get(x["id"])
        assert after.get("followup_consent") == x.get("followup_consent")
        assert "followup_consent_at" not in after


def test_temporary_failure_auto_retry_then_manual(h):
    m, _ = post(message="texte [SIMULER-ECHEC]")
    m = wait(m["id"], lambda x: x["owner_notification"].get("attempts", 0) >= 1 and x["owner_notification"]["status"] == "pending"
             and x["confirmation"]["status"] == "sent")
    n = m["owner_notification"]
    assert n["error_kind"] == "temporary" and n["next_at"] > datetime.now(timezone.utc).isoformat()
    assert m["confirmation"]["status"] == "sent"  # indépendante
    mdb.contact_messages.update_one({"id": m["id"]}, {"$set": {"owner_notification.attempts": 3,
                                                                "owner_notification.status": "failed"}})
    r = requests.post(f"{API}/admin/messages/{m['id']}/notifications/owner_notification/retry", headers=h,
                      json={"request_id": uuid.uuid4().hex})
    assert r.status_code == 200 and r.json()["job"]["status"] in ("pending", "failed")
    assert get(m["id"])["message"] == "texte [SIMULER-ECHEC]"


def test_explanatory_mentions_pass_filter(h):
    m, _ = post(message="Mon CVV ne passe pas et j'ai oublié mon mot de passe, que faire ?")
    m = wait(m["id"], done)
    assert m["owner_notification"]["status"] == "sent" and not m["owner_notification"]["content_omitted"]
    assert m["confirmation"]["status"] == "sent"
    assert reply(h, m["id"], body="Ne communiquez jamais votre CVV ni votre mot de passe, à personne.").status_code == 200


def test_real_sensitive_data_owner_fallback_and_reply_refused(h):
    msg = "Voici ma carte 4111 1111 1111 1111, cvv: 123"
    m, _ = post(message=msg)
    m = wait(m["id"], done)
    assert m["owner_notification"]["status"] == "sent" and m["owner_notification"]["content_omitted"] is True
    assert m["message"] == msg
    r = reply(h, m["id"], body="Envoyez-nous votre mot de passe pour vérifier.")
    assert r.status_code == 424 and "filtre de sécurité" in r.json()["detail"]
    rep = get(m["id"])["replies"][0]
    assert rep["status"] == "failed" and rep["error_kind"] == "refused_local"
    bad = requests.post(f"{API}/admin/messages/{m['id']}/replies/{rep['id']}/retry", headers=h, json={"request_id": uuid.uuid4().hex})
    assert bad.status_code == 400
    assert reply(h, m["id"], body="Pas de souci, voici la marche à suivre.").status_code == 200


def test_injected_form_and_bad_links_still_blocked():
    import sys
    sys.path.insert(0, "/app/backend")
    from emailer import _assert_safe_email
    for html in ("<form><input></form>", '<a href="http://x.test">x</a>', '<a href="https://bit.ly/a">x</a>',
                 '<a href="https://evil.test">paypal.com</a>', "<p>please send us your password</p>"):
        with pytest.raises(ValueError):
            _assert_safe_email("s", html, contextual=True)
    with pytest.raises(ValueError):
        _assert_safe_email("s", "<p>cvv</p>")  # règle par défaut (commandes, newsletter) inchangée


def test_concurrent_workers_claim_once():
    t = datetime.now(timezone.utc).isoformat()
    ids = [f"conc-{uuid.uuid4().hex[:8]}" for _ in range(5)]
    mdb.contact_messages.insert_many([{"id": i, "name": "C", "email": f"{i}@{DOMAIN}", "subject": "", "message": "m",
                                       "created_at": t, "status": "new", "replies": [],
                                       "owner_notification": {"status": "pending", "attempts": 0, "next_at": t},
                                       "confirmation": {"status": "pending", "attempts": 0, "next_at": t}} for i in ids])
    import subprocess
    code = (
        "import asyncio,sys; sys.path.insert(0,'/app/backend')\n"
        "from dotenv import load_dotenv; load_dotenv('/app/backend/.env')\n"
        "import contact_admin as c\n"
        "calls=[]\n"
        "orig=c._deliver_job\n"
        "async def spy(k,m):\n    calls.append((m['id'],k)); await asyncio.sleep(0.2); return await orig(k,m)\n"
        "c._deliver_job=spy\n"
        f"ids={ids!r}\n"
        "async def main():\n    await asyncio.gather(*[c.process_message(i) for i in ids for _ in range(4)], c.worker_tick(), c.worker_tick())\n"
        "asyncio.run(main()); print(len(calls))\n")
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr
    assert int(out.stdout.strip().splitlines()[-1]) <= 10
    for i in ids:
        m = get(i)
        for k in ("owner_notification", "confirmation"):
            assert m[k]["status"] == "sent" and m[k]["attempts"] == 1


def test_provider_refusal_not_sent(h):
    m, _ = post()
    r = reply(h, wait(m["id"], done)["id"], body="x [SIMULER-REFUS]")
    assert r.status_code == 424
    m2 = get(m["id"])
    assert m2["replies"][0]["status"] == "failed" and m2["status"] == "new"


def test_reply_failure_retry_links_entries(h):
    m, _ = post()
    r = reply(h, m["id"], body="réponse [SIMULER-ECHEC]")
    assert r.status_code == 424
    rep = get(m["id"])["replies"][0]
    mdb.contact_messages.update_one({"id": m["id"], "replies.id": rep["id"]},
                                    {"$set": {"replies.$.body": "réponse corrigée"}})
    rid = uuid.uuid4().hex
    r2 = requests.post(f"{API}/admin/messages/{m['id']}/replies/{rep['id']}/retry", headers=h, json={"request_id": rid})
    assert r2.status_code == 200, r2.text
    m2 = get(m["id"])
    assert len(m2["replies"]) == 2 and m2["replies"][0]["retried_by"] == m2["replies"][1]["id"]
    assert m2["replies"][1]["retry_of"] == rep["id"] and m2["status"] == "answered"
    again = requests.post(f"{API}/admin/messages/{m['id']}/replies/{rep['id']}/retry", headers=h, json={"request_id": uuid.uuid4().hex})
    assert again.status_code == 409


def test_stuck_reply_detected_blocks_then_recovers(h):
    m, _ = post()
    stuck = {"id": "stuck-1", "request_id": "stuck-req-1", "subject": "s", "body": "b", "status": "sending",
             "created_at": old_iso(20), "started_at": old_iso(20)}
    mdb.contact_messages.update_one({"id": m["id"]}, {"$push": {"replies": stuck}})
    assert reply(h, m["id"]).status_code == 409  # envoi récent en cours : bloque
    mdb.contact_messages.update_one({"id": m["id"], "replies.id": "stuck-1"},
                                    {"$set": {"replies.$.started_at": old_iso()}})
    assert reply(h, m["id"]).status_code == 200  # délai dépassé : ne bloque plus
    m2 = wait(m["id"], lambda x: x["replies"][0]["status"] == "uncertain", timeout=30)
    assert m2["replies"][0]["status"] == "uncertain"
    no = requests.post(f"{API}/admin/messages/{m['id']}/replies/stuck-1/retry", headers=h, json={"request_id": uuid.uuid4().hex})
    assert no.status_code == 400
    ok = requests.post(f"{API}/admin/messages/{m['id']}/replies/stuck-1/retry", headers=h,
                       json={"request_id": uuid.uuid4().hex, "confirm_duplicate_risk": True})
    assert ok.status_code == 200


def test_stuck_notification_becomes_uncertain_and_needs_confirmation(h):
    m, _ = post()
    wait(m["id"], done)
    mdb.contact_messages.update_one({"id": m["id"]}, {"$set": {"owner_notification.status": "sending",
                                                                "owner_notification.started_at": old_iso()}})
    m2 = wait(m["id"], lambda x: x["owner_notification"]["status"] == "uncertain", timeout=30)
    assert m2["owner_notification"]["status"] == "uncertain"
    url = f"{API}/admin/messages/{m['id']}/notifications/owner_notification/retry"
    assert requests.post(url, headers=h, json={"request_id": uuid.uuid4().hex}).status_code == 400
    r = requests.post(url, headers=h, json={"request_id": uuid.uuid4().hex, "confirm_duplicate_risk": True})
    assert r.status_code == 200 and r.json()["job"]["status"] == "sent"
    assert requests.post(url, headers=h, json={"request_id": uuid.uuid4().hex, "confirm_duplicate_risk": True}).status_code == 400


def test_double_click_sends_once(h):
    m, _ = post()
    rid = uuid.uuid4().hex
    with ThreadPoolExecutor(4) as ex:
        codes = sorted(f.result().status_code for f in [ex.submit(reply, h, m["id"], "Une fois", rid) for _ in range(4)])
    assert codes.count(200) == 1 and all(c == 409 for c in codes if c != 200)
    assert len(get(m["id"])["replies"]) == 1


def test_html_escaped(h):
    m, _ = post(message="<script>alert(1)</script> <a href='http://evil'>x</a>")
    assert wait(m["id"], done)["owner_notification"]["status"] == "sent"
    assert reply(h, m["id"], body="<img src=http://evil.test/x.png> <form>").status_code == 200


def test_status_toggle_auth_and_rate_limit(h):
    m, _ = post()
    assert requests.post(f"{API}/admin/messages/{m['id']}/status", json={"status": "handled"}).status_code in (401, 403)
    assert requests.post(f"{API}/admin/messages/{m['id']}/reply", json={"request_id": "x" * 10, "subject": "s", "body": "b"}).status_code in (401, 403)
    assert requests.post(f"{API}/admin/messages/{m['id']}/status", headers=h, json={"status": "handled"}).json()["status"] == "handled"
    assert reply(h, "inexistant").status_code == 404
    hdr = {"X-Forwarded-For": "198.51.100.7, 10.0.0.1, 10.0.0.2"}
    codes = [requests.post(f"{LOCAL}/contact", headers=hdr, json={"name": "R", "email": f"r@{DOMAIN}", "message": "m"}).status_code
             for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429
