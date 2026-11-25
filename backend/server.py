import os
import re
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import stripe
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Response
from starlette.middleware.cors import CORSMiddleware
from cors_config import cors_origins
from pydantic import BaseModel, EmailStr, Field, StrictBool, field_validator
from pymongo.errors import DuplicateKeyError
from starlette.responses import JSONResponse

from database import db
from auth import hash_password, verify_password, create_access_token, get_current_admin
from newsletter_admin import (router as newsletter_router, mark_interrupted_campaigns, has_valid_consent,
                              require_delete_confirmation, DeleteConfirm)
from order_guard import order_deletion_blockers
from product_rules import (DEFAULT_CURRENCY, commercial_issues, derive_lookup, effective_currency,
                           effective_lookup, lookup_owners, valid_lookup)
from content_admin import router as content_router, ordered_articles
from stripe_keys import select_stripe_keys, preflight_new_live, LIVE_ACCOUNT_ID
from contact_admin import (router as contact_router, new_job as contact_job, schedule as schedule_contact,
                           start_worker as start_contact_worker, NOTICE_VERSION as CONTACT_NOTICE_VERSION)
from download_renewal import router as renewal_router, admin_view as download_admin_view
from merch import router as merch_router, pricing_of, reassurance_for, promo_status
from storage import put_object, get_object, delete_object, init_storage, APP_NAME, MIME_TYPES
from emailer import send_email, order_confirmation_html, owner_sale_notification_html
import seed_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- Configuration Stripe (secrets uniquement via variables d'environnement) ---
_STRIPE = select_stripe_keys(os.environ)
STRIPE_SECRET_KEY = _STRIPE["secret"]
STRIPE_MODE = (os.environ.get("STRIPE_MODE") or "test").strip().lower()
STRIPE_WEBHOOK_SECRET = _STRIPE["webhook"]

# Aucun fallback test : si la clé est absente, échec explicite (pas de mode Test silencieux).
if not STRIPE_SECRET_KEY:
    raise RuntimeError(
        "CONFIG ERROR: STRIPE_SECRET_KEY est absente. Configurez le secret Stripe côté serveur "
        "(variables d'environnement / Secrets). Aucun fallback vers une clé de test n'est autorisé."
    )

_is_live_key = STRIPE_SECRET_KEY.startswith(("sk_live_", "rk_live_"))
_is_test_key = STRIPE_SECRET_KEY.startswith(("sk_test_", "rk_test_"))

# Cohérence mode <-> type de clé : empêche un déploiement "prod" de tourner en Test par erreur.
if STRIPE_MODE == "live" and not _is_live_key:
    raise RuntimeError(
        "CONFIG ERROR: STRIPE_MODE=live mais STRIPE_SECRET_KEY n'est pas une clé live "
        "(attendu sk_live_... ou rk_live_...). Refus de démarrer pour éviter un paiement en Test en production."
    )
if STRIPE_MODE != "live" and _is_live_key and os.environ.get("STRIPE_ALLOW_LIVE", "").strip() != "1":
    raise RuntimeError(
        "CONFIG ERROR: une clé Stripe LIVE est configurée alors que STRIPE_MODE != 'live'. "
        "Refus de démarrer pour éviter de vrais débits en environnement de test/preview. "
        "Passez STRIPE_MODE=live en production, ou utilisez une clé de test en preview "
        "(override volontaire : STRIPE_ALLOW_LIVE=1)."
    )
if STRIPE_MODE == "live" and not STRIPE_WEBHOOK_SECRET:
    raise RuntimeError(
        "CONFIG ERROR: STRIPE_MODE=live sans STRIPE_WEBHOOK_SECRET. "
        "Le webhook signé est le mécanisme principal de livraison en production : "
        "configurez le whsec_ de l'endpoint LIVE avant de démarrer."
    )

# URL serveur de confiance (jamais fournie par le client) pour les URLs Stripe et les liens e-mail.
PUBLIC_BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
if STRIPE_MODE == "live" and not PUBLIC_BASE_URL.startswith("https://"):
    raise RuntimeError("CONFIG ERROR: PUBLIC_BASE_URL (https) est requise en production.")

stripe.api_key = STRIPE_SECRET_KEY
if _STRIPE["environment"] == "production" and _STRIPE["source"] == "NEW_STRIPE_*":
    try:
        _acct = stripe.Account.retrieve().id
    except Exception as e:
        _acct = None
        logger.warning("Stripe : compte non vérifiable au démarrage (%s).", type(e).__name__)
    if _acct and _acct != LIVE_ACCOUNT_ID:
        raise RuntimeError("CONFIG ERROR (Stripe) : NEW_STRIPE_SECRET_KEY appartient à un autre compte que celui attendu. Refus de démarrer.")
    logger.info("Stripe : compte LIVE %s", "vérifié" if _acct else "non vérifié")
if _STRIPE["environment"] == "production" and _STRIPE["source"] == "STRIPE_*":
    _pf = preflight_new_live(os.environ, STRIPE_WEBHOOK_SECRET, lambda k: stripe.Account.retrieve(api_key=k).id)
    logger.info("Contrôle NEW_STRIPE_* LIVE (lecture seule) | " + " | ".join(f"{k}={'oui' if v is True else 'non' if v is False else v}" for k, v in _pf.items()))
logger.info("Stripe initialisé | env=%s | source=%s | mode=%s | cle=%s", _STRIPE["environment"], _STRIPE["source"], STRIPE_MODE, "live" if _is_live_key else ("test" if _is_test_key else "inconnue"))

DOWNLOAD_TTL_DAYS = 30
DOWNLOAD_LIMIT = 25

# Uploads admin : garde-fous (taille, extensions, MIME)
MAX_IMAGE_BYTES = 8 * 1024 * 1024      # 8 Mo
MAX_FILE_BYTES = 50 * 1024 * 1024      # 50 Mo
ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp", "gif"}
ALLOWED_IMAGE_MIME = {"image/png", "image/jpeg", "image/webp", "image/gif"}
ALLOWED_FILE_EXT = {"xlsx", "xls", "csv", "pdf", "zip"}
ALLOWED_FILE_MIME = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel", "text/csv", "application/pdf", "application/zip",
    "application/octet-stream",
}


def safe_ext(filename: str) -> str:
    name = os.path.basename(filename or "")
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def sanitize_filename(filename: str, fallback: str) -> str:
    name = os.path.basename(filename or "").replace("\\", "").strip()
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name or fallback


# Rate limiting in-memory (fenêtre glissante), sans dépendance externe.
from collections import defaultdict, deque
import time as _time
_rl_store = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # Chaîne observée (Preview, même infra que la prod) : X-Forwarded-For = "<valeurs client éventuelles>,
    # <IP client ajoutée par Cloudflare>, <IP du nœud Cloudflare>, <IP du load balancer>". Les valeurs de gauche
    # sont fournies par le client (falsifiables) : on prend la 3e en partant de la droite, posée par Cloudflare.
    parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    if len(parts) >= TRUSTED_PROXY_HOPS + 1:
        return parts[-(TRUSTED_PROXY_HOPS + 1)]
    return request.client.host if request.client else "unknown"


TRUSTED_PROXY_HOPS = 2


def check_rate(request: Request, bucket: str, limit: int, window: int = 60):
    key = f"{bucket}:{_client_ip(request)}"
    now = _time.time()
    dq = _rl_store[key]
    while dq and dq[0] <= now - window:
        dq.popleft()
    if len(dq) >= limit:
        raise HTTPException(429, "Trop de requêtes. Merci de réessayer dans une minute.")
    dq.append(now)

app = FastAPI(title="La Maison d'Auben API")
api = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean(doc: dict) -> dict:
    if doc:
        doc.pop("_id", None)
    return doc


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
NEWSLETTER_CONSENT_VERSION = "newsletter-v1-2026-06"
NEWSLETTER_CONSENT_TEXT = "J'accepte de recevoir la newsletter et j'ai lu la politique de confidentialité."
WITHDRAWAL_CONSENT_VERSION = "retractation-v1-2026-06"
WITHDRAWAL_CONSENT_TEXT = (
    "Je demande l'accès immédiat au fichier numérique dès la confirmation du paiement et je reconnais "
    "perdre mon droit de rétractation dès le début de cette fourniture (article L.221-28, 13° du Code de la consommation)."
)


class NewsletterInput(BaseModel):
    email: EmailStr
    consent: StrictBool


class UnsubscribeInput(BaseModel):
    token: str


class ContactInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=254)
    subject: str = Field("", max_length=200)
    message: str = Field(min_length=1, max_length=5000)

    @field_validator("name", "message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Champ obligatoire.")
        return v.strip()


class CheckoutInput(BaseModel):
    lookup_key: str
    origin_url: str
    withdrawal_waiver: StrictBool = False
    withdrawal_consent_version: str = ""


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ProductInput(BaseModel):
    slug: Optional[str] = None
    name: str
    category_slug: str
    lookup_key: Optional[str] = None
    price: Optional[float] = None
    currency: str = "eur"
    badge: Optional[str] = None
    status: str = "available"
    short_description: str = ""
    description: str = ""
    audience: str = ""
    features: List[dict] = []
    contents: List[str] = []
    compatibility: List[str] = []
    faq: List[dict] = []
    seo: dict = {}
    gallery: List[dict] = []


class ProductUpdateInput(BaseModel):
    """Mise à jour PARTIELLE : seuls les champs explicitement fournis sont modifiés."""
    name: Optional[str] = None
    category_slug: Optional[str] = None
    lookup_key: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    badge: Optional[str] = None
    status: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    audience: Optional[str] = None
    features: Optional[List[dict]] = None
    contents: Optional[List[str]] = None
    compatibility: Optional[List[str]] = None
    faq: Optional[List[dict]] = None
    seo: Optional[dict] = None
    gallery: Optional[List[dict]] = None
    main_image: Optional[str] = None
    benefits: Optional[List[dict]] = None
    practical: Optional[dict] = None
    reassurance_hidden: Optional[List[str]] = None
    reassurance_extra: Optional[List[dict]] = None


# --------------------------------------------------------------------------- #
# Public content
# --------------------------------------------------------------------------- #
@api.get("/")
async def root():
    return {"message": "La Maison d'Auben API"}


@api.get("/settings")
async def get_settings():
    return clean(await db.settings.find_one({"id": "site"})) or {}


@api.get("/categories")
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return cats


def lookup_of(p: dict):
    # Clé Stripe du produit ; déduite du slug si absente en base (avertissement journalisé).
    return effective_lookup(p, warn=True)


def with_purchasable(p):
    """Achetable = vrai fichier + prix positif + devise + référence Stripe valide."""
    if p is not None:
        p["purchasable"] = not commercial_issues(p)
        p["lookup_key"] = lookup_of(p)
        p["currency"] = effective_currency(p, warn=True)
        p["pricing"] = pricing_of(p)
        p.pop("promotion", None)
        p["download_terms"] = {"days": DOWNLOAD_TTL_DAYS, "limit": DOWNLOAD_LIMIT}
    return p


@api.get("/products")
async def get_products(category: Optional[str] = None, q: Optional[str] = None, sort: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category_slug"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"short_description": {"$regex": q, "$options": "i"}},
        ]
    items = await db.products.find(query, {"_id": 0}).to_list(500)
    # available first, then coming_soon
    order = {"available": 0, "coming_soon": 1}
    items.sort(key=lambda p: (order.get(p.get("status"), 2), p.get("name", "")))
    items = [with_purchasable(p) for p in items]
    if sort == "price_asc":
        items.sort(key=lambda p: p["pricing"]["final"] or 9999)
    elif sort == "price_desc":
        items.sort(key=lambda p: p["pricing"]["final"] or -1, reverse=True)
    return items


@api.get("/products/{slug}")
async def get_product(slug: str):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    p["reassurance"] = await reassurance_for(p)
    return with_purchasable(p)


@api.get("/articles")
async def get_articles(category: Optional[str] = None):
    query = {"published": {"$ne": False}}
    if category:
        query["category"] = category
    return ordered_articles(await db.articles.find(query, {"_id": 0}).to_list(200))


@api.get("/articles/{slug}")
async def get_article(slug: str):
    a = await db.articles.find_one({"slug": slug, "published": {"$ne": False}}, {"_id": 0})
    if not a:
        moved = await db.articles.find_one({"previous_slugs": slug, "published": {"$ne": False}}, {"_id": 0, "slug": 1})
        if moved:
            return {"redirect_to": moved["slug"]}
        raise HTTPException(404, "Article introuvable")
    related = []
    for ps in a.get("related_product_slugs", []):
        p = await db.products.find_one({"slug": ps}, {"_id": 0})
        if p:
            related.append(with_purchasable(p))
    a["related_products"] = related
    return a


@api.get("/faq")
async def get_faq():
    return await db.faq.find({}, {"_id": 0}).sort("order", 1).to_list(200)


@api.post("/newsletter")
async def subscribe_newsletter(request: Request, inp: NewsletterInput):
    check_rate(request, "newsletter", 10)
    if inp.consent is not True:
        raise HTTPException(400, "Le consentement est requis.")
    email = inp.email.lower()
    consent = {
        "consent": True, "consent_at": now_iso(),
        "consent_text_version": NEWSLETTER_CONSENT_VERSION, "consent_text": NEWSLETTER_CONSENT_TEXT,
        "status": "subscribed", "unsubscribed_at": None,
    }
    existing = await db.newsletter.find_one({"email": email})
    if existing and existing.get("status") != "unsubscribed" and has_valid_consent(existing):
        return {"status": "already", "message": "Vous êtes déjà inscrit·e. Merci !"}
    if existing:
        if not existing.get("unsubscribe_token"):
            consent["unsubscribe_token"] = secrets.token_urlsafe(32)
        await db.newsletter.update_one({"email": email}, {"$set": consent})
    else:
        await db.newsletter.insert_one({
            "id": str(uuid.uuid4()), "email": email, "created_at": now_iso(),
            "unsubscribe_token": secrets.token_urlsafe(32), **consent,
        })
    return {"status": "ok", "message": "Merci ! Vous êtes bien inscrit·e."}


@api.post("/newsletter/unsubscribe")
async def unsubscribe_newsletter(request: Request, inp: UnsubscribeInput):
    check_rate(request, "newsletter-unsub", 10)
    sub = await db.newsletter.find_one({"unsubscribe_token": inp.token}) if inp.token else None
    if not sub:
        raise HTTPException(404, "Lien de désinscription invalide.")
    if sub.get("status") != "unsubscribed":
        await db.newsletter.update_one({"unsubscribe_token": inp.token}, {"$set": {
            "status": "unsubscribed", "consent": False, "unsubscribed_at": now_iso()}})
    return {"status": "ok", "message": "Vous êtes désinscrit·e de la newsletter."}


@api.post("/contact")
async def contact(request: Request, inp: ContactInput):
    check_rate(request, "contact", 5)
    m = {"id": str(uuid.uuid4()), "name": inp.name, "email": inp.email.lower(),
         "subject": inp.subject.strip(), "message": inp.message, "created_at": now_iso(), "status": "new",
         "notice_version": CONTACT_NOTICE_VERSION, "replies": [],
         "owner_notification": contact_job(), "confirmation": contact_job()}
    await db.contact_messages.insert_one(m)
    schedule_contact(m["id"])
    return {"status": "ok", "message": "Message envoyé. Nous vous répondrons rapidement."}


# --------------------------------------------------------------------------- #
# Media (images publiques servies par le backend, jamais d'URL storage exposée)
# --------------------------------------------------------------------------- #
@api.get("/media/{path:path}")
async def media(path: str, request: Request):
    record = await db.media.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "Fichier introuvable")
    ct = record.get("content_type") or ""
    if ct.startswith("video/"):
        return _video_response(path, ct, request.headers.get("range"))
    data, ct2 = get_object(path)
    return Response(content=data, media_type=ct or ct2)


VIDEO_CACHE = "/tmp/auben_video_cache"


def _trim_video_cache(keep: str, max_bytes: int = 600 * 1024 * 1024):
    files = sorted((os.path.join(VIDEO_CACHE, f) for f in os.listdir(VIDEO_CACHE)), key=os.path.getmtime)
    total = sum(os.path.getsize(f) for f in files)
    for f in files:
        if total <= max_bytes:
            break
        if f != keep:
            total -= os.path.getsize(f)
            os.remove(f)


def _video_response(path: str, ct: str, rng: Optional[str]):
    # Vidéos : cache disque + requêtes partielles (Range), indispensables à la lecture sur iPhone et au déplacement.
    local = os.path.join(VIDEO_CACHE, re.sub(r"[^A-Za-z0-9._-]", "_", path))
    if not os.path.exists(local):
        os.makedirs(VIDEO_CACHE, exist_ok=True)
        data, _ = get_object(path)
        tmp = f"{local}.{uuid.uuid4().hex}"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, local)
        _trim_video_cache(local)
    size = os.path.getsize(local)
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
    m = re.match(r"bytes=(\d*)-(\d*)$", (rng or "").strip())
    if not m or (not m.group(1) and not m.group(2)):
        start, end, status = 0, size - 1, 200
    else:
        if m.group(1):
            start = int(m.group(1))
            end = min(int(m.group(2)) if m.group(2) else size - 1, size - 1)
        else:
            start, end = max(size - int(m.group(2)), 0), size - 1
        if start >= size or start > end:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        end = min(end, start + 4 * 1024 * 1024 - 1)
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    with open(local, "rb") as f:
        f.seek(start)
        chunk = f.read(end - start + 1)
    return Response(content=chunk, status_code=status, media_type=ct, headers=headers)


# --------------------------------------------------------------------------- #
# Payments (Stripe)
# --------------------------------------------------------------------------- #
def _stripe_product(lookup_key: str):
    for p in stripe.Product.list(active=True, limit=100).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == lookup_key:
            return p
    return None


def _conforms(pr, amount: int, currency: str) -> bool:
    return pr.unit_amount == amount and pr.currency == currency and pr.tax_behavior == "inclusive"


def _prod_id(pr):
    return pr.product if isinstance(pr.product, str) else getattr(pr.product, "id", None)


def price_diagnostic(lookup_key: str, price: float, currency: str):
    """Lecture seule, contrôle commun (démarrage, admin, paiement) : None si conforme, sinon explication."""
    amount = int(round(price * 100))
    product = _stripe_product(lookup_key)
    holder = (stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1).data or [None])[0]
    conforming = [pr for pr in stripe.Price.list(product=product.id, active=True, limit=100).auto_paging_iter()
                  if _conforms(pr, amount, currency)] if product else []
    hint = " Un prix conforme existe déjà chez Stripe : la synchronisation le réutilisera." if conforming and (not holder or holder.id not in {c.id for c in conforming}) else ""
    if not product:
        return "aucun produit Stripe associé à cette référence"
    if not holder:
        return "aucun prix actif ne porte la référence « " + lookup_key + " »." + hint
    problems = []
    if _prod_id(holder) != product.id:
        problems.append("le prix porteur de la référence appartient à un autre produit Stripe")
    if holder.unit_amount != amount:
        problems.append(f"montant {holder.unit_amount / 100:.2f} au lieu de {amount / 100:.2f}")
    if holder.currency != currency:
        problems.append(f"devise {holder.currency} au lieu de {currency}")
    if holder.tax_behavior != "inclusive":
        problems.append(f"TVA « {holder.tax_behavior} » au lieu de TTC (inclusive)")
    return ("prix Stripe actif non conforme : " + ", ".join(problems) + "." + hint) if problems else None


def sync_stripe_price(lookup_key: str, name: str, price: float, currency: str = "eur"):
    """Écriture explicite (bouton, modification admin, paiement) : réutilise un prix conforme, n'en crée qu'à défaut,
    et ne désactive que l'ancien porteur non conforme de la référence."""
    amount = int(round(price * 100))
    product = _stripe_product(lookup_key) or stripe.Product.create(
        name=name, tax_code="txcd_10302000", metadata={"managed_by": "emergent", "emergent_product_id": lookup_key})
    holder = (stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1).data or [None])[0]
    if holder and _prod_id(holder) == product.id and _conforms(holder, amount, currency):
        return
    reuse = next((pr for pr in stripe.Price.list(product=product.id, active=True, limit=100).auto_paging_iter()
                  if _conforms(pr, amount, currency)), None)
    if reuse:
        stripe.Price.modify(reuse.id, lookup_key=lookup_key, transfer_lookup_key=True)
        logger.info(f"Stripe : prix conforme réutilisé pour {lookup_key}")
    else:
        stripe.Price.create(product=product.id, unit_amount=amount, currency=currency,
                            lookup_key=lookup_key, transfer_lookup_key=True, tax_behavior="inclusive")
        logger.info(f"Stripe : nouveau prix créé pour {lookup_key}")
    if holder:
        stripe.Price.modify(holder.id, active=False)
        logger.info(f"Stripe : ancien prix non conforme désactivé pour {lookup_key}")


async def ensure_stripe_catalog():
    # Démarrage strictement sans écriture Stripe (TEST comme LIVE) : écarts signalés, corrigés seulement sur action explicite.
    try:
        async for p in db.products.find({"price": {"$gt": 0},
                                         "download_storage_path": {"$nin": [None, ""]}}, {"_id": 0}):
            if commercial_issues(p) or len(await lookup_owners(db, lookup_of(p))) > 1:
                logger.warning(f"Catalogue Stripe : {p['slug']} ignoré (fiche incomplète ou référence en double)")
                continue
            issue = price_diagnostic(lookup_of(p), p["price"], effective_currency(p, warn=True))
            if issue:
                logger.warning(f"Catalogue Stripe (lecture seule) : écart pour {p['slug']} — {issue} Aucune correction automatique au démarrage.")
        logger.info(f"Stripe catalog checked (lecture seule, env={_STRIPE['environment']})")
    except Exception as e:
        logger.error(f"Stripe catalog check failed: {type(e).__name__}")


def promo_coupon(price, discount_cents: int) -> str:
    """Coupon Stripe à montant fixe (calculé serveur), limité au produit ; le prix catalogue n'est jamais modifié."""
    product_id = _prod_id(price)
    cid = f"auben_{price.lookup_key}_{price.currency}_{discount_cents}"
    try:
        c = stripe.Coupon.retrieve(cid, expand=["applies_to"])
    except stripe.error.InvalidRequestError:
        c = stripe.Coupon.create(id=cid, amount_off=discount_cents, currency=price.currency, duration="once",
                                 applies_to={"products": [product_id]}, name="Promotion La Maison d'Auben", expand=["applies_to"])
        logger.info(f"Stripe : coupon promotionnel créé ({cid})")
    if c.amount_off != discount_cents or c.currency != price.currency or product_id not in ((c.get("applies_to") or {}).get("products") or []):
        raise HTTPException(503, "Paiement momentanément indisponible. Réessayez.")
    return c.id


@api.post("/payments/checkout")
async def create_checkout(request: Request, req: CheckoutInput):
    check_rate(request, "checkout", 20)
    owners = await lookup_owners(db, req.lookup_key)
    if len(owners) > 1:
        logger.error(f"Checkout bloqué : référence {req.lookup_key} partagée par {owners}")
        raise HTTPException(409, "Produit indisponible à l'achat (référence de paiement en double).")
    product = await db.products.find_one({"slug": owners[0]}, {"_id": 0}) if owners else None
    if product:
        effective_lookup(product, warn=True, always=True)
        effective_currency(product, warn=True, always=True)
    # Gating : aucun checkout (ni session Stripe) pour un produit incomplet.
    if not product or commercial_issues(product):
        raise HTTPException(409, "Produit indisponible à l'achat.")
    if req.withdrawal_waiver is not True or req.withdrawal_consent_version != WITHDRAWAL_CONSENT_VERSION:
        raise HTTPException(400, "Merci de cocher la case relative à l'accès immédiat et au droit de rétractation.")
    withdrawal_consent = {
        "accepted": True, "accepted_at": now_iso(),
        "text_version": WITHDRAWAL_CONSENT_VERSION, "text": WITHDRAWAL_CONSENT_TEXT,
        "ip": _client_ip(request), "user_agent": request.headers.get("user-agent", "")[:300],
    }
    expected = int(round(product["price"] * 100))
    currency = product.get("currency") or "eur"
    if price_diagnostic(req.lookup_key, product["price"], currency):
        # Le prix Stripe doit toujours être celui affiché sur le site (prix en base).
        sync_stripe_price(req.lookup_key, product["name"], product["price"], currency)
    prices = stripe.Price.list(lookup_keys=[req.lookup_key], active=True, limit=1).data
    if not prices or prices[0].unit_amount != expected:
        raise HTTPException(503, "Paiement momentanément indisponible. Réessayez.")
    price = prices[0]
    pricing = pricing_of(product)
    charged = int(round(pricing["final"] * 100))
    discounts = [{"coupon": promo_coupon(price, pricing["discount_cents"])}] if pricing["active"] else None
    # SÉCURITÉ : ne jamais utiliser l'origin_url fourni par le client pour des URLs sensibles.
    base = PUBLIC_BASE_URL
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="payment",
        success_url=f"{base}/paiement/succes?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base}/paiement/annule",
        metadata={"lookup_key": req.lookup_key, "product_slug": product["slug"] if product else "",
                  "withdrawal_consent_version": WITHDRAWAL_CONSENT_VERSION,
                  "withdrawal_consent_at": withdrawal_consent["accepted_at"],
                  "promo_discount_cents": str(pricing.get("discount_cents", 0))},
    )
    if discounts:
        kwargs["discounts"] = discounts
    try:
        session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError as e:
        msg = (e.user_message or "").lower()
        if "managed payments" in msg or "ineligible" in msg:
            session = stripe.checkout.Session.create(
                **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required",
            )
        else:
            logger.error(f"Checkout Stripe error for {req.lookup_key}: {type(e).__name__} code={e.code} msg={e.user_message}")
            raise HTTPException(502, "Paiement momentanément indisponible. Réessayez.")
    # Le montant facturé par Stripe doit être exactement celui affiché (prix ou prix promotionnel serveur).
    if session.amount_total != charged:
        logger.error(f"Checkout {req.lookup_key} : montant Stripe {session.amount_total} ≠ affiché {charged}, session expirée")
        try:
            stripe.checkout.Session.expire(session.id)
        except stripe.error.StripeError:
            pass
        raise HTTPException(503, "Paiement momentanément indisponible. Réessayez.")
    await db.payment_transactions.insert_one({
        "session_id": session.id, "lookup_key": req.lookup_key,
        "product_slug": product["slug"] if product else "",
        "amount": charged / 100.0, "currency": price.currency,
        "base_amount": (price.unit_amount or 0) / 100.0, "discount": pricing.get("discount_cents", 0) / 100.0,
        "status": "initiated", "payment_status": "pending",
        "withdrawal_consent": withdrawal_consent,
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


async def _claim_email(sid: str, field: str) -> bool:
    """Réclame l'envoi de façon atomique. Rejoue aussi un 'sending' bloqué > 5 min (crash)."""
    stale = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    at = f"{field}_at"
    res = await db.orders.update_one(
        {"session_id": sid, "$or": [
            {field: {"$in": ["pending", "failed"]}},
            {field: "sending", at: {"$lt": stale}},
            {field: "sending", at: {"$exists": False}},
        ]},
        {"$set": {field: "sending", at: now_iso()}},
    )
    return res.modified_count > 0


async def _send_customer_email(order: dict):
    """Envoi idempotent + rejouable de l'e-mail client (état email_status propre)."""
    sid = order["session_id"]
    if not await _claim_email(sid, "email_status"):
        return  # déjà envoyé ou en cours récent (pas de double envoi)
    email = order.get("customer_email")
    if not email:
        await db.orders.update_one({"session_id": sid}, {"$set": {"email_status": "skipped"}})
        return
    download_url = f"{PUBLIC_BASE_URL}/telechargement/{order['download_token']}"
    try:
        eid = await send_email(
            to=email,
            subject=f"Votre commande {order['product_name']} est confirmée",
            html=order_confirmation_html(
                product_name=order["product_name"], amount=order["amount"],
                currency=order["currency"], download_url=download_url, order_id=order["id"],
                withdrawal_consent=order.get("withdrawal_consent"),
            ),
        )
        await db.orders.update_one({"session_id": sid}, {"$set": {
            "email_status": "sent" if eid else "failed", "email_sent": bool(eid)}})
    except Exception as e:
        logger.error("Confirmation email error (order %s): %s", order["id"], e)
        await db.orders.update_one({"session_id": sid}, {"$set": {"email_status": "failed"}})


async def _send_owner_email(order: dict):
    """Notification vendeur, idempotente + rejouable (état owner_email_status propre)."""
    owner_email = os.environ.get("OWNER_EMAIL")
    if not owner_email:
        return
    sid = order["session_id"]
    if not await _claim_email(sid, "owner_email_status"):
        return
    try:
        oid = await send_email(
            to=owner_email,
            subject=f"Nouvelle vente : {order['product_name']} ({order['amount']:.2f} {order['currency'].upper()})",
            html=owner_sale_notification_html(
                product_name=order["product_name"], amount=order["amount"],
                currency=order["currency"], customer_email=order.get("customer_email") or "non communiqué",
                order_id=order["id"],
            ),
        )
        await db.orders.update_one({"session_id": sid}, {"$set": {
            "owner_email_status": "sent" if oid else "failed", "owner_notified": bool(oid)}})
    except Exception as e:
        logger.error("Owner email error (order %s): %s", order["id"], e)
        await db.orders.update_one({"session_id": sid}, {"$set": {"owner_email_status": "failed"}})


async def fulfill_order(session_id: str):
    """Crée la commande (idempotent) UNIQUEMENT si le paiement est réellement confirmé,
    puis déclenche les e-mails (envoi rejouable). Ne livre jamais sur un simple status=complete."""
    existing = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if existing:
        # commande déjà créée : relancer uniquement les e-mails non aboutis (pas de doublon)
        await _send_customer_email(existing)
        await _send_owner_email(existing)
        return await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    try:
        s = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError:
        return None
    # SOURCE DE VÉRITÉ SERVEUR : livraison conditionnée au paiement RÉELLEMENT encaissé.
    # Un simple s.status == "complete" ne suffit PAS (paiements asynchrones, etc.).
    if s.payment_status != "paid":
        return None
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    slug = (tx or {}).get("product_slug") or (s.metadata or {}).get("product_slug", "")
    product = await db.products.find_one({"slug": slug}, {"_id": 0}) or {}
    email = None
    if s.customer_details:
        email = s.customer_details.get("email")
    token = secrets.token_urlsafe(32)
    order = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "product_slug": slug,
        "product_name": product.get("name", "Produit"),
        "amount": (s.amount_total or 0) / 100.0 if s.amount_total is not None else (tx or {}).get("amount", 0),
        "currency": s.currency or (tx or {}).get("currency", "eur"),
        "customer_email": email,
        "status": "paid",
        "fulfillment_status": "paid",
        "download_token": token,
        "download_expires_at": (datetime.now(timezone.utc) + timedelta(days=DOWNLOAD_TTL_DAYS)).isoformat(),
        "download_count": 0,
        "download_limit": DOWNLOAD_LIMIT,
        "email_sent": False,
        "email_status": "pending",
        "owner_notified": False,
        "owner_email_status": "pending",
        "withdrawal_consent": (tx or {}).get("withdrawal_consent"),
        "created_at": now_iso(),
    }
    # Idempotence : insertion atomique gardée par l'index unique session_id.
    try:
        res = await db.orders.update_one(
            {"session_id": session_id}, {"$setOnInsert": order}, upsert=True
        )
    except DuplicateKeyError:
        res = None
    if res is not None and res.upserted_id is not None:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now_iso()}},
        )
    # Emails (état propre, rejouable) — pas de doublon de commande, retry possible sur échec.
    current = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if current:
        await _send_customer_email(current)
        await _send_owner_email(current)
    return await db.orders.find_one({"session_id": session_id}, {"_id": 0})


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Transaction introuvable")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid":
                await fulfill_order(session_id)
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"]}


@api.get("/orders/by-session/{session_id}")
async def order_by_session(session_id: str):
    order = await fulfill_order(session_id)
    if not order:
        raise HTTPException(404, "Commande introuvable ou paiement non confirmé")
    return {
        "id": order["id"], "product_name": order["product_name"],
        "amount": order["amount"], "currency": order["currency"],
        "customer_email": order.get("customer_email"),
        "download_token": order["download_token"], "email_sent": order.get("email_sent", False),
    }


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook non configuré")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Signature invalide")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        # payment_status peut être unpaid (paiement asynchrone) : ne pas forcer "paid".
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "unpaid"),
                      "updated_at": now_iso()}},
        )
        await fulfill_order(obj["id"])  # ne livrera que si payment_status == paid
    elif t == "checkout.session.async_payment_succeeded":
        await fulfill_order(obj["id"])
    elif t in ("checkout.session.async_payment_failed", "checkout.session.expired"):
        await db.payment_transactions.update_one(
            {"session_id": obj["id"]},
            {"$set": {"status": "failed", "payment_status": "failed", "updated_at": now_iso()}},
        )
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Secure digital download
# --------------------------------------------------------------------------- #
@api.get("/download/{token}")
async def download(token: str):
    order = await db.orders.find_one({"download_token": token}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Lien de téléchargement invalide")
    exp = datetime.fromisoformat(order["download_expires_at"])
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(410, "Ce lien de téléchargement a expiré. Contactez-nous pour le renouveler.")
    limit = order.get("download_limit", DOWNLOAD_LIMIT)
    product = await db.products.find_one({"slug": order["product_slug"]}, {"_id": 0})
    if not product or not product.get("download_storage_path"):
        raise HTTPException(404, "Le fichier n'est pas encore disponible. Nous vous contacterons.")
    # Incrément ATOMIQUE conditionné : empêche de dépasser la limite via des requêtes concurrentes.
    claim = await db.orders.update_one(
        {"download_token": token, "download_count": {"$lt": limit}},
        {"$inc": {"download_count": 1}},
    )
    if claim.modified_count == 0:
        raise HTTPException(429, "Nombre de téléchargements dépassé. Contactez-nous.")
    try:
        data, ct = get_object(product["download_storage_path"])
    except Exception:
        # En cas d'échec de lecture, rembourser le crédit consommé.
        await db.orders.update_one({"download_token": token}, {"$inc": {"download_count": -1}})
        raise HTTPException(503, "Téléchargement momentanément indisponible. Réessayez.")
    filename = product.get("download_filename", f"{product['slug']}.xlsx")
    return Response(content=data, media_type=ct, headers={
        "Content-Disposition": f'attachment; filename="{filename}"'
    })


@api.get("/download-info/{token}")
async def download_info(token: str):
    order = await db.orders.find_one({"download_token": token}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Lien invalide")
    product = await db.products.find_one({"slug": order["product_slug"]}, {"_id": 0}) or {}
    exp = datetime.fromisoformat(order["download_expires_at"])
    return {
        "product_name": order["product_name"],
        "expired": datetime.now(timezone.utc) > exp,
        "file_available": bool(product.get("download_storage_path")),
        "expires_at": order["download_expires_at"],
    }


# --------------------------------------------------------------------------- #
# Admin
# --------------------------------------------------------------------------- #
@api.post("/admin/login")
async def admin_login(request: Request, inp: LoginInput):
    check_rate(request, "admin_login", 5)
    user = await db.users.find_one({"email": inp.email.lower()})
    if not user or not verify_password(inp.password, user.get("password_hash", "")):
        raise HTTPException(401, "Identifiants incorrects")
    if user.get("role") != "admin":
        raise HTTPException(403, "Accès refusé")
    token = create_access_token(user["id"], user["email"])
    return {"access_token": token, "user": {"email": user["email"], "name": user.get("name", "Admin")}}


@api.get("/admin/me")
async def admin_me(admin=Depends(get_current_admin)):
    return {"email": admin["email"], "name": admin.get("name", "Admin")}


@api.get("/admin/orders")
async def admin_orders(admin=Depends(get_current_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    sids = [o.get("session_id") for o in orders if o.get("session_id")]
    txs = await db.payment_transactions.find({"session_id": {"$in": sids}}, {"_id": 0}).to_list(5000)
    products = {p["slug"]: p for p in await db.products.find({}, {"_id": 0, "slug": 1, "download_storage_path": 1}).to_list(500)}
    for o in orders:
        o.update(download_admin_view(o, products.get(o.get("product_slug"))))
        o["deletion_blockers"] = order_deletion_blockers(o, [t for t in txs if t["session_id"] == o.get("session_id")])
        o["deletable"] = not o["deletion_blockers"]
    return orders


@api.post("/admin/orders/{order_id}/delete-permanently")
async def admin_delete_order(order_id: str, inp: DeleteConfirm, admin=Depends(get_current_admin)):
    require_delete_confirmation(inp)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Commande introuvable.")
    sid = order.get("session_id") or ""
    txs = await db.payment_transactions.find({"session_id": sid}, {"_id": 0}).to_list(100) if sid else []
    blockers = order_deletion_blockers(order, txs)
    if blockers:
        raise HTTPException(403, " ".join(blockers))
    await db.payment_transactions.delete_many({"session_id": sid, "livemode": {"$ne": True}})
    await db.orders.delete_one({"id": order_id})
    logger.info(f"Admin deleted TEST order {order_id} and {len(txs)} test transaction(s)")
    return {"ok": True, "deleted_transactions": len(txs)}


@api.post("/admin/messages/{message_id}/delete-permanently")
async def admin_delete_message(message_id: str, inp: DeleteConfirm, admin=Depends(get_current_admin)):
    require_delete_confirmation(inp)
    res = await db.contact_messages.delete_one({"id": message_id})
    if not res.deleted_count:
        raise HTTPException(404, "Message introuvable.")
    return {"ok": True}


@api.get("/admin/messages")
async def admin_messages(admin=Depends(get_current_admin)):
    return await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api.post("/admin/orders/{order_id}/resend-email")
async def admin_resend_email(order_id: str, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Commande introuvable")
    # réinitialise l'état pour permettre un nouvel essai (sans recréer la commande)
    await db.orders.update_one({"id": order_id}, {"$set": {"email_status": "pending"}})
    order["email_status"] = "pending"
    await _send_customer_email(order)
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"status": "ok", "email_status": updated.get("email_status"), "email_sent": updated.get("email_sent", False)}


@api.post("/admin/products")
async def create_product(inp: ProductInput, admin=Depends(get_current_admin)):
    data = inp.model_dump()
    data["slug"] = data.get("slug") or data["name"].lower().replace(" ", "-")
    data["lookup_key"] = data.get("lookup_key") or derive_lookup(data["slug"])
    data["currency"] = data.get("currency") or DEFAULT_CURRENCY
    if await db.products.find_one({"slug": data["slug"]}):
        raise HTTPException(400, "Un produit avec ce slug existe déjà")
    if not valid_lookup(data["lookup_key"]):
        raise HTTPException(400, "Référence Stripe invalide : utilisez un slug en minuscules, chiffres et tirets.")
    if await lookup_owners(db, data["lookup_key"]):
        raise HTTPException(409, f"La référence Stripe « {data['lookup_key']} » est déjà utilisée par un autre produit.")
    if data.get("status") == "available" and commercial_issues(data):
        raise HTTPException(400, "Produit incomplet pour la vente : " + " ".join(i["message"] for i in commercial_issues(data)))
    data["created_at"] = now_iso()
    await db.products.insert_one(data)
    return clean(await db.products.find_one({"slug": data["slug"]}))


@api.put("/admin/products/{slug}")
async def update_product(slug: str, inp: ProductUpdateInput, admin=Depends(get_current_admin)):
    existing = await db.products.find_one({"slug": slug})
    if not existing:
        raise HTTPException(404, "Produit introuvable")
    # Mise à jour PARTIELLE : uniquement les champs réellement fournis (jamais d'écrasement).
    data = inp.model_dump(exclude_unset=True)
    data.pop("slug", None)
    # Référence / devise : jamais effacées, jamais réécrites si déjà renseignées.
    for f in ("lookup_key", "currency"):
        if f in data and (not data[f] or existing.get(f)):
            if data[f] and existing.get(f) and data[f] != existing[f]:
                raise HTTPException(400, f"{'Référence Stripe' if f == 'lookup_key' else 'Devise'} déjà renseignée : modification refusée.")
            data.pop(f)
    if "lookup_key" in data:
        if not valid_lookup(data["lookup_key"]):
            raise HTTPException(400, "Référence Stripe invalide.")
        if [s for s in await lookup_owners(db, data["lookup_key"]) if s != slug]:
            raise HTTPException(409, f"La référence Stripe « {data['lookup_key']} » est déjà utilisée par un autre produit.")
    merged = {**existing, **data}
    if data.get("status") == "available" and commercial_issues(merged):
        raise HTTPException(400, "Produit incomplet pour la vente : " + " ".join(i["message"] for i in commercial_issues(merged)))
    stripe_synced = None
    if "price" in data and data["price"] is not None:
        has_file = bool(existing.get("download_storage_path")) and not existing.get("download_is_placeholder")
        if has_file:
            lookup = lookup_of(merged)
            name = data.get("name") or existing.get("name")
            currency = effective_currency(merged, warn=True)
            try:
                sync_stripe_price(lookup, name, data["price"], currency)
                stripe_synced = True
            except Exception as e:
                logger.error(f"Stripe price sync failed for {slug}: {e}")
                stripe_synced = False
    if data:
        await db.products.update_one({"slug": slug}, {"$set": data})
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    p = with_purchasable(p)
    if stripe_synced is not None:
        p["stripe_synced"] = stripe_synced
    return p


@api.delete("/admin/products/{slug}")
async def delete_product(slug: str, admin=Depends(get_current_admin)):
    await db.products.delete_one({"slug": slug})
    return {"status": "ok"}


@api.post("/admin/products/{slug}/file")
async def upload_product_file(slug: str, file: UploadFile = File(...), admin=Depends(get_current_admin)):
    product = await db.products.find_one({"slug": slug})
    if not product:
        raise HTTPException(404, "Produit introuvable")
    ext = safe_ext(file.filename)
    if ext not in ALLOWED_FILE_EXT:
        raise HTTPException(400, f"Extension non autorisée. Autorisées : {', '.join(sorted(ALLOWED_FILE_EXT))}")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "Fichier vide.")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(400, "Fichier trop volumineux (max 50 Mo).")
    ct = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    if ct not in ALLOWED_FILE_MIME:
        ct = MIME_TYPES.get(ext, "application/octet-stream")
    filename = sanitize_filename(file.filename, f"{slug}.{ext}")
    path = f"{APP_NAME}/files/{slug}/{uuid.uuid4()}.{ext}"
    put_object(path, data, ct)
    await db.products.update_one({"slug": slug}, {"$set": {
        "download_storage_path": path, "download_filename": filename,
        "download_is_placeholder": False, "status": "available",
    }})
    # Un fichier présent + un prix défini → le produit devient réellement achetable :
    # on resynchronise le prix Stripe (même mécanisme que le catalogue).
    prod = await db.products.find_one({"slug": slug}, {"_id": 0})
    if prod and not commercial_issues(prod) and len(await lookup_owners(db, lookup_of(prod))) == 1:
        try:
            sync_stripe_price(lookup_of(prod), prod["name"], prod["price"], effective_currency(prod, warn=True))
        except Exception as e:
            logger.error(f"Stripe price sync after upload failed for {slug}: {e}")
    return {"status": "ok", "filename": filename}


@api.delete("/admin/products/{slug}/file")
async def delete_product_file(slug: str, admin=Depends(get_current_admin)):
    product = await db.products.find_one({"slug": slug})
    if not product:
        raise HTTPException(404, "Produit introuvable")
    path = product.get("download_storage_path")
    if path:
        try:
            delete_object(path)
        except Exception as e:
            logger.error(f"Storage delete failed for {slug}: {e}")
    # Sans fichier réel, le produit repasse automatiquement en « bientôt disponible ».
    await db.products.update_one({"slug": slug}, {
        "$set": {"status": "coming_soon"},
        "$unset": {"download_storage_path": "", "download_filename": "", "download_is_placeholder": ""},
    })
    return {"status": "ok"}


def _stripe_price_issue(key: str, price: float, currency: str):
    try:
        issue = price_diagnostic(key, price, currency)
    except Exception as e:
        logger.error(f"Diagnostic Stripe impossible pour {key}: {type(e).__name__}")
        return {"code": "stripe_unreachable", "message": "Vérification Stripe impossible pour le moment."}
    return {"code": "stripe_price", "message": "Stripe : " + issue[0].upper() + issue[1:]} if issue else None


async def _product_health(p: dict) -> dict:
    issues = commercial_issues(p)
    warnings = []
    if not p.get("lookup_key"):
        warnings.append("Référence Stripe absente en base (déduite du slug).")
    if not p.get("currency"):
        warnings.append("Devise absente en base (« eur » utilisée par défaut).")
    if promo_status(p) == "invalid":
        warnings.append("Promotion activée mais invalide avec le prix actuel : le prix normal reste affiché et facturé.")
    key = effective_lookup(p)
    if key and len(await lookup_owners(db, key)) > 1:
        issues.append({"code": "duplicate", "message": f"Référence Stripe « {key} » utilisée par plusieurs produits."})
    if not issues:
        stripe_issue = _stripe_price_issue(key, p["price"], effective_currency(p))
        if stripe_issue:
            issues.append(stripe_issue)
    return {"slug": p["slug"], "lookup_key": key, "status": p.get("status"),
            "ready": not issues, "issues": issues, "warnings": warnings,
            "can_sync": [i["code"] for i in issues] == ["stripe_price"]}


@api.get("/admin/products/health")
async def products_health(admin=Depends(get_current_admin)):
    return [await _product_health(p) async for p in db.products.find({}, {"_id": 0})]


@api.post("/admin/products/{slug}/stripe-sync")
async def products_stripe_sync(slug: str, admin=Depends(get_current_admin)):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    health = await _product_health(p)
    if not health["can_sync"]:
        raise HTTPException(400, "Synchronisation impossible : " + " ".join(i["message"] for i in health["issues"]) if health["issues"] else "Rien à synchroniser.")
    try:
        sync_stripe_price(health["lookup_key"], p["name"], p["price"], effective_currency(p, warn=True))
    except Exception as e:
        logger.error(f"Stripe sync manuelle échouée pour {slug}: {type(e).__name__}")
        raise HTTPException(502, "La synchronisation Stripe a échoué. Réessayez.")
    return await _product_health(p)


@api.post("/admin/upload/image")
async def upload_image(file: UploadFile = File(...), admin=Depends(get_current_admin)):
    ext = safe_ext(file.filename)
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(400, f"Image non autorisée. Autorisées : {', '.join(sorted(ALLOWED_IMAGE_EXT))}")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "Fichier vide.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Image trop volumineuse (max 8 Mo).")
    ct = file.content_type if file.content_type in ALLOWED_IMAGE_MIME else MIME_TYPES.get(ext, "image/png")
    path = f"{APP_NAME}/images/{uuid.uuid4()}.{ext}"
    put_object(path, data, ct)
    await db.media.insert_one({
        "id": str(uuid.uuid4()), "storage_path": path,
        "original_filename": sanitize_filename(file.filename, f"image.{ext}"),
        "content_type": ct, "is_deleted": False, "created_at": now_iso(),
    })
    return {"status": "ok", "path": path, "url": f"/api/media/{path}"}


@api.delete("/admin/articles/{slug}")
async def delete_article(slug: str, inp: DeleteConfirm, admin=Depends(get_current_admin)):
    # Suppression définitive d'un seul article (et de ses anciennes adresses previous_slugs, qui deviennent 404).
    require_delete_confirmation(inp)
    res = await db.articles.delete_one({"slug": slug})
    if not res.deleted_count:
        raise HTTPException(404, "Article introuvable.")
    logger.info(f"Admin deleted article {slug}")
    return {"status": "ok"}


@api.delete("/admin/faq/{fid}")
async def delete_faq(fid: str, admin=Depends(get_current_admin)):
    await db.faq.delete_one({"id": fid})
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Startup / seed
# --------------------------------------------------------------------------- #
async def _seed_once(marker: str, coll, exists_query: dict) -> bool:
    """True si le contenu de démo doit être inséré (jamais inséré auparavant et absent)."""
    if await db.seed_markers.find_one({"key": marker}):
        return False
    return not await coll.find_one(exists_query)


async def _mark_seeded(marker: str):
    await db.seed_markers.update_one({"key": marker}, {"$setOnInsert": {"key": marker, "at": now_iso()}}, upsert=True)


async def seed():
    # Settings
    await db.settings.update_one({"id": "site"}, {"$set": seed_data.SETTINGS}, upsert=True)
    # Categories
    for c in seed_data.CATEGORIES:
        await db.categories.update_one({"slug": c["slug"]}, {"$setOnInsert": {**c}}, upsert=True)
    # Admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email,
            "password_hash": hash_password(admin_pw), "name": "Admin",
            "role": "admin", "created_at": now_iso(),
        })
    elif not verify_password(admin_pw, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})
    # Products (available) — insert once, ne jamais écraser les éditions admin
    for p in seed_data.PRODUCTS:
        await db.products.update_one({"slug": p["slug"]}, {"$setOnInsert": {**p, "created_at": now_iso()}}, upsert=True)
    # Coming soon products
    for p in seed_data.COMING_SOON:
        await db.products.update_one({"slug": p["slug"]}, {"$setOnInsert": {**p, "created_at": now_iso()}}, upsert=True)
    # Backfill non destructif du CONTENU éditorial manquant : répare les fiches
    # dont la description/les fonctionnalités avaient été vidées. Ne touche JAMAIS
    # prix / statut / fichier / image (seuls les champs vides sont complétés).
    content_fields = ["short_description", "description", "audience", "features",
                      "contents", "compatibility", "faq", "seo", "gallery"]
    for p in (seed_data.PRODUCTS + seed_data.COMING_SOON):
        doc = await db.products.find_one({"slug": p["slug"]})
        if not doc:
            continue
        fill = {f: p[f] for f in content_fields if f in p and not doc.get(f)}
        if fill:
            await db.products.update_one({"slug": p["slug"]}, {"$set": fill})
    # Articles & FAQ : insérés une seule fois (marqueur), pour ne jamais recréer un article
    # renommé ni une question supprimée depuis l'administration.
    for a in seed_data.ARTICLES:
        if await _seed_once(f"article:{a['slug']}", db.articles, {"$or": [{"slug": a["slug"]}, {"previous_slugs": a["slug"]}]}):
            await db.articles.insert_one({**a})
        await _mark_seeded(f"article:{a['slug']}")
    # FAQ
    for i, f in enumerate(seed_data.GLOBAL_FAQ):
        fid = f"faq-{i+1}"
        if await _seed_once(f"faq:{fid}", db.faq, {"id": fid}):
            await db.faq.insert_one({**f, "id": fid})
        await _mark_seeded(f"faq:{fid}")
    # Fichier Excel par défaut (vrai fichier fourni) pour Budget mensuel.
    bm = await db.products.find_one({"slug": "budget-mensuel"})
    if bm and not bm.get("download_storage_path"):
        try:
            data = seed_data.load_default_xlsx()
            path = f"{APP_NAME}/files/budget-mensuel/{uuid.uuid4()}.xlsx"
            put_object(path, data, MIME_TYPES["xlsx"])
            await db.products.update_one({"slug": "budget-mensuel"}, {"$set": {
                "download_storage_path": path,
                "download_filename": seed_data.DEFAULT_XLSX_FILENAME,
                "download_is_placeholder": False,
            }})
        except Exception as e:
            logger.error(f"Default xlsx seed failed: {e}")


@app.on_event("startup")
async def startup():
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await db.newsletter.create_index("email", unique=True)
    await db.newsletter.create_index("unsubscribe_token", sparse=True)
    async for sub in db.newsletter.find({"unsubscribe_token": {"$exists": False}}, {"_id": 1}):
        await db.newsletter.update_one({"_id": sub["_id"]}, {"$set": {"unsubscribe_token": secrets.token_urlsafe(32)}})
    await db.orders.create_index("download_token")
    await db.orders.create_index("session_id", unique=True)
    await db.payment_transactions.create_index("session_id")
    await seed()
    for old, new in seed_data.LEGACY_COVER_IMAGES.items():
        await db.articles.update_many({"cover_image": old}, {"$set": {"cover_image": new}})
    await ensure_stripe_catalog()
    await mark_interrupted_campaigns()
    start_contact_worker()
    logger.info("Startup complete")


@app.on_event("shutdown")
async def shutdown():
    from database import client
    client.close()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Ne jamais exposer de stack trace / secret / détail interne au public.
    logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Une erreur interne est survenue. Réessayez plus tard."})


api.include_router(newsletter_router)
api.include_router(content_router)
api.include_router(contact_router)
api.include_router(renewal_router)
app.include_router(api)
app.include_router(merch_router)


@app.middleware("http")
async def api_security_headers(request: Request, call_next):
    # Réponses de l'API uniquement (JSON/XML/fichiers) : jamais intégrables dans une page tierce.
    # HSTS, nosniff et Referrer-Policy sont déjà ajoutés par l'hébergeur (Cloudflare/Emergent) ; les pages HTML
    # du site sont servies par l'hébergeur : leurs en-têtes ne sont pas configurables ici.
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Content-Security-Policy", "frame-ancestors 'none'")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
    return response

# CORS. L'admin s'authentifie par en-tête Authorization (pas de cookie) : aucun credential cross-origin n'est autorisé.
# Production (STRIPE_MODE=live) : liste explicite CORS_ORIGINS (séparée par des virgules). Une valeur vide ou "*" est
# ignorée et remplacée par l'origine de PUBLIC_BASE_URL et sa variante www — jamais d'origine générique en production.
CORS_ALLOWED_ORIGINS = cors_origins(STRIPE_MODE, os.environ.get("CORS_ORIGINS", ""), PUBLIC_BASE_URL)
if STRIPE_MODE == "live" and (os.environ.get("CORS_ORIGINS", "").strip() in ("", "*")):
    logger.warning(f"CORS_ORIGINS vide ou '*' ignoré en production ; origines autorisées : {CORS_ALLOWED_ORIGINS}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
