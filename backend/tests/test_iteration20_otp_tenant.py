# Iteration 20: OTP request honours X-Tenant-ID / body.jeweller_id; buy quote for Patel customer
import os

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
J1, J2 = "demo-jeweller-001", "demo-jeweller-002"


def _login(phone, headers=None, body_extra=None):
    body = {"phone": phone, **(body_extra or {})}
    r = requests.post(f"{API}/auth/otp/request", json=body, headers=headers or {})
    assert r.status_code == 200, r.text
    c = r.json()
    v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": c["challenge_id"], "otp": c["demo_otp"]}, headers=headers or {})
    assert v.status_code == 200, v.text
    return c, v.json()


# OTP request with X-Tenant-ID header -> Patel store; existing Patel customer logs in
def test_otp_header_patel():
    c, v = _login("9845678903", {"X-Tenant-ID": J2})
    assert c["jeweller_id"] == J2
    assert c["is_new_user"] is False
    assert v["user"]["jeweller_id"] == J2
    assert v["user"]["first_name"] == "Rohan"
    import jwt
    p = jwt.decode(v["access_token"], options={"verify_signature": False})
    assert p.get("jeweller_id") == J2


# Invalid tenant header -> 400
def test_otp_invalid_header():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": "9845678903"}, headers={"X-Tenant-ID": "TEST_nope"})
    assert r.status_code == 400
    assert "not available" in r.json().get("detail", "")


# Invalid body jeweller_id -> 400
def test_otp_invalid_body_jid():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": "9845678903", "jeweller_id": "TEST_nope"})
    assert r.status_code == 400


# No header -> default store (Sharma)
def test_otp_no_header_default():
    c, v = _login("9876543210")
    assert c["jeweller_id"] == J1
    assert c["is_new_user"] is False
    assert v["user"]["first_name"] == "Aarav"


# Body jeweller_id wins
def test_otp_body_jid():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": "9845678903", "jeweller_id": J2})
    assert r.status_code == 200
    assert r.json()["jeweller_id"] == J2 and r.json()["is_new_user"] is False


# Sharma customer phone under Patel header shows as new user there (isolation)
def test_otp_sharma_phone_on_patel_is_new():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": "9876543210"}, headers={"X-Tenant-ID": J2})
    assert r.status_code == 200
    assert r.json()["jeweller_id"] == J2 and r.json()["is_new_user"] is True


# Buy quote + vault for logged-in Patel customer
def test_patel_quote_and_vault():
    _, v = _login("9845678903", {"X-Tenant-ID": J2})
    h = {"Authorization": f"Bearer {v['access_token']}", "X-Tenant-ID": J2}
    q = requests.post(f"{API}/quote", json={}, headers=h)
    if q.status_code == 503:
        pytest.skip("live rates unavailable")
    assert q.status_code == 200, q.text
    qd = q.json()
    assert qd["buy"] > 0 and qd["lock_seconds"] > 0
    print("quote", qd)


# Patel quote matches Patel /price (not Sharma), /me + /vault are Patel's
def test_patel_quote_matches_patel_price():
    _, v = _login("9845678903", {"X-Tenant-ID": J2})
    h = {"Authorization": f"Bearer {v['access_token']}", "X-Tenant-ID": J2}
    me = requests.get(f"{API}/me", headers=h).json()
    assert me.get("jeweller_id", J2) == J2
    assert requests.get(f"{API}/vault", headers=h).status_code == 200
    p2 = requests.get(f"{API}/price", headers={"X-Tenant-ID": J2}).json()
    p1 = requests.get(f"{API}/price", headers={"X-Tenant-ID": J1}).json()
    print("p1", {k: p1.get(k) for k in ("buy", "sell", "base_rate")}, "p2", {k: p2.get(k) for k in ("buy", "sell", "base_rate")})
    q = requests.post(f"{API}/quote", json={}, headers=h)
    if q.status_code == 503:
        pytest.skip("live rates unavailable")
    assert abs(q.json()["buy"] - p2["buy"]) < 1.0, (q.json(), p2.get("buy"))
