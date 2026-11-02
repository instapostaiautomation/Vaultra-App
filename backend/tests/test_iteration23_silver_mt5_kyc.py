# Iteration 23: silver SIP/goals, redeem bar/coin, holdings values/avg, catalogue purity,
# KYC photo privacy, master customer detail, MT5 bookings, referral store scoping. Run with -n 0 (serial).
import io
import os
import random
import time

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
J1, J2 = "demo-jeweller-001", "demo-jeweller-002"
MT5_DEFAULT = {"enabled": True, "gold_lot_g": 10, "silver_lot_g": 1000, "min_volume": 1, "step": 1}
PNG = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
       b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82")


def _tok(d):
    return d.get("access_token") or d.get("token")


def _cust(phone, tenant=None, **extra):
    h = {"X-Tenant-ID": tenant} if tenant else {}
    c = requests.post(f"{API}/auth/otp/request", json={"phone": phone, **({"jeweller_id": tenant} if tenant else {})}, headers=h).json()
    assert "challenge_id" in c, c
    v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": c["challenge_id"], "otp": c["demo_otp"], **extra}, headers=h)
    assert v.status_code == 200, v.text
    d = v.json()
    return {"Authorization": f"Bearer {_tok(d)}"}, d


def _new_phone():
    return "9" + "".join(random.choice("0123456789") for _ in range(9))


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
def patel():
    r = requests.post(f"{API}/jeweller/login", json={"email": "patel@vaultra.in", "password": "jeweller123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {_tok(r.json())}"}


@pytest.fixture(scope="module")
def aarav():
    return _cust("9876543210")[0]


@pytest.fixture(scope="module")
def fresh():
    h, d = _cust(_new_phone(), first_name="TEST_Fresh")
    return h, d


def _me(h):
    return requests.get(f"{API}/me", headers=h).json()


# ── Silver SIP ──
def test_silver_sip_run_credits_silver(fresh):
    h, _ = fresh
    r = requests.post(f"{API}/sips", json={"amount": 1000, "frequency": "monthly", "metal": "silver"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["metal"] == "silver"
    sid = r.json()["id"]
    before = _me(h)
    run = requests.post(f"{API}/sips/{sid}/run", headers=h)
    assert run.status_code == 200, run.text
    t = run.json()
    after = _me(h)
    assert t.get("metal") == "silver", t
    assert abs(t["gst"] - 30) < 0.01 and abs(t["total"] - 1000) < 0.01
    srate = requests.post(f"{API}/quote/silver", json={}, headers=h).json()["buy"]
    assert abs(t["rate"] - srate) / srate < 0.05, (t["rate"], srate)
    assert abs(t["grams"] - 970 / t["rate"]) < 0.001
    assert after["silver_grams"] > before.get("silver_grams", 0)
    assert abs(after["gold_grams"] - before["gold_grams"]) < 1e-6
    lst = requests.get(f"{API}/sips", headers=h).json()
    assert any(s["id"] == sid and s["metal"] == "silver" for s in lst)


def test_gold_sip_unchanged(fresh):
    h, _ = fresh
    sid = requests.post(f"{API}/sips", json={"amount": 1000, "frequency": "monthly", "metal": "gold"}, headers=h).json()["id"]
    before = _me(h)
    t = requests.post(f"{API}/sips/{sid}/run", headers=h).json()
    after = _me(h)
    assert t.get("metal", "gold") == "gold"
    assert after["gold_grams"] > before["gold_grams"]
    assert abs(after["silver_grams"] - before["silver_grams"]) < 1e-6


def test_panel_sips_summary(sharma, master):
    for url, h in ((f"{API}/jeweller/v3/sips", sharma), (f"{API}/master/v3/sips", master)):
        d = requests.get(url, headers=h).json()
        s = d["summary"]
        for k in ("gold_grams", "silver_grams", "gold_active", "silver_active"):
            assert k in s, (url, s)
        rows = d.get("sips") or d.get("rows") or d.get("items") or []
        assert rows and all("metal" in x for x in rows), url
        assert s["silver_active"] >= 1


# ── Silver goals ──
def test_silver_goal(fresh, sharma, master):
    h, _ = fresh
    r = requests.post(f"{API}/goals", json={"name": "TEST_SilverGoal", "occasion": "custom", "target_grams": 50, "months": 6, "metal": "silver"}, headers=h)
    assert r.status_code == 200, r.text
    gid = r.json()["id"]
    assert r.json()["metal"] == "silver"
    assert any(g["id"] == gid and g["metal"] == "silver" for g in requests.get(f"{API}/goals", headers=h).json())
    # run silver SIP again -> silver goal progress increases
    sid = [s for s in requests.get(f"{API}/sips", headers=h).json() if s["metal"] == "silver"][0]["id"]
    requests.post(f"{API}/sips/{sid}/run", headers=h)
    for url, ah in ((f"{API}/jeweller/v3/goals", sharma), (f"{API}/master/v3/goals", master)):
        g = [x for x in requests.get(url, headers=ah).json() if x["id"] == gid]
        assert g and g[0]["metal"] == "silver" and g[0]["saved_grams"] > 0, (url, g)
    requests.delete(f"{API}/goals/{gid}", headers=h)


# ── Redeem bar / coin ──
def _buy(h, rupees):
    q = requests.post(f"{API}/quote", json={}, headers=h).json()
    o = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": rupees}, headers=h).json()
    return requests.post(f"{API}/orders/{o['id']}/mock-confirm", json={"method": "upi", "success": True}, headers=h)


def test_redeem_request_bar(aarav, sharma):
    if _me(aarav)["gold_grams"] < 1.2:
        assert _buy(aarav, 20000).status_code == 200
    r = requests.post(f"{API}/redeem-requests", json={"grams": 1, "form": "bar"}, headers=aarav)
    if r.status_code == 409:
        for x in requests.get(f"{API}/jeweller/v3/redeem-requests", headers=sharma).json():
            if x["phone"] == "9876543210":
                requests.post(f"{API}/jeweller/v3/redeem-requests/{x['id']}/reject", headers=sharma)
        r = requests.post(f"{API}/redeem-requests", json={"grams": 1, "form": "bar"}, headers=aarav)
    assert r.status_code == 200, r.text
    assert r.json()["item"] == "1g 24K Gold Bar"
    lst = requests.get(f"{API}/jeweller/v3/redeem-requests", headers=sharma).json()
    row = [x for x in lst if x["id"] == r.json()["id"]]
    assert row and row[0]["item"] == "1g 24K Gold Bar"
    requests.post(f"{API}/jeweller/v3/redeem-requests/{row[0]['id']}/reject", headers=sharma)
    c = requests.post(f"{API}/redeem-requests", json={"grams": 1, "form": "coin"}, headers=aarav)
    assert c.status_code == 200 and c.json()["item"] == "1g 24K Gold Coin", c.text
    requests.post(f"{API}/jeweller/v3/redeem-requests/{c.json()['id']}/reject", headers=sharma)
    bad = requests.post(f"{API}/redeem-requests", json={"grams": 1, "form": "ring"}, headers=aarav)
    assert bad.status_code == 422


# ── Holdings ──
def test_holdings_values(sharma):
    d = requests.get(f"{API}/jeweller/v3/holdings", headers=sharma).json()
    assert "gold_value" in d["totals"] and "silver_value" in d["totals"]
    for k in ("gold_value", "silver_value", "avg_gold", "avg_silver"):
        assert all(k in x for x in d["customers"]), k
    a = [x for x in d["customers"] if x["phone"] == "9876543210"][0]
    assert a["avg_gold"] > 0
    det = requests.get(f"{API}/jeweller/v3/holdings/{a['id']}", headers=sharma).json()
    for k in ("gold_value", "silver_value", "avg_silver", "sips", "shop"):
        assert k in det, k
    assert det["shop"].startswith("Sharma")


# ── Catalogue purity ──
def test_catalogue_purity(sharma):
    d = requests.get(f"{API}/jeweller/v3/catalogue", headers=sharma).json()
    p = d["products"][0]
    for k in ("purity", "purity_pct", "buy_rate", "total_price", "making_pct"):
        assert k in p, (k, p)
    orig = (p["making_pct"], p["purity"])
    try:
        for pur, pct in (("24K", 100), ("22K", 91.67), ("18K", 75)):
            r = requests.put(f"{API}/jeweller/v3/products/{p['id']}/making", json={"making_pct": 7.5, "purity": pur}, headers=sharma)
            assert r.status_code == 200, r.text
            q = [x for x in requests.get(f"{API}/jeweller/v3/catalogue", headers=sharma).json()["products"] if x["id"] == p["id"]][0]
            assert q["purity"] == pur and abs(q["purity_pct"] - pct) < 0.1, q
            exp = q["grams"] * q["buy_rate"] * 1.075
            assert abs(q["total_price"] - exp) < 2, (q, exp)
        assert requests.put(f"{API}/jeweller/v3/products/{p['id']}/making", json={"making_pct": 41}, headers=sharma).status_code == 422
        assert requests.put(f"{API}/jeweller/v3/products/{p['id']}/making", json={"making_pct": 5, "purity": "14K"}, headers=sharma).status_code == 422
    finally:
        requests.put(f"{API}/jeweller/v3/products/{p['id']}/making", json={"making_pct": orig[0], "purity": orig[1]}, headers=sharma)
    pub = requests.get(f"{API}/products?jeweller_id={J1}").json()
    assert all("purity" in x for x in pub)


def test_create_product_with_purity(sharma):
    r = requests.post(f"{API}/jeweller/products", json={"name": "TEST_Ring18", "category": "rings", "grams": 2, "making_pct": 10, "purity": "18K"}, headers=sharma)
    assert r.status_code in (200, 201), r.text
    pid = r.json().get("id")
    try:
        q = [x for x in requests.get(f"{API}/jeweller/v3/catalogue", headers=sharma).json()["products"] if x["id"] == pid][0]
        assert q["purity"] == "18K"
    finally:
        requests.delete(f"{API}/jeweller/products/{pid}", headers=sharma)


# ── KYC photo privacy ──
def test_kyc_photo_flow(fresh, sharma, patel, master):
    h, d = fresh
    cid = (d.get("user") or {}).get("id") or _me(h)["id"]
    up = requests.post(f"{API}/kyc/photo", files={"file": ("me.png", io.BytesIO(PNG), "image/png")}, headers=h)
    assert up.status_code == 200, up.text
    pid = up.json()["id"]
    assert requests.get(f"{API}/files/{pid}").status_code == 404
    assert requests.post(f"{API}/kyc/submit", json={"full_name": "TEST Fresh", "aadhaar": "123412341234", "pan": "ABCDE1234F", "photo_id": "bogus"}, headers=h).status_code == 400
    s = requests.post(f"{API}/kyc/submit", json={"full_name": "TEST Fresh", "aadhaar": "123412341234", "pan": "ABCDE1234F", "photo_id": pid}, headers=h)
    assert s.status_code == 200, s.text
    own = requests.get(f"{API}/jeweller/v3/kyc/{cid}/photo", headers=sharma)
    assert own.status_code == 200 and own.headers["content-type"].startswith("image/"), own.status_code
    assert requests.get(f"{API}/jeweller/v3/kyc/{cid}/photo", headers=patel).status_code == 404
    assert requests.get(f"{API}/master/v3/kyc/{cid}/photo", headers=master).status_code == 200


# ── Master customer detail ──
def test_master_customer_detail(master, sharma):
    cid = [x for x in requests.get(f"{API}/jeweller/v3/holdings", headers=sharma).json()["customers"] if x["phone"] == "9876543210"][0]["id"]
    r = requests.get(f"{API}/master/v3/customers/{cid}", headers=master)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["customer"]["phone"] == "9876543210" and d["shop"] and "gold_value" in d
    assert requests.get(f"{API}/master/v3/customers/{cid}", headers=sharma).status_code in (401, 403)
    assert requests.get(f"{API}/master/v3/customers/nope", headers=master).status_code == 404


# ── Referral scoped to the store ──
def test_referral_other_store_not_credited():
    rohan, _ = _cust("9845678903", J2)
    code = requests.get(f"{API}/referral", headers=rohan).json().get("code") or requests.get(f"{API}/referral", headers=rohan).json().get("referral_code")
    assert code
    h, d = _cust(_new_phone(), first_name="TEST_Ref", referral_code=code)
    me = _me(h)
    assert not me.get("referred_by") and (me.get("referral_balance") or 0) == 0, me


# ── MT5 bookings ──
def test_mt5_bookings(master, aarav):
    d = requests.get(f"{API}/master/v3/mt5-bookings", headers=master)
    assert d.status_code == 200, d.text
    d = d.json()
    for k in ("config", "pending", "bookings", "symbols"):
        assert k in d
    pend0 = d["pending"]["gold"]
    n0 = len(d["bookings"])
    try:
        # accumulate only (big lot) -> pending grows
        assert requests.put(f"{API}/master/v3/mt5-bookings/config", json={**MT5_DEFAULT, "gold_lot_g": 100000}, headers=master).status_code == 200
        q = requests.post(f"{API}/quote", json={}, headers=aarav).json()
        o = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": 500}, headers=aarav).json()
        cf = requests.post(f"{API}/orders/{o['id']}/mock-confirm", json={"method": "upi", "success": True}, headers=aarav)
        assert cf.status_code == 200, cf.text
        time.sleep(3)
        p1 = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()["pending"]["gold"]
        assert p1 > pend0, (pend0, p1)
        # tiny lot -> real booking attempt
        requests.put(f"{API}/master/v3/mt5-bookings/config", json={**MT5_DEFAULT, "gold_lot_g": 0.01}, headers=master)
        q = requests.post(f"{API}/quote", json={}, headers=aarav).json()
        o = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": 500}, headers=aarav).json()
        cf = requests.post(f"{API}/orders/{o['id']}/mock-confirm", json={"method": "upi", "success": True}, headers=aarav)
        assert cf.status_code == 200, cf.text  # purchase succeeds regardless of MT5
        time.sleep(8)
        d2 = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()
        assert len(d2["bookings"]) > n0
        b = d2["bookings"][0]
        print("MT5 BOOKING:", b)
        assert b["status"] in ("booked", "failed")
        if b["status"] == "booked":
            assert b["ticket"]
        else:
            assert b["error"]
        rt = requests.post(f"{API}/master/v3/mt5-bookings/retry", headers=master)
        assert rt.status_code == 200, rt.text
        print("RETRY:", rt.json())
        pos = requests.get(f"{API}/master/v3/mt5-positions", headers=master)
        print("POSITIONS:", pos.status_code, pos.text[:300])
        assert pos.status_code in (200, 502)
    finally:
        requests.put(f"{API}/master/v3/mt5-bookings/config", json=MT5_DEFAULT, headers=master)
    assert requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()["config"]["gold_lot_g"] == 10
