import re

# Garde-fou pur (aucun appel Stripe) : une commande n'est supprimable que si elle est clairement en mode Stripe TEST.
_TEST_SESSION = re.compile(r"^cs_test_[A-Za-z0-9]+$")


def order_deletion_blockers(order: dict, txs: list) -> list:
    reasons = []
    sid = order.get("session_id") or ""
    if sid.startswith("cs_live_"):
        reasons.append("Commande liée à une session Stripe LIVE (paiement réel) : suppression interdite.")
    elif not _TEST_SESSION.match(sid):
        reasons.append("Session Stripe absente ou de format inconnu : mode de paiement non vérifiable.")
    if order.get("livemode") is True:
        reasons.append("La commande est marquée comme réelle (livemode).")
    if not txs:
        reasons.append("Aucune transaction associée vérifiable pour cette session.")
    for t in txs:
        if t.get("session_id") != sid or not _TEST_SESSION.match(t.get("session_id") or "") or t.get("livemode") is True:
            reasons.append("Une transaction associée n'est pas clairement en mode Stripe TEST.")
            break
    return reasons
