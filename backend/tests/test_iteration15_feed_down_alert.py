# Iteration 15: Feed-down alert - has_live / offline flags on price APIs, feed status for master admin
import os
import pytest
import requests


def _base():
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")


BASE_URL = _base()


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def master(s):
    r = s.post(f"{BASE_URL}/api/master/login", json={"username": "admin", "password": "admin123"})
    if r.status_code != 200:
        pytest.skip(f"master login failed {r.status_code}")
    d = r.json()
    tok = d.get("access_token") or d.get("token")
    return {"Authorization": f"Bearer {tok}"}


# Public price endpoint flags
class TestPublicPrice:
    def test_price_has_live_false_offline_true(self, s):
        r = s.get(f"{BASE_URL}/api/price", params={"jeweller_id": "demo-jeweller-001"})
        assert r.status_code == 200
        d = r.json()
        assert "has_live" in d and isinstance(d["has_live"], bool)
        assert d["offline"] is True
        assert d["source"] == "offline"
        assert d["live"] is False
        assert d["has_live"] is False

    def test_price_without_jeweller(self, s):
        r = s.get(f"{BASE_URL}/api/price")
        assert r.status_code == 200
        assert r.json()["has_live"] is False


# Master rate endpoint includes feed status
class TestMasterRate:
    def test_master_rate_feed(self, s, master):
        r = s.get(f"{BASE_URL}/api/master/rate", headers=master)
        assert r.status_code == 200
        d = r.json()
        f = d["feed"]
        assert f["configured"] is True
        assert f["source"] == "offline"
        assert "530" in (f["error"] or "")
        assert "***" in f["error"] or "key=" not in f["error"]
        assert f["last_live_at"] is None
        assert d["has_live"] is False and d["offline"] is True

    def test_master_rate_requires_auth(self, s):
        r = requests.get(f"{BASE_URL}/api/master/rate")
        assert r.status_code in (401, 403)

    def test_overview_has_feed(self, s, master):
        r = s.get(f"{BASE_URL}/api/master/v3/overview", headers=master)
        assert r.status_code == 200
        d = r.json()
        assert d["feed"]["source"] == "offline"
        assert d["price"]["has_live"] is False
        # note: price object itself has no 'feed' key (frontend sets S.price = ov.price)
        print("overview.price has feed key:", "feed" in d["price"])


# Jeweller panel price
class TestJewellerPrice:
    def test_jeweller_login_price(self, s):
        r = s.post(f"{BASE_URL}/api/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"})
        if r.status_code != 200:
            pytest.skip(f"jeweller login {r.status_code}")
        d = r.json()
        tok = d.get("access_token") or d.get("token")
        jid = (d.get("jeweller") or {}).get("id") or "demo-jeweller-001"
        r = s.get(f"{BASE_URL}/api/price", params={"jeweller_id": jid}, headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        assert r.json()["has_live"] is False


# Offline guard regression: quote blocked
class TestOfflineGuard:
    def test_quote_blocked(self, s):
        r = s.post(f"{BASE_URL}/api/auth/otp/request", json={"phone": "9876543210", "jeweller_id": "demo-jeweller-001"})
        if r.status_code != 200:
            pytest.skip("otp")
        d = r.json()
        r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"], "jeweller_id": "demo-jeweller-001"})
        if r.status_code != 200:
            pytest.skip("verify")
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = s.post(f"{BASE_URL}/api/quote", json={"tenant": "demo-jeweller-001"}, headers=h)
        print("quote", r.status_code, r.text[:200])
        assert r.status_code == 503
