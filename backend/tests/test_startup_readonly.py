# Catalogue Stripe : démarrage sans écriture (Preview et Production), diagnostic commun, réutilisation d'un prix conforme.
import asyncio
import types

import pytest
import stripe

import server

WRITES = []
NS = types.SimpleNamespace


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


def price(pid, key, amount, prod, cur="eur", tax="inclusive"):
    return NS(id=pid, lookup_key=key, unit_amount=amount, currency=cur, tax_behavior=tax, product=prod, active=True)


@pytest.fixture
def stripe_state(monkeypatch):
    """Catalogue Stripe simulé ; toute écriture est enregistrée dans WRITES."""
    WRITES.clear()
    st = {"products": {k: f"prod_{k}" for k in ("ok_produit", "ecart_prix", "ecart_taxe", "ecart_devise", "autre_produit", "sans_prix", "suivi_sportif")},
          "prices": [price("p_ok", "ok_produit", 599, "prod_ok_produit"), price("p_ecart", "ecart_prix", 499, "prod_ecart_prix"),
                     price("p_taxe", "ecart_taxe", 699, "prod_ecart_taxe", tax="exclusive"),
                     price("p_dev", "ecart_devise", 599, "prod_ecart_devise", cur="usd"),
                     price("p_autre", "autre_produit", 599, "prod_ok_produit")]}

    def plist(lookup_keys=None, product=None, active=True, **k):
        data = [p for p in st["prices"] if p.active and (lookup_keys is None or p.lookup_key in lookup_keys)
                and (product is None or p.product == product)]
        return NS(data=data[:1] if lookup_keys else data, auto_paging_iter=lambda: iter(data))

    def pmodify(pid, **k):
        WRITES.append(("Price.modify", pid, k))
        p = next(x for x in st["prices"] if x.id == pid)
        if k.get("transfer_lookup_key"):
            for x in st["prices"]:
                if x.lookup_key == k["lookup_key"]:
                    x.lookup_key = None
        for a, v in k.items():
            if a != "transfer_lookup_key":
                setattr(p, a, v)
        return p

    def pcreate(**k):
        WRITES.append(("Price.create", k.get("unit_amount")))
        for x in st["prices"]:
            if x.lookup_key == k["lookup_key"]:
                x.lookup_key = None
        p = price(f"p_new{len(st['prices'])}", k["lookup_key"], k["unit_amount"], k["product"], k["currency"], k["tax_behavior"])
        st["prices"].append(p)
        return p

    monkeypatch.setattr(stripe.Price, "list", plist)
    monkeypatch.setattr(stripe.Price, "modify", pmodify)
    monkeypatch.setattr(stripe.Price, "create", pcreate)
    monkeypatch.setattr(stripe.Product, "create", lambda **k: WRITES.append(("Product.create",)) or NS(id="prod_new"))
    monkeypatch.setattr(stripe.Product, "modify", lambda *a, **k: WRITES.append(("Product.modify",)))
    prods = [NS(id=v, to_dict=(lambda k=k: {"metadata": {"emergent_product_id": k}})) for k, v in st["products"].items()]
    monkeypatch.setattr(stripe.Product, "list", lambda **k: NS(auto_paging_iter=lambda: iter(prods)))
    items = [product("ok-produit", 5.99), product("ecart-prix", 5.99), product("ecart-taxe", 6.99),
             product("ecart-devise", 5.99), product("autre-produit", 5.99), product("sans-prix", 3.99)]
    monkeypatch.setattr(server.db, "products", NS(find=lambda *a, **k: FakeCursor(items)))

    async def owners(db, key):
        return [key]
    monkeypatch.setattr(server, "lookup_owners", owners)
    monkeypatch.setattr(server, "commercial_issues", lambda p: [])
    return st


@pytest.mark.parametrize("env", ["production", "preview"])
def test_startup_never_writes_and_reports(stripe_state, monkeypatch, caplog, env):
    monkeypatch.setitem(server._STRIPE, "environment", env)
    caplog.set_level("INFO")
    for _ in range(3):
        asyncio.run(server.ensure_stripe_catalog())
    assert WRITES == []
    t = caplog.text
    assert "écart pour ok-produit" not in t
    assert "montant 4.99 au lieu de 5.99" in t and "TVA « exclusive »" in t and "devise usd au lieu de eur" in t
    assert "appartient à un autre produit Stripe" in t and "aucun prix actif ne porte la référence « sans_prix »" in t
    assert t.count("Stripe catalog checked (lecture seule") == 3


def test_admin_and_startup_share_diagnostic(stripe_state):
    assert server._stripe_price_issue("ok_produit", 5.99, "eur") is None
    msg = server._stripe_price_issue("ecart_prix", 5.99, "eur")["message"]
    assert msg.startswith("Stripe : Prix Stripe actif non conforme") and "4.99" in msg


def test_sync_reuses_existing_conforming_price(stripe_state):
    # Situation observée : un prix parasite 4,99 a pris la référence, le prix 5,99 conforme reste actif sans référence.
    st = stripe_state
    st["prices"].append(price("p_599_old", None, 599, "prod_suivi_sportif"))
    st["prices"].append(price("p_stray", "suivi_sportif", 499, "prod_suivi_sportif"))
    assert "prix conforme existe déjà" in server.price_diagnostic("suivi_sportif", 5.99, "eur")
    server.sync_stripe_price("suivi_sportif", "Suivi sportif", 5.99, "eur")
    assert ("Price.create", 599) not in WRITES
    assert WRITES[0][:2] == ("Price.modify", "p_599_old") and WRITES[1] == ("Price.modify", "p_stray", {"active": False})
    assert server.price_diagnostic("suivi_sportif", 5.99, "eur") is None
    WRITES.clear()
    server.sync_stripe_price("suivi_sportif", "Suivi sportif", 5.99, "eur")
    assert WRITES == []  # idempotent


def test_sync_creates_only_when_no_conforming_price(stripe_state):
    server.sync_stripe_price("ecart_prix", "Ecart", 5.99, "eur")
    assert [w[0] for w in WRITES] == ["Price.create", "Price.modify"] and WRITES[1][1] == "p_ecart"
    assert len([p for p in stripe_state["prices"] if p.active and p.product == "prod_ecart_prix"]) == 1
