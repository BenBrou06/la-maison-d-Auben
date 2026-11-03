# Seed TEST_ contact messages for UI testing of admin Messages panel (only @contact-test.example.com)
import os, uuid, requests, json
from datetime import datetime, timezone
from pymongo import MongoClient

BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
env = dict(l.split("=", 1) for l in open("/app/backend/.env").read().splitlines() if "=" in l)
db = MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]

for name, msg in [("TEST_UI cvv", "Bonjour, mon cvv a-t-il été prélevé ? TEST_UI"),
                  ("TEST_UI echec", "Message avec [SIMULER-ECHEC] TEST_UI")]:
    r = requests.post(f"{BASE}/api/contact", json={"name": name, "email": f"{name.split()[1]}@contact-test.example.com",
                                                    "subject": f"{name} sujet", "message": msg})
    print(name, r.status_code, r.text[:100])

now = datetime.now(timezone.utc).isoformat()
uid, lid = str(uuid.uuid4()), str(uuid.uuid4())
db.contact_messages.insert_one({"id": uid, "name": "TEST_UI uncertain", "email": "uncertain@contact-test.example.com",
    "subject": "TEST_UI uncertain sujet", "message": "TEST_UI incertain", "created_at": now, "status": "new",
    "replies": [], "owner_notification": {"status": "uncertain", "attempts": 1, "next_at": now, "started_at": now, "uncertain_at": now},
    "confirmation": {"status": "sent", "attempts": 1, "simulated": True, "sent_at": now, "email_id": "simulated-x"}})
db.contact_messages.insert_one({"id": lid, "name": "TEST_UI legacy", "email": "legacy@contact-test.example.com",
    "subject": "TEST_UI legacy sujet", "message": "TEST_UI ancien message", "created_at": now, "status": "new",
    "followup_consent": False})
print(json.dumps({"uncertain": uid, "legacy": lid}))
for d in db.contact_messages.find({"email": {"$regex": "@contact-test\\.example\\.com$"}}, {"_id": 0, "id": 1, "name": 1}):
    print(d)
