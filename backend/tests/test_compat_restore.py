"""Iteration 5 - Compatibility endpoints added for restored old Expo UI (tenant alias, quote w/o auth,
silver quote/buy, order status, vault pending_pickups, gifts names, alerts book/trigger, admin panels)."""
import os, uuid, pytest, requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
J1 = "demo-jeweller-001"


def rnd_phone(prefix="91"):
    return f"{prefix}{uuid.uuid4().int % 10**8:08d}"


def login(phone, tenant=J1, name="TEST User"):
    r = requests.post(f"{API}/auth/otp/request", json={"phone": phone})
    assert r.status_code == 200, r.text
    d = r.json()
    r2 = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"], "tenant": tenant, "first_name": name})
    assert r2.status_code == 200, r2.text
    return {"Authorization": f"Bearer {r2.json()['access_token']}"}, r2.json()["user"]


@pytest.fixture(scope="module")
def auth():
    return login(rnd_phone())


def buy(hdr, metal="gold", value=1000, mode="rupees", confirm=True):
    q = requests.post(f"{API}/quote" + ("/silver" if metal == "silver" else ""), json={"tenant": J1}).json()
    ep = "/orders/buy-silver" if metal == "silver" else "/orders/buy"
    o = requests.post(f"{API}{ep}", headers=hdr, json={"quote_id": q["id"], "mode": mode, "value": value, "method": "mock"})
    assert o.status_code == 200, o.text
    o = o.json()
    if confirm:
        c = requests.post(f"{API}/orders/{o['id']}/mock-confirm", headers=hdr, json={"method": "upi", "success": True})
        assert c.status_code == 200, c.text
    return q, o


# Tenant alias + price
class TestPriceTenant:
    def test_price_tenant_alias(self):
        r = requests.get(f"{API}/price", params={"tenant": J1})
        assert r.status_code == 200
        d = r.json()
        assert d["buy"] > d["sell"] > 0
        assert "silver" in d and d["silver"]["buy"] > 0
        assert (d["change_pct"] >= 0) == (d["direction"] == "up")

    def test_otp_verify_tenant_alias(self, auth):
        hdr, user = auth
        assert user.get("tenant") == J1


# Quote with/without auth, silver
class TestQuote:
    def test_quote_no_auth_body_tenant(self):
        r = requests.post(f"{API}/quote", json={"tenant": J1})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["metal"] == "gold" and d["lock_seconds"] == 300 and d["buy"] > 0

    def test_quote_no_body(self):
        r = requests.post(f"{API}/quote")
        assert r.status_code == 200, r.text

    def test_quote_silver(self):
        r = requests.post(f"{API}/quote/silver", json={"tenant": J1})
        assert r.status_code == 200, r.text
        d = r.json()
        g = requests.post(f"{API}/quote", json={"tenant": J1}).json()
        assert d["metal"] == "silver" and d["buy"] < g["buy"]


# Buy flows + order status + vault
class TestBuy:
    def test_buy_gold_rupees_credits_after_confirm(self, auth):
        hdr, _ = auth
        before = requests.get(f"{API}/vault", headers=hdr).json()["user"]["gold_grams"]
        q, o = buy(hdr, "gold", 1000)
        after = requests.get(f"{API}/vault", headers=hdr).json()["user"]["gold_grams"]
        assert round(after - before, 4) == round(o["grams"], 4)

    def test_buy_without_confirm_does_not_credit(self, auth):
        # BuyWidget only calls /orders/buy (no mock-confirm) - documents that balance is NOT credited
        hdr, _ = auth
        before = requests.get(f"{API}/vault", headers=hdr).json()["user"]["gold_grams"]
        q, o = buy(hdr, "gold", 500, confirm=False)
        assert o["status"] == "created"
        after = requests.get(f"{API}/vault", headers=hdr).json()["user"]["gold_grams"]
        print(f"before={before} after={after} (no mock-confirm)")
        assert after == before

    def test_buy_gold_grams(self, auth):
        hdr, _ = auth
        q, o = buy(hdr, "gold", 0.5, mode="grams")
        assert o["grams"] == 0.5 and abs(o["amount"] - round(0.5 * q["buy"], 2)) < 0.02

    def test_buy_silver_and_order_status(self, auth):
        hdr, _ = auth
        q, o = buy(hdr, "silver", 1000)
        assert o["metal"] == "silver"
        r = requests.get(f"{API}/orders/{o['id']}", headers=hdr)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order"]["status"] == "paid" and d["order"]["tenant"] == J1
        assert d["transaction"] and d["transaction"]["type"] == "buy_silver"
        v = requests.get(f"{API}/vault", headers=hdr).json()
        assert v["user"]["silver_grams"] > 0
        assert isinstance(v["pending_pickups"], list)

    def test_order_404(self, auth):
        hdr, _ = auth
        assert requests.get(f"{API}/orders/nope", headers=hdr).status_code == 404

    def test_txn_has_tenant(self, auth):
        hdr, _ = auth
        r = requests.get(f"{API}/transactions", headers=hdr)
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        assert items and items[0].get("tenant") == J1


# Gifts with names
class TestGifts:
    def test_gift_new_phone_names(self, auth):
        hdr, _ = auth
        to = rnd_phone("92")
        r = requests.post(f"{API}/gifts", headers=hdr, json={"phone": to, "recipient_name": "TEST Friend", "mode": "grams", "value": 0.01, "message": "hi"})
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/gifts", headers=hdr).json()
        sent = g.get("sent", [])
        assert sent, g
        s0 = sent[0]
        print(s0)
        assert s0.get("recipient_phone", "").endswith(to[-10:])
        assert s0.get("recipient_name") and s0.get("sender_name")

    def test_gifts_mark_seen(self, auth):
        hdr, _ = auth
        r = requests.post(f"{API}/gifts/mark-seen", headers=hdr)
        assert r.status_code == 200, r.text


# Alerts incl book + trigger
class TestAlerts:
    def test_alert_create_book_trigger_delete(self, auth):
        hdr, _ = auth
        p = requests.get(f"{API}/price", params={"tenant": J1}).json()
        a = requests.post(f"{API}/alerts", headers=hdr, json={"target": round(p["buy"] * 0.9, 2)})
        assert a.status_code == 200, a.text
        a = a.json()
        assert a["tenant"] == J1 and a["status"] == "active"
        b = requests.post(f"{API}/alerts/book", headers=hdr, json={"target": round(p["buy"] * 0.95, 2), "buy_amount": 1000})
        assert b.status_code == 200, b.text
        assert b.json().get("alert_type") == "book"
        # trigger when price above target -> must not trigger
        t = requests.post(f"{API}/alerts/{a['id']}/trigger", headers=hdr)
        print("trigger:", t.status_code, t.text[:200])
        assert t.status_code in (200, 400, 409)
        if t.status_code == 200:
            assert t.json().get("status") != "triggered"
        hi = requests.post(f"{API}/alerts", headers=hdr, json={"target": round(p["buy"] * 1.2, 2)}).json()
        t2 = requests.post(f"{API}/alerts/{hi['id']}/trigger", headers=hdr)
        assert t2.status_code == 200 and t2.json().get("status") == "triggered", t2.text
        lst = requests.get(f"{API}/alerts", headers=hdr).json()
        assert len(lst) >= 3
        for x in (a, b.json(), hi):
            d = requests.delete(f"{API}/alerts/{x['id']}", headers=hdr)
            assert d.status_code == 200
        assert not [x for x in requests.get(f"{API}/alerts", headers=hdr).json() if x["id"] == a["id"]]


# Redeem -> pending pickups
class TestRedeem:
    def test_redeem_coin_pending_pickup(self, auth):
        hdr, _ = auth
        buy(hdr, "gold", 1.05, mode="grams")
        r = requests.post(f"{API}/redeem", headers=hdr, json={"kind": "coin", "coin_grams": 1})
        print(r.status_code, r.text[:300])
        assert r.status_code == 200, r.text
        v2 = requests.get(f"{API}/vault", headers=hdr).json()
        assert v2["pending_pickups"], "pending pickup missing"
        pk = v2["pending_pickups"][0]
        print(pk)
        assert pk.get("otp") or pk.get("pickup_otp") or pk.get("code")


# Admin web panels
class TestAdminPanels:
    @pytest.mark.parametrize("path", ["/api/admin/master", "/api/admin/jeweller"])
    def test_panel_loads(self, path):
        r = requests.get(f"{BASE}{path}")
        assert r.status_code == 200 and "<html" in r.text.lower()
        import re
        emojis = re.findall("[\U0001F300-\U0001FAFF\u2600-\u27BF]", r.text)
        print(path, "emoji chars:", set(emojis))
