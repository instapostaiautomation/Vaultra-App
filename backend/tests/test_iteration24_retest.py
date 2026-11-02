# Iteration 24: retest of iteration 23 fixes - product redemption fine gold, catalogue commission,
# avg_silver GST basis, MT5 max_volume + backoff, product copy (24K). Run with -n 0 (serial).
import os
import random
import time

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
J1 = "demo-jeweller-001"
PCT = {"24K": 100.0, "22K": 91.67, "18K": 75.0}
MT5_DEFAULT = {"enabled": True, "gold_lot_g": 10, "silver_lot_g": 1000, "min_volume": 1, "step": 1, "max_volume": 10}


def _tok(d):
    return d.get("access_token") or d.get("token")


def _cust(phone):
    c = requests.post(f"{API}/auth/otp/request", json={"phone": phone}).json()
    assert "challenge_id" in c, c
    v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": c["challenge_id"], "otp": c["demo_otp"]})
    assert v.status_code == 200, v.text
    return {"Authorization": f"Bearer {_tok(v.json())}"}


@pytest.fixture(scope="module")
def master():
    r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {_tok(r.json())}"}


@pytest.fixture(scope="module")
def sharma():
    r = requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {_tok(r.json())}"}


@pytest.fixture(scope="module")
def aarav():
    return _cust("9876543210")


def _me(h):
    return requests.get(f"{API}/me", headers=h).json()


def _buy(h, rupees):
    for _ in range(12):  # live feed can be briefly unavailable
        q = requests.post(f"{API}/quote", json={}, headers=h).json()
        if "id" in q:
            break
        time.sleep(5)
    assert "id" in q, q
    o = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": rupees}, headers=h).json()
    assert "id" in o, o
    return requests.post(f"{API}/orders/{o['id']}/mock-confirm", json={"method": "upi", "success": True}, headers=h)


# Products expose fine_grams = grams * purity%
def test_products_fine_grams():
    prods = requests.get(f"{API}/products?jeweller_id={J1}").json()
    assert prods
    for p in prods:
        assert "fine_grams" in p, p
        assert abs(p["fine_grams"] - p["grams"] * PCT[p["purity"]] / 100) < 0.001, p
    d = requests.get(f"{API}/products/{prods[0]['id']}").json()
    assert abs(d["fine_grams"] - prods[0]["fine_grams"]) < 0.0001


# Product copy: names with 24K are 24K purity; other descriptions do not claim 24K
def test_products_copy_24k():
    bad = []
    for p in requests.get(f"{API}/products?jeweller_id={J1}").json() + requests.get(f"{API}/products?jeweller_id=demo-jeweller-002").json():
        if "24K" in (p["name"] or "") and p["purity"] != "24K":
            bad.append(("name", p["name"], p["purity"]))
        if p["purity"] != "24K" and "24K" in (p["description"] or ""):
            bad.append(("desc", p["name"], p["purity"], p["description"]))
        if p["category"].lower().startswith("coin") and p["purity"] != "24K":
            bad.append(("coin", p["name"], p["purity"]))
    assert not bad, bad


# HIGH fix: product redemption deducts 24K-equivalent fine gold
def test_redeem_product_deducts_fine_gold(aarav):
    prods = [p for p in requests.get(f"{API}/products?jeweller_id={J1}").json() if p["purity"] != "24K"]
    assert prods, "need a 22K/18K product"
    p = min(prods, key=lambda x: x["fine_grams"])
    if _me(aarav)["gold_grams"] < p["fine_grams"] + 0.5:
        need = (p["fine_grams"] + 1) * p["live_rate"] * 1.05
        assert _buy(aarav, round(need)).status_code == 200
    g0 = _me(aarav)["gold_grams"]
    r = requests.post(f"{API}/redeem", json={"kind": "product", "product_id": p["id"]}, headers=aarav)
    assert r.status_code == 200, r.text
    print("REDEEM:", p["name"], p["purity"], p["grams"], p["fine_grams"], r.json())
    g1 = _me(aarav)["gold_grams"]
    assert abs((g0 - g1) - p["fine_grams"]) < 0.001, (g0, g1, p)
    assert (g0 - g1) < p["grams"]


def test_redeem_coin_still_full_grams(aarav):
    if _me(aarav)["gold_grams"] < 1.5:
        assert _buy(aarav, 20000).status_code == 200
    g0 = _me(aarav)["gold_grams"]
    r = requests.post(f"{API}/redeem", json={"kind": "coin", "coin_grams": 1}, headers=aarav)
    assert r.status_code == 200, r.text
    assert abs((g0 - _me(aarav)["gold_grams"]) - 1) < 0.001


# MEDIUM fix: catalogue commission non-negative and = buy_rate - live*purity
def test_catalogue_commission(sharma):
    d = requests.get(f"{API}/jeweller/v3/catalogue", headers=sharma).json()
    for p in d["products"]:
        exp = p["buy_rate"] - p["live_rate"] * p["purity_pct"] / 100
        assert abs(p["commission_per_g"] - exp) < 0.05, p
        assert p["commission_per_g"] >= 0, p


# avg_silver now GST-inclusive (consistent with avg gold)
def test_avg_silver_gst_inclusive(sharma):
    d = requests.get(f"{API}/jeweller/v3/holdings", headers=sharma).json()
    rows = [x for x in d["customers"] if x["silver_g"] > 0 and x["avg_silver"] > 0]
    if not rows:
        pytest.skip("no silver holders")
    det = requests.get(f"{API}/jeweller/v3/holdings/{rows[0]['id']}", headers=sharma).json()
    sb = det["silver_value"] / rows[0]["silver_g"] if rows[0]["silver_g"] else 0
    print("AVG SILVER list/detail/rate:", rows[0]["avg_silver"], det["avg_silver"], sb)
    assert abs(rows[0]["avg_silver"] - det["avg_silver"]) < 1
    assert det["avg_silver"] > sb * 1.01, "avg silver should include GST (~3%)"


# MT5 max_volume config + cap + backoff
def test_mt5_max_volume_and_backoff(master, aarav):
    try:
        assert requests.put(f"{API}/master/v3/mt5-bookings/config", json={**MT5_DEFAULT, "max_volume": 3}, headers=master).status_code == 200
        cfg = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()["config"]
        assert cfg["max_volume"] == 3
        assert requests.put(f"{API}/master/v3/mt5-bookings/config", json={**MT5_DEFAULT, "max_volume": 0}, headers=master).status_code == 422
        assert requests.put(f"{API}/master/v3/mt5-bookings/config", json={**MT5_DEFAULT, "max_volume": 5000}, headers=master).status_code == 422
        # tiny lot => pending converts to huge volume; must be capped at 3
        requests.put(f"{API}/master/v3/mt5-bookings/config", json={**MT5_DEFAULT, "gold_lot_g": 0.01, "max_volume": 1}, headers=master)
        rt = requests.post(f"{API}/master/v3/mt5-bookings/retry", headers=master)
        assert rt.status_code == 200, rt.text
        print("RETRY1:", rt.json())
        b = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()["bookings"]
        gold = [x for x in b if x["metal"] == "gold"]
        assert gold and gold[0]["volume"] <= 1, gold[:1]
        print("LATEST GOLD BOOKING:", gold[0])
        if gold[0]["status"] == "failed":
            n0 = len(b)
            for _ in range(2):
                assert _buy(aarav, 500).status_code == 200
            time.sleep(6)
            b2 = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()["bookings"]
            assert len(b2) == n0, f"auto-booking should back off after a failure: {n0} -> {len(b2)}"
            # manual retry still attempts immediately
            requests.post(f"{API}/master/v3/mt5-bookings/retry", headers=master)
            b3 = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()["bookings"]
            assert len(b3) > n0, "manual retry must attempt immediately"
    finally:
        requests.put(f"{API}/master/v3/mt5-bookings/config", json=MT5_DEFAULT, headers=master)
    cfg = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()["config"]
    assert cfg == {**cfg, **MT5_DEFAULT}, cfg
