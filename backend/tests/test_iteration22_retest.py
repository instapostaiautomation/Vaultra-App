# Iteration 22: retest of iteration 21 issues (products hidden w/ rates off, SIP GST-inclusive,
# referral reward public, redeem request min/KYC guards, regression buy ₹1450)
import os

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
J1, J2 = "demo-jeweller-001", "demo-jeweller-002"
ALL_ON = {"rates": True, "booking": True, "min_investment": 500, "shops": {}}


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


@pytest.fixture(autouse=True, scope="module")
def restore(master, sharma):
    yield
    requests.put(f"{API}/master/v3/controls", json=ALL_ON, headers=master)
    requests.put(f"{API}/jeweller/v3/referral-reward", json={"amount": 50}, headers=sharma)


# HIGH 1: products hide prices when rates are off
def test_products_hidden_when_rates_off(master):
    assert requests.put(f"{API}/master/v3/controls", json={**ALL_ON, "rates": False}, headers=master).status_code == 200
    try:
        lst = requests.get(f"{API}/products?jeweller_id={J1}").json()
        assert len(lst) > 0
        for p in lst:
            assert p["gold_value"] == 0 and p["total_price"] == 0 and p["live_rate"] == 0, p
        one = requests.get(f"{API}/products/{lst[0]['id']}").json()
        assert one["gold_value"] == 0 and one["total_price"] == 0 and one["live_rate"] == 0
    finally:
        requests.put(f"{API}/master/v3/controls", json=ALL_ON, headers=master)
    lst = requests.get(f"{API}/products?jeweller_id={J1}").json()
    assert lst[0]["live_rate"] > 0 and lst[0]["total_price"] > 0


# HIGH 1b: per-shop rates off only hides that shop's products
def test_products_hidden_per_shop(master):
    body = {**ALL_ON, "shops": {J2: {"rates": False, "booking": True}}}
    requests.put(f"{API}/master/v3/controls", json=body, headers=master)
    try:
        p2 = requests.get(f"{API}/products?jeweller_id={J2}").json()
        p1 = requests.get(f"{API}/products?jeweller_id={J1}").json()
        assert all(p["total_price"] == 0 for p in p2)
        assert all(p["total_price"] > 0 for p in p1)
    finally:
        requests.put(f"{API}/master/v3/controls", json=ALL_ON, headers=master)


# HIGH 2: SIP run is GST-inclusive
def test_sip_run_gst_inclusive(aarav):
    r = requests.post(f"{API}/sips", json={"amount": 500, "frequency": "monthly"}, headers=aarav)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    try:
        run = requests.post(f"{API}/sips/{sid}/run", headers=aarav)
        assert run.status_code == 200, run.text
        t = run.json()
        assert t["total"] == 500, t
        assert t["gst"] == 15.0 and t["amount"] == 485.0, t
        assert abs(t["grams"] - round(485.0 / t["rate"], 4)) < 0.0002, t
    finally:
        requests.delete(f"{API}/sips/{sid}", headers=aarav)


# HIGH 3: referral reward public endpoint
def test_referral_reward_public(sharma):
    assert requests.put(f"{API}/jeweller/v3/referral-reward", json={"amount": 75}, headers=sharma).json()["amount"] == 75
    assert requests.get(f"{API}/referral-reward?tenant={J1}").json()["amount"] == 75
    assert requests.get(f"{API}/referral-reward", headers={"X-Tenant-ID": J1}).json()["amount"] == 75
    requests.put(f"{API}/jeweller/v3/referral-reward", json={"amount": 50}, headers=sharma)
    assert requests.get(f"{API}/referral-reward?tenant={J1}").json()["amount"] == 50


# LOW: redeem requests require KYC approved
def test_redeem_kyc_required():
    diya = _cust("9812345670")  # KYC pending
    r = requests.post(f"{API}/redeem-requests", json={"grams": 1}, headers=diya)
    assert r.status_code == 403, r.text


# LOW: redeem below 1g rejected
def test_redeem_below_1g(aarav):
    assert requests.post(f"{API}/redeem-requests", json={"grams": 0.5}, headers=aarav).status_code in (400, 422)


# Regression: buy ₹1450 GST-inclusive
def test_buy_1450(aarav):
    q = requests.post(f"{API}/quote", json={}, headers=aarav).json()
    assert q["lock_seconds"] == 120
    r = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": 1450}, headers=aarav)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["total"] == 1450 and d["gst"] == 43.5 and d["amount"] == 1406.5
