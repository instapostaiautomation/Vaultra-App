# Iteration 14: offline guards for SIP run / gifts / quote, log redaction, startup retry, regressions
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
def auth(s):
    r = s.post(f"{BASE_URL}/api/auth/otp/request", json={"phone": "9876543210", "jeweller_id": "demo-jeweller-001"})
    if r.status_code != 200:
        pytest.skip(f"otp request failed {r.status_code}")
    d = r.json()
    r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"], "jeweller_id": "demo-jeweller-001"})
    if r.status_code != 200:
        pytest.skip(f"verify failed {r.status_code}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# Offline state of the price feed
def test_price_offline(s):
    r = s.get(f"{BASE_URL}/api/price")
    assert r.status_code == 200
    d = r.json()
    assert d["offline"] is True and d["live"] is False
    assert abs(d["buy"] - 14321.85) < 1


# Quote blocked while offline
def test_quote_503(s):
    r = s.post(f"{BASE_URL}/api/quote", json={"tenant": "demo-jeweller-001"})
    assert r.status_code == 503
    assert r.json()["detail"] == OFFLINE_MSG


# SIP run blocked while offline, vault grams unchanged
def test_sip_run_503(s, auth):
    before = s.get(f"{BASE_URL}/api/vault", headers=auth).json()["user"]["gold_grams"]
    r = s.post(f"{BASE_URL}/api/sips", json={"amount": 500, "frequency": "monthly"}, headers=auth)
    assert r.status_code == 200
    sid = r.json()["id"]
    try:
        r = s.post(f"{BASE_URL}/api/sips/{sid}/run", headers=auth)
        assert r.status_code == 503, r.text
        assert r.json()["detail"] == OFFLINE_MSG
        after = s.get(f"{BASE_URL}/api/vault", headers=auth).json()["user"]["gold_grams"]
        assert after == before
    finally:
        s.delete(f"{BASE_URL}/api/sips/{sid}", headers=auth)


# Non-existent SIP still 404 (ownership check before rate check)
def test_sip_run_404(s, auth):
    r = s.post(f"{BASE_URL}/api/sips/nonexistent-xyz/run", headers=auth)
    assert r.status_code == 404


# Gift blocked while offline
def test_gift_503(s, auth):
    r = s.post(f"{BASE_URL}/api/gifts", json={"phone": "9834567892", "mode": "grams", "value": 0.01, "theme": "diwali", "message": "TEST_"}, headers=auth)
    assert r.status_code == 503, r.text
    assert r.json()["detail"] == OFFLINE_MSG


# Gift requires auth
def test_gift_no_auth(s):
    r = requests.post(f"{BASE_URL}/api/gifts", json={"phone": "9834567892", "mode": "grams", "value": 0.01})
    assert r.status_code in (401, 403)


# Logs never contain the plain MT5 key
def test_logs_no_plain_key():
    key = None
    for line in open("/app/backend/.env"):
        if line.startswith("MT5_API_KEY="):
            key = line.split("=", 1)[1].strip().strip('"')
    if not key:
        pytest.skip("no MT5 key")
    import glob
    for f in glob.glob("/var/log/supervisor/backend*.log"):
        assert key not in open(f, errors="ignore").read(), f"plain key in {f}"


# Startup retry catches all exceptions
def test_startup_retry_catches_exception():
    src = open("/app/backend/server.py").read()
    m = re.search(r"async def startup\(\):(.*?)await seed_data", src, re.S)
    assert m and "except Exception" in m.group(1)


# Regressions
def test_vault(s, auth):
    r = s.get(f"{BASE_URL}/api/vault", headers=auth)
    assert r.status_code == 200 and r.json()["buy_rate"] > 13000


def test_products(s):
    r = s.get(f"{BASE_URL}/api/products", params={"tenant": "demo-jeweller-001"})
    assert r.status_code == 200
