"""Suppression des données de test (adresse e-mail ou nom contenant « test », insensible à la casse).

Usage : python cleanup_test_data.py            -> simulation (rien n'est supprimé)
        python cleanup_test_data.py --apply    -> suppression définitive
Les commandes liées à une session Stripe LIVE ne sont jamais supprimées : elles sont signalées.
"""
import os
import re
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
RX = re.compile("test", re.I)
APPLY = "--apply" in sys.argv


def has_test(*values):
    return any(RX.search(v or "") for v in values)


def main():
    nl = [s for s in db.newsletter.find({}, {"_id": 1, "email": 1}) if has_test(s.get("email"))]
    msgs = [m for m in db.contact_messages.find({}, {"_id": 1, "email": 1, "name": 1}) if has_test(m.get("email"), m.get("name"))]
    orders, flagged = [], []
    for o in db.orders.find({}, {"_id": 1, "customer_email": 1, "session_id": 1, "amount": 1}):
        if not has_test(o.get("customer_email")):
            continue
        (orders if (o.get("session_id") or "").startswith("cs_test_") else flagged).append(o)
    sessions = [o["session_id"] for o in orders]
    txs = db.payment_transactions.count_documents({"session_id": {"$in": sessions}})

    print(f"Newsletter à supprimer : {len(nl)} / {db.newsletter.count_documents({})}")
    print(f"Messages à supprimer : {len(msgs)} / {db.contact_messages.count_documents({})}")
    print(f"Commandes de test (Stripe TEST) à supprimer : {len(orders)} / {db.orders.count_documents({})}"
          f" + {txs} transaction(s) de test associée(s)")
    for o in flagged:
        print(f"  SIGNALÉE, NON SUPPRIMÉE (session non TEST) : commande {o['_id']} — {o.get('amount')} €")
    if not APPLY:
        print("Simulation uniquement. Relancer avec --apply pour supprimer.")
        return
    db.newsletter.delete_many({"_id": {"$in": [s["_id"] for s in nl]}})
    db.contact_messages.delete_many({"_id": {"$in": [m["_id"] for m in msgs]}})
    db.orders.delete_many({"_id": {"$in": [o["_id"] for o in orders]}})
    db.payment_transactions.delete_many({"session_id": {"$in": sessions}})
    print("Suppression effectuée.")


if __name__ == "__main__":
    main()
