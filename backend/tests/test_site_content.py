# Contenu éditorial : cohérence disponibilité, pages, articles, FAQ, sitemap, non-écrasement au démarrage.
# Lancer avec `-n 0`. Données fictives (préfixe fictif-ed-) supprimées ; contenus réels restaurés en fin de test.
import os
import re
import subprocess
import time

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
P = "fictif-ed-"
SEED_SLUG = "comment-faire-son-budget-mensuel"


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    e = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    p = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    tok = requests.post(f"{API}/admin/login", json={"email": e, "password": p}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module", autouse=True)
def snapshot():
    content = list(mdb.site_content.find({}, {"_id": 0}))
    faq = list(mdb.faq.find({}, {"_id": 0}))
    prices = {p["slug"]: (p.get("price"), p.get("status"), p.get("download_storage_path")) for p in mdb.products.find()}
    yield
    mdb.site_content.delete_many({})
    if content:
        mdb.site_content.insert_many(content)
    mdb.faq.delete_many({})
    if faq:
        mdb.faq.insert_many(faq)
    mdb.articles.delete_many({"slug": {"$regex": "^" + P}})
    mdb.articles.update_many({}, {"$pull": {"previous_slugs": {"$regex": "^" + P}}})
    after = {p["slug"]: (p.get("price"), p.get("status"), p.get("download_storage_path")) for p in mdb.products.find()}
    assert after == prices, "les produits (prix/statut/fichier) ne doivent jamais changer"


def _restart_backend():
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], capture_output=True)
    for _ in range(40):
        time.sleep(1)
        try:
            if requests.get(f"{API}/", timeout=3).status_code == 200:
                return
        except requests.RequestException:
            pass
    raise AssertionError("backend non redémarré")


class TestAvailability:
    def test_article_products_match_shop(self):
        shop = {p["slug"]: p["purchasable"] for p in requests.get(f"{API}/products").json()}
        checked = 0
        for a in requests.get(f"{API}/articles").json():
            for p in requests.get(f"{API}/articles/{a['slug']}").json().get("related_products", []):
                assert p["purchasable"] == shop[p["slug"]], (a["slug"], p["slug"])
                checked += 1
        assert checked > 0
        rel = requests.get(f"{API}/articles/{SEED_SLUG}").json()["related_products"]
        bm = [p for p in rel if p["slug"] == "budget-mensuel"]
        assert bm and bm[0]["purchasable"] is True


class TestPageContent:
    def test_requires_admin(self):
        assert requests.put(f"{API}/admin/content/home", json={"fields": {"why_title": "x"}}).status_code == 401
        assert requests.get(f"{API}/admin/content").status_code == 401
        for path in ("/admin/articles", "/admin/faq"):
            assert requests.get(API + path).status_code == 401
        assert requests.put(f"{API}/admin/faq", json={"items": []}).status_code == 401
        assert requests.post(f"{API}/admin/articles", json={"title": "x", "slug": "x"}).status_code == 401

    def test_rejects_html_and_bad_names(self, h):
        for bad in ("<script>alert(1)</script>", "Texte <b>gras</b>", "[clic](javascript:alert(1))"):
            assert requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"why_title": bad}}).status_code == 400
        assert requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"Bad-Name": "x"}}).status_code == 400
        assert requests.put(f"{API}/admin/content/../x", headers=h, json={"fields": {"a": "x"}}).status_code in (400, 404)
        lst = [{"title": "ok", "body": "<img src=x onerror=alert(1)>"}]
        assert requests.put(f"{API}/admin/content/legal-cgv", headers=h, json={"fields": {"sections": lst}}).status_code == 400
        assert requests.put(f"{API}/admin/content/page-inconnue", headers=h, json={"fields": {"a": "x"}}).status_code == 400
        assert requests.put(f"{API}/admin/content/about", headers=h, json={"fields": {"image": "//evil.example/x.png"}}).status_code == 400
        assert requests.put(f"{API}/admin/articles/{SEED_SLUG}", headers=h, json={"cover_image": "//evil.example/x.png"}).status_code == 400
        dup = [{"id": "faq-1", "question": "a", "answer": "b"}, {"id": "faq-1", "question": "c", "answer": "d"}]
        assert requests.put(f"{API}/admin/faq", headers=h, json={"items": dup}).status_code == 400

    def test_partial_save_merge_unset_and_restart(self, h):
        r = requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"why_title": "Titre fictif A"}})
        assert r.status_code == 200
        requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"brand_cta": "Bouton fictif B"}})
        legal = [{"title": "Section fictive", "body": "Para.\n\n- un\n- deux"}]
        requests.put(f"{API}/admin/content/legal-cgv", headers=h, json={"fields": {"sections": legal}})
        pub = requests.get(f"{API}/content").json()
        assert pub["home"]["why_title"] == "Titre fictif A" and pub["home"]["brand_cta"] == "Bouton fictif B"
        assert pub["legal-cgv"]["sections"] == legal
        _restart_backend()
        pub = requests.get(f"{API}/content").json()
        assert pub["home"]["why_title"] == "Titre fictif A" and pub["legal-cgv"]["sections"] == legal
        requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"why_title": None}})
        pub = requests.get(f"{API}/content").json()
        assert "why_title" not in pub["home"] and pub["home"]["brand_cta"] == "Bouton fictif B"


class TestArticles:
    def test_create_draft_publish_rename_redirect(self, h):
        slug = P + "article"
        r = requests.post(f"{API}/admin/articles", headers=h, json={
            "title": "Article fictif", "slug": slug, "excerpt": "Extrait", "category": "Budget",
            "content": [{"type": "h2", "text": "Titre"}, {"type": "p", "text": "Paragraphe"}],
            "related_product_slugs": ["budget-mensuel"], "seo_title": "SEO fictif"})
        assert r.status_code == 200 and r.json()["published"] is False
        assert requests.get(f"{API}/articles/{slug}").status_code == 404
        assert slug not in requests.get(f"{API}/sitemap.xml").text
        assert requests.post(f"{API}/admin/articles", headers=h, json={"title": "x", "slug": slug}).status_code == 409
        assert requests.put(f"{API}/admin/articles/{slug}", headers=h, json={"published": True}).status_code == 200
        a = requests.get(f"{API}/articles/{slug}").json()
        assert a["seo_title"] == "SEO fictif" and a["excerpt"] == "Extrait" and a["related_products"][0]["purchasable"] is True
        assert slug in requests.get(f"{API}/sitemap.xml").text
        new = P + "article-renomme"
        assert requests.put(f"{API}/admin/articles/{slug}", headers=h, json={"slug": new}).status_code == 200
        assert requests.get(f"{API}/articles/{slug}").json() == {"redirect_to": new}
        assert requests.get(f"{API}/articles/{new}").json()["content"][0]["text"] == "Titre"
        assert requests.put(f"{API}/admin/articles/{new}", headers=h, json={"slug": SEED_SLUG}).status_code == 409
        assert requests.put(f"{API}/admin/articles/{new}", headers=h, json={"content": [{"type": "p", "text": "<script>x</script>"}]}).status_code == 400
        assert requests.put(f"{API}/admin/articles/{new}", headers=h, json={"slug": "Pas Bon"}).status_code == 400

    def test_renamed_seed_article_not_recreated_on_restart(self, h):
        tmp = P + "seed-renomme"
        assert requests.put(f"{API}/admin/articles/{SEED_SLUG}", headers=h, json={"slug": tmp}).status_code == 200
        _restart_backend()
        assert mdb.articles.count_documents({"slug": SEED_SLUG}) == 0
        assert requests.get(f"{API}/articles/{SEED_SLUG}").json() == {"redirect_to": tmp}
        assert requests.put(f"{API}/admin/articles/{tmp}", headers=h, json={"slug": SEED_SLUG}).status_code == 200
        assert requests.get(f"{API}/articles/{SEED_SLUG}").json()["slug"] == SEED_SLUG


class TestFaq:
    def test_edit_reorder_delete_survive_restart(self, h):
        items = [{"id": f["id"], "question": f["question"], "answer": f["answer"]} for f in requests.get(f"{API}/faq").json()]
        assert len(items) >= 2
        new = [items[1], {**items[0], "answer": "Réponse fictive"}, {"question": "Question fictive ?", "answer": "Oui."}] + items[3:]
        r = requests.put(f"{API}/admin/faq", headers=h, json={"items": new})
        assert r.status_code == 200
        _restart_backend()
        pub = requests.get(f"{API}/faq").json()
        assert [f["question"] for f in pub][:3] == [items[1]["question"], items[0]["question"], "Question fictive ?"]
        assert pub[1]["answer"] == "Réponse fictive"
        assert items[2]["id"] not in [f["id"] for f in pub]  # supprimée et non recréée au démarrage
        assert requests.put(f"{API}/admin/faq", headers=h, json={"items": [{"question": "<b>x</b>", "answer": "y"}]}).status_code == 400


class TestArticleDeletion:
    def test_delete_requires_confirmation_and_only_removes_target(self, h):
        keep, gone = P + "garde", P + "supprime"
        for s in (keep, gone):
            assert requests.post(f"{API}/admin/articles", headers=h, json={"title": s, "slug": s, "published": True,
                                 "content": [{"type": "p", "text": "x"}]}).status_code == 200
        assert requests.put(f"{API}/admin/articles/{gone}", headers=h, json={"slug": gone + "-v2"}).status_code == 200
        gone2 = gone + "-v2"
        before = mdb.articles.count_documents({})
        assert requests.delete(f"{API}/admin/articles/{gone2}", json={"confirmation": "SUPPRIMER"}).status_code == 401
        assert requests.delete(f"{API}/admin/articles/{gone2}", headers=h, json={"confirmation": "oui"}).status_code == 400
        assert requests.delete(f"{API}/admin/articles/{gone2}", headers=h).status_code == 422
        assert mdb.articles.count_documents({}) == before
        assert requests.delete(f"{API}/admin/articles/{gone2}", headers=h, json={"confirmation": "SUPPRIMER"}).status_code == 200
        assert mdb.articles.count_documents({}) == before - 1
        assert mdb.articles.find_one({"slug": gone2}) is None and mdb.articles.find_one({"slug": keep})
        assert requests.get(f"{API}/articles/{gone2}").status_code == 404
        assert requests.get(f"{API}/articles/{gone}").status_code == 404  # ancienne adresse : 404, pas de redirection
        xml = requests.get(f"{API}/sitemap.xml").text
        assert gone2 not in xml and f"/ressources/{keep}" in xml and f"/ressources/{SEED_SLUG}" in xml
        assert gone2 not in [a["slug"] for a in requests.get(f"{API}/admin/articles", headers=h).json()]
        assert requests.delete(f"{API}/admin/articles/{gone2}", headers=h, json={"confirmation": "SUPPRIMER"}).status_code == 404
        assert requests.put(f"{API}/admin/articles/{keep}", headers=h, json={"excerpt": "Toujours là"}).status_code == 200
        assert requests.get(f"{API}/articles/{keep}").json()["excerpt"] == "Toujours là"


class TestHeaderAndFavicon:
    def test_default_favicon_files_served(self):
        for path in ("/images/favicon-32.png", "/images/apple-touch-icon.png", "/images/favicon-default.png"):
            r = requests.get(BASE + path)
            assert r.status_code == 200 and r.headers.get("content-type", "").startswith("image/png"), path
        html = open("/app/frontend/public/index.html").read()
        assert 'id="site-favicon"' in html and "favicon-32.png" in html and 'id="site-apple-icon"' in html

    def test_favicon_and_header_texts_saved(self, h):
        assert requests.put(f"{API}/admin/content/header", headers=h, json={"fields": {"favicon": "//evil.example/x.png"}}).status_code == 400
        assert requests.put(f"{API}/admin/content/header", headers=h, json={"fields": {"nav_shop": "<b>x</b>"}}).status_code == 400
        assert requests.put(f"{API}/admin/content/header", json={"fields": {"nav_shop": "x"}}).status_code == 401
        up = requests.post(f"{API}/admin/upload/image", headers=h,
                           files={"file": ("fav.png", open("/app/frontend/public/images/favicon-32.png", "rb"), "image/png")})
        assert up.status_code == 200
        path = up.json()["path"]
        r = requests.put(f"{API}/admin/content/header", headers=h, json={"fields": {"favicon": path, "nav_shop": "Magasin fictif"}})
        assert r.status_code == 200
        pub = requests.get(f"{API}/content").json()["header"]
        assert pub == {"favicon": path, "nav_shop": "Magasin fictif"}
        assert requests.get(f"{API}/media/{path}").status_code == 200
        assert "footer" not in requests.get(f"{API}/content").json()  # pied de page non touché
        requests.put(f"{API}/admin/content/header", headers=h, json={"fields": {"favicon": None, "nav_shop": None}})
        assert requests.get(f"{API}/content").json().get("header", {}) == {}


class TestSitemapAndCommerce:
    def test_sitemap_contents(self):
        xml = requests.get(f"{API}/sitemap.xml").text
        assert "https://la-maison-dauben.com/boutique/budget-mensuel" in xml and f"/ressources/{SEED_SLUG}" in xml
        assert "/admin" not in xml and "/paiement" not in xml and "/telechargement" not in xml

    def test_checkout_guard_unchanged(self):
        r = requests.post(f"{API}/payments/checkout", json={"product_slug": "budget-mensuel", "origin_url": BASE})
        assert r.status_code in (400, 422)  # sans renonciation : refus, aucun paiement
        prod = requests.get(f"{API}/products/budget-mensuel").json()
        assert prod["purchasable"] is True and prod["price"] == 6.99
