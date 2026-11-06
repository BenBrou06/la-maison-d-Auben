# Démarrage Production : la vérification du catalogue Stripe ne doit jamais écrire (tests en processus, Stripe simulé).
import asyncio
import types

import pytest
import stripe

import server

WRITES = []


class FakeCursor:
    def __init__(self, items):
        self.items = items

    def __aiter__(self):
        self._it = iter(self.items)
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration


def product(slug, price):
    return {"slug": slug, "name": slug, "price": price, "currency": "eur", "lookup_key": slug.replace("-", "_"),
            "status": "available", "download_storage_path": "x/" + slug + ".xlsx", "download_filename": slug + ".xlsx"}


STRIPE_PRICES = {"ok_produit": (599, "eur", "inclusive"), "ecart_prix": (499, "eur", "inclusive"),
                 "ecart_taxe": (699, "eur", "exclusive")}


@pytest.fixture
def fake_stripe(monkeypatch):
    WRITES.clear()
    rec = lambda name: (lambda *a, **k: WRITES.append(name) or types.SimpleNamespace(id="x"))
    for cls, meth in [(stripe.Product, "create"), (stripe.Product, "modify"), (stripe.Price, "create"), (stripe.Price, "modify")]:
        monkeypatch.setattr(cls, meth, rec(f"{cls.__name__}.{meth}"))

    def price_list(lookup_keys=None, **k):
        d = STRIPE_PRICES.get(lookup_keys[0])
        data = [types.SimpleNamespace(unit_amount=d[0], currency=d[1], tax_behavior=d[2], id="price_x")] if d else []
        return types.SimpleNamespace(data=data)
    monkeypatch.setattr(stripe.Price, "list", price_list)
    monkeypatch.setattr(stripe.Product, "list", lambda **k: types.SimpleNamespace(auto_paging_iter=lambda: iter([])))
    items = [product("ok-produit", 5.99), product("ecart-prix", 5.99), product("ecart-taxe", 6.99), product("sans-prix", 3.99)]
    monkeypatch.setattr(server.db, "products", types.SimpleNamespace(find=lambda *a, **k: FakeCursor(items)))

    async def owners(db, key):
        return [key]
    monkeypatch.setattr(server, "lookup_owners", owners)
    monkeypatch.setattr(server, "commercial_issues", lambda p: [])


def run():
    asyncio.run(server.ensure_stripe_catalog())


def test_production_startup_is_read_only(fake_stripe, monkeypatch, caplog):
    monkeypatch.setitem(server._STRIPE, "environment", "production")
    caplog.set_level("INFO")
    run()
    assert WRITES == []
    text = caplog.text
    assert "écart pour ecart-prix" in text and "écart pour ecart-taxe" in text and "écart pour sans-prix" in text
    assert "écart pour ok-produit" not in text
    assert "Stripe catalog checked (lecture seule)" in text


def test_preview_startup_still_syncs(fake_stripe, monkeypatch):
    monkeypatch.setitem(server._STRIPE, "environment", "preview")
    run()
    assert "Price.create" in WRITES and "Price.modify" in WRITES
