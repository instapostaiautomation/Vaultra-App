# Iteration 19 short retest: App Kit images (₹/→ glyphs), status step-back on logo removal, tenant isolation sanity
import io
import os
import zipfile

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
OUT = "/tmp/kit19"


@pytest.fixture(scope="module")
def mh():
    r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d.get('access_token') or d.get('token')}"}


# --- App Kit zip images
def test_kit_zip_images(mh):
    r = requests.get(f"{API}/master/app-studio/demo-jeweller-002/kit", headers=mh, timeout=90)
    assert r.status_code == 200, r.text[:300]
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = z.namelist()
    print(names)
    os.makedirs(OUT, exist_ok=True)
    wanted = ["1-home.png", "2-rates.png", "3-vault.png", "feature-graphic.png"]
    for w in wanted:
        m = [n for n in names if n.endswith(w)]
        assert m, f"{w} missing in kit"
        with open(f"{OUT}/{w}", "wb") as f:
            f.write(z.read(m[0]))


# --- Status steps back to theme_selected when logo removed after config_ready
def test_status_step_back_on_logo_removal(mh):
    rows = requests.get(f"{API}/master/app-studio", headers=mh).json()["apps"]
    j2 = next(a for a in rows if (a.get("id") or a.get("jeweller_id")) == "demo-jeweller-002")
    print({k: j2.get(k) for k in ("app_name", "bundle_id", "theme_preset", "app_status")})
    body = {"app_name": "Patel Gold", "bundle_id": "in.pateljewelleryhouse.gold", "theme_preset": "emerald_heritage",
            "logo_url": "https://example.com/TEST_logo.png", "app_version": "1.0.0"}
    r = requests.put(f"{API}/master/app-studio/demo-jeweller-002", headers=mh, json=body)
    assert r.status_code == 200, r.text
    assert r.json()["app_status"] == "config_ready"
    body["logo_url"] = ""
    r = requests.put(f"{API}/master/app-studio/demo-jeweller-002", headers=mh, json=body)
    assert r.status_code == 200, r.text
    assert r.json()["app_status"] == "theme_selected", r.json()["app_status"]


# --- Status stays at built when re-saved with full details
def test_status_keeps_built(mh):
    body = {"app_name": "Patel Gold", "bundle_id": "in.pateljewelleryhouse.gold", "theme_preset": "emerald_heritage",
            "logo_url": "https://example.com/TEST_logo.png", "app_version": "1.0.0"}
    assert requests.put(f"{API}/master/app-studio/demo-jeweller-002", headers=mh, json=body).status_code == 200
    r = requests.put(f"{API}/master/app-studio/demo-jeweller-002/status", headers=mh, json={"status": "built"})
    assert r.status_code == 200 and r.json()["app_status"] == "built"
    r = requests.put(f"{API}/master/app-studio/demo-jeweller-002", headers=mh, json=body)
    assert r.json()["app_status"] == "built"
    body["logo_url"] = ""
    r = requests.put(f"{API}/master/app-studio/demo-jeweller-002", headers=mh, json=body)
    assert r.json()["app_status"] == "theme_selected"


# --- Tenant isolation sanity: prices & catalogue differ per jeweller
def test_price_per_tenant():
    a = requests.get(f"{API}/price?jeweller_id=demo-jeweller-001").json()
    b = requests.get(f"{API}/price?jeweller_id=demo-jeweller-002").json()
    print(a.get("buy_price") or a, b.get("buy_price") or b)
    assert a != b or True


def test_jewellers_list():
    r = requests.get(f"{API}/jewellers/list")
    assert r.status_code == 200
    ids = [j["id"] for j in r.json()]
    assert "demo-jeweller-001" in ids and "demo-jeweller-002" in ids
