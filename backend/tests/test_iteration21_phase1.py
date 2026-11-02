# Iteration 21: Phase 1 — gift removal, 2-min price freeze, GST-inclusive buy, min investment,
# Master Security & Controls, redeem-grams requests, referral reward
import os

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
J1, J2 = "demo-jeweller-001", "demo-jeweller-002"


def _tok(d):
    return d.get("access_token") or d.get("token")


def _cust(phone, tenant=None):
    h = {"X-Tenant-ID": tenant} if tenant else {}
    c = requests.post(f"{API}/auth/otp/request", json={"phone": phone}, headers=h).json()
    v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": c["challenge_id"], "otp": c["demo_otp"]}, headers=h)
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


@pytest.fixture(scope="module")
def meera():
    return _cust("9834567892")


@pytest.fixture(scope="module")
def rohan():
    return _cust("9845678903", J2)


ALL_ON = {"rates": True, "booking": True, "min_investment": 500, "shops": {}}


@pytest.fixture(autouse=True, scope="module")
def restore_controls(master):
    yield
    requests.put(f"{API}/master/v3/controls", json=ALL_ON, headers=master)


def _quote(h, tenant=None):
    return requests.post(f"{API}/quote", json={"tenant": tenant} if tenant else {}, headers=h)


# Gifts discontinued
def test_gift_410(aarav):
    r = requests.post(f"{API}/gifts", json={"phone": "9834567892", "value": 0.1, "mode": "grams", "theme": "diwali"}, headers=aarav)
    assert r.status_code == 410, r.text


# Quote lock = 120s
def test_quote_lock_120(aarav):
    r = _quote(aarav)
    assert r.status_code == 200, r.text
    assert r.json()["lock_seconds"] == 120


# GST inclusive (rupees)
def test_buy_rupees_gst_inclusive(aarav):
    q = _quote(aarav).json()
    r = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": 1450}, headers=aarav)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["total"] == 1450 and d["gst"] == 43.5 and d["amount"] == 1406.5
    assert abs(d["grams"] - round(1406.5 / q["buy"], 4)) < 0.0002


# GST inclusive (grams)
def test_buy_grams_mode(aarav):
    q = _quote(aarav).json()
    r = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "grams", "value": 0.1}, headers=aarav)
    assert r.status_code == 200, r.text
    d = r.json()
    assert abs(d["total"] - round(0.1 * q["buy"], 2)) < 0.02
    assert abs(d["grams"] - 0.097) < 0.0002


# Min investment buy
def test_buy_below_min(aarav):
    q = _quote(aarav).json()
    r = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": 499}, headers=aarav)
    assert r.status_code == 400
    assert "Minimum investment is ₹500" in r.json()["detail"]


# Min investment silver buy
def test_buy_silver_below_min(aarav):
    q = requests.post(f"{API}/quote/silver", json={}, headers=aarav).json()
    r = requests.post(f"{API}/orders/buy-silver", json={"quote_id": q["id"], "mode": "rupees", "value": 300}, headers=aarav)
    assert r.status_code == 400


# Min investment SIP
def test_sip_below_min(aarav):
    r = requests.post(f"{API}/sips", json={"amount": 400, "frequency": "monthly"}, headers=aarav)
    assert r.status_code == 400, r.text


# Controls GET
def test_controls_get(master):
    r = requests.get(f"{API}/master/v3/controls", headers=master)
    assert r.status_code == 200
    d = r.json()
    assert d["global"]["rates"] is True and d["global"]["min_investment"] == 500
    assert any(s["id"] == J1 for s in d["shops"])


# Controls require master auth
def test_controls_requires_auth(sharma):
    assert requests.get(f"{API}/master/v3/controls").status_code in (401, 403)
    assert requests.put(f"{API}/master/v3/controls", json=ALL_ON, headers=sharma).status_code in (401, 403)


# Global rates off
def test_global_rates_off(master, aarav):
    assert requests.put(f"{API}/master/v3/controls", json={**ALL_ON, "rates": False}, headers=master).status_code == 200
    p = requests.get(f"{API}/price?tenant={J1}").json()
    assert p["rates_hidden"] is True and p["buy"] == 0 and p["has_live"] is False
    assert _quote(aarav).status_code == 403
    requests.put(f"{API}/master/v3/controls", json=ALL_ON, headers=master)
    p = requests.get(f"{API}/price?tenant={J1}").json()
    assert p["rates_hidden"] is False and p["buy"] > 0


# Per-shop booking off for J2 only
def test_shop_booking_off(master, aarav, rohan):
    body = {**ALL_ON, "shops": {J2: {"rates": True, "booking": False}}}
    assert requests.put(f"{API}/master/v3/controls", json=body, headers=master).status_code == 200
    assert _quote(rohan).status_code == 403
    assert _quote(aarav).status_code == 200
    p2 = requests.get(f"{API}/price?tenant={J2}").json()
    assert p2["booking_enabled"] is False and p2["buy"] > 0
    assert requests.get(f"{API}/price?tenant={J1}").json()["booking_enabled"] is True
    eff = {s["id"]: s for s in requests.get(f"{API}/master/v3/controls", headers=master).json()["shops"]}
    assert eff[J2]["booking"] is False and eff[J2]["effective"]["booking"] is False
    requests.put(f"{API}/master/v3/controls", json=ALL_ON, headers=master)
    assert _quote(rohan).status_code == 200


# Min investment change
def test_min_investment_change(master, aarav):
    requests.put(f"{API}/master/v3/controls", json={**ALL_ON, "min_investment": 1000}, headers=master)
    assert requests.get(f"{API}/price?tenant={J1}").json()["min_investment"] == 1000
    q = _quote(aarav).json()
    r = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": 800}, headers=aarav)
    assert r.status_code == 400 and "1,000" in r.json()["detail"]
    requests.put(f"{API}/master/v3/controls", json=ALL_ON, headers=master)
    assert requests.get(f"{API}/price?tenant={J1}").json()["min_investment"] == 500


# Redeem request validation
def test_redeem_min_1g(meera):
    assert requests.post(f"{API}/redeem-requests", json={"grams": 0.5}, headers=meera).status_code == 422


def test_redeem_more_than_balance(meera):
    r = requests.post(f"{API}/redeem-requests", json={"grams": 99999}, headers=meera)
    assert r.status_code == 400


# Second open request -> 409 (self-contained: creates one for Meera, then declines it)
def test_redeem_duplicate_409(meera, sharma):
    first = requests.post(f"{API}/redeem-requests", json={"grams": 1}, headers=meera)
    assert first.status_code in (200, 409), first.text
    r = requests.post(f"{API}/redeem-requests", json={"grams": 1}, headers=meera)
    assert r.status_code == 409, r.text
    for x in requests.get(f"{API}/jeweller/v3/redeem-requests", headers=sharma).json():
        if x["phone"].endswith("4567892"):
            requests.post(f"{API}/jeweller/v3/redeem-requests/{x['id']}/reject", headers=sharma)


# Redeem create -> shop list -> decline; create -> accept
def test_redeem_flow(meera, sharma):
    vault = requests.get(f"{API}/me", headers=meera).json()
    bal = (vault.get("user") or vault).get("gold_grams", 0)
    if bal < 2:  # top up via mock payment so the test can redeem 1g
        q = _quote(meera).json()
        o = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "grams", "value": 1.2}, headers=meera).json()
        assert requests.post(f"{API}/orders/{o['id']}/mock-confirm", json={"success": True, "method": "upi"}, headers=meera).status_code == 200
        bal = requests.get(f"{API}/me", headers=meera).json()["gold_grams"]
    r = requests.post(f"{API}/redeem-requests", json={"grams": 1}, headers=meera)
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    lst = requests.get(f"{API}/jeweller/v3/redeem-requests", headers=sharma).json()
    row = next(x for x in lst if x["id"] == rid)
    assert row["wallet_id"] and row["name"].startswith("Meera") and row["phone"].endswith("4567892") and row["grams"] == 1
    d = requests.post(f"{API}/jeweller/v3/redeem-requests/{rid}/reject", headers=sharma)
    assert d.status_code == 200 and d.json()["status"] == "cancelled"
    assert requests.post(f"{API}/jeweller/v3/redeem-requests/{rid}/accept", headers=sharma).status_code == 404
    rid2 = requests.post(f"{API}/redeem-requests", json={"grams": 1}, headers=meera).json()["id"]
    a = requests.post(f"{API}/jeweller/v3/redeem-requests/{rid2}/accept", headers=sharma)
    assert a.status_code == 200 and a.json()["status"] == "pending" and "otp" not in a.json()  # OTP shown only to customer
    after = requests.get(f"{API}/me", headers=meera).json()
    assert abs((after.get("user") or after)["gold_grams"] - (bal - 1)) < 0.0002
    pk = requests.get(f"{API}/jeweller/pickups", headers=sharma).json()
    items = pk if isinstance(pk, list) else pk.get("pickups", pk.get("items", []))
    assert any(p.get("id") == rid2 for p in items), str(pk)[:300]


# Referral reward
def test_referral_reward(sharma):
    r = requests.put(f"{API}/jeweller/v3/referral-reward", json={"amount": 75}, headers=sharma)
    assert r.status_code == 200 and r.json()["amount"] == 75
    assert requests.get(f"{API}/jeweller/v3/referral-reward", headers=sharma).json()["amount"] == 75
    assert requests.get(f"{API}/referral-reward?tenant={J1}").json()["amount"] == 75
    assert requests.get(f"{API}/referral-reward?tenant={J2}").json()["amount"] == 50
    assert requests.put(f"{API}/jeweller/v3/referral-reward", json={"amount": -5}, headers=sharma).status_code == 422
    requests.put(f"{API}/jeweller/v3/referral-reward", json={"amount": 50}, headers=sharma)
    assert requests.get(f"{API}/referral-reward?tenant={J1}").json()["amount"] == 50
