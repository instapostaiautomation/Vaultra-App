"""Iteration 6 retest - buy credit via mock-confirm, product image key, tenant scoping on products/orders/redeem,
no 'Saver' default names, max 5 alerts, silver alerts compare silver price."""
import os, uuid, pytest, requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
J1 = "demo-jeweller-001"
J2 = "demo-jeweller-002"


def rnd_phone(prefix="93"):
    return f"{prefix}{uuid.uuid4().int % 10**8:08d}"


def login(phone, tenant=J1, name="TEST Iter6"):
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


def vault(hdr):
    r = requests.get(f"{API}/vault", headers=hdr)
    assert r.status_code == 200, r.text
    return r.json()


def quote(metal="gold", tenant=J1):
    r = requests.post(f"{API}/quote" + ("/silver" if metal == "silver" else ""), json={"tenant": tenant})
    assert r.status_code == 200, r.text
    return r.json()


def buy_confirm(hdr, metal="gold", mode="rupees", value=1000, tenant=J1):
    q = quote(metal, tenant)
    ep = "/orders/buy-silver" if metal == "silver" else "/orders/buy"
    o = requests.post(f"{API}{ep}", headers=hdr, json={"quote_id": q["id"], "mode": mode, "value": value, "method": "upi"})
    assert o.status_code == 200, o.text
    c = requests.post(f"{API}/orders/{o.json()['id']}/mock-confirm", headers=hdr, json={"method": "upi", "success": True})
    assert c.status_code == 200, c.text
    return q, o.json(), c.json()


# Buy flow (same calls BuyWidget makes)
class TestBuyCredit:
    def test_gold_rupees_credit_and_passbook(self, auth):
        hdr, _ = auth
        before = vault(hdr)
        q, o, c = buy_confirm(hdr, "gold", "rupees", 2000)
        t = c["transaction"]
        assert t["grams"] > 0 and abs(t["rate"] - q["buy"]) < 0.01
        assert abs(t["total"] - 2060) < 0.05
        after = vault(hdr)
        print("vault keys", list(after.keys()))
        g_before = before.get("user", before).get("gold_grams", before.get("gold_grams", 0)) if isinstance(before.get("user"), dict) else before.get("gold_grams", 0)
        g_after = after.get("user", after).get("gold_grams", after.get("gold_grams", 0)) if isinstance(after.get("user"), dict) else after.get("gold_grams", 0)
        assert g_after > g_before, (g_before, g_after)

    def test_gold_grams_credit(self, auth):
        hdr, _ = auth
        _, o, c = buy_confirm(hdr, "gold", "grams", 0.05)
        assert abs(c["transaction"]["grams"] - 0.05) < 1e-4

    def test_silver_credit(self, auth):
        hdr, _ = auth
        _, o, c = buy_confirm(hdr, "silver", "rupees", 1000)
        assert c["transaction"]["metal"] == "silver"
        assert c["user"].get("silver_grams", 0) > 0

    def test_double_confirm_rejected(self, auth):
        hdr, _ = auth
        _, o, _ = buy_confirm(hdr, "gold", "rupees", 500)
        r = requests.post(f"{API}/orders/{o['id']}/mock-confirm", headers=hdr, json={"method": "upi", "success": True})
        assert r.status_code == 400


# Products: image key + tenant scoping
class TestProducts:
    def test_products_scoped_and_have_image(self):
        r = requests.get(f"{API}/products", params={"jeweller_id": J1})
        assert r.status_code == 200
        ps = r.json()
        assert len(ps) > 0
        assert all(p["jeweller_id"] == J1 for p in ps)
        assert all(p.get("image") for p in ps)
        assert not any("Test Jewellers" in (p.get("name") or "") for p in ps)

    def test_products_unscoped_list(self):
        r = requests.get(f"{API}/products")
        jids = {p["jeweller_id"] for p in r.json()}
        print("Unscoped /products jewellers:", jids)

    def test_product_detail_has_image(self):
        p = requests.get(f"{API}/products", params={"jeweller_id": J1}).json()[0]
        d = requests.get(f"{API}/products/{p['id']}").json()
        assert d.get("image") and d["features"]


# Cross-tenant rejection
class TestTenantGuards:
    def test_buy_rejects_other_jeweller_quote(self, auth):
        hdr, _ = auth
        q = quote("gold", J2)
        r = requests.post(f"{API}/orders/buy", headers=hdr, json={"quote_id": q["id"], "mode": "rupees", "value": 1000, "method": "upi"})
        assert r.status_code == 400, r.text

    def test_redeem_rejects_other_jeweller_product(self, auth):
        hdr, _ = auth
        p2 = requests.get(f"{API}/products", params={"jeweller_id": J2}).json()
        if not p2:
            pytest.skip("no J2 products")
        r = requests.post(f"{API}/redeem", headers=hdr, json={"kind": "product", "product_id": p2[0]["id"]})
        assert r.status_code == 404, r.text


# Names: no 'Saver'
class TestNames:
    def test_new_user_no_saver(self):
        phone = rnd_phone()
        r = requests.post(f"{API}/auth/otp/request", json={"phone": phone}).json()
        v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": r["challenge_id"], "otp": r["demo_otp"], "tenant": J1}).json()
        assert "Saver" not in (v["user"].get("name") or ""), v["user"]

    def test_gift_recipient_name(self, auth):
        hdr, _ = auth
        ph = rnd_phone("94")
        r = requests.post(f"{API}/gifts", headers=hdr, json={"phone": ph, "recipient_name": "TEST Riya", "mode": "grams", "value": 0.001, "theme": "diwali"})
        assert r.status_code == 200, r.text
        sent = requests.get(f"{API}/gifts", headers=hdr).json()
        s = sent.get("sent", sent) if isinstance(sent, dict) else sent
        txt = str(s)
        assert "Saver" not in txt
        assert "TEST Riya" in txt


# Alerts: max 5, silver compares silver price
class TestAlerts:
    def test_silver_alert_trigger_uses_silver_price(self, auth):
        hdr, _ = auth
        sq = quote("silver")
        a = requests.post(f"{API}/alerts", headers=hdr, json={"target": sq["buy"] + 50, "metal": "silver"}).json()
        t = requests.post(f"{API}/alerts/{a['id']}/trigger", headers=hdr).json()
        assert t["status"] == "triggered" and t["triggered_price"] < 1000
        b = requests.post(f"{API}/alerts", headers=hdr, json={"target": sq["buy"] - 20, "metal": "silver"}).json()
        t2 = requests.post(f"{API}/alerts/{b['id']}/trigger", headers=hdr).json()
        assert t2["status"] == "active"
        requests.delete(f"{API}/alerts/{b['id']}", headers=hdr)

    def test_max_5_active_alerts(self):
        hdr, _ = login(rnd_phone())
        ids = []
        for i in range(5):
            r = requests.post(f"{API}/alerts", headers=hdr, json={"target": 5000 + i, "metal": "gold"})
            assert r.status_code == 200, r.text
            ids.append(r.json()["id"])
        r = requests.post(f"{API}/alerts", headers=hdr, json={"target": 6000, "metal": "gold"})
        assert r.status_code == 400
        requests.delete(f"{API}/alerts/{ids[0]}", headers=hdr)
        r = requests.post(f"{API}/alerts", headers=hdr, json={"target": 6000, "metal": "gold"})
        assert r.status_code == 200
