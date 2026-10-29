# Iteration 17: feed-down labels (no MetaApi message with MT5 provider, DNS error) + customer vault/price has_live flags
import os
import pytest
import requests


def _base():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith(("EXPO_BACKEND_URL=", "EXPO_PUBLIC_BACKEND_URL=")):
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
        pytest.skip("master login failed")
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


# Feed error never shows MetaApi message when MT5 bridge is the provider
def test_feed_error_not_metaapi(s, master):
    f = s.get(f"{BASE_URL}/api/master/rate", headers=master).json()["feed"]
    assert f["provider"] == "mt5_script"
    assert "MetaApi" not in (f.get("error") or "")
    assert f["source"] == "offline"


# Price endpoint exposes has_live=false for customer/admin UIs to blank rates
def test_price_has_live_false(s):
    d = s.get(f"{BASE_URL}/api/price", params={"jeweller_id": JID}).json()
    assert d["has_live"] is False and d["offline"] is True


# Vault still loads during outage (UI hides current value)
def test_vault_loads(s, customer):
    r = s.get(f"{BASE_URL}/api/vault", headers=customer)
    assert r.status_code == 200
    assert "gold_grams" in r.json() or "grams" in str(r.json())[:500]
