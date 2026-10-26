"""Iteration 7 retest - silver passbook/vault, buy rounding, products active-jeweller filter,
admin panel HTML not prefilled, admin logins, gold buy + login regression."""
import os, uuid, math, re, pytest, requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
J1 = "demo-jeweller-001"


def rnd_phone(prefix="94"):
    return f"{prefix}{uuid.uuid4().int % 10**8:08d}"


def login(phone, tenant=J1, name="TEST Iter7"):
    r = requests.post(f"{API}/auth/otp/request", json={"phone": phone, "jeweller_id": tenant})
    assert r.status_code == 200, r.text
    d = r.json()
    r2 = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"],
                                                      "tenant": tenant, "first_name": name})
    assert r2.status_code == 200, r2.text
    return {"Authorization": f"Bearer {r2.json()['access_token']}"}, r2.json()["user"]


@pytest.fixture(scope="module")
def auth():
    return login(rnd_phone())


def buy_confirm(hdr, metal="gold", mode="rupees", value=1000):
    q = requests.post(f"{API}/quote" + ("/silver" if metal == "silver" else ""), json={"tenant": J1}).json()
    ep = "/orders/buy-silver" if metal == "silver" else "/orders/buy"
    o = requests.post(f"{API}{ep}", headers=hdr, json={"quote_id": q["id"], "mode": mode, "value": value, "method": "upi"})
    assert o.status_code == 200, o.text
    c = requests.post(f"{API}/orders/{o.json()['id']}/mock-confirm", headers=hdr, json={"method": "upi", "success": True})
    assert c.status_code == 200, c.text
    return q, o.json(), c.json()


# Login regression
class TestLogin:
    def test_existing_customer_login(self):
        hdr, u = login("9876543210")
        assert u["phone"].endswith("9876543210")
        assert requests.get(f"{API}/vault", headers=hdr).status_code == 200


# Gold buy regression + preview==credited rounding (floor 4dp)
class TestBuy:
    def test_gold_rupees_floor(self, auth):
        hdr, _ = auth
        q, o, c = buy_confirm(hdr, "gold", "rupees", 2000)
        expected = math.floor((2000 / q["buy"]) * 10000) / 10000
        assert abs(c["transaction"]["grams"] - expected) < 1e-9, (c["transaction"]["grams"], expected)

    def test_silver_buy_txn_type_and_balance(self, auth):
        hdr, _ = auth
        q, o, c = buy_confirm(hdr, "silver", "rupees", 1000)
        t = c["transaction"]
        assert t["metal"] == "silver" and t["type"] == "buy_silver"
        expected = math.floor((1000 / q["buy"]) * 10000) / 10000
        assert abs(t["grams"] - expected) < 1e-9
        tx = requests.get(f"{API}/transactions", headers=hdr).json()
        items = tx if isinstance(tx, list) else tx.get("items", tx.get("transactions", []))
        assert any(x["type"] == "buy_silver" for x in items)
        v = requests.get(f"{API}/vault", headers=hdr).json()
        u = v.get("user", v)
        assert u.get("silver_grams", 0) > 0, v


# /products excludes suspended jewellers
class TestProductsActive:
    def test_unscoped_excludes_suspended(self):
        r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200, r.text
        mh = {"Authorization": f"Bearer {r.json()['access_token']}"}
        js = requests.get(f"{API}/master/jewellers", headers=mh).json()
        status = {j["id"]: j["status"] for j in js}
        prods = requests.get(f"{API}/products").json()
        bad = [p["jeweller_id"] for p in prods if status.get(p["jeweller_id"]) != "active"]
        assert not bad, bad
        # toggle Patel to suspended and verify its products vanish, then restore
        j2 = "demo-jeweller-002"
        t = requests.post(f"{API}/master/jewellers/{j2}/toggle", headers=mh).json()
        try:
            if t["status"] == "suspended":
                prods2 = requests.get(f"{API}/products").json()
                assert not any(p["jeweller_id"] == j2 for p in prods2)
        finally:
            if t["status"] == "suspended":
                requests.post(f"{API}/master/jewellers/{j2}/toggle", headers=mh)
        assert requests.get(f"{API}/master/jewellers", headers=mh).json() and \
            {j["id"]: j["status"] for j in requests.get(f"{API}/master/jewellers", headers=mh).json()}[j2] == "active"


# Admin panels: not prefilled, logins work
class TestAdminPanels:
    def test_master_panel_not_prefilled(self):
        html = requests.get(f"{API}/admin/master").text
        m = re.search(r'id="lu"[^>]*', html); p = re.search(r'id="lp"[^>]*', html)
        assert 'value="admin"' not in m.group(0) and "admin123" not in p.group(0), (m.group(0), p.group(0))

    def test_jeweller_panel_not_prefilled(self):
        html = requests.get(f"{API}/admin/jeweller").text
        assert "sharma@vaultra.in" not in html and "jeweller123" not in html

    def test_master_login(self):
        r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200 and r.json()["access_token"]

    def test_jeweller_login(self):
        r = requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"})
        assert r.status_code == 200 and r.json()["jeweller"]["id"] == J1
