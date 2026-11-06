"""Sélection des identifiants Stripe selon l'environnement, reconnu par PUBLIC_BASE_URL (jamais par STRIPE_MODE seul)."""

PREVIEW_URL = "https://auben-preview-shop.preview.emergentagent.com"
PRODUCTION_URL = "https://la-maison-dauben.com"


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
        # Étapes 1-2 de la migration : la Production conserve les variables gérées par Emergent.
        return {"environment": "production", "secret": (env.get("STRIPE_SECRET_KEY") or "").strip(),
                "publishable": (env.get("STRIPE_PUBLISHABLE_KEY") or "").strip(),
                "webhook": (env.get("STRIPE_WEBHOOK_SECRET") or "").strip(), "source": "STRIPE_*"}
    _fail("PUBLIC_BASE_URL ne correspond ni à la Preview ni à la Production attendues.")
