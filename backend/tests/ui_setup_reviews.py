# UI test fixtures for reviews (setup/teardown by id). Usage: python ui_setup_reviews.py setup|teardown
import os, sys, json, asyncio, uuid, requests
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from pymongo import MongoClient
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
BASE = "https://auben-preview-shop.preview.emergentagent.com"
API = BASE + "/api"
STATE = "/tmp/ui_reviews_state.json"

if sys.argv[1] == "setup":
    s = requests.Session()
    s.headers["Authorization"] = "Bearer " + requests.post(f"{API}/admin/login", json={"email": "admin@lamaisondauben.fr", "password": "Auben2026!"}).json()["access_token"]
    t = s.post(f"{API}/admin/testimonials", json={"name": "TEST_UIReview", "text": "TEST_ avis UI pour signalement", "kind": "brand", "product_slug": "",
                                                  "email": "test_ui_rev@example.com", "authentic": False, "source_note": "", "rating": 5, "experience_month": "2026-08"}).json()
    s.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "approved"})
    s.put(f"{API}/admin/testimonials/{t['id']}/status", json={"status": "published"})
    oid = "TEST-REVIEW-ORDER-UI-" + uuid.uuid4().hex[:6]
    mdb.orders.insert_one({"id": oid, "product_slug": "budget-mensuel", "customer_email": "test_ui_buyer@example.com",
                           "session_id": "cs_test_fake_" + oid, "test_fixture": True})
    from reviews import create_invite
    url = asyncio.new_event_loop().run_until_complete(create_invite({"id": oid, "product_slug": "budget-mensuel"}, BASE))["url"]
    json.dump({"tid": t["id"], "oid": oid, "url": url}, open(STATE, "w"))
    print(json.dumps({"tid": t["id"], "oid": oid, "url": url}))
else:
    st = json.load(open(STATE))
    print(mdb.testimonials.delete_many({"id": st["tid"]}).deleted_count,
          mdb.testimonials.delete_many({"order_id": st["oid"]}).deleted_count,
          mdb.testimonials.delete_many({"email": {"$regex": "^test_ui_.*@example.com$"}}).deleted_count,
          mdb.review_invites.delete_many({"order_id": st["oid"]}).deleted_count,
          mdb.orders.delete_many({"id": st["oid"], "test_fixture": True}).deleted_count)
    mdb.rate_hits.delete_many({"bucket": {"$in": ["review", "review-day", "review-report", "review-invite"]}})
