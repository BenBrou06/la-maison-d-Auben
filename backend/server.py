import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import stripe
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Response
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from database import db
from auth import hash_password, verify_password, create_access_token, get_current_admin
from storage import put_object, get_object, init_storage, APP_NAME, MIME_TYPES
from emailer import send_email, order_confirmation_html, owner_sale_notification_html
import seed_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- Configuration Stripe (secrets uniquement via variables d'environnement) ---
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_MODE = (os.environ.get("STRIPE_MODE") or "test").strip().lower()
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

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
if STRIPE_MODE != "live" and _is_live_key:
    logger.warning("STRIPE_MODE=%s alors qu'une clé LIVE est configurée : de vrais paiements seront traités.", STRIPE_MODE)
if STRIPE_MODE == "live" and not STRIPE_WEBHOOK_SECRET:
    logger.warning("STRIPE_MODE=live sans STRIPE_WEBHOOK_SECRET : le webhook rejettera les événements (le fallback polling prendra le relais). Configurez le whsec_ de production.")

stripe.api_key = STRIPE_SECRET_KEY
logger.info("Stripe initialisé | mode=%s | cle=%s", STRIPE_MODE, "live" if _is_live_key else ("test" if _is_test_key else "inconnue"))

DOWNLOAD_TTL_DAYS = 30
DOWNLOAD_LIMIT = 25

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
class NewsletterInput(BaseModel):
    email: EmailStr
    consent: bool = True


class ContactInput(BaseModel):
    name: str
    email: EmailStr
    subject: str = ""
    message: str


class CheckoutInput(BaseModel):
    lookup_key: str
    origin_url: str


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


class ArticleInput(BaseModel):
    slug: Optional[str] = None
    title: str
    category: str = ""
    excerpt: str = ""
    read_time: int = 5
    cover_image: str = ""
    related_product_slugs: List[str] = []
    content: List[dict] = []
    cta_text: str = ""
    published_at: Optional[str] = None


class FaqInput(BaseModel):
    id: Optional[str] = None
    question: str
    answer: str
    order: int = 100


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
    if sort == "price_asc":
        items.sort(key=lambda p: p.get("price") or 9999)
    elif sort == "price_desc":
        items.sort(key=lambda p: p.get("price") or -1, reverse=True)
    return items


@api.get("/products/{slug}")
async def get_product(slug: str):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    return p


@api.get("/articles")
async def get_articles(category: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    items = await db.articles.find(query, {"_id": 0}).sort("published_at", -1).to_list(200)
    return items


@api.get("/articles/{slug}")
async def get_article(slug: str):
    a = await db.articles.find_one({"slug": slug}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Article introuvable")
    related = []
    for ps in a.get("related_product_slugs", []):
        p = await db.products.find_one({"slug": ps}, {"_id": 0})
        if p:
            related.append(p)
    a["related_products"] = related
    return a


@api.get("/faq")
async def get_faq():
    return await db.faq.find({}, {"_id": 0}).sort("order", 1).to_list(200)


@api.post("/newsletter")
async def subscribe_newsletter(inp: NewsletterInput):
    if not inp.consent:
        raise HTTPException(400, "Le consentement est requis.")
    email = inp.email.lower()
    existing = await db.newsletter.find_one({"email": email})
    if existing:
        return {"status": "already", "message": "Vous êtes déjà inscrit·e. Merci !"}
    await db.newsletter.insert_one({
        "id": str(uuid.uuid4()), "email": email, "consent": True,
        "confirmed": False, "created_at": now_iso(),
    })
    return {"status": "ok", "message": "Merci ! Vous êtes bien inscrit·e."}


@api.post("/contact")
async def contact(inp: ContactInput):
    await db.contact_messages.insert_one({
        "id": str(uuid.uuid4()), "name": inp.name, "email": inp.email.lower(),
        "subject": inp.subject, "message": inp.message, "created_at": now_iso(),
    })
    return {"status": "ok", "message": "Message envoyé. Nous vous répondrons rapidement."}


# --------------------------------------------------------------------------- #
# Media (images publiques servies par le backend, jamais d'URL storage exposée)
# --------------------------------------------------------------------------- #
@api.get("/media/{path:path}")
async def media(path: str):
    record = await db.media.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "Fichier introuvable")
    data, ct = get_object(path)
    return Response(content=data, media_type=record.get("content_type", ct))


# --------------------------------------------------------------------------- #
# Payments (Stripe)
# --------------------------------------------------------------------------- #
def ensure_stripe_catalog():
    try:
        for entry in seed_data.PRODUCTS:
            if entry.get("status") != "available" or not entry.get("price"):
                continue
            lookup = entry["lookup_key"]
            product = None
            for p in stripe.Product.list(active=True, limit=100).auto_paging_iter():
                if p.to_dict().get("metadata", {}).get("emergent_product_id") == lookup:
                    product = p
                    break
            if not product:
                product = stripe.Product.create(
                    name=entry["name"], tax_code="txcd_10302000",
                    metadata={"managed_by": "emergent", "emergent_product_id": lookup},
                )
            amount = int(round(entry["price"] * 100))
            existing = stripe.Price.list(lookup_keys=[lookup], active=True, limit=1).data
            if existing:
                e0 = existing[0]
                if e0.unit_amount != amount or e0.currency != entry["currency"] or e0.tax_behavior != "inclusive":
                    stripe.Price.modify(e0.id, active=False)
                    existing = []
            if not existing:
                stripe.Price.create(
                    product=product.id, unit_amount=amount, currency=entry["currency"],
                    lookup_key=lookup, transfer_lookup_key=True, tax_behavior="inclusive",
                )
        logger.info("Stripe catalog ensured")
    except Exception as e:
        logger.error(f"Stripe catalog setup failed: {e}")


@api.post("/payments/checkout")
async def create_checkout(req: CheckoutInput):
    prices = stripe.Price.list(lookup_keys=[req.lookup_key], active=True, limit=1).data
    if not prices:
        raise HTTPException(500, f"Prix introuvable : {req.lookup_key}")
    price = prices[0]
    product = await db.products.find_one({"lookup_key": req.lookup_key}, {"_id": 0})
    origin = (req.origin_url or "").rstrip("/")
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="payment",
        success_url=f"{origin}/paiement/succes?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/paiement/annule",
        metadata={"lookup_key": req.lookup_key, "product_slug": product["slug"] if product else "", "origin_url": origin},
    )
    try:
        session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError as e:
        msg = (e.user_message or "").lower()
        if "managed payments" in msg or "ineligible" in msg:
            session = stripe.checkout.Session.create(
                **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required",
            )
        else:
            raise
    await db.payment_transactions.insert_one({
        "session_id": session.id, "lookup_key": req.lookup_key,
        "product_slug": product["slug"] if product else "",
        "amount": (price.unit_amount or 0) / 100.0, "currency": price.currency,
        "origin_url": origin,
        "status": "initiated", "payment_status": "pending",
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


async def fulfill_order(session_id: str):
    """Idempotent : crée la commande, le lien de téléchargement et envoie l'e-mail."""
    existing = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if existing:
        return existing
    try:
        s = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError:
        return None
    if not (s.payment_status == "paid" or s.status == "complete"):
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
        "download_token": token,
        "download_expires_at": (datetime.now(timezone.utc) + timedelta(days=DOWNLOAD_TTL_DAYS)).isoformat(),
        "download_count": 0,
        "download_limit": DOWNLOAD_LIMIT,
        "email_sent": False,
        "owner_notified": False,
        "created_at": now_iso(),
    }
    # Idempotence : insertion atomique gardée par l'index unique session_id.
    try:
        res = await db.orders.update_one(
            {"session_id": session_id}, {"$setOnInsert": order}, upsert=True
        )
    except DuplicateKeyError:
        return await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if res.upserted_id is None:
        return await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now_iso()}},
    )
    # Email de confirmation avec lien de téléchargement sécurisé
    if email:
        base = ((tx or {}).get("origin_url")
                or os.environ.get("PUBLIC_BASE_URL")
                or os.environ.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
        download_url = f"{base}/telechargement/{token}"
        try:
            eid = await send_email(
                to=email,
                subject=f"Votre commande {order['product_name']} est confirmée",
                html=order_confirmation_html(
                    product_name=order["product_name"], amount=order["amount"],
                    currency=order["currency"], download_url=download_url, order_id=order["id"],
                ),
            )
            await db.orders.update_one({"session_id": session_id}, {"$set": {"email_sent": bool(eid)}})
        except Exception as e:
            logger.error(f"Confirmation email failed: {e}")
    # Notification vendeur (alerte de nouvelle vente)
    owner_email = os.environ.get("OWNER_EMAIL")
    if owner_email:
        try:
            oid = await send_email(
                to=owner_email,
                subject=f"Nouvelle vente : {order['product_name']} ({order['amount']:.2f} {order['currency'].upper()})",
                html=owner_sale_notification_html(
                    product_name=order["product_name"], amount=order["amount"],
                    currency=order["currency"], customer_email=email or "non communiqué", order_id=order["id"],
                ),
            )
            await db.orders.update_one({"session_id": session_id}, {"$set": {"owner_notified": bool(oid)}})
        except Exception as e:
            logger.error(f"Owner notification email failed: {e}")
    return await db.orders.find_one({"session_id": session_id}, {"_id": 0})


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Transaction introuvable")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
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
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Signature invalide")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "updated_at": now_iso()}},
        )
        await fulfill_order(obj["id"])
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
    if order.get("download_count", 0) >= order.get("download_limit", DOWNLOAD_LIMIT):
        raise HTTPException(429, "Nombre de téléchargements dépassé. Contactez-nous.")
    product = await db.products.find_one({"slug": order["product_slug"]}, {"_id": 0})
    if not product or not product.get("download_storage_path"):
        raise HTTPException(404, "Le fichier n'est pas encore disponible. Nous vous contacterons.")
    data, ct = get_object(product["download_storage_path"])
    await db.orders.update_one({"download_token": token}, {"$inc": {"download_count": 1}})
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
async def admin_login(inp: LoginInput):
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
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.get("/admin/newsletter")
async def admin_newsletter(admin=Depends(get_current_admin)):
    return await db.newsletter.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)


@api.get("/admin/messages")
async def admin_messages(admin=Depends(get_current_admin)):
    return await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api.post("/admin/products")
async def create_product(inp: ProductInput, admin=Depends(get_current_admin)):
    data = inp.model_dump()
    data["slug"] = data.get("slug") or data["name"].lower().replace(" ", "-")
    data["lookup_key"] = data.get("lookup_key") or data["slug"].replace("-", "_")
    if await db.products.find_one({"slug": data["slug"]}):
        raise HTTPException(400, "Un produit avec ce slug existe déjà")
    data["created_at"] = now_iso()
    await db.products.insert_one(data)
    return clean(await db.products.find_one({"slug": data["slug"]}))


@api.put("/admin/products/{slug}")
async def update_product(slug: str, inp: ProductInput, admin=Depends(get_current_admin)):
    data = {k: v for k, v in inp.model_dump().items() if v is not None}
    data.pop("slug", None)
    await db.products.update_one({"slug": slug}, {"$set": data})
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
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
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/files/{slug}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    ct = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    put_object(path, data, ct)
    await db.products.update_one({"slug": slug}, {"$set": {
        "download_storage_path": path, "download_filename": file.filename,
    }})
    return {"status": "ok", "filename": file.filename}


@api.post("/admin/upload/image")
async def upload_image(file: UploadFile = File(...), admin=Depends(get_current_admin)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "png"
    path = f"{APP_NAME}/images/{uuid.uuid4()}.{ext}"
    data = await file.read()
    ct = file.content_type or MIME_TYPES.get(ext, "image/png")
    put_object(path, data, ct)
    await db.media.insert_one({
        "id": str(uuid.uuid4()), "storage_path": path, "original_filename": file.filename,
        "content_type": ct, "is_deleted": False, "created_at": now_iso(),
    })
    return {"status": "ok", "path": path, "url": f"/api/media/{path}"}


@api.post("/admin/articles")
async def create_article(inp: ArticleInput, admin=Depends(get_current_admin)):
    data = inp.model_dump()
    data["slug"] = data.get("slug") or data["title"].lower().replace(" ", "-")
    data["published_at"] = data.get("published_at") or now_iso()
    if await db.articles.find_one({"slug": data["slug"]}):
        raise HTTPException(400, "Slug déjà utilisé")
    await db.articles.insert_one(data)
    return clean(await db.articles.find_one({"slug": data["slug"]}))


@api.put("/admin/articles/{slug}")
async def update_article(slug: str, inp: ArticleInput, admin=Depends(get_current_admin)):
    data = {k: v for k, v in inp.model_dump().items() if v is not None}
    data.pop("slug", None)
    await db.articles.update_one({"slug": slug}, {"$set": data})
    a = await db.articles.find_one({"slug": slug}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Article introuvable")
    return a


@api.delete("/admin/articles/{slug}")
async def delete_article(slug: str, admin=Depends(get_current_admin)):
    await db.articles.delete_one({"slug": slug})
    return {"status": "ok"}


@api.post("/admin/faq")
async def create_faq(inp: FaqInput, admin=Depends(get_current_admin)):
    data = inp.model_dump()
    data["id"] = data.get("id") or str(uuid.uuid4())
    await db.faq.update_one({"id": data["id"]}, {"$set": data}, upsert=True)
    return clean(await db.faq.find_one({"id": data["id"]}))


@api.delete("/admin/faq/{fid}")
async def delete_faq(fid: str, admin=Depends(get_current_admin)):
    await db.faq.delete_one({"id": fid})
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Startup / seed
# --------------------------------------------------------------------------- #
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
    # Articles
    for a in seed_data.ARTICLES:
        await db.articles.update_one({"slug": a["slug"]}, {"$setOnInsert": {**a}}, upsert=True)
    # FAQ
    for i, f in enumerate(seed_data.GLOBAL_FAQ):
        fid = f"faq-{i+1}"
        await db.faq.update_one({"id": fid}, {"$setOnInsert": {**f, "id": fid}}, upsert=True)
    # Placeholder Excel file for Budget mensuel
    bm = await db.products.find_one({"slug": "budget-mensuel"})
    if bm and not bm.get("download_storage_path"):
        try:
            data = seed_data.build_placeholder_xlsx()
            path = f"{APP_NAME}/files/budget-mensuel/placeholder.xlsx"
            put_object(path, data, MIME_TYPES["xlsx"])
            await db.products.update_one({"slug": "budget-mensuel"}, {"$set": {
                "download_storage_path": path,
                "download_filename": "Budget-mensuel-La-Maison-dAuben.xlsx",
                "download_is_placeholder": True,
            }})
        except Exception as e:
            logger.error(f"Placeholder xlsx seed failed: {e}")


@app.on_event("startup")
async def startup():
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await db.newsletter.create_index("email", unique=True)
    await db.orders.create_index("download_token")
    await db.orders.create_index("session_id", unique=True)
    await db.payment_transactions.create_index("session_id")
    await seed()
    ensure_stripe_catalog()
    logger.info("Startup complete")


@app.on_event("shutdown")
async def shutdown():
    from database import client
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
