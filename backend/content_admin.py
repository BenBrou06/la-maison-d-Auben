import re
from datetime import datetime, timezone
from typing import Any, List, Optional
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from auth import get_current_admin
from database import db

router = APIRouter()
SITE_URL = "https://la-maison-dauben.com"
_KEY = re.compile(r"^[a-z0-9-]{1,40}$")
_FIELD = re.compile(r"^[a-z0-9_]{1,40}$")
_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_HTML = re.compile(r"<\s*/?\s*[a-zA-Z!?]")
_BAD_URL = re.compile(r"\]\(\s*(javascript|data|vbscript):", re.I)
MAX_STR = 30000
PAGE_KEYS = {"home", "shop", "resources", "about", "faq", "contact", "header", "footer", "legal-mentions-legales", "legal-cgv",
             "legal-confidentialite", "legal-politique-cookies", "legal-produits-numeriques"}


def valid_image(img: str) -> bool:
    """Chemin local (/images/…), objet stocké (dossier/fichier.ext) ou URL https:// — jamais //hote ni javascript:."""
    if img.startswith("https://"):
        return not re.search(r"[\s\"'<>]", img)
    return not img.startswith("//") and ".." not in img and bool(re.match(r"^/?[\w\-./]+$", img))


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def check_safe(value: Any, depth: int = 0):
    """Refuse balises HTML / liens javascript: dans tout texte reçu (le rendu public est en texte brut)."""
    if depth > 4:
        raise HTTPException(400, "Structure de contenu trop profonde.")
    if isinstance(value, str):
        if len(value) > MAX_STR:
            raise HTTPException(400, "Texte trop long.")
        if _HTML.search(value) or _BAD_URL.search(value):
            raise HTTPException(400, "Le HTML et les scripts ne sont pas autorisés dans le contenu.")
    elif isinstance(value, list):
        if len(value) > 200:
            raise HTTPException(400, "Liste trop longue.")
        for v in value:
            check_safe(v, depth + 1)
    elif isinstance(value, dict):
        for k, v in value.items():
            if not _FIELD.match(str(k)):
                raise HTTPException(400, f"Nom de champ invalide : {k}")
            check_safe(v, depth + 1)
    elif value is not None and not isinstance(value, (bool, int, float)):
        raise HTTPException(400, "Type de valeur non pris en charge.")


# ---------- Contenus de pages (surcharges partielles ; les valeurs par défaut restent dans le code) ----------
class ContentUpdate(BaseModel):
    fields: dict


@router.get("/content")
async def public_content():
    docs = await db.site_content.find({}, {"_id": 0, "key": 1, "fields": 1}).to_list(100)
    return {d["key"]: d.get("fields", {}) for d in docs}


@router.get("/admin/content")
async def admin_content(admin=Depends(get_current_admin)):
    return await db.site_content.find({}, {"_id": 0}).to_list(100)


@router.put("/admin/content/{key}")
async def update_content(key: str, inp: ContentUpdate, admin=Depends(get_current_admin)):
    if key not in PAGE_KEYS:
        raise HTTPException(400, "Clé de page invalide.")
    if not inp.fields:
        raise HTTPException(400, "Aucune modification.")
    sets, unsets = {}, {}
    for name, value in inp.fields.items():
        if not _FIELD.match(name):
            raise HTTPException(400, f"Nom de champ invalide : {name}")
        check_safe(value)
        if (name.endswith("image") or name == "favicon") and value and not (isinstance(value, str) and valid_image(value)):
            raise HTTPException(400, "Image : chemin ou URL https:// invalide.")
        if value is None:
            unsets[f"fields.{name}"] = ""
        else:
            sets[f"fields.{name}"] = value
    sets.update({"key": key, "updated_at": now_iso(), "updated_by": admin["email"]})
    update = {"$set": sets}
    if unsets:
        update["$unset"] = unsets
    await db.site_content.update_one({"key": key}, update, upsert=True)
    return await db.site_content.find_one({"key": key}, {"_id": 0})


# ---------- Articles ----------
class Block(BaseModel):
    type: str = Field(pattern=r"^(p|h2)$")
    text: str = Field(min_length=1, max_length=8000)


class ArticleInput(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    slug: Optional[str] = Field(None, min_length=1, max_length=120)
    category: Optional[str] = Field(None, max_length=80)
    excerpt: Optional[str] = Field(None, max_length=600)
    cover_image: Optional[str] = Field(None, max_length=500)
    published_at: Optional[str] = Field(None, max_length=40)
    read_time: Optional[int] = Field(None, ge=1, le=120)
    content: Optional[List[Block]] = None
    cta_text: Optional[str] = Field(None, max_length=300)
    related_product_slugs: Optional[List[str]] = None
    published: Optional[bool] = None
    seo_title: Optional[str] = Field(None, max_length=200)
    seo_description: Optional[str] = Field(None, max_length=400)


async def _validated(inp: ArticleInput, current_slug: Optional[str] = None) -> dict:
    data = inp.model_dump(exclude_unset=True)
    check_safe({k: v for k, v in data.items() if k != "content"})
    for b in data.get("content") or []:
        check_safe(b["text"])
    img = data.get("cover_image")
    if img and not valid_image(img):
        raise HTTPException(400, "Image : chemin ou URL https:// invalide.")
    if "slug" in data:
        if not _SLUG.match(data["slug"]):
            raise HTTPException(400, "Slug invalide : lettres minuscules, chiffres et tirets uniquement.")
        if data["slug"] != current_slug:
            clash = await db.articles.find_one({"$or": [{"slug": data["slug"]}, {"previous_slugs": data["slug"]}]})
            if clash and clash.get("slug") != current_slug:
                raise HTTPException(409, "Ce slug est déjà utilisé par un autre article.")
    for ps in data.get("related_product_slugs") or []:
        if not await db.products.find_one({"slug": ps}):
            raise HTTPException(400, f"Produit associé introuvable : {ps}")
    if data.get("published_at"):
        try:
            datetime.fromisoformat(data["published_at"].replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "Date de publication invalide.")
    return data


@router.get("/admin/articles")
async def admin_articles(admin=Depends(get_current_admin)):
    return await db.articles.find({}, {"_id": 0}).sort("published_at", -1).to_list(500)


@router.post("/admin/articles")
async def create_article(inp: ArticleInput, admin=Depends(get_current_admin)):
    if not inp.title or not inp.slug:
        raise HTTPException(400, "Titre et slug obligatoires.")
    data = await _validated(inp)
    doc = {"category": "", "excerpt": "", "cover_image": "", "read_time": 3, "content": [], "cta_text": "",
           "related_product_slugs": [], "published": False, "published_at": now_iso(), **data,
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.articles.insert_one(doc)
    return await db.articles.find_one({"slug": doc["slug"]}, {"_id": 0})


@router.put("/admin/articles/{slug}")
async def update_article(slug: str, inp: ArticleInput, admin=Depends(get_current_admin)):
    current = await db.articles.find_one({"slug": slug})
    if not current:
        raise HTTPException(404, "Article introuvable.")
    data = await _validated(inp, current_slug=slug)
    if not data:
        raise HTTPException(400, "Aucune modification.")
    update = {"$set": {**data, "updated_at": now_iso()}}
    if data.get("slug") and data["slug"] != slug:
        update["$addToSet"] = {"previous_slugs": slug}
        await db.articles.update_one({"slug": slug}, {"$pull": {"previous_slugs": data["slug"]}})
    await db.articles.update_one({"slug": slug}, update)
    return await db.articles.find_one({"slug": data.get("slug", slug)}, {"_id": 0})


# ---------- FAQ ----------
class FaqItem(BaseModel):
    id: Optional[str] = Field(None, max_length=60)
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=5000)


class FaqInput(BaseModel):
    items: List[FaqItem] = Field(max_length=200)


@router.get("/admin/faq")
async def admin_faq(admin=Depends(get_current_admin)):
    return await db.faq.find({}, {"_id": 0}).sort("order", 1).to_list(200)


@router.put("/admin/faq")
async def save_faq(inp: FaqInput, admin=Depends(get_current_admin)):
    import uuid
    for it in inp.items:
        check_safe([it.question, it.answer])
    ids = [it.id for it in inp.items if it.id]
    if len(ids) != len(set(ids)):
        raise HTTPException(400, "Identifiants de questions en double.")
    keep = []
    for i, it in enumerate(inp.items):
        fid = it.id or f"faq-{uuid.uuid4().hex[:10]}"
        keep.append(fid)
        await db.faq.update_one({"id": fid}, {"$set": {"id": fid, "question": it.question, "answer": it.answer,
                                                       "order": i + 1, "updated_at": now_iso()}}, upsert=True)
    await db.faq.delete_many({"id": {"$nin": keep}})
    return await db.faq.find({}, {"_id": 0}).sort("order", 1).to_list(200)


# ---------- Sitemap dynamique ----------
STATIC_PAGES = ["/", "/boutique", "/ressources", "/a-propos", "/faq", "/contact", "/mentions-legales",
                "/cgv", "/confidentialite", "/politique-cookies", "/produits-numeriques"]


@router.get("/sitemap.xml")
async def sitemap():
    urls = [(p, None) for p in STATIC_PAGES]
    for p in await db.products.find({}, {"_id": 0, "slug": 1}).to_list(500):
        urls.append((f"/boutique/{p['slug']}", None))
    for a in await db.articles.find({"published": {"$ne": False}}, {"_id": 0, "slug": 1, "updated_at": 1, "published_at": 1}).to_list(500):
        urls.append((f"/ressources/{a['slug']}", (a.get("updated_at") or a.get("published_at") or "")[:10] or None))
    body = "".join(
        f"<url><loc>{xml_escape(SITE_URL + path)}</loc>{f'<lastmod>{lm}</lastmod>' if lm else ''}</url>"
        for path, lm in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    return Response(content=xml, media_type="application/xml")
