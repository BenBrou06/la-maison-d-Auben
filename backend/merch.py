"""Valorisation commerciale : promotions (calcul serveur), réassurance, témoignages, vidéos produit."""
import os
import uuid
import shutil
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from database import db
from auth import get_current_admin
from storage import put_object, APP_NAME

logger = logging.getLogger("merch")
router = APIRouter(prefix="/api")

STRIPE_MIN_CENTS = 50


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _parse(dt):
    if not dt:
        return None
    try:
        d = datetime.fromisoformat(str(dt).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# --------------------------------------------------------------------------- #
# Promotions : le montant est TOUJOURS calculé ici, jamais fourni par le client.
# --------------------------------------------------------------------------- #
def promo_final_cents(base_cents: int, kind: str, value: float):
    if kind == "percent":
        v = int(value)
        if v != value or not 1 <= v <= 90:
            return None
        final = (base_cents * (100 - v) + 50) // 100
    elif kind == "amount":
        final = base_cents - int(round(value * 100))
    else:
        return None
    return final if STRIPE_MIN_CENTS <= final < base_cents else None


def pricing_of(p: dict, now: Optional[datetime] = None) -> dict:
    price = p.get("price")
    if not isinstance(price, (int, float)) or price <= 0:
        return {"base": price, "final": price, "active": False}
    base_c = int(round(price * 100))
    promo = p.get("promotion") or {}
    now = now or datetime.now(timezone.utc)
    start, end = _parse(promo.get("starts_at")), _parse(promo.get("ends_at"))
    final_c = promo_final_cents(base_c, promo.get("type"), promo.get("value") or 0) if promo.get("enabled") else None
    active = final_c is not None and (not start or now >= start) and (not end or now < end)
    out = {"base": base_c / 100, "final": (final_c if active else base_c) / 100, "active": active}
    if active:
        out["discount_cents"] = base_c - final_c
        out["label"] = f"-{int(promo['value'])} %" if promo["type"] == "percent" else \
            "-" + f"{(base_c - final_c) / 100:.2f}".replace(".", ",") + " €"
        out["ends_at"] = end.isoformat() if end else None
    return out


def promo_status(p: dict) -> str:
    promo = p.get("promotion") or {}
    if not promo.get("enabled"):
        return "off"
    if pricing_of(p)["active"]:
        return "active"
    price = p.get("price") or 0
    if promo_final_cents(int(round(price * 100)), promo.get("type"), promo.get("value") or 0) is None:
        return "invalid"
    now = datetime.now(timezone.utc)
    start, end = _parse(promo.get("starts_at")), _parse(promo.get("ends_at"))
    return "scheduled" if start and now < start else "expired" if end and now >= end else "off"


class PromotionInput(BaseModel):
    enabled: bool = False
    type: str = "percent"
    value: float = 0
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None


@router.get("/admin/products/{slug}/promotion")
async def get_promotion(slug: str, admin=Depends(get_current_admin)):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    return {"promotion": p.get("promotion") or {}, "pricing": pricing_of(p), "status": promo_status(p)}


@router.put("/admin/products/{slug}/promotion")
async def save_promotion(slug: str, inp: PromotionInput, admin=Depends(get_current_admin)):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    if inp.type not in ("percent", "amount"):
        raise HTTPException(400, "Type de réduction inconnu.")
    start, end = _parse(inp.starts_at), _parse(inp.ends_at)
    if (inp.starts_at and not start) or (inp.ends_at and not end):
        raise HTTPException(400, "Date invalide.")
    if start and end and end <= start:
        raise HTTPException(400, "La date de fin doit être postérieure à la date de début.")
    if inp.enabled:
        price = p.get("price")
        if not isinstance(price, (int, float)) or price <= 0:
            raise HTTPException(400, "Définissez d'abord le prix du produit.")
        if promo_final_cents(int(round(price * 100)), inp.type, inp.value) is None:
            raise HTTPException(400, "Réduction invalide : pourcentage entier entre 1 et 90, ou montant laissant un prix d'au moins 0,50 € et inférieur au prix normal.")
    promo = {"enabled": inp.enabled, "type": inp.type, "value": inp.value,
             "starts_at": start.isoformat() if start else None, "ends_at": end.isoformat() if end else None,
             "updated_at": now_iso()}
    await db.products.update_one({"slug": slug}, {"$set": {"promotion": promo}})
    p["promotion"] = promo
    return {"promotion": promo, "pricing": pricing_of(p), "status": promo_status(p)}


# --------------------------------------------------------------------------- #
# Réassurance : éléments communs + exceptions par produit
# --------------------------------------------------------------------------- #
DEFAULT_REASSURANCE = [
    {"key": "one_time", "enabled": True, "icon": "Receipt", "title": "Achat unique, sans abonnement",
     "text": "Vous payez une seule fois : aucun prélèvement récurrent."},
    {"key": "access", "enabled": True, "icon": "Download", "title": "Accès dès le paiement confirmé",
     "text": "Le lien de téléchargement s'affiche après le paiement et vous est aussi envoyé par e-mail."},
    {"key": "secure_download", "enabled": True, "icon": "ShieldCheck", "title": "Téléchargement sécurisé",
     "text": "Un lien personnel, valable 30 jours, jusqu'à 25 téléchargements."},
    {"key": "secure_payment", "enabled": True, "icon": "Lock", "title": "Paiement sécurisé",
     "text": "Paiement traité par Stripe : nous n'avons jamais accès à vos coordonnées bancaires."},
    {"key": "support", "enabled": True, "icon": "LifeBuoy", "title": "Une aide en cas de difficulté",
     "text": "Écrivez-nous depuis la page Contact, nous vous répondons."},
    {"key": "updates", "enabled": False, "icon": "RefreshCw", "title": "Mises à jour du produit",
     "text": "Précisez ici les conditions réellement proposées avant d'activer cet élément."},
]


class ReassuranceItem(BaseModel):
    key: str = Field(min_length=1, max_length=60)
    enabled: bool = True
    icon: str = "ShieldCheck"
    title: str = Field("", max_length=120)
    text: str = Field("", max_length=300)


class ReassuranceInput(BaseModel):
    items: List[ReassuranceItem]


async def reassurance_items() -> list:
    doc = await db.site_config.find_one({"id": "reassurance"}, {"_id": 0})
    return doc["items"] if doc else [dict(i) for i in DEFAULT_REASSURANCE]


async def reassurance_for(p: dict) -> list:
    hidden = set(p.get("reassurance_hidden") or [])
    items = [{k: i[k] for k in ("key", "icon", "title", "text")} for i in await reassurance_items()
             if i.get("enabled") and i.get("title", "").strip() and i["key"] not in hidden]
    extra = [{"key": f"extra-{n}", "icon": e.get("icon") or "Sparkles", "title": e["title"].strip(), "text": (e.get("text") or "").strip()}
             for n, e in enumerate(p.get("reassurance_extra") or []) if (e.get("title") or "").strip()]
    return items + extra


@router.get("/admin/reassurance")
async def admin_get_reassurance(admin=Depends(get_current_admin)):
    return {"items": await reassurance_items()}


@router.put("/admin/reassurance")
async def admin_save_reassurance(inp: ReassuranceInput, admin=Depends(get_current_admin)):
    keys = [i.key for i in inp.items]
    if len(keys) != len(set(keys)):
        raise HTTPException(400, "Deux éléments portent le même identifiant.")
    for i in inp.items:
        if i.enabled and not i.title.strip():
            raise HTTPException(400, "Un élément activé doit avoir un intitulé.")
    items = [i.model_dump() for i in inp.items]
    await db.site_config.update_one({"id": "reassurance"}, {"$set": {"items": items, "updated_at": now_iso()}}, upsert=True)
    return {"items": items}


# --------------------------------------------------------------------------- #
# Vidéos : envoi par morceaux (limite du proxy), puis stockage objet existant.
# --------------------------------------------------------------------------- #
MAX_VIDEO_BYTES = 80 * 1024 * 1024
CHUNK_BYTES = 4 * 1024 * 1024
VIDEO_TYPES = {"mp4": "video/mp4", "webm": "video/webm"}
UPLOAD_DIR = "/tmp/auben_video_uploads"


class VideoInit(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    size: int


def _ext(name: str) -> str:
    base = os.path.basename(name or "")
    return base.rsplit(".", 1)[-1].lower() if "." in base else ""


def _looks_like_video(head: bytes, ext: str) -> bool:
    return head[4:8] == b"ftyp" if ext == "mp4" else head[:4] == b"\x1a\x45\xdf\xa3"


async def _purge_stale_uploads():
    # Envois abandonnés depuis plus d'une heure : suppression des morceaux temporaires.
    cutoff = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() - 3600, timezone.utc).isoformat()
    async for up in db.video_uploads.find({"created_at": {"$lt": cutoff}}, {"_id": 0, "id": 1}):
        shutil.rmtree(os.path.join(UPLOAD_DIR, up["id"]), ignore_errors=True)
        await db.video_uploads.delete_one({"id": up["id"]})


@router.post("/admin/upload/video/init")
async def video_init(inp: VideoInit, admin=Depends(get_current_admin)):
    ext = _ext(inp.filename)
    if ext not in VIDEO_TYPES:
        raise HTTPException(400, "Format vidéo non accepté : utilisez un fichier MP4 ou WebM.")
    if inp.size <= 0:
        raise HTTPException(400, "Fichier vide.")
    if inp.size > MAX_VIDEO_BYTES:
        raise HTTPException(400, f"Vidéo trop lourde ({inp.size / 1048576:.0f} Mo). Taille maximale : {MAX_VIDEO_BYTES // 1048576} Mo. Raccourcissez-la ou réduisez sa résolution.")
    await _purge_stale_uploads()
    uid = uuid.uuid4().hex
    os.makedirs(os.path.join(UPLOAD_DIR, uid), exist_ok=True)
    await db.video_uploads.insert_one({"id": uid, "ext": ext, "size": inp.size, "filename": inp.filename,
                                       "received": 0, "created_at": now_iso()})
    return {"upload_id": uid, "chunk_size": CHUNK_BYTES}


@router.put("/admin/upload/video/{uid}/chunk")
async def video_chunk(uid: str, index: int, request: Request, admin=Depends(get_current_admin)):
    up = await db.video_uploads.find_one({"id": uid}, {"_id": 0})
    if not up:
        raise HTTPException(404, "Envoi introuvable ou expiré.")
    body = await request.body()
    if not body or len(body) > CHUNK_BYTES or index != up["received"] // CHUNK_BYTES or up["received"] + len(body) > up["size"]:
        raise HTTPException(400, "Morceau de vidéo invalide. Recommencez l'envoi.")
    with open(os.path.join(UPLOAD_DIR, uid, "data"), "ab") as f:
        f.write(body)
    await db.video_uploads.update_one({"id": uid}, {"$inc": {"received": len(body)}})
    return {"received": up["received"] + len(body)}


@router.post("/admin/upload/video/{uid}/complete")
async def video_complete(uid: str, admin=Depends(get_current_admin)):
    up = await db.video_uploads.find_one({"id": uid}, {"_id": 0})
    if not up:
        raise HTTPException(404, "Envoi introuvable ou expiré.")
    folder = os.path.join(UPLOAD_DIR, uid)
    try:
        if up["received"] != up["size"]:
            raise HTTPException(400, "Vidéo incomplète. Recommencez l'envoi.")
        with open(os.path.join(folder, "data"), "rb") as f:
            data = f.read()
        if not _looks_like_video(data[:16], up["ext"]):
            raise HTTPException(400, "Ce fichier n'est pas une vidéo MP4 ou WebM lisible.")
        path = f"{APP_NAME}/videos/{uuid.uuid4()}.{up['ext']}"
        try:
            put_object(path, data, VIDEO_TYPES[up["ext"]])
        except Exception as e:
            logger.error(f"Video storage failed: {type(e).__name__}")
            raise HTTPException(502, "Le stockage de la vidéo a échoué. Réessayez.")
        await db.media.insert_one({"id": str(uuid.uuid4()), "storage_path": path, "original_filename": os.path.basename(up["filename"]),
                                   "content_type": VIDEO_TYPES[up["ext"]], "size": up["size"], "is_deleted": False, "created_at": now_iso()})
        return {"status": "ok", "path": path}
    finally:
        shutil.rmtree(folder, ignore_errors=True)
        await db.video_uploads.delete_one({"id": uid})
