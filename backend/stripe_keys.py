"""Sélection des identifiants Stripe selon l'environnement, reconnu par PUBLIC_BASE_URL (jamais par STRIPE_MODE seul)."""

PREVIEW_URL = "https://auben-preview-shop.preview.emergentagent.com"
PRODUCTION_URL = "https://la-maison-dauben.com"
LIVE_ACCOUNT_ID = "acct_1UHr1vA7WGaTzlxD"
# Source des clés en Production : "new" = NEW_STRIPE_* (valeurs Live) ; retour arrière : "emergent" = STRIPE_* gérées par Emergent.
PRODUCTION_KEY_SOURCE = "new"


def _fail(msg: str):
    raise RuntimeError("CONFIG ERROR (Stripe) : " + msg + " Refus de démarrer. Aucune valeur de clé n'est affichée.")


def select_stripe_keys(env) -> dict:
    url = (env.get("PUBLIC_BASE_URL") or "").strip().rstrip("/")
    mode = (env.get("STRIPE_MODE") or "").strip().lower()
    if url == PREVIEW_URL:
        if mode == "live":
            _fail("STRIPE_MODE=live sur l'adresse Preview.")
        secret = (env.get("NEW_STRIPE_SECRET_KEY") or "").strip()
        publishable = (env.get("NEW_STRIPE_PUBLISHABLE_KEY") or "").strip()
        webhook = (env.get("NEW_STRIPE_WEBHOOK_SECRET") or "").strip()
        if not secret.startswith(("sk_test_", "rk_test_")):
            _fail("NEW_STRIPE_SECRET_KEY absente ou n'est pas une clé TEST (sk_test_/rk_test_).")
        if not publishable.startswith("pk_test_"):
            _fail("NEW_STRIPE_PUBLISHABLE_KEY absente ou n'est pas une clé TEST (pk_test_).")
        if not webhook:
            _fail("NEW_STRIPE_WEBHOOK_SECRET absent : secret de l'endpoint webhook TEST requis.")
        return {"environment": "preview", "secret": secret, "publishable": publishable, "webhook": webhook, "source": "NEW_STRIPE_*"}
    if url == PRODUCTION_URL:
        if mode != "live":
            _fail("STRIPE_MODE doit valoir live sur l'adresse de Production.")
        prefix = "NEW_STRIPE_" if PRODUCTION_KEY_SOURCE == "new" else "STRIPE_"
        secret = (env.get(prefix + "SECRET_KEY") or "").strip()
        publishable = (env.get(prefix + "PUBLISHABLE_KEY") or "").strip()
        webhook = (env.get(prefix + "WEBHOOK_SECRET") or "").strip()
        if PRODUCTION_KEY_SOURCE == "new":
            if not secret.startswith(("sk_live_", "rk_live_")):
                _fail("NEW_STRIPE_SECRET_KEY absente ou n'est pas une clé LIVE (sk_live_/rk_live_).")
            if not publishable.startswith("pk_live_"):
                _fail("NEW_STRIPE_PUBLISHABLE_KEY absente ou n'est pas une clé LIVE (pk_live_).")
            if not webhook:
                _fail("NEW_STRIPE_WEBHOOK_SECRET absent : secret de l'endpoint webhook LIVE requis.")
        return {"environment": "production", "secret": secret, "publishable": publishable,
                "webhook": webhook, "source": prefix + "*"}
    _fail("PUBLIC_BASE_URL ne correspond ni à la Preview ni à la Production attendues.")


def preflight_new_live(env, current_webhook: str, account_of) -> dict:
    """Contrôle en lecture seule des valeurs NEW_STRIPE_* LIVE (résultats oui/non, jamais de valeur)."""
    import hmac
    secret = (env.get("NEW_STRIPE_SECRET_KEY") or "").strip()
    publishable = (env.get("NEW_STRIPE_PUBLISHABLE_KEY") or "").strip()
    webhook = (env.get("NEW_STRIPE_WEBHOOK_SECRET") or "").strip()
    res = {"presentes": bool(secret and publishable and webhook),
           "prefixe_secrete": secret.startswith(("sk_live_", "rk_live_")),
           "prefixe_publiable": publishable.startswith("pk_live_"),
           "webhook_identique": bool(webhook and current_webhook) and hmac.compare_digest(webhook, current_webhook),
           "compte": "non vérifié"}
    if res["prefixe_secrete"]:
        try:
            res["compte"] = "conforme" if account_of(secret) == LIVE_ACCOUNT_ID else "AUTRE COMPTE"
        except Exception as e:
            res["compte"] = "erreur " + type(e).__name__
    return res
