"""Témoignages clients : un seul système (admin « Confiance », formulaire public, invitation après achat)."""
import hashlib
import hmac
import logging
import os
import re
import unicodedata
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr, Field, StrictBool

from database import db
from auth import get_current_admin
from emailer import send_email, review_rejected_html
from newsletter_admin import DeleteConfirm, require_delete_confirmation
from contact_admin import DRY_RUN as EMAIL_DRY_RUN  # même simulation que les e-mails de la messagerie (Preview)

logger = logging.getLogger("reviews")
router = APIRouter(prefix="/api")

STATUSES = ("pending", "approved", "published", "rejected")
RETENTION_DAYS = 90          # avis non publiés (en attente, à publier, refusés) : anonymisés ensuite
INVITE_DAYS = 180            # validité du lien d'avis envoyé après achat
CONSENT_VERSION = "avis-v1-2026-11"
REJECT_REASONS = {
    "spam": "contenu publicitaire ou automatisé (spam)",
    "fake": "témoignage qui ne paraît pas authentique",
    "impersonation": "usurpation d'identité",
    "insult": "propos injurieux ou diffamatoires",
    "illegal": "contenu illicite",
    "off_topic": "contenu sans rapport avec nos produits ou notre marque",
    "third_party": "présence de données personnelles d'un tiers",
    "no_consent": "absence d'autorisation de publication",
    "other": "autre motif",
}
EMAIL_DEFAULTS = {
    "email_title": "Votre avis compte pour nous !",
    "email_text": "Après avoir découvert et testé votre nouvel outil, prenez quelques instants pour nous partager votre expérience. "
                  "Vos retours nous aident à améliorer nos créations et permettent à d'autres personnes de choisir l'outil qui leur correspond.",
    "email_button": "Partager mon avis",
}


def _now():
    return datetime.now(timezone.utc)


def now_iso():
    return _now().isoformat()


def _hash(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()


def _norm_text(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.lower())
    return re.sub(r"[^a-z0-9]+", "", t)


def status_of(t: dict) -> str:
    # Témoignages créés avant l'ajout des statuts : statut déduit des anciennes cases.
    if t.get("status") in STATUSES:
        return t["status"]
    return "published" if t.get("published") and t.get("authentic") else "approved" if t.get("authentic") else "pending"


def mask_email(e: str) -> str:
    local, _, dom = e.partition("@")
    return f"{local[:1]}•••@{dom}" if dom else ""


# --------------------------------------------------------------------------- #
# Conservation (RGPD)
# --------------------------------------------------------------------------- #
async def backfill_status():
    async for t in db.testimonials.find({"status": {"$exists": False}}, {"_id": 0}):
        await db.testimonials.update_one({"id": t["id"]}, {"$set": {
            "status": status_of(t), "source": t.get("source", "admin"),
            "kind": "product" if t.get("product_slug") else "brand",
            "status_changed_at": t.get("updated_at") or now_iso()}})


async def purge():
    cutoff = (_now() - timedelta(days=RETENTION_DAYS)).isoformat()
    res = await db.testimonials.update_many(
        {"status": {"$in": ["pending", "approved", "rejected"]}, "status_changed_at": {"$lt": cutoff}, "anonymized_at": None},
        {"$set": {"name": "Anonyme", "email": "", "text": "", "source_note": "", "order_id": "", "text_hash": "",
                  "rejection_detail": "", "authentic": False, "status": "rejected", "anonymized_at": now_iso()}})
    await db.review_invites.delete_many({"expires_at": {"$lt": now_iso()}})
    if res.modified_count:
        logger.info(f"Témoignages : {res.modified_count} dossier(s) anonymisé(s) (conservation {RETENTION_DAYS} j)")


# --------------------------------------------------------------------------- #
# Invitation après achat (lien dans l'e-mail de livraison)
# --------------------------------------------------------------------------- #
async def email_texts() -> dict:
    doc = await db.site_content.find_one({"key": "avis"}, {"_id": 0, "fields": 1}) or {}
    f = doc.get("fields") or {}
    return {k: (f.get(k) or "").strip() or v for k, v in EMAIL_DEFAULTS.items()}


async def create_invite(order: dict, base_url: str) -> dict:
    """Jeton non prévisible (HMAC secret) : identique à chaque renvoi de l'e-mail, seule son empreinte est stockée."""
    slug = order.get("product_slug") or ""
    texts = await email_texts()
    if not slug:
        return {**texts, "url": f"{base_url}/donner-mon-avis"}
    if await db.review_invites.find_one({"order_id": order["id"], "product_slug": slug, "used_at": {"$ne": None}}, {"_id": 1}):
        return {**texts, "url": f"{base_url}/donner-mon-avis?produit={slug}"}
    token = hmac.new(os.environ["JWT_SECRET"].encode(), f"review-invite:{order['id']}:{slug}".encode(), hashlib.sha256).hexdigest()
    await db.review_invites.update_one(
        {"order_id": order["id"], "product_slug": slug},
        {"$setOnInsert": {"token_hash": _hash(token), "created_at": now_iso(), "used_at": None,
                          "expires_at": (_now() + timedelta(days=INVITE_DAYS)).isoformat()}}, upsert=True)
    return {**texts, "url": f"{base_url}/donner-mon-avis?invitation={token}"}


async def _invite(token: str) -> dict:
    inv = await db.review_invites.find_one({"token_hash": _hash(token or "")}, {"_id": 0})
    if not inv or inv["expires_at"] < now_iso():
        raise HTTPException(404, "Ce lien d'avis n'est plus valable. Vous pouvez tout de même partager votre avis avec le formulaire ci-dessous.")
    if inv.get("used_at"):
        raise HTTPException(409, "Vous avez déjà partagé votre avis pour cet achat. Merci !")
    return inv


def _rate(request: Request, bucket: str, limit: int, window: int):
    from server import check_rate  # limiteur partagé du site
    check_rate(request, bucket, limit, window)


@router.get("/reviews/invitation")
async def invitation_info(token: str, request: Request):
    _rate(request, "review-invite", 30, 60)
    inv = await _invite(token)
    order = await db.orders.find_one({"id": inv["order_id"]}, {"_id": 0, "customer_email": 1})
    product = await db.products.find_one({"slug": inv["product_slug"]}, {"_id": 0, "name": 1})
    if not order or not product:
        raise HTTPException(404, "Ce lien d'avis n'est plus valable.")
    return {"product_slug": inv["product_slug"], "product_name": product["name"], "email_hint": mask_email(order.get("customer_email") or "")}


# --------------------------------------------------------------------------- #
# Formulaire public : enregistré « En attente », jamais publié sans modération.
# --------------------------------------------------------------------------- #
class ReviewSubmit(BaseModel):
    kind: Literal["product", "brand"]
    product_slug: str = Field("", max_length=80)
    name: str = Field(min_length=1, max_length=60)
    email: Optional[EmailStr] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    text: str = Field(min_length=1, max_length=1500)
    consent: StrictBool
    invitation: str = Field("", max_length=100)
    website: str = Field("", max_length=200)
    elapsed_ms: int = 0


@router.post("/reviews")
async def submit_review(inp: ReviewSubmit, request: Request):
    _rate(request, "review", 3, 600)
    _rate(request, "review-day", 10, 86400)
    if inp.website.strip():
        return {"status": "ok"}  # piège à robots : réponse identique, rien n'est enregistré
    if inp.elapsed_ms < 3000:
        raise HTTPException(400, "Envoi trop rapide : prenez quelques secondes pour relire votre avis, puis réessayez.")
    if not inp.consent:
        raise HTTPException(400, "Cochez la case autorisant la publication de votre témoignage.")
    name, text = inp.name.strip(), inp.text.strip()
    if not name:
        raise HTTPException(400, "Indiquez un nom ou un pseudonyme.")
    if len(text) < 10:
        raise HTTPException(400, "Votre témoignage est un peu court : quelques mots de plus nous aideront (10 caractères minimum).")
    await purge()
    doc = {"source": "form", "verified_purchase": False, "order_id": ""}
    if inp.invitation:
        inv = await _invite(inp.invitation)
        order = await db.orders.find_one({"id": inv["order_id"]}, {"_id": 0, "customer_email": 1, "id": 1})
        if not order or not order.get("customer_email"):
            raise HTTPException(404, "Ce lien d'avis n'est plus valable.")
        kind, slug, email = "product", inv["product_slug"], order["customer_email"].lower()
        doc.update(source="order", verified_purchase=True, order_id=order["id"])
    else:
        if not inp.email:
            raise HTTPException(400, "Indiquez votre adresse e-mail (elle ne sera jamais affichée).")
        kind, slug, email = inp.kind, inp.product_slug if inp.kind == "product" else "", str(inp.email).lower()
        if kind == "product" and not await db.products.find_one({"slug": slug}, {"_id": 1}):
            raise HTTPException(400, "Choisissez le produit concerné.")
    text_hash = _hash(_norm_text(text))
    active = {"status": {"$in": ["pending", "approved", "published"]}}
    if await db.testimonials.find_one({**active, "email": email, "kind": kind, "product_slug": slug}, {"_id": 1}):
        what = "ce produit" if kind == "product" else "La Maison d'Auben"
        raise HTTPException(409, f"Vous avez déjà partagé un avis sur {what}. Pour le modifier, écrivez-nous depuis la page Contact.")
    if await db.testimonials.find_one({"text_hash": text_hash}, {"_id": 1}):
        raise HTTPException(409, "Ce témoignage a déjà été reçu. Merci !")
    since = (_now() - timedelta(days=1)).isoformat()
    if await db.testimonials.count_documents({"email": email, "created_at": {"$gt": since}}) >= 3:
        raise HTTPException(429, "Plusieurs avis ont déjà été envoyés avec cette adresse aujourd'hui. Réessayez demain.")
    if inp.invitation:
        claimed = await db.review_invites.find_one_and_update(
            {"token_hash": _hash(inp.invitation), "used_at": None}, {"$set": {"used_at": now_iso()}})
        if not claimed:
            raise HTTPException(409, "Vous avez déjà partagé votre avis pour cet achat. Merci !")
    last = await db.testimonials.find_one({}, {"_id": 0, "order": 1}, sort=[("order", -1)])
    doc.update({
        "id": str(uuid.uuid4()), "name": name, "email": email, "text": text, "rating": inp.rating,
        "kind": kind, "product_slug": slug, "authentic": False, "status": "pending", "source_note": "",
        "text_hash": text_hash, "consent_at": now_iso(), "consent_version": CONSENT_VERSION,
        "order": (last or {}).get("order", -1) + 1, "created_at": now_iso(), "updated_at": now_iso(),
        "status_changed_at": now_iso(), "anonymized_at": None,
    })
    await db.testimonials.insert_one(doc)
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Affichage public : uniquement « Publié » + authentique ; jamais d'e-mail ni de note interne.
# --------------------------------------------------------------------------- #
class TestimonialSettings(BaseModel):
    enabled: bool = False
    show_home: bool = True
    show_products: bool = True


async def _settings() -> dict:
    doc = await db.site_config.find_one({"id": "testimonials"}, {"_id": 0}) or {}
    return {"enabled": bool(doc.get("enabled")), "show_home": doc.get("show_home", True),
            "show_products": doc.get("show_products", True)}


def _public(t: dict) -> dict:
    out = {"id": t["id"], "name": t["name"], "text": t["text"], "product_slug": t.get("product_slug", ""),
           "verified_purchase": bool(t.get("verified_purchase"))}
    if isinstance(t.get("rating"), int) and 1 <= t["rating"] <= 5:
        out["rating"] = t["rating"]
    return out


@router.get("/testimonials")
async def public_testimonials(place: str = "home", product: str = ""):
    if place not in ("home", "product"):
        raise HTTPException(400, "Emplacement inconnu.")
    s = await _settings()
    if not s["enabled"] or (place == "home" and not s["show_home"]) or (place == "product" and not s["show_products"]):
        return []
    q = {"status": "published", "authentic": True}
    if place == "product":
        q["product_slug"] = {"$in": [product, ""]}
    items = await db.testimonials.find(q, {"_id": 0}).sort("order", 1).to_list(50)
    return [_public(t) for t in items if t.get("name", "").strip() and t.get("text", "").strip()]


# --------------------------------------------------------------------------- #
# Administration (onglet « Confiance »)
# --------------------------------------------------------------------------- #
class TestimonialInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=1500)
    rating: Optional[int] = Field(None, ge=1, le=5)
    kind: Literal["product", "brand"] = "brand"
    product_slug: str = ""
    email: str = Field("", max_length=200)
    authentic: bool = False
    source_note: str = Field("", max_length=500)


class StatusInput(BaseModel):
    status: Literal["pending", "approved", "published", "rejected"]
    reason: str = ""
    detail: str = Field("", max_length=500)
    notify: bool = False


class ReorderInput(BaseModel):
    ids: List[str]


def _admin_view(t: dict) -> dict:
    t = {k: v for k, v in t.items() if k not in ("text_hash", "published")}
    t["status"] = status_of(t)
    t.setdefault("source", "admin")
    t.setdefault("kind", "product" if t.get("product_slug") else "brand")
    changed = t.get("status_changed_at") or t.get("updated_at")
    if t["status"] != "published" and not t.get("anonymized_at") and changed:
        t["purge_at"] = (datetime.fromisoformat(changed) + timedelta(days=RETENTION_DAYS)).isoformat()
    return t


async def _get(tid: str) -> dict:
    t = await db.testimonials.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Témoignage introuvable")
    return t


async def _clean(inp: TestimonialInput) -> dict:
    d = inp.model_dump()
    d["name"], d["text"], d["email"] = d["name"].strip(), d["text"].strip(), d["email"].strip().lower()
    if not d["name"] or not d["text"]:
        raise HTTPException(400, "Le nom et le texte sont obligatoires.")
    if d["kind"] == "product":
        if not await db.products.find_one({"slug": d["product_slug"]}, {"_id": 1}):
            raise HTTPException(400, "Choisissez le produit concerné.")
    else:
        d["product_slug"] = ""
    return d


@router.get("/admin/testimonials")
async def admin_testimonials(admin=Depends(get_current_admin)):
    await purge()
    items = await db.testimonials.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return {"settings": await _settings(), "items": [_admin_view(t) for t in items],
            "reasons": REJECT_REASONS, "retention_days": RETENTION_DAYS}


@router.put("/admin/testimonials/settings")
async def admin_testimonial_settings(inp: TestimonialSettings, admin=Depends(get_current_admin)):
    await db.site_config.update_one({"id": "testimonials"}, {"$set": inp.model_dump()}, upsert=True)
    return await _settings()


@router.post("/admin/testimonials")
async def admin_add_testimonial(inp: TestimonialInput, admin=Depends(get_current_admin)):
    last = await db.testimonials.find_one({}, {"_id": 0, "order": 1}, sort=[("order", -1)])
    t = {"id": str(uuid.uuid4()), **await _clean(inp), "status": "pending", "source": "admin", "verified_purchase": False,
         "order": (last or {}).get("order", -1) + 1, "created_at": now_iso(), "updated_at": now_iso(),
         "status_changed_at": now_iso(), "anonymized_at": None}
    await db.testimonials.insert_one(t)
    t.pop("_id", None)
    return _admin_view(t)


@router.put("/admin/testimonials/{tid}")
async def admin_update_testimonial(tid: str, inp: TestimonialInput, admin=Depends(get_current_admin)):
    t = await _get(tid)
    d = await _clean(inp)
    if t.get("verified_purchase") and (d["kind"], d["product_slug"]) != ("product", t.get("product_slug")):
        raise HTTPException(400, "Avis « Achat vérifié » : le produit associé est celui de la commande et ne peut pas être changé.")
    sets = {**d, "text_hash": _hash(_norm_text(d["text"])), "updated_at": now_iso()}
    if not d["authentic"] and status_of(t) in ("approved", "published"):
        sets.update(status="pending", status_changed_at=now_iso())  # plus authentique => retiré du site
    await db.testimonials.update_one({"id": tid}, {"$set": sets})
    return _admin_view(await _get(tid))


ALLOWED = {"pending": {"approved", "rejected"}, "approved": {"published", "rejected", "pending"},
           "published": {"approved", "rejected"}, "rejected": {"pending"}}


async def _notify_rejection(t: dict, inp: "StatusInput") -> bool:
    if EMAIL_DRY_RUN:
        logger.info("Review rejection email SIMULATED (preview)")
        return True
    try:
        return bool(await send_email(to=t["email"], subject="Votre témoignage sur La Maison d'Auben",
                                     html=review_rejected_html(name=t["name"], reason=REJECT_REASONS[inp.reason], detail=inp.detail.strip())))
    except Exception as e:
        logger.error(f"Review rejection email failed: {type(e).__name__}")
        return False


@router.put("/admin/testimonials/{tid}/status")
async def admin_testimonial_status(tid: str, inp: StatusInput, admin=Depends(get_current_admin)):
    t = await _get(tid)
    cur = status_of(t)
    if t.get("anonymized_at"):
        raise HTTPException(400, "Ce témoignage a été anonymisé : il ne peut plus être traité.")
    if inp.status not in ALLOWED[cur]:
        raise HTTPException(400, "Changement de statut impossible depuis le statut actuel.")
    sets = {"status": inp.status, "status_changed_at": now_iso(), "updated_at": now_iso()}
    if inp.status == "approved" and cur == "pending":
        sets["authentic"] = True  # « Valider » = confirmé authentique et autorisé
    if inp.status == "published" and not t.get("authentic"):
        raise HTTPException(400, "Seul un témoignage confirmé comme authentique peut être publié.")
    notified = None
    if inp.status == "rejected":
        if inp.reason not in REJECT_REASONS or (inp.reason == "other" and not inp.detail.strip()):
            raise HTTPException(400, "Indiquez le motif du refus (et précisez-le pour « autre motif »).")
        sets.update(rejection_reason=inp.reason, rejection_detail=inp.detail.strip(), rejected_at=now_iso())
        if inp.notify and t.get("email") and not t.get("author_notified_at"):
            notified = await _notify_rejection(t, inp)
            if notified:
                sets["author_notified_at"] = now_iso()
    await db.testimonials.update_one({"id": tid}, {"$set": sets})
    return {"item": _admin_view(await _get(tid)), "notified": notified, "simulated": bool(notified) and EMAIL_DRY_RUN}


@router.post("/admin/testimonials/{tid}/delete-permanently")
async def admin_delete_testimonial(tid: str, inp: DeleteConfirm, admin=Depends(get_current_admin)):
    require_delete_confirmation(inp)
    res = await db.testimonials.delete_one({"id": tid})
    if not res.deleted_count:
        raise HTTPException(404, "Témoignage introuvable")
    return {"ok": True}


@router.post("/admin/testimonials/reorder")
async def admin_reorder_testimonials(inp: ReorderInput, admin=Depends(get_current_admin)):
    for n, tid in enumerate(inp.ids):
        await db.testimonials.update_one({"id": tid}, {"$set": {"order": n}})
    return {"status": "ok"}
