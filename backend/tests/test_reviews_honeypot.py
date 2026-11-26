# Reviews honeypot fix (iteration 26): suspect storage, confirm_suspect, logs, duplicates, too-fast, rate limit
import os, uuid, time, subprocess
import pytest, requests
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
LOG = "/var/log/supervisor/backend.err.log"
BUCKETS = ["review", "review-day", "review-report", "review-invite"]


def reset_rate():
    mdb.rate_hits.delete_many({"bucket": {"$in": BUCKETS}})


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/admin/login", json={"email": "admin@lamaisondauben.fr", "password": "Auben2026!"})
    if r.status_code != 200:
        pytest.skip("admin login failed")
    s.headers["Authorization"] = "Bearer " + r.json()["access_token"]
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    created = []
    yield created
    for e in created:
        mdb.testimonials.delete_many({"email": e})
    reset_rate()


def payload(email, **kw):
    p = {"kind": "brand", "product_slug": "", "name": "TEST_Hp", "email": email, "rating": 5,
         "text": f"TEST_ honeypot avis {uuid.uuid4().hex}", "consent": True, "experience_month": "2026-10",
         "invitation": "", "elapsed_ms": 5000}
    p.update(kw)
    return p


def submit(p, created):
    reset_rate()
    created.append(p["email"])
    return requests.post(f"{API}/reviews", json=p)


def log_tail():
    return subprocess.run(["tail", "-n", "200", LOG], capture_output=True, text=True).stdout


# Normal submission stored with suspect=false
def test_normal_not_suspect(cleanup):
    e = f"test_hp_norm_{uuid.uuid4().hex[:6]}@example.com"
    r = submit(payload(e), cleanup)
    assert r.status_code == 200 and r.json() == {"status": "ok", "saved": True}
    d = mdb.testimonials.find_one({"email": e})
    assert d["status"] == "pending" and d["suspect"] is False and d["suspect_reason"] == ""


# zx_ctrl honeypot -> stored pending suspect + warning log without PII
def test_honeypot_stored_and_logged(cleanup, admin):
    e = f"test_hp_zx_{uuid.uuid4().hex[:6]}@example.com"
    p = payload(e, zx_ctrl="x", name="TEST_HpUniqueName")
    r = submit(p, cleanup)
    assert r.status_code == 200 and r.json()["saved"] is True
    d = mdb.testimonials.find_one({"email": e})
    assert d["status"] == "pending" and d["suspect"] is True and d["suspect_reason"] == "honeypot"
    time.sleep(1)
    lines = [l for l in log_tail().splitlines() if "Review honeypot triggered: path=public result=stored_pending_suspect" in l]
    assert lines
    assert not any(e in l or "TEST_HpUniqueName" in l or p["text"] in l for l in lines)
    # Admin view exposes suspect, public never
    items = admin.get(f"{API}/admin/testimonials").json()["items"]
    assert any(t["id"] == d["id"] and t["suspect"] for t in items)
    pub = requests.get(f"{API}/testimonials?place=home").json()
    for t in pub:
        assert "suspect" not in t and "suspect_reason" not in t and "email" not in t
    # 2b: confirm_suspect required
    tid = d["id"]
    assert admin.put(f"{API}/admin/testimonials/{tid}/status", json={"status": "published"}).status_code == 400
    r1 = admin.put(f"{API}/admin/testimonials/{tid}/status", json={"status": "approved"})
    assert r1.status_code == 400 and "Suspect" in r1.json()["detail"]
    assert mdb.testimonials.find_one({"id": tid})["status"] == "pending"
    r2 = admin.put(f"{API}/admin/testimonials/{tid}/status", json={"status": "approved", "confirm_suspect": True})
    assert r2.status_code == 200 and r2.json()["item"]["status"] == "approved"
    # Publish then unpublish (published -> approved) on a suspect: does it require confirm again?
    assert admin.put(f"{API}/admin/testimonials/{tid}/status", json={"status": "published"}).status_code == 200
    pub = requests.get(f"{API}/testimonials?place=home").json()
    me = [t for t in pub if t["id"] == tid]
    assert me and "suspect" not in me[0] and "email" not in me[0]
    un = admin.put(f"{API}/admin/testimonials/{tid}/status", json={"status": "approved"})
    print("unpublish suspect without confirm:", un.status_code, un.text[:120])


# Legacy 'website' field still treated as suspect
def test_legacy_website_suspect(cleanup):
    e = f"test_hp_web_{uuid.uuid4().hex[:6]}@example.com"
    r = submit(payload(e, website="http://x"), cleanup)
    assert r.status_code == 200 and r.json()["saved"] is True
    d = mdb.testimonials.find_one({"email": e})
    assert d["suspect"] is True and d["status"] == "pending"


# Honeypot + validation failure -> refused log
def test_honeypot_refused_logged(cleanup):
    e = f"test_hp_ref_{uuid.uuid4().hex[:6]}@example.com"
    r = submit(payload(e, zx_ctrl="x", elapsed_ms=1000), cleanup)
    assert r.status_code == 400
    time.sleep(1)
    assert "Review honeypot triggered: path=public result=refused http=400" in log_tail()


# Duplicates + too fast
def test_duplicates_and_too_fast(cleanup):
    e = f"test_hp_dup_{uuid.uuid4().hex[:6]}@example.com"
    p = payload(e, kind="product", product_slug="budget-mensuel")
    assert submit(p, cleanup).status_code == 200
    r = submit({**p, "text": p["text"] + " autre"}, cleanup)
    assert r.status_code == 409 and "déjà partagé un avis sur ce produit" in r.json()["detail"]
    r = submit(payload(f"test_hp_dup2_{uuid.uuid4().hex[:6]}@example.com", text=p["text"]), cleanup)
    assert r.status_code == 409 and "déjà été reçu" in r.json()["detail"]
    r = submit(payload(f"test_hp_fast_{uuid.uuid4().hex[:6]}@example.com", elapsed_ms=1000), cleanup)
    assert r.status_code == 400 and "trop rapide" in r.json()["detail"]


# Rate limit: 4th POST within 10 min -> 429
def test_rate_limit(cleanup):
    reset_rate()
    codes = []
    for i in range(4):
        e = f"test_hp_rl{i}_{uuid.uuid4().hex[:6]}@example.com"
        cleanup.append(e)
        codes.append(requests.post(f"{API}/reviews", json=payload(e)).status_code)
    assert codes[:3] == [200, 200, 200] and codes[3] == 429
    reset_rate()
