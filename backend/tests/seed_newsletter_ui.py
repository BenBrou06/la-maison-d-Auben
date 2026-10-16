# Seed/cleanup fictif-qa-ui- newsletter rows for UI testing. Usage: python seed_newsletter_ui.py [--clean]
import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
P = "fictif-qa-ui-"
NOW = "2026-06-01T10:00:00+00:00"


def ok(n, **kw):
    d = dict(id=f"{P}{n}", email=f"{P}{n}@exemple-fictif.fr", status="subscribed", consent=True, consent_at=NOW,
             consent_text_version="newsletter-v1-2026-06", unsubscribe_token=f"{P}tok-{n}", created_at=NOW)
    d.update(kw)
    return d


db.newsletter.delete_many({"id": {"$regex": "^" + P}})
db.newsletter_campaigns.delete_many({"subject": {"$regex": "^QA-UI"}})
if "--clean" not in sys.argv:
    db.newsletter.insert_many([ok("a"), ok("b"), ok("flagged", is_test=True), ok("unsub", status="unsubscribed", unsubscribed_at=NOW),
                               ok("legacy", consent=None, consent_at=None, consent_text_version=None)])
    print("seeded")
else:
    print("cleaned")
