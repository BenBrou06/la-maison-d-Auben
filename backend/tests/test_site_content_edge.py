# Edge cases contenu éditorial (iteration_13) : chaînes de renommage, brouillons, FAQ, images, contenu public.
# Lancer avec `-n 0`. Données fictives préfixe fictif-e13- supprimées en fin de module.
import os
import re

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
P = "fictif-e13-"


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    e = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    p = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    tok = requests.post(f"{API}/admin/login", json={"email": e, "password": p}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    content = list(mdb.site_content.find({}, {"_id": 0}))
    faq = list(mdb.faq.find({}, {"_id": 0}))
    yield
    mdb.articles.delete_many({"slug": {"$regex": "^" + P}})
    mdb.site_content.delete_many({})
    if content:
        mdb.site_content.insert_many(content)
    mdb.faq.delete_many({})
    if faq:
        mdb.faq.insert_many(faq)


def mk(h, slug, **kw):
    return requests.post(f"{API}/admin/articles", headers=h, json={"title": "T " + slug, "slug": slug, **kw})


class TestRenameChains:
    def test_chain_a_b_c_redirects_to_latest(self, h):
        a, b, c = P + "a", P + "b", P + "c"
        assert mk(h, a, published=True).status_code == 200
        assert requests.put(f"{API}/admin/articles/{a}", headers=h, json={"slug": b}).status_code == 200
        assert requests.put(f"{API}/admin/articles/{b}", headers=h, json={"slug": c}).status_code == 200
        assert requests.get(f"{API}/articles/{a}").json() == {"redirect_to": c}
        assert requests.get(f"{API}/articles/{b}").json() == {"redirect_to": c}
        # Revenir à l'ancien slug a : autorisé (c'est le sien), plus de redirection en boucle
        r = requests.put(f"{API}/admin/articles/{c}", headers=h, json={"slug": a})
        assert r.status_code == 200, r.text
        assert a not in r.json().get("previous_slugs", [])
        assert requests.get(f"{API}/articles/{a}").json()["slug"] == a
        assert requests.get(f"{API}/articles/{c}").json() == {"redirect_to": a}

    def test_new_article_cannot_take_previous_slug_of_other(self, h):
        assert mk(h, P + "b").status_code == 409

    def test_draft_previous_slug_not_redirected(self, h):
        d, d2 = P + "draft", P + "draft2"
        assert mk(h, d).status_code == 200
        requests.put(f"{API}/admin/articles/{d}", headers=h, json={"slug": d2})
        assert requests.get(f"{API}/articles/{d}").status_code == 404
        assert requests.get(f"{API}/articles/{d2}").status_code == 404
        assert d2 not in [x["slug"] for x in requests.get(f"{API}/articles").json()]

    def test_update_unknown_article_404(self, h):
        assert requests.put(f"{API}/admin/articles/{P}nope", headers=h, json={"title": "x"}).status_code == 404

    def test_empty_update_400(self, h):
        assert requests.put(f"{API}/admin/articles/{P}a", headers=h, json={}).status_code == 400


class TestArticleValidation:
    @pytest.mark.parametrize("img,ok", [
        ("/images/x.jpg", True), ("https://example.com/x.jpg", True), ("uploads/abc.png", True),
        ("javascript:alert(1)", False), ("../etc/passwd", False), ("http://x.com/a.jpg", False),
    ])
    def test_cover_image(self, h, img, ok):
        r = requests.put(f"{API}/admin/articles/{P}a", headers=h, json={"cover_image": img})
        assert (r.status_code == 200) == ok, (img, r.status_code, r.text)

    def test_protocol_relative_cover_image(self, h):
        # //evil.com/x.png passe la regex de chemin local -> charge une image tierce (informatif)
        r = requests.put(f"{API}/admin/articles/{P}a", headers=h, json={"cover_image": "//evil.example/x.png"})
        print("protocol-relative cover status:", r.status_code)
        requests.put(f"{API}/admin/articles/{P}a", headers=h, json={"cover_image": "/images/x.jpg"})

    def test_bad_block_type_and_unknown_product(self, h):
        assert requests.put(f"{API}/admin/articles/{P}a", headers=h, json={"content": [{"type": "h1", "text": "x"}]}).status_code == 422
        assert requests.put(f"{API}/admin/articles/{P}a", headers=h, json={"related_product_slugs": ["nope-xyz"]}).status_code == 400
        assert requests.put(f"{API}/admin/articles/{P}a", headers=h, json={"published_at": "pas-une-date"}).status_code == 400
        assert requests.put(f"{API}/admin/articles/{P}a", headers=h, json={"read_time": 0}).status_code == 422

    def test_plain_text_with_lt_allowed(self, h):
        r = requests.put(f"{API}/admin/articles/{P}a", headers=h, json={"excerpt": "Budget < 100 € et 3 > 2"})
        assert r.status_code == 200, r.text


class TestContentEdge:
    def test_unknown_key_accepted(self, h):
        r = requests.put(f"{API}/admin/content/{P}unknown", headers=h, json={"fields": {"x": "y"}})
        print("unknown content key status:", r.status_code)
        mdb.site_content.delete_many({"key": P + "unknown"})

    def test_empty_fields_400(self, h):
        assert requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {}}).status_code == 400

    def test_nested_bad_key_and_too_long(self, h):
        assert requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"principles": [{"Bad Key": "x"}]}}).status_code == 400
        assert requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"why_title": "a" * 30001}}).status_code == 400

    def test_public_content_no_admin_metadata(self, h):
        requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"why_eyebrow": "Fictif e13"}})
        pub = requests.get(f"{API}/content").json()
        assert pub["home"]["why_eyebrow"] == "Fictif e13"
        assert "updated_by" not in str(pub) and "@" not in str(pub.get("home", {}).get("updated_by", ""))
        requests.put(f"{API}/admin/content/home", headers=h, json={"fields": {"why_eyebrow": None}})


class TestFaqEdge:
    def test_duplicate_ids(self, h):
        cur = requests.get(f"{API}/admin/faq", headers=h).json()
        assert len(cur) >= 2
        items = [{"id": cur[0]["id"], "question": "Q1 fictive", "answer": "A1"},
                 {"id": cur[0]["id"], "question": "Q2 fictive", "answer": "A2"}]
        r = requests.put(f"{API}/admin/faq", headers=h, json={"items": items})
        print("duplicate faq ids:", r.status_code, len(r.json()) if r.status_code == 200 else r.text)

    def test_empty_question_422(self, h):
        assert requests.put(f"{API}/admin/faq", headers=h, json={"items": [{"question": "", "answer": "x"}]}).status_code == 422
