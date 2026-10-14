"""Vaultra DigiGold - Backend tests for Gift Gold + Price Alerts (iteration 2)."""
import os, uuid, pytest, requests, time

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://vaultra-gold.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

# fresh phones per run to avoid OTP rate-limit collisions
SENDER = f"90000{uuid.uuid4().int % 100000:05d}"
RECIPIENT_NEW = f"90001{uuid.uuid4().int % 100000:05d}"  # user that does NOT exist yet
EXISTING_RECIPIENT = "9812345670"  # seeded user


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def login(sess, phone, name="Tester"):
    r = sess.post(f"{API}/auth/otp/request", json={"phone": phone})
    assert r.status_code == 200, r.text
    d = r.json()
    r2 = sess.post(f"{API}/auth/otp/verify",
                   json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"],
                         "tenant": "vaultra", "name": name})
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"], r2.json()["user"]


@pytest.fixture(scope="module")
def sender_auth(s):
    tok, u = login(s, SENDER, "Gift Sender")
    hdr = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    # buy enough gold to gift (3g)
    q = s.post(f"{API}/quote?tenant=vaultra").json()
    o = s.post(f"{API}/orders/buy", headers=hdr,
               json={"quote_id": q["id"], "mode": "grams", "value": 3.0}).json()
    s.post(f"{API}/orders/{o['id']}/mock-confirm", headers=hdr, json={"method": "upi", "success": True})
    return hdr, u


# =============== GIFTS ===============
class TestGiftsErrors:
    def test_self_gift_blocked(self, s, sender_auth):
        hdr, u = sender_auth
        r = s.post(f"{API}/gifts", headers=hdr,
                   json={"phone": u["phone"], "mode": "grams", "value": 0.1,
                         "theme": "diwali", "message": "self", "tenant": "vaultra"})
        assert r.status_code == 400

    def test_invalid_phone(self, s, sender_auth):
        hdr, _ = sender_auth
        r = s.post(f"{API}/gifts", headers=hdr,
                   json={"phone": "12345", "mode": "grams", "value": 0.1,
                         "theme": "diwali", "tenant": "vaultra"})
        assert r.status_code == 400

    def test_invalid_theme(self, s, sender_auth):
        hdr, _ = sender_auth
        r = s.post(f"{API}/gifts", headers=hdr,
                   json={"phone": EXISTING_RECIPIENT, "mode": "grams", "value": 0.1,
                         "theme": "halloween", "tenant": "vaultra"})
        assert r.status_code == 400

    def test_over_50g_blocked(self, s, sender_auth):
        hdr, _ = sender_auth
        r = s.post(f"{API}/gifts", headers=hdr,
                   json={"phone": EXISTING_RECIPIENT, "mode": "grams", "value": 51,
                         "theme": "diwali", "tenant": "vaultra"})
        assert r.status_code == 400

    def test_insufficient_balance(self, s, sender_auth):
        hdr, _ = sender_auth
        r = s.post(f"{API}/gifts", headers=hdr,
                   json={"phone": EXISTING_RECIPIENT, "mode": "grams", "value": 49,
                         "theme": "diwali", "tenant": "vaultra"})
        assert r.status_code == 400


class TestGiftsHappy:
    def test_send_gift_debits_sender_credits_recipient(self, s, sender_auth):
        hdr, u = sender_auth
        before = s.get(f"{API}/vault", headers=hdr).json()["user"]["gold_grams"]
        r = s.post(f"{API}/gifts", headers=hdr,
                   json={"phone": EXISTING_RECIPIENT, "recipient_name": "Rohan",
                         "mode": "grams", "value": 0.25, "theme": "birthday",
                         "message": "Happy birthday!", "tenant": "vaultra"})
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["grams"] == 0.25 and g["theme"] == "birthday" and g["recipient_phone"] == EXISTING_RECIPIENT
        after = s.get(f"{API}/vault", headers=hdr).json()["user"]["gold_grams"]
        assert abs((before - after) - 0.25) < 1e-6
        # Transactions filter gift
        tx = s.get(f"{API}/transactions?type=gift", headers=hdr).json()
        assert any(t["type"] == "gift_sent" and t.get("gift_id") == g["id"] for t in tx)

    def test_gift_lists_show_sent(self, s, sender_auth):
        hdr, _ = sender_auth
        r = s.get(f"{API}/gifts", headers=hdr).json()
        assert "sent" in r and "received" in r and "unseen" in r
        assert len(r["sent"]) >= 1

    def test_send_gift_to_new_phone_creates_user(self, s, sender_auth):
        hdr, _ = sender_auth
        r = s.post(f"{API}/gifts", headers=hdr,
                   json={"phone": RECIPIENT_NEW, "recipient_name": "Newbie",
                         "mode": "rupees", "value": 500, "theme": "congrats",
                         "message": "GG", "tenant": "vaultra"})
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["grams"] > 0 and g["amount"] > 0
        # Recipient logs in and sees it
        tok2, u2 = login(s, RECIPIENT_NEW, "Newbie")
        rhdr = {"Authorization": f"Bearer {tok2}"}
        gl = s.get(f"{API}/gifts", headers=rhdr).json()
        assert any(x["id"] == g["id"] for x in gl["received"])
        assert gl["unseen"] >= 1
        # mark-seen clears
        s.post(f"{API}/gifts/mark-seen", headers=rhdr)
        gl2 = s.get(f"{API}/gifts", headers=rhdr).json()
        assert gl2["unseen"] == 0
        # Recipient vault increased
        v = s.get(f"{API}/vault", headers=rhdr).json()
        assert v["user"]["gold_grams"] >= g["grams"] - 1e-6

    def test_gift_txn_cannot_be_reversed(self, s, sender_auth):
        hdr, _ = sender_auth
        tx = s.get(f"{API}/transactions?type=gift", headers=hdr).json()
        gift_tx = next((t for t in tx if t["type"] == "gift_sent"), None)
        assert gift_tx
        # Admin login
        a = s.post(f"{API}/admin/login", json={"staff_id": "STF001", "pin": "1234"}).json()
        ah = {"Authorization": f"Bearer {a['access_token']}", "Content-Type": "application/json"}
        rv = s.post(f"{API}/admin/ledger/{gift_tx['id']}/reverse", headers=ah, json={"reason": "nope"})
        assert rv.status_code == 400


# =============== ALERTS ===============
class TestAlerts:
    def test_create_list_delete(self, s, sender_auth):
        hdr, _ = sender_auth
        c = s.post(f"{API}/alerts", headers=hdr, json={"target": 7000, "tenant": "vaultra"})
        assert c.status_code == 200, c.text
        aid = c.json()["id"]
        assert c.json()["target"] == 7000 and c.json()["status"] == "active"
        lst = s.get(f"{API}/alerts", headers=hdr).json()
        assert any(a["id"] == aid for a in lst)
        d = s.delete(f"{API}/alerts/{aid}", headers=hdr)
        assert d.status_code == 200
        lst2 = s.get(f"{API}/alerts", headers=hdr).json()
        assert not any(a["id"] == aid for a in lst2)

    def test_trigger_server_verified(self, s, sender_auth):
        hdr, _ = sender_auth
        price = s.get(f"{API}/price?tenant=vaultra").json()["buy"]
        # Target BELOW live price should NOT trigger
        low = s.post(f"{API}/alerts", headers=hdr,
                     json={"target": max(1500, price - 2000), "tenant": "vaultra"}).json()
        t1 = s.post(f"{API}/alerts/{low['id']}/trigger", headers=hdr).json()
        assert t1["status"] == "active", f"unexpected trigger when target < price: {t1}"
        # Target ABOVE live price SHOULD trigger
        high = s.post(f"{API}/alerts", headers=hdr,
                      json={"target": price + 500, "tenant": "vaultra"}).json()
        t2 = s.post(f"{API}/alerts/{high['id']}/trigger", headers=hdr).json()
        assert t2["status"] == "triggered" and t2["triggered_price"] is not None
        # cleanup
        s.delete(f"{API}/alerts/{low['id']}", headers=hdr)
        s.delete(f"{API}/alerts/{high['id']}", headers=hdr)

    def test_max_5_active(self, s, sender_auth):
        hdr, _ = sender_auth
        ids = []
        for i in range(5):
            r = s.post(f"{API}/alerts", headers=hdr,
                       json={"target": 7000 + i, "tenant": "vaultra"})
            assert r.status_code == 200, r.text
            ids.append(r.json()["id"])
        over = s.post(f"{API}/alerts", headers=hdr,
                      json={"target": 7100, "tenant": "vaultra"})
        assert over.status_code == 400
        for i in ids:
            s.delete(f"{API}/alerts/{i}", headers=hdr)

    def test_invalid_target(self, s, sender_auth):
        hdr, _ = sender_auth
        r = s.post(f"{API}/alerts", headers=hdr, json={"target": 500, "tenant": "vaultra"})
        assert r.status_code in (400, 422)
