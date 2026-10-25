"""Nettoyage des données de test — simulation par défaut, aucune suppression sans empreinte validée.

  python cleanup_test_data.py                              -> simulation détaillée + empreinte
  python cleanup_test_data.py --apply --fingerprint=XXXX   -> supprime exactement la cible simulée

Critères :
  - newsletter : e-mail contenant « test » (insensible à la casse)
  - contact_messages : e-mail ou nom contenant « test »
  - orders : e-mail contenant « test » ET garde-fou order_guard satisfait (session + transactions Stripe TEST)
    sinon : signalée, jamais supprimée
  - payment_transactions sans commande : session cs_test_ non payée -> supprimable ;
    cs_test_ payée -> signalée ; cs_live_ ou format inconnu -> jamais touchée
Aucun appel Stripe, aucun e-mail.
"""
import hashlib
import os
import re
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

from order_guard import order_deletion_blockers

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
RX = re.compile("test", re.I)
# Mots réels contenant « test » : à relire avant validation (faux positifs possibles).
RISKY = re.compile(r"(attest|contest|protest|detest|testa|teste[a-z]|celest)", re.I)


def has_test(*values):
    return any(RX.search(v or "") for v in values)


def build_plan():
    plan = {"newsletter": [], "messages": [], "orders": [], "order_txs": [], "orphan_txs": [], "flagged": []}
    for s in db.newsletter.find({}, {"_id": 0, "id": 1, "email": 1}):
        if has_test(s.get("email")):
            plan["newsletter"].append(s)
    for m in db.contact_messages.find({}, {"_id": 0, "id": 1, "email": 1, "name": 1}):
        if has_test(m.get("email"), m.get("name")):
            plan["messages"].append(m)
    order_sids = set()
    for o in db.orders.find({}, {"_id": 0}):
        order_sids.add(o.get("session_id"))
        if not has_test(o.get("customer_email")):
            continue
        txs = list(db.payment_transactions.find({"session_id": o.get("session_id")}, {"_id": 0})) if o.get("session_id") else []
        blockers = order_deletion_blockers(o, txs)
        if blockers:
            plan["flagged"].append(f"Commande {o['id']} ({o.get('customer_email')}, {o.get('amount')} €) : {' '.join(blockers)}")
        else:
            plan["orders"].append(o)
            plan["order_txs"] += [t["session_id"] for t in txs]
    for t in db.payment_transactions.find({}, {"_id": 0, "session_id": 1, "payment_status": 1, "amount": 1}):
        sid = t.get("session_id") or ""
        if sid in order_sids:
            continue
        if re.match(r"^cs_test_[A-Za-z0-9]+$", sid) and t.get("payment_status") != "paid":
            plan["orphan_txs"].append(t)
        elif sid.startswith("cs_test_"):
            plan["flagged"].append(f"Transaction TEST payée sans commande {sid[:20]}… : non supprimée")
        else:
            plan["flagged"].append(f"Transaction {sid[:12]}… ({t.get('payment_status')}) non TEST : jamais touchée")
    return plan


def fingerprint(plan):
    ids = sorted(
        [f"n:{s['id']}" for s in plan["newsletter"]] + [f"m:{m['id']}" for m in plan["messages"]]
        + [f"o:{o['id']}" for o in plan["orders"]] + [f"t:{s}" for s in plan["order_txs"]]
        + [f"t:{t['session_id']}" for t in plan["orphan_txs"]]
    )
    return hashlib.sha256("|".join(ids).encode()).hexdigest()[:12]


def report(plan):
    print("== Newsletter (e-mail contenant « test ») :", len(plan["newsletter"]), "/", db.newsletter.count_documents({}))
    for s in plan["newsletter"]:
        print("   -", s["email"], "  <- À RELIRE (faux positif possible)" if RISKY.search(s["email"]) else "")
    print("== Messages (nom ou e-mail contenant « test ») :", len(plan["messages"]), "/", db.contact_messages.count_documents({}))
    for m in plan["messages"]:
        print("   -", m.get("name"), "<" + (m.get("email") or "") + ">")
    print("== Commandes Stripe TEST vérifiées :", len(plan["orders"]), "/", db.orders.count_documents({}),
          f"(+ {len(plan['order_txs'])} transaction(s) TEST associée(s))")
    for o in plan["orders"]:
        print("   -", o["id"], o.get("customer_email"), o.get("amount"), o.get("session_id", "")[:20] + "…")
    print("== Transactions Stripe TEST non payées sans commande :", len(plan["orphan_txs"]), "/",
          db.payment_transactions.count_documents({}))
    print("== Signalé, NON supprimé :", len(plan["flagged"]))
    for f in plan["flagged"]:
        print("   !", f)
    print("Empreinte de cette simulation :", fingerprint(plan))


def apply(plan):
    db.newsletter.delete_many({"id": {"$in": [s["id"] for s in plan["newsletter"]]}})
    db.contact_messages.delete_many({"id": {"$in": [m["id"] for m in plan["messages"]]}})
    db.orders.delete_many({"id": {"$in": [o["id"] for o in plan["orders"]]}})
    sids = plan["order_txs"] + [t["session_id"] for t in plan["orphan_txs"]]
    db.payment_transactions.delete_many({"session_id": {"$in": [s for s in sids if s.startswith("cs_test_")]},
                                         "livemode": {"$ne": True}})


def main():
    plan = build_plan()
    report(plan)
    if "--apply" not in sys.argv:
        print("Simulation uniquement : aucune donnée modifiée.")
        return
    given = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--fingerprint=")), "")
    if given != fingerprint(plan):
        print("REFUS : empreinte absente ou différente de la simulation validée. Aucune suppression.")
        sys.exit(1)
    apply(plan)
    after = build_plan()
    print("Suppression effectuée. Vérification après coup :",
          {k: len(v) for k, v in after.items() if k != "flagged"}, "| signalés :", len(after["flagged"]))


if __name__ == "__main__":
    main()
