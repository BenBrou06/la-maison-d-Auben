from urllib.parse import urlparse


def cors_origins(stripe_mode: str, cors_env: str, public_base_url: str) -> list:
    """Origines CORS autorisées. Production (live) : jamais "*" — à défaut, origine de PUBLIC_BASE_URL + www."""
    listed = [o.strip().rstrip("/") for o in (cors_env or "").split(",") if o.strip() and o.strip() != "*"]
    if stripe_mode != "live":
        return listed or ["*"]
    if listed:
        return listed
    u = urlparse(public_base_url)
    out = [f"{u.scheme}://{u.netloc}"]
    if not u.netloc.startswith("www."):
        out.append(f"{u.scheme}://www.{u.netloc}")
    return out
