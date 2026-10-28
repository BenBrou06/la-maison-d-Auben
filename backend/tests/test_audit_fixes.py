# Correctifs d'audit (2026-06) : sitemap unique, robots, canonique, en-têtes API, contact, limitation de débit,
# redirections d'articles. Preview uniquement, données synthétiques (préfixe fictif-audit-) supprimées. `-n 0`.
import os
import re
import time
import xml.etree.ElementTree as ET

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
SITE = "https://la-maison-dauben.com"
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
P = "fictif-audit-"


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    mdb.articles.delete_many({"slug": {"$regex": "^" + P}})
    mdb.contact_messages.delete_many({"email": {"$regex": "^" + P}})


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    e = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    p = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    return {"Authorization": "Bearer " + requests.post(f"{API}/admin/login", json={"email": e, "password": p}).json()["access_token"]}


def _locs():
    root = ET.fromstring(requests.get(f"{API}/sitemap.xml").content)
    return [e.text for e in root.findall("s:url/s:loc", NS)]


class TestSitemap:
    def test_static_file_is_index_to_dynamic(self):
        r = requests.get(f"{BASE}/sitemap.xml")
        root = ET.fromstring(r.content)
        assert root.tag.endswith("sitemapindex")
        assert [e.text for e in root.findall("s:sitemap/s:loc", NS)] == [f"{SITE}/api/sitemap.xml"]

    def test_dynamic_rules(self, h):
        locs = _locs()
        assert len(locs) == len(set(locs)), "doublons"
        assert all(u.startswith(SITE + "/") for u in locs)
        for bad in ("/admin", "/paiement", "/telechargement", "/newsletter/desinscription", "/api/"):
            assert not any(bad in u for u in locs), bad
        products = {p["slug"] for p in requests.get(f"{API}/products").json()}
        articles = {a["slug"] for a in requests.get(f"{API}/articles").json()}
        assert {f"{SITE}/boutique/{s}" for s in products} <= set(locs)
        assert {f"{SITE}/ressources/{s}" for s in articles} <= set(locs)
        slug = P + "brouillon"
        assert requests.post(f"{API}/admin/articles", headers=h, json={"title": "Brouillon", "slug": slug}).status_code == 200
        assert f"{SITE}/ressources/{slug}" not in _locs()
        assert requests.get(f"{API}/articles/{slug}").status_code == 404

    def test_robots(self):
        t = requests.get(f"{BASE}/robots.txt").text
        assert f"Sitemap: {SITE}/api/sitemap.xml" in t and "Disallow: /admin" in t


class TestSeoSources:
    def test_no_generic_canonical_in_index_html(self):
        html = open("/app/frontend/public/index.html").read()
        assert 'rel="canonical"' not in html
        seo = open("/app/frontend/src/components/Seo.jsx").read()
        assert "canonical" in seo and "og:url" in seo and "application/ld+json" in seo


class TestApiHeaders:
    def test_frame_protection_on_api(self):
        r = requests.get(f"{API}/products")
        assert r.headers.get("X-Frame-Options") == "DENY"
        assert "frame-ancestors 'none'" in r.headers.get("Content-Security-Policy", "")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"


class TestContactValidation:
    @pytest.mark.parametrize("payload", [
        {"name": "x" * 101, "email": "a@exemple-fictif.fr", "message": "m"},
        {"name": "Nom", "email": "a@exemple-fictif.fr", "message": "m" * 5001},
        {"name": "Nom", "email": "a@exemple-fictif.fr", "subject": "s" * 201, "message": "m"},
        {"name": "   ", "email": "a@exemple-fictif.fr", "message": "m"},
        {"name": "Nom", "email": "a@exemple-fictif.fr", "message": "   "},
        {"name": "Nom", "email": "pas-un-email", "message": "m"},
        {"email": "a@exemple-fictif.fr", "message": "m"},
    ])
    def test_invalid_rejected(self, payload):
        assert requests.post(f"{API}/contact", json=payload).status_code == 422

    def test_valid_accepted(self):
        r = requests.post(f"{API}/contact", json={"name": "Fictif", "email": f"{P}ok@exemple-fictif.fr", "subject": "", "message": "Bonjour"})
        assert r.status_code == 200
        assert mdb.contact_messages.find_one({"email": f"{P}ok@exemple-fictif.fr"})


class TestRateLimitSpoofing:
    def test_spoofed_forwarded_for_does_not_bypass(self):
        time.sleep(61)
        codes = []
        for i in range(7):
            codes.append(requests.post(f"{API}/admin/login", json={"email": "no@exemple-fictif.fr", "password": "x"},
                                       headers={"X-Forwarded-For": f"198.51.100.{i}"}).status_code)
        assert codes[:5] == [401] * 5 and 429 in codes[5:], codes
        time.sleep(61)


class TestArticleRedirects:
    def test_rename_chain_without_loop(self, h):
        a, b = P + "a", P + "b"
        assert requests.post(f"{API}/admin/articles", headers=h, json={"title": "A", "slug": a, "published": True}).status_code == 200
        assert requests.put(f"{API}/admin/articles/{a}", headers=h, json={"slug": b}).status_code == 200
        assert requests.get(f"{API}/articles/{a}").json() == {"redirect_to": b}
        assert requests.put(f"{API}/admin/articles/{b}", headers=h, json={"slug": a}).status_code == 200
        assert requests.get(f"{API}/articles/{a}").json()["slug"] == a  # plus de redirection vers soi-même
        assert requests.get(f"{API}/articles/{b}").json() == {"redirect_to": a}
        assert requests.get(f"{API}/articles/{P}inexistant").status_code == 404
