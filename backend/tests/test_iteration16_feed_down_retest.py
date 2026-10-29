# Iteration 16: retest feed-down state (has_live=false/offline), quote guard, both admin dashboards' APIs
import os
import pytest
import requests


def _base():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_BACKEND_URL=") or line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
                break
    return url.rstrip("/")


BASE_URL = _base()
JID = "demo-jeweller-001"


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
    return {"Authorization": f"Bearer {d.get('access_token') or d.get('token')}"}


@pytest.fixture(scope="module")
def jeweller(s):
    r = s.post(f"{BASE_URL}/api/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"})
    if r.status_code != 200:
        pytest.skip(f"jeweller login failed {r.status_code}")
    d = r.json()
    return {"Authorization": f"Bearer {d.get('access_token') or d.get('token')}"}


@pytest.fixture(scope="module")
def customer(s):
    r = s.post(f"{BASE_URL}/api/auth/otp/request", json={"phone": "9876543210", "jeweller_id": JID})
    if r.status_code != 200:
        pytest.skip("otp request failed")
    d = r.json()
    r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"], "jeweller_id": JID})
    if r.status_code != 200:
        pytest.skip("otp verify failed")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# Public price is offline with no live data
class TestPriceOffline:
    def test_price_flags(self, s):
        d = s.get(f"{BASE_URL}/api/price", params={"jeweller_id": JID}).json()
        assert d["offline"] is True and d["has_live"] is False and d["live"] is False

    def test_quote_503(self, s, customer):
        r = s.post(f"{BASE_URL}/api/quote", json={"tenant": JID}, headers=customer)
        assert r.status_code == 503, r.text[:200]


# Master dashboard APIs
class TestMasterDashboard:
    def test_master_rate(self, s, master):
        d = s.get(f"{BASE_URL}/api/master/rate", headers=master).json()
        assert d["feed"]["source"] == "offline" and d["feed"]["configured"] is True
        assert d["has_live"] is False
        err = d["feed"]["error"] or ""
        assert "key=" not in err

    def test_overview(self, s, master):
        r = s.get(f"{BASE_URL}/api/master/v3/overview?range=30d", headers=master)
        assert r.status_code == 200
        d = r.json()
        assert d["totals"]["jewellers"] >= 2
        assert d["feed"]["source"] == "offline"

    def test_pricing(self, s, master):
        r = s.get(f"{BASE_URL}/api/master/v3/pricing", headers=master)
        assert r.status_code == 200
        assert len(r.json()["shops"]) >= 2

    def test_customers(self, s, master):
        r = s.get(f"{BASE_URL}/api/master/customers", headers=master)
        assert r.status_code == 200

    def test_panel_html(self, s):
        r = s.get(f"{BASE_URL}/api/admin/master")
        assert r.status_code == 200 and "feedalert" in r.text


# Jeweller dashboard APIs
class TestJewellerDashboard:
    def test_dashboard(self, s, jeweller):
        r = s.get(f"{BASE_URL}/api/jeweller/v3/dashboard", headers=jeweller)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["price"]["has_live"] is False

    def test_orders(self, s, jeweller):
        assert s.get(f"{BASE_URL}/api/jeweller/v3/orders", headers=jeweller).status_code == 200

    def test_holdings(self, s, jeweller):
        assert s.get(f"{BASE_URL}/api/jeweller/v3/holdings", headers=jeweller).status_code == 200

    def test_panel_html(self, s):
        r = s.get(f"{BASE_URL}/api/admin/jeweller")
        assert r.status_code == 200


# Customer vault while offline
class TestCustomerOffline:
    def test_vault(self, s, customer):
        r = s.get(f"{BASE_URL}/api/vault", headers=customer)
        print("vault", r.status_code, r.text[:300])
        assert r.status_code == 200
