"""Règles communes : référence Stripe (lookup_key), devise et conditions de mise en vente."""
import logging
import re

logger = logging.getLogger("product_rules")

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LOOKUP_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-.]{0,199}$")
DEFAULT_CURRENCY = "eur"
_warned = set()


def derive_lookup(slug: str):
    """Clé déduite du slug, uniquement si le slug est sans ambiguïté (minuscules, chiffres, tirets)."""
    return slug.replace("-", "_") if slug and SLUG_RE.match(slug) else None


def valid_lookup(key) -> bool:
    return isinstance(key, str) and bool(LOOKUP_RE.match(key))


def effective_lookup(p: dict, warn: bool = False, always: bool = False):
    key = p.get("lookup_key")
    if key:
        return key
    key = derive_lookup(p.get("slug", ""))
    if warn and (always or (p.get("slug"), "lookup_key") not in _warned):
        _warned.add((p.get("slug"), "lookup_key"))
        logger.warning(f"ANOMALIE produit slug={p.get('slug')} : lookup_key absent en base, "
                       f"référence déduite du slug = {key or 'IMPOSSIBLE (slug non conforme)'}")
    return key


def effective_currency(p: dict, warn: bool = False, always: bool = False):
    cur = p.get("currency")
    if cur:
        return cur
    if warn and (always or (p.get("slug"), "currency") not in _warned):
        _warned.add((p.get("slug"), "currency"))
        logger.warning(f"ANOMALIE produit slug={p.get('slug')} : currency absente en base, "
                       f"devise par défaut utilisée = {DEFAULT_CURRENCY}")
    return DEFAULT_CURRENCY


def has_real_file(p: dict) -> bool:
    return bool(p.get("download_storage_path")) and not p.get("download_is_placeholder")


def commercial_issues(p: dict) -> list:
    """Conditions bloquantes pour qu'un produit soit achetable (sans appel Stripe ni base)."""
    issues = []
    price = p.get("price")
    if not isinstance(price, (int, float)) or price <= 0:
        issues.append({"code": "price", "message": "Prix manquant ou non positif."})
    if not effective_currency(p):
        issues.append({"code": "currency", "message": "Devise manquante."})
    key = effective_lookup(p)
    if not valid_lookup(key):
        issues.append({"code": "lookup_key", "message": "Référence Stripe manquante ou invalide (slug non conforme)."})
    if not has_real_file(p):
        issues.append({"code": "file", "message": "Aucun vrai fichier téléchargeable."})
    return issues


async def lookup_owners(db, key: str) -> list:
    """Slugs de tous les produits dont la référence effective (enregistrée ou déduite) vaut `key`."""
    owners = []
    async for p in db.products.find({}, {"_id": 0, "slug": 1, "lookup_key": 1}):
        if effective_lookup(p) == key:
            owners.append(p["slug"])
    return owners
