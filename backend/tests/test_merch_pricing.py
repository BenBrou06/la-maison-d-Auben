from datetime import datetime, timezone, timedelta

from merch import pricing_of, promo_final_cents, promo_status


def test_percent_rounding_matches_example():
    assert promo_final_cents(799, "percent", 20) == 639
    assert pricing_of({"price": 7.99, "promotion": {"enabled": True, "type": "percent", "value": 20}})["final"] == 6.39


def test_invalid_promotions_fall_back_to_normal_price():
    for promo in ({"enabled": True, "type": "percent", "value": 95}, {"enabled": True, "type": "percent", "value": 12.5},
                  {"enabled": True, "type": "amount", "value": 7.6}, {"enabled": True, "type": "amount", "value": 0},
                  {"enabled": False, "type": "percent", "value": 20}):
        pr = pricing_of({"price": 7.99, "promotion": promo})
        assert pr["active"] is False and pr["final"] == 7.99


def test_dates_window_and_expiry():
    now = datetime.now(timezone.utc)
    p = {"price": 4.99, "promotion": {"enabled": True, "type": "amount", "value": 1,
                                      "starts_at": (now + timedelta(days=1)).isoformat()}}
    assert pricing_of(p)["active"] is False and promo_status(p) == "scheduled"
    p["promotion"]["starts_at"] = (now - timedelta(days=2)).isoformat()
    p["promotion"]["ends_at"] = (now - timedelta(days=1)).isoformat()
    assert pricing_of(p)["final"] == 4.99 and promo_status(p) == "expired"
    p["promotion"]["ends_at"] = (now + timedelta(days=1)).isoformat()
    pr = pricing_of(p)
    assert pr["active"] and pr["final"] == 3.99 and pr["discount_cents"] == 100 and promo_status(p) == "active"


def test_no_price_no_promo():
    assert pricing_of({"price": None, "promotion": {"enabled": True, "type": "percent", "value": 10}})["active"] is False
