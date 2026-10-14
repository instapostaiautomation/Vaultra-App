"""Vaultra DigiGold - Comprehensive backend regression tests."""
import os, time, uuid, pytest, requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://vaultra-gold.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
TEST_PHONE = "9000012345"  # fresh user per run
TEST_PHONE2 = "9000098765"  # second fresh user for KYC flow


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# -------- auth helper (new/returning user) --------
def login_as(sess, phone):
    r = sess.post(f"{API}/auth/otp/request", json={"phone": phone})
    assert r.status_code == 200, r.text
    data = r.json()
    r2 = sess.post(f"{API}/auth/otp/verify",
                   json={"challenge_id": data["challenge_id"], "otp": data["demo_otp"],
                         "tenant": "vaultra", "name": "Test User"})
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"], r2.json()["user"]


# -------- public endpoints --------
class TestPublic:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200 and r.json()["app"] == "Vaultra DigiGold"

    def test_tenants(self, s):
        r = s.get(f"{API}/tenants")
        assert r.status_code == 200 and len(r.json()) == 3

    def test_price(self, s):
        r = s.get(f"{API}/price?tenant=tanishq")
        d = r.json()
        assert r.status_code == 200 and d["buy"] > 0 and d["sell"] < d["buy"] and d["gst_rate"] == 0.03

    def test_quote(self, s):
        r = s.post(f"{API}/quote?tenant=vaultra")
        assert r.status_code == 200 and r.json()["lock_seconds"] == 300

    def test_products_filter(self, s):
        r = s.get(f"{API}/products?category=rings")
        assert r.status_code == 200 and all(p["category"] == "rings" for p in r.json())

    def test_config(self, s):
        r = s.get(f"{API}/config")
        d = r.json()
        assert r.status_code == 200 and d["coins"] == [1, 2, 5, 10]


# -------- customer auth / OTP --------
class TestAuth:
    def test_otp_bad_phone(self, s):
        r = s.post(f"{API}/auth/otp/request", json={"phone": "12345"})
        assert r.status_code == 422 or r.status_code == 400

    def test_otp_wrong_code(self, s):
        r = s.post(f"{API}/auth/otp/request", json={"phone": "9000055555"}).json()
        bad = s.post(f"{API}/auth/otp/verify",
                     json={"challenge_id": r["challenge_id"], "otp": "000000", "tenant": "vaultra"})
        assert bad.status_code == 401

    def test_full_login_new_user(self, s):
        tok, u = login_as(s, TEST_PHONE)
        assert tok and u["phone"] == TEST_PHONE and u["kyc_status"] == "not_submitted"


# -------- buy/vault/sip flows --------
@pytest.fixture(scope="class")
def buy_auth(s):
    tok, u = login_as(s, TEST_PHONE)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


class TestBuyVaultSIP:
    @pytest.fixture(autouse=True)
    def setup(self, buy_auth):
        self.auth = buy_auth

    def test_me(self, s):
        r = s.get(f"{API}/me", headers=self.auth)
        assert r.status_code == 200 and r.json()["phone"] == TEST_PHONE

    def test_buy_rupees_mock_confirm_updates_vault(self, s):
        q = s.post(f"{API}/quote?tenant=vaultra").json()
        before = s.get(f"{API}/vault", headers=self.auth).json()["user"]["gold_grams"]
        r = s.post(f"{API}/orders/buy", headers=self.auth,
                   json={"quote_id": q["id"], "mode": "rupees", "value": 2000, "method": "upi"})
        assert r.status_code == 200, r.text
        o = r.json()
        # verify 3% GST
        assert abs(o["gst"] - round(o["amount"] * 0.03, 2)) < 0.02
        assert abs(o["total"] - round(o["amount"] + o["gst"], 2)) < 0.02
        # mock-confirm
        c = s.post(f"{API}/orders/{o['id']}/mock-confirm", headers=self.auth,
                   json={"method": "upi", "success": True})
        assert c.status_code == 200, c.text
        after = s.get(f"{API}/vault", headers=self.auth).json()["user"]["gold_grams"]
        assert after > before

    def test_buy_grams_mode(self, s):
        q = s.post(f"{API}/quote?tenant=vaultra").json()
        r = s.post(f"{API}/orders/buy", headers=self.auth,
                   json={"quote_id": q["id"], "mode": "grams", "value": 0.1})
        assert r.status_code == 200 and r.json()["grams"] == 0.1

    def test_buy_invalid_quote(self, s):
        r = s.post(f"{API}/orders/buy", headers=self.auth,
                   json={"quote_id": "nope", "mode": "rupees", "value": 500})
        assert r.status_code == 400

    def test_sell_requires_kyc(self, s):
        r = s.post(f"{API}/sell", headers=self.auth, json={"grams": 0.1, "tenant": "vaultra"})
        assert r.status_code == 403

    def test_redeem_requires_kyc(self, s):
        r = s.post(f"{API}/redeem", headers=self.auth,
                   json={"kind": "coin", "coin_grams": 1, "tenant": "vaultra"})
        assert r.status_code == 403

    def test_transactions_filter(self, s):
        r = s.get(f"{API}/transactions?type=buy", headers=self.auth)
        assert r.status_code == 200 and all(t["type"] in ("buy", "counter_sale") for t in r.json())

    def test_sip_crud_and_run(self, s):
        c = s.post(f"{API}/sips", headers=self.auth, json={"amount": 500, "frequency": "monthly", "tenant": "vaultra"})
        assert c.status_code == 200
        sid = c.json()["id"]
        r = s.post(f"{API}/sips/{sid}/run", headers=self.auth)
        assert r.status_code == 200 and r.json()["type"] == "sip"
        t = s.post(f"{API}/sips/{sid}/toggle", headers=self.auth)
        assert t.status_code == 200 and t.json()["status"] == "paused"
        d = s.delete(f"{API}/sips/{sid}", headers=self.auth)
        assert d.status_code == 200


# -------- KYC + approved flows (sell/redeem) --------
class TestKycAndApproved:
    def test_kyc_submit_then_admin_approve_then_sell_and_redeem(self, s):
        tok, u = login_as(s, TEST_PHONE2)
        auth = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # buy some gold first
        q = s.post(f"{API}/quote?tenant=vaultra").json()
        o = s.post(f"{API}/orders/buy", headers=auth,
                   json={"quote_id": q["id"], "mode": "grams", "value": 1.5}).json()
        s.post(f"{API}/orders/{o['id']}/mock-confirm", headers=auth,
               json={"method": "upi", "success": True})

        # Submit KYC
        r = s.post(f"{API}/kyc/submit", headers=auth,
                   json={"full_name": "Test KYC", "aadhaar": "123456789012", "pan": "ABCDE1234F", "dob": "1990-01-01"})
        assert r.status_code == 200 and r.json()["kyc_status"] == "pending"

        # Admin login (STF001 all tenant)
        a = s.post(f"{API}/admin/login", json={"staff_id": "STF001", "pin": "1234"})
        assert a.status_code == 200, a.text
        astaff = {"Authorization": f"Bearer {a.json()['access_token']}", "Content-Type": "application/json"}

        # Find in KYC queue
        q = s.get(f"{API}/admin/kyc-queue", headers=astaff).json()
        target = next((x for x in q if x["phone"] == TEST_PHONE2), None)
        assert target, f"User not in KYC queue, got {len(q)} entries"

        # Approve
        d = s.post(f"{API}/admin/kyc/{target['id']}/decision", headers=astaff,
                   json={"approve": True, "note": "ok"})
        assert d.status_code == 200 and d.json()["kyc_status"] == "approved"

        # Now sell works
        se = s.post(f"{API}/sell", headers=auth, json={"grams": 0.05, "tenant": "vaultra"})
        assert se.status_code == 200 and se.json()["type"] == "sell"

        # Redeem coin -> pickup with OTP
        rd = s.post(f"{API}/redeem", headers=auth,
                    json={"kind": "coin", "coin_grams": 1, "tenant": "vaultra"})
        assert rd.status_code == 200
        pickup = rd.json()["pickup"]
        assert len(pickup["otp"]) == 6

        # Admin pickups list (OTP must be stripped)
        plist = s.get(f"{API}/admin/pickups", headers=astaff).json()
        found = next((p for p in plist if p["id"] == pickup["id"]), None)
        assert found and "otp" not in found

        # Wrong OTP decrements, right OTP collects
        bad = s.post(f"{API}/admin/pickups/{pickup['id']}/collect", headers=astaff, json={"otp": "000000"})
        assert bad.status_code == 400
        good = s.post(f"{API}/admin/pickups/{pickup['id']}/collect", headers=astaff, json={"otp": pickup["otp"]})
        assert good.status_code == 200


# -------- staff/admin --------
class TestAdmin:
    @pytest.fixture(autouse=True)
    def setup(self, s):
        a = s.post(f"{API}/admin/login", json={"staff_id": "STF001", "pin": "1234"})
        assert a.status_code == 200
        self.auth = {"Authorization": f"Bearer {a.json()['access_token']}", "Content-Type": "application/json"}

    def test_bad_pin(self, s):
        r = s.post(f"{API}/admin/login", json={"staff_id": "STF001", "pin": "9999"})
        assert r.status_code == 401

    def test_stats(self, s):
        r = s.get(f"{API}/admin/stats", headers=self.auth)
        assert r.status_code == 200 and "vault_custody_grams" in r.json()

    def test_events(self, s):
        r = s.get(f"{API}/admin/events", headers=self.auth)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_customers_and_lookup(self, s):
        r = s.get(f"{API}/admin/customers", headers=self.auth)
        assert r.status_code == 200 and len(r.json()) > 0
        lk = s.get(f"{API}/admin/customers/lookup?phone=9876543210", headers=self.auth)
        assert lk.status_code == 200 and lk.json()["found"] is True

    def test_tenant_scoped_staff_sees_only_tenant(self, s):
        a = s.post(f"{API}/admin/login", json={"staff_id": "STF002", "pin": "5678"})
        assert a.status_code == 200
        aa = {"Authorization": f"Bearer {a.json()['access_token']}"}
        cs = s.get(f"{API}/admin/customers", headers=aa).json()
        assert all(c["tenant"] == "tanishq" for c in cs), f"STF002 saw: {set(c['tenant'] for c in cs)}"
        st = s.get(f"{API}/admin/stats", headers=aa).json()
        assert st["tenant"] == "tanishq"

    def test_counter_sale_and_ledger_reverse(self, s):
        a = s.post(f"{API}/admin/login", json={"staff_id": "STF002", "pin": "5678"})
        aa = {"Authorization": f"Bearer {a.json()['access_token']}", "Content-Type": "application/json"}
        cs = s.post(f"{API}/admin/counter-sale", headers=aa,
                    json={"phone": "9800011122", "name": "POS Cust", "grams": 0.5, "method": "cash"})
        assert cs.status_code == 200, cs.text
        txn = cs.json()
        assert txn["type"] == "counter_sale" and txn["tenant"] == "tanishq"

        # Lookup customer balance after
        lk = s.get(f"{API}/admin/customers/lookup?phone=9800011122", headers=aa).json()
        before_g = lk["customer"]["gold_grams"]
        assert before_g >= 0.5 - 1e-6

        # Reverse
        rv = s.post(f"{API}/admin/ledger/{txn['id']}/reverse", headers=aa, json={"reason": "test reversal"})
        assert rv.status_code == 200 and rv.json()["type"] == "reversal"

        # Verify original marked reversed
        ledger = s.get(f"{API}/admin/ledger", headers=aa).json()
        orig = next((t for t in ledger if t["id"] == txn["id"]), None)
        assert orig and orig["status"] == "reversed"

        # Verify customer balance decremented
        lk2 = s.get(f"{API}/admin/customers/lookup?phone=9800011122", headers=aa).json()
        assert lk2["customer"]["gold_grams"] < before_g

    def test_pin_lockout_after_5(self, s):
        # Use STF003 to avoid blocking STF001/STF002 for other tests
        for _ in range(5):
            s.post(f"{API}/admin/login", json={"staff_id": "STF003", "pin": "0000"})
        r = s.post(f"{API}/admin/login", json={"staff_id": "STF003", "pin": "2468"})
        assert r.status_code == 423, f"Expected 423 locked, got {r.status_code}"
