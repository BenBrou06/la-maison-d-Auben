# Second audit : CORS, logo commun. Preview uniquement, `-n 0`.
import requests
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware

from cors_config import cors_origins

BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
SITE = "https://la-maison-dauben.com"


class TestCorsConfig:
    def test_live_never_wildcard(self):
        for env in ("", "*", " * "):
            assert cors_origins("live", env, SITE) == [SITE, "https://www.la-maison-dauben.com"]
        assert cors_origins("live", "*, https://a.example", SITE) == ["https://a.example"]
        assert cors_origins("live", f"{SITE}/, https://www.la-maison-dauben.com", SITE) == [SITE, "https://www.la-maison-dauben.com"]

    def test_test_mode_keeps_explicit_or_wildcard(self):
        assert cors_origins("test", "*", "https://x.preview") == ["*"]
        assert cors_origins("test", "https://a.example", "https://x.preview") == ["https://a.example"]

    def test_live_policy_behaviour(self):
        # Même configuration que server.py en production, appliquée à une app isolée.
        app = FastAPI()
        app.add_middleware(CORSMiddleware, allow_origins=cors_origins("live", "*", SITE), allow_credentials=False,
                           allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                           allow_headers=["Authorization", "Content-Type"])

        @app.get("/api/x")
        def x():
            return {"ok": True}

        c = TestClient(app)
        for good in (SITE, "https://www.la-maison-dauben.com"):
            r = c.get("/api/x", headers={"Origin": good})
            assert r.headers.get("access-control-allow-origin") == good
            assert "access-control-allow-credentials" not in r.headers
            p = c.options("/api/x", headers={"Origin": good, "Access-Control-Request-Method": "POST",
                                             "Access-Control-Request-Headers": "authorization,content-type"})
            assert p.status_code == 200 and p.headers.get("access-control-allow-origin") == good
        for bad in ("https://evil.example", "https://la-maison-dauben.com.evil.example", "https://auben-preview-shop.emergent.host", "null"):
            r = c.get("/api/x", headers={"Origin": bad})
            assert "access-control-allow-origin" not in r.headers, bad
            p = c.options("/api/x", headers={"Origin": bad, "Access-Control-Request-Method": "POST"})
            assert p.status_code == 400, bad
        p = c.options("/api/x", headers={"Origin": SITE, "Access-Control-Request-Method": "POST",
                                         "Access-Control-Request-Headers": "x-evil"})
        assert p.status_code == 400


class TestPreviewCors:
    def test_no_credentials_with_wildcard(self):
        r = requests.get(f"{API}/products", headers={"Origin": "https://evil.example"})
        assert r.headers.get("access-control-allow-credentials") != "true"
        assert r.headers.get("access-control-allow-origin") in ("*", None)


class TestLogo:
    def test_default_logo_files(self):
        for path in ("/images/logo-176.png", "/images/favicon-32.png", "/images/favicon-default.png"):
            r = requests.get(BASE + path)
            assert r.status_code == 200 and r.headers["content-type"].startswith("image/png"), path
        src = open("/app/frontend/src/components/Logo.jsx").read()
        assert "c.favicon" in src and "assets/logo" not in src
        fav = open("/app/frontend/src/components/SiteFavicon.jsx").read()
        assert 'useContent("header")' in fav and "favicon" in fav
