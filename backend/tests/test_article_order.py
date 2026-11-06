# Articles : conservation des retours à la ligne et ordre manuel (Preview). `-n 0`.
import os
import re
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"')
API = BASE + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PFX = "test-ordre-"
TEXT = "Ligne 1\nLigne 2\n\n\nNouveau paragraphe\n- point A\n- point B\n\n[lien](/boutique)"


@pytest.fixture(scope="module")
def h():
    cred = open("/app/memory/test_credentials.md").read()
    e = re.search(r"Email:\s*`?([^\s`]+)", cred).group(1)
    p = re.search(r"Password:\s*`?([^\s`]+)", cred).group(1)
    return {"Authorization": "Bearer " + requests.post(f"{API}/admin/login", json={"email": e, "password": p}).json()["access_token"]}


@pytest.fixture(scope="module", autouse=True)
def restore():
    before = {a["slug"]: a.get("position") for a in mdb.articles.find({}, {"slug": 1, "position": 1})}
    yield
    mdb.articles.delete_many({"slug": {"$regex": "^" + PFX}})
    for slug, pos in before.items():
        mdb.articles.update_one({"slug": slug}, {"$set": {"position": pos}} if pos is not None else {"$unset": {"position": ""}})


def slugs(h):
    return [a["slug"] for a in requests.get(f"{API}/admin/articles", headers=h).json()]


def public():
    return [a["slug"] for a in requests.get(f"{API}/articles").json()]


def create(h, name, published=True):
    r = requests.post(f"{API}/admin/articles", headers=h, json={
        "title": f"Test {name}", "slug": PFX + name, "published": published,
        "content": [{"type": "h2", "text": "Titre"}, {"type": "p", "text": TEXT}]})
    assert r.status_code == 200, r.text
    return r.json()


def test_initial_order_is_previous_chronological_order(h):
    docs = list(mdb.articles.find({}, {"_id": 0, "slug": 1, "published_at": 1, "position": 1}))
    if all(d.get("position") is None for d in docs):
        assert slugs(h) == [d["slug"] for d in sorted(docs, key=lambda d: d.get("published_at") or "", reverse=True)]


def test_newlines_preserved_and_new_article_appended(h):
    before = slugs(h)
    a = create(h, "a")
    assert a["content"][1]["text"] == TEXT
    assert slugs(h) == before + [PFX + "a"]
    b = create(h, "b", published=False)
    assert slugs(h) == before + [PFX + "a", PFX + "b"]
    assert PFX + "b" not in public() and public()[-1] == PFX + "a"
    assert requests.get(f"{API}/articles/{PFX}a").json()["content"][1]["text"] == TEXT
    assert b["position"] == a["position"] + 1


def test_reorder_persists_and_drives_public_order(h):
    order = slugs(h)
    new = [PFX + "a"] + [s for s in order if s != PFX + "a"]
    r = requests.post(f"{API}/admin/articles/reorder", headers=h, json={"slugs": new})
    assert r.status_code == 200 and [x["slug"] for x in r.json()] == new
    assert slugs(h) == new and public()[0] == PFX + "a"
    assert [s for s in new if s != PFX + "b"] == public()


def test_edit_keeps_order_and_delete_keeps_relative(h):
    order = slugs(h)
    assert requests.put(f"{API}/admin/articles/{PFX}a", headers=h, json={"title": "Test a modifié", "published_at": "2020-01-01"}).status_code == 200
    assert slugs(h) == order
    r = requests.delete(f"{API}/admin/articles/{PFX}a", headers=h, json={"confirmation": "SUPPRIMER"})
    assert r.status_code == 200, r.text
    assert slugs(h) == [s for s in order if s != PFX + "a"]


def test_reorder_rejects_stale_or_partial_lists(h):
    order = slugs(h)
    for bad in (order[:-1], order + ["inconnu"], order[:1] + order[:1] + order[2:]):
        assert requests.post(f"{API}/admin/articles/reorder", headers=h, json={"slugs": bad}).status_code == 409
    assert requests.post(f"{API}/admin/articles/reorder", json={"slugs": order}).status_code in (401, 403)
    assert slugs(h) == order
