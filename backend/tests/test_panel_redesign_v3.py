"""Iteration 8 - Jeweller/Master panel redesign v3 APIs: dashboard ranges, commission (flat per g),
orders (buy/redeem only) + bill, holdings, settings, master overview, sell disabled."""
import os, uuid, pytest, requests

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"
J1 = "demo-jeweller-001"


def jlogin(email):
    r = requests.post(f"{API}/jeweller/login", json={"email": email, "password": "jeweller123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def sharma():
    return jlogin("sharma@vaultra.in")


@pytest.fixture(scope="module")
def patel():
    return jlogin("patel@vaultra.in")


@pytest.fixture(scope="module")
def master():
    r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def customer_login(phone):
    r = requests.post(f"{API}/auth/otp/request", json={"phone": phone, "jeweller_id": J1})
    d = r.json()
    r2 = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"],
                                                      "tenant": J1, "first_name": "TEST Iter8"})
    assert r2.status_code == 200, r2.text
    return {"Authorization": f"Bearer {r2.json()['access_token']}"}


# Dashboard ranges
class TestDashboard:
    @pytest.mark.parametrize("rng", ["1d", "3d", "7d", "30d"])
    def test_ranges(self, sharma, rng):
        r = requests.get(f"{API}/jeweller/v3/dashboard?range={rng}", headers=sharma)
        assert r.status_code == 200, r.text
        d = r.json()
        c = d["customers"]
        assert c["active"] + c["inactive"] == c["total"]
        assert "gold_g" in d["booked"] and "price" in d and "feed" in d
        assert d["range"]["key"] == rng

    def test_30d_ge_1d(self, sharma):
        a = requests.get(f"{API}/jeweller/v3/dashboard?range=1d", headers=sharma).json()
        b = requests.get(f"{API}/jeweller/v3/dashboard?range=30d", headers=sharma).json()
        assert b["booked"]["gold_g"] >= a["booked"]["gold_g"]
        assert b["customers"]["active"] >= a["customers"]["active"]

    def test_custom(self, sharma):
        r = requests.get(f"{API}/jeweller/v3/dashboard?range=custom&start=2025-01-01&end=2030-01-01", headers=sharma)
        assert r.status_code == 200
        bad = requests.get(f"{API}/jeweller/v3/dashboard?range=custom&start=xx", headers=sharma)
        assert bad.status_code == 400

    def test_unauth(self):
        assert requests.get(f"{API}/jeweller/v3/dashboard").status_code in (401, 403)


# Commission flat per-gram
class TestCommission:
    def test_save_reflects_price_and_reset(self, sharma):
        try:
            r = requests.put(f"{API}/jeweller/v3/commission", headers=sharma, json={"gold_per_g": 50, "silver_per_g": 2})
            assert r.status_code == 200, r.text
            p = requests.get(f"{API}/price?jeweller_id={J1}").json()
            assert abs(p["buy"] - (p["base_rate"] + 50)) < 0.02, p
            assert abs(p["silver"]["buy"] - (p["silver"]["base_rate"] + 2)) < 0.02 if "base_rate" in p["silver"] else True
        finally:
            z = requests.put(f"{API}/jeweller/v3/commission", headers=sharma, json={"gold_per_g": 0, "silver_per_g": 0})
            assert z.status_code == 200
        p = requests.get(f"{API}/price?jeweller_id={J1}").json()
        assert abs(p["buy"] - p["base_rate"]) < 0.02

    @pytest.mark.parametrize("body", [{"gold_per_g": 1001, "silver_per_g": 0}, {"gold_per_g": 0, "silver_per_g": 101},
                                      {"gold_per_g": -1, "silver_per_g": 0}])
    def test_validation(self, sharma, body):
        assert requests.put(f"{API}/jeweller/v3/commission", headers=sharma, json=body).status_code == 422


# Orders buy/redeem only + bill + isolation
class TestOrders:
    def test_no_sell_rows(self, sharma):
        d = requests.get(f"{API}/jeweller/v3/orders", headers=sharma).json()
        assert all(o["side"] in ("buy", "redeem") for o in d["orders"])
        assert all(o["type"] != "sell" for o in d["orders"])
        assert len(d["orders"]) > 0

    def test_side_sell_returns_no_sell(self, sharma):
        d = requests.get(f"{API}/jeweller/v3/orders?side=sell", headers=sharma).json()
        assert all(o["type"] != "sell" for o in d["orders"])

    def test_filters(self, sharma):
        b = requests.get(f"{API}/jeweller/v3/orders?side=buy", headers=sharma).json()["orders"]
        assert all(o["side"] == "buy" for o in b)
        rd = requests.get(f"{API}/jeweller/v3/orders?side=redeem", headers=sharma).json()["orders"]
        assert all(o["side"] == "redeem" for o in rd)
        s = requests.get(f"{API}/jeweller/v3/orders?metal=silver", headers=sharma).json()["orders"]
        assert all(o["metal"] == "silver" for o in s)
        g = requests.get(f"{API}/jeweller/v3/orders?metal=gold", headers=sharma).json()["orders"]
        assert all(o["metal"] == "gold" for o in g)
        sr = requests.get(f"{API}/jeweller/v3/orders?search=Aarav", headers=sharma).json()["orders"]
        assert sr and all("Aarav" in o["customer_name"] for o in sr)

    def test_bill_and_isolation(self, sharma, patel):
        o = requests.get(f"{API}/jeweller/v3/orders?side=buy", headers=sharma).json()["orders"][0]
        r = requests.get(f"{API}/jeweller/v3/orders/{o['id']}/bill", headers=sharma)
        assert r.status_code == 200
        b = r.json()
        assert b["customer"]["name"] and b["order"]["grams"] == o["grams"]
        for k in ("amount", "gst", "total", "charges", "payable", "metal"):
            assert k in b["order"]
        assert abs(b["order"]["amount"] + b["order"]["gst"] - b["order"]["total"]) < 1.0
        assert requests.get(f"{API}/jeweller/v3/orders/{o['id']}/bill", headers=patel).status_code == 404


# Holdings
class TestHoldings:
    def test_list_and_detail(self, sharma, patel):
        d = requests.get(f"{API}/jeweller/v3/holdings", headers=sharma).json()
        assert d["totals"]["customers"] == len(d["customers"]) > 0
        assert abs(d["totals"]["gold_g"] - sum(c["gold_g"] for c in d["customers"])) < 0.01
        cid = d["customers"][0]["id"]
        det = requests.get(f"{API}/jeweller/v3/holdings/{cid}", headers=sharma)
        assert det.status_code == 200
        j = det.json()
        for k in ("customer", "purchased", "redeemed", "pickups", "timeline"):
            assert k in j
        assert all(t["type"] != "sell" for t in j["timeline"])
        assert requests.get(f"{API}/jeweller/v3/holdings/{cid}", headers=patel).status_code == 404


# Settings + other pages
class TestSettingsMisc:
    def test_settings(self, sharma):
        d = requests.get(f"{API}/jeweller/v3/settings", headers=sharma).json()
        assert d["app_key"] == J1 and d["app_link"].startswith("https://") and d["admin_link"]

    def test_min_redemption(self, sharma):
        cur = requests.get(f"{API}/jeweller/v3/settings", headers=sharma).json().get("min_redemption_grams", 1.0)
        r = requests.put(f"{API}/jeweller/settings/min-redemption", headers=sharma, json={"min_grams": 0.75})
        assert r.status_code == 200 and r.json()["min_redemption_grams"] == 0.75
        requests.put(f"{API}/jeweller/settings/min-redemption", headers=sharma, json={"min_grams": cur})

    @pytest.mark.parametrize("ep", ["v3/gifts", "v3/referrals", "kyc-queue", "pickups", "products", "customers"])
    def test_pages(self, sharma, ep):
        assert requests.get(f"{API}/jeweller/{ep}", headers=sharma).status_code == 200


# Master
class TestMaster:
    @pytest.mark.parametrize("rng", ["1d", "7d", "30d"])
    def test_overview(self, master, rng):
        r = requests.get(f"{API}/master/v3/overview?range={rng}", headers=master)
        assert r.status_code == 200
        d = r.json()
        assert d["totals"]["jewellers"] == len(d["jewellers"]) >= 2

    @pytest.mark.parametrize("ep", ["jewellers", "pool", "bifurcation-invoices", "transactions", "customers", "rate", "dashboard"])
    def test_endpoints(self, master, ep):
        assert requests.get(f"{API}/master/{ep}", headers=master).status_code == 200

    def test_jeweller_cannot_access_master(self, sharma):
        assert requests.get(f"{API}/master/v3/overview", headers=sharma).status_code in (401, 403)


# Customer: sell disabled, buy works
class TestCustomer:
    def test_sell_403_and_buy(self):
        hdr = customer_login("9876543210")
        assert requests.post(f"{API}/sell", headers=hdr, json={"grams": 0.01}).status_code == 403
        q = requests.post(f"{API}/quote", json={"tenant": J1}).json()
        o = requests.post(f"{API}/orders/buy", headers=hdr, json={"quote_id": q["id"], "mode": "rupees", "value": 100, "method": "upi"})
        assert o.status_code == 200, o.text
        c = requests.post(f"{API}/orders/{o.json()['id']}/mock-confirm", headers=hdr, json={"method": "upi", "success": True})
        assert c.status_code == 200, c.text
