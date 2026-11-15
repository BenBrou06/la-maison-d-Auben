# Renouvellement des liens de téléchargement depuis l'admin (sans nouvelle commande ni paiement).
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_admin
from contact_admin import DRY_RUN, deliver
from database import db
from emailer import order_confirmation_html
from storage import get_object

logger = logging.getLogger("download_renewal")
router = APIRouter(prefix="/admin/orders")

TTL_DAYS = 30
DEFAULT_LIMIT = 25
EXCEPTION_WORD = "RENOUVELER"
SIM_FAIL = "+simuler-echec@"
PUBLIC_BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")
ENV_LIVE = (os.environ.get("STRIPE_MODE") or "test").strip().lower() == "live"
STATE_LABEL = {
    "valid": "Valide", "expired": "Expiré", "exhausted": "Limite de téléchargements atteinte",
    "invalid": "Invalide — à renouveler", "file_missing": "Fichier indisponible",
}


def now() -> datetime:
    return datetime.now(timezone.utc)


def link_of(order: dict) -> Optional[str]:
    return f"{PUBLIC_BASE_URL}/telechargement/{order['download_token']}" if order.get("download_token") else None


def payment_mode(order: dict) -> str:
    sid = order.get("session_id") or ""
    return "live" if sid.startswith("cs_live_") else "test" if sid.startswith("cs_test_") else "unknown"


def download_state(order: dict, product: Optional[dict]) -> str:
    if not product or not product.get("download_storage_path"):
        return "file_missing"
    if not order.get("download_token") or not order.get("download_expires_at"):
        return "invalid"
    try:
        if now() > datetime.fromisoformat(order["download_expires_at"]):
            return "expired"
    except ValueError:
        return "invalid"
    if (order.get("download_count") or 0) >= (order.get("download_limit") or DEFAULT_LIMIT):
        return "exhausted"
    return "valid"


def renew_blocker(order: dict) -> Optional[str]:
    """Raison (sans appel Stripe) empêchant tout renouvellement, exception comprise."""
    if order.get("status") != "paid":
        return "Commande non payée : aucun lien ne peut être généré."
    mode = payment_mode(order)
    if ENV_LIVE and mode == "test":
        return "Commande TEST (paiement fictif) : pas de renouvellement sur le site officiel."
    if not ENV_LIVE and mode == "live":
        return "Commande réelle : à renouveler depuis l'administration du site officiel."
    return None


def admin_view(order: dict, product: Optional[dict]) -> dict:
    state = download_state(order, product)
    return {"download_state": state, "download_state_label": STATE_LABEL[state], "payment_mode": payment_mode(order),
            "renew_blocker": renew_blocker(order), "download_url": link_of(order)}


def verify_payment(order: dict) -> dict:
    """{"ok"} / {"refused": raison} / {"unverifiable": raison} — lecture seule côté Stripe."""
    sid = order.get("session_id") or ""
    if payment_mode(order) == "unknown":
        return {"unverifiable": "Aucune session de paiement Stripe exploitable n'est enregistrée pour cette commande."}
    try:
        s = stripe.checkout.Session.retrieve(sid, expand=["payment_intent.latest_charge"])
    except stripe.error.InvalidRequestError:
        return {"unverifiable": "Stripe ne retrouve plus la session de paiement de cette commande."}
    except stripe.error.StripeError as e:
        return {"unverifiable": f"Stripe est injoignable pour le moment ({type(e).__name__}). Réessayez plus tard."}
    if s.payment_status != "paid":
        return {"refused": "Stripe indique que cette commande n'est pas payée."}
    pi = s.payment_intent
    charge = getattr(pi, "latest_charge", None) if pi and not isinstance(pi, str) else None
    if pi is not None and not charge:
        return {"unverifiable": "Le détail du paiement n'a pas pu être lu chez Stripe."}
    if charge:
        if getattr(charge, "refunded", False) or (getattr(charge, "amount_refunded", 0) or 0) > 0:
            return {"refused": "Cette commande a été remboursée : aucun nouveau lien ne peut être généré."}
        if getattr(charge, "disputed", False):
            return {"refused": "Ce paiement fait l'objet d'une contestation bancaire : renouvellement bloqué."}
    return {"ok": True}


async def _log(order_id: str, admin: dict, result: str, method: str = None, detail: str = None, reason: str = None):
    await db.download_renewals.insert_one({
        "id": str(uuid.uuid4()), "order_id": order_id, "at": now().isoformat(), "admin": admin.get("email"),
        "result": result, "method": method, "detail": detail, "reason": reason})


class RenewInput(BaseModel):
    exception_confirmation: Optional[str] = Field(default=None, max_length=20)
    exception_reason: Optional[str] = Field(default=None, max_length=500)


@router.post("/{order_id}/renew-download")
async def renew_download(order_id: str, inp: RenewInput, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Commande introuvable.")
    blocker = renew_blocker(order)
    if blocker:
        await _log(order_id, admin, "refused", detail=blocker)
        raise HTTPException(403, blocker)
    product = await db.products.find_one({"slug": order.get("product_slug")}, {"_id": 0})
    path = (product or {}).get("download_storage_path")
    try:
        if not path:
            raise LookupError
        get_object(path)
    except Exception:
        msg = "Le fichier de ce produit est introuvable dans le stockage : ajoutez-le dans « Produits » avant de renouveler."
        await _log(order_id, admin, "refused", detail="fichier indisponible")
        raise HTTPException(409, msg)
    check = verify_payment(order)
    method, reason = "stripe", None
    if check.get("refused"):
        await _log(order_id, admin, "refused", detail=check["refused"])
        raise HTTPException(403, check["refused"])
    if check.get("unverifiable"):
        reason = (inp.exception_reason or "").strip()
        if inp.exception_confirmation != EXCEPTION_WORD or len(reason) < 10:
            raise HTTPException(409, {"code": "needs_exception", "message": check["unverifiable"]})
        method = "exception"
    token = secrets.token_urlsafe(32)
    expires = (now() + timedelta(days=TTL_DAYS)).isoformat()
    entry = {"at": now().isoformat(), "admin": admin.get("email"), "method": method, "reason": reason}
    res = await db.orders.update_one(
        {"id": order_id, "download_token": order.get("download_token"),
         "$or": [{"download_renewed_at": {"$exists": False}}, {"download_renewed_at": {"$lt": (now() - timedelta(seconds=15)).isoformat()}}]},
        {"$set": {"download_token": token, "download_expires_at": expires, "download_count": 0,
                  "download_limit": order.get("download_limit") or DEFAULT_LIMIT, "download_renewed_at": entry["at"],
                  "link_email_status": None},
         "$inc": {"download_renewal_count": 1}, "$push": {"download_renewals": entry}})
    if not res.modified_count:
        await _log(order_id, admin, "conflict")
        raise HTTPException(409, "Un autre renouvellement vient d'être effectué pour cette commande : actualisez la page.")
    await _log(order_id, admin, "renewed", method=method, reason=reason)
    logger.info(f"Lien de téléchargement renouvelé (commande {order_id}, méthode {method})")
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {**updated, **admin_view(updated, product), "renewal_method": method}


@router.post("/{order_id}/send-download-link")
async def send_download_link(order_id: str, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Commande introuvable.")
    if renew_blocker(order):
        raise HTTPException(403, renew_blocker(order))
    product = await db.products.find_one({"slug": order.get("product_slug")}, {"_id": 0})
    if download_state(order, product) != "valid":
        raise HTTPException(409, "Le lien actuel n'est pas valide : renouvelez-le avant de l'envoyer.")
    if not order.get("customer_email"):
        raise HTTPException(409, "Aucune adresse e-mail n'est enregistrée pour cette commande.")
    stale = (now() - timedelta(minutes=2)).isoformat()
    claim = await db.orders.update_one(
        {"id": order_id, "download_token": order["download_token"],
         "$or": [{"link_email_status": {"$ne": "sending"}}, {"link_email_at": {"$lt": stale}}]},
        {"$set": {"link_email_status": "sending", "link_email_at": now().isoformat()}})
    if not claim.modified_count:
        raise HTTPException(409, "Un envoi est déjà en cours pour cette commande.")
    to = order["customer_email"]
    html = order_confirmation_html(product_name=order["product_name"], amount=order["amount"], currency=order["currency"],
                                   download_url=link_of(order), order_id=order["id"],
                                   withdrawal_consent=order.get("withdrawal_consent"))
    if DRY_RUN and SIM_FAIL in to:
        r = {"id": None, "kind": "temporary", "error": "Échec simulé (fournisseur indisponible)."}
    else:
        r = await deliver(to=to, subject=f"Votre lien de téléchargement — {order['product_name']}", html=html)
    ok = bool(r.get("id"))
    await db.orders.update_one({"id": order_id}, {
        "$set": {"link_email_status": "sent" if ok else "failed", "link_email_at": now().isoformat()},
        "$push": {"download_link_emails": {"at": now().isoformat(), "admin": admin.get("email"), "ok": ok,
                                           "email_id": r.get("id"), "error": None if ok else r.get("kind"),
                                           "simulated": DRY_RUN}}})
    await _log(order_id, admin, "email_sent" if ok else "email_failed", detail=None if ok else r.get("kind"))
    if not ok:
        raise HTTPException(424, "L'e-mail n'a pas pu être envoyé. Le nouveau lien reste valable : copiez-le ou réessayez.")
    return {"ok": True, "simulated": DRY_RUN, "to": to}
