# Iteration 13: MT5 feed offline behaviour + regression of core APIs
import os
import re
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
OFFLINE_MSG = "Live rates are temporarily unavailable. Please try again in a few minutes."


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def customer_token(s):
    r = s.post(f"{BASE_URL}/api/auth/otp/request", json={"phone": "9876543210", "jeweller_id": "demo-jeweller-001"})
    if r.status_code != 200:
        pytest.skip(f"otp request failed {r.status_code}")
    d = r.json()
    r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"], "jeweller_id": "demo-jeweller-001"})
    if r.status_code != 200:
        pytest.skip(f"verify-otp failed {r.status_code} {r.text[:200]}")
    return r.json().get("access_token")


# Price endpoint while MT5 tunnel is down
class TestPriceOffline:
    def test_price_offline_last_real_rate(self, s):
        r = s.get(f"{BASE_URL}/api/price")
        assert r.status_code == 200
        d = r.json()
        assert d["source"] == "offline"
        assert d["offline"] is True and d["live"] is False
        assert 13000 < d["buy"] < 16000, f"buy={d['buy']} looks like demo price"
        assert abs(d["buy"] - 14321.85) < 1
        assert abs(d["silver"]["buy"] - 191.99) < 0.5
        assert d["sell"] < d["buy"]

    def test_price_stable_not_simulated(self, s):
        import time
        a = s.get(f"{BASE_URL}/api/price").json()["buy"]
        time.sleep(5)
        b = s.get(f"{BASE_URL}/api/price").json()["buy"]
        assert a == b, "price should be frozen while offline"

    def test_price_with_tenant(self, s):
        r = s.get(f"{BASE_URL}/api/price", params={"tenant": "demo-jeweller-001"})
        assert r.status_code == 200
        assert r.json()["offline"] is True


# Quotes blocked while offline
class TestQuoteOffline:
    def test_gold_quote_503(self, s):
        r = s.post(f"{BASE_URL}/api/quote", json={"tenant": "demo-jeweller-001"})
        assert r.status_code == 503
        assert r.json()["detail"] == OFFLINE_MSG

    def test_silver_quote_503(self, s):
        r = s.post(f"{BASE_URL}/api/quote/silver", json={"tenant": "demo-jeweller-001"})
        assert r.status_code == 503
        assert r.json()["detail"] == OFFLINE_MSG

    def test_quote_no_body_503(self, s):
        r = s.post(f"{BASE_URL}/api/quote")
        assert r.status_code == 503


# Log redaction
class TestLogs:
    def test_recent_logs_redacted(self):
        key = ""
        for line in open("/app/backend/.env"):
            if line.startswith("MT5_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
        if not key:
            pytest.skip("no key configured")
        lines = open("/var/log/supervisor/backend.err.log", errors="ignore").read().splitlines()
        # only lines after the latest backend start
        idx = max(i for i, l in enumerate(lines) if "Application startup complete" in l)
        assert not any(key in l for l in lines[idx:])


# Regression of other APIs
class TestRegression:
    def test_vault(self, s, customer_token):
        r = s.get(f"{BASE_URL}/api/vault", headers={"Authorization": f"Bearer {customer_token}"})
        assert r.status_code == 200
        d = r.json()
        assert "user" in d and d["buy_rate"] > 13000

    def test_catalogue_products(self, s):
        r = s.get(f"{BASE_URL}/api/products", params={"tenant": "demo-jeweller-001"})
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    def test_jewellers_list(self, s):
        r = s.get(f"{BASE_URL}/api/jewellers/list")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_admin_panels(self, s):
        for p in ("/api/admin/jeweller", "/api/admin/master"):
            r = s.get(f"{BASE_URL}{p}")
            assert r.status_code == 200 and "<html" in r.text.lower()
