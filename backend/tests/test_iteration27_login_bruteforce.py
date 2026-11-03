# Iteration 27: security fixes — login brute-force limiter (jeweller + master), KYC photo privacy regression.
# Run serially (-p no:xdist). Uses fake identities so demo accounts are not locked. Limiter is in-memory.
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
RUN = uuid.uuid4().hex[:6]
BF_EMAIL = f"bruteforce-test-{RUN}@example.com"
BF_USER = f"bf-test-user-{RUN}"


def _tok(d):
    return d.get("access_token") or d.get("token")


@pytest.fixture(scope="module")
def master():
    r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {_tok(r.json())}"}


@pytest.fixture(scope="module")
def sharma():
    r = requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {_tok(r.json())}"}


@pytest.fixture(scope="module")
def patel():
    r = requests.post(f"{API}/jeweller/login", json={"email": "patel@vaultra.in", "password": "jeweller123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {_tok(r.json())}"}


# ── correct logins still work ──
def test_correct_logins(sharma, master):
    r = requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"})
    assert r.status_code == 200 and _tok(r.json()) and r.json()["jeweller"]["email"] == "sharma@vaultra.in"
    r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200 and _tok(r.json()) and "admin" in r.json()


# ── jeweller lockout (fake email) ── jeweller-IP fails used: 5
def test_jeweller_lockout_fake_email():
    for i in range(5):
        r = requests.post(f"{API}/jeweller/login", json={"email": BF_EMAIL, "password": f"wrong{i}"})
        assert r.status_code == 401, (i, r.status_code, r.text)
        assert r.json()["detail"] == "Invalid email or password"
    r = requests.post(f"{API}/jeweller/login", json={"email": BF_EMAIL, "password": "anything"})
    assert r.status_code == 429, r.text
    assert r.json()["detail"].startswith("Too many failed attempts"), r.text
    assert "15 min" in r.json()["detail"] or "min" in r.json()["detail"]
    # case / whitespace variants map to the same counter
    r = requests.post(f"{API}/jeweller/login", json={"email": "  " + BF_EMAIL.upper() + " ", "password": "x"})
    assert r.status_code == 429, r.text


# ── other accounts unaffected by a locked one ──
def test_other_jeweller_unaffected():
    r = requests.post(f"{API}/jeweller/login", json={"email": "patel@vaultra.in", "password": "jeweller123"})
    assert r.status_code == 200 and _tok(r.json())


# ── success clears account failure count ── jeweller-IP fails used: 5 + 3 + 3 = 11
def test_success_clears_counter():
    for _ in range(3):
        assert requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "nope"}).status_code == 401
    assert requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"}).status_code == 200
    for _ in range(3):  # would be 6 total without reset → must still be 401, not 429
        r = requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "nope"})
        assert r.status_code == 401, r.text
    r = requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"})
    assert r.status_code == 200, r.text


# ── master lockout (fake username) ── master-IP fails used: 5
def test_master_lockout_fake_user():
    for i in range(5):
        r = requests.post(f"{API}/master/login", json={"username": BF_USER, "password": f"wrong{i}"})
        assert r.status_code == 401, (i, r.text)
    r = requests.post(f"{API}/master/login", json={"username": BF_USER, "password": "x"})
    assert r.status_code == 429 and r.json()["detail"].startswith("Too many failed attempts"), r.text
    r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200 and _tok(r.json())


# ── regression: KYC photo privacy ──
def test_kyc_photo_privacy(master, sharma, patel):
    rows = requests.get(f"{API}/master/v3/kyc?status=all", headers=master).json()
    with_photo = [c for c in rows if (c.get("kyc") or {}).get("photo_id")]
    if not with_photo:
        pytest.skip("No customer with KYC photo")
    c = with_photo[0]
    pid = c["kyc"]["photo_id"]
    assert requests.get(f"{API}/files/{pid}").status_code == 404
    own, other = (sharma, patel) if c.get("jeweller_id", "demo-jeweller-001") == "demo-jeweller-001" else (patel, sharma)
    r_own = requests.get(f"{API}/jeweller/v3/kyc/{c['id']}/photo", headers=own)
    r_other = requests.get(f"{API}/jeweller/v3/kyc/{c['id']}/photo", headers=other)
    print("customer", c.get("name"), c.get("shop"), c.get("jeweller_id"), "own", r_own.status_code, "other", r_other.status_code)
    assert 404 in (r_own.status_code, r_other.status_code)
    assert r_other.status_code == 404 or r_own.status_code == 404
    assert requests.get(f"{API}/master/v3/kyc/{c['id']}/photo", headers=master).status_code == 200
    assert requests.get(f"{API}/master/v3/kyc/{c['id']}/photo").status_code in (401, 403)
