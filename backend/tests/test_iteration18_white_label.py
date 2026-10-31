# Iteration 18: white-label (karat rates, per-karat margins, X-Tenant-ID isolation, App Studio, tenant public pages)
import io
import json
import os
import zipfile

import pytest
import requests
from PIL import Image


def _base():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith(("EXPO_BACKEND_URL=", "EXPO_PUBLIC_BACKEND_URL=")):
                url = line.split("=", 1)[1].strip().strip('"')
                break
    return url.rstrip("/")


BASE_URL = _base()
API = f"{BASE_URL}/api"
J1, J2 = "demo-jeweller-001", "demo-jeweller-002"


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def master(s):
    r = s.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    if r.status_code != 200:
        pytest.skip("master login failed")
    d = r.json()
    return {"Authorization": f"Bearer {d.get('access_token') or d.get('token')}"}


def _jlogin(s, email):
    r = s.post(f"{API}/jeweller/login", json={"email": email, "password": "jeweller123"})
    if r.status_code != 200:
        pytest.skip(f"jeweller login failed {email}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def sharma(s):
    return _jlogin(s, "sharma@vaultra.in")


@pytest.fixture(scope="module")
def patel(s):
    return _jlogin(s, "patel@vaultra.in")


@pytest.fixture(scope="module")
def customer(s):
    r = s.post(f"{API}/auth/otp/request", json={"phone": "9876543210", "jeweller_id": J1})
    if r.status_code != 200:
        pytest.skip("otp request failed")
    d = r.json()
    r = s.post(f"{API}/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"], "jeweller_id": J1})
    if r.status_code != 200:
        pytest.skip("otp verify failed")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def orig_pricing(s, master):
    shops = {x["id"]: x for x in s.get(f"{API}/master/v3/pricing", headers=master).json()["shops"]}
    yield shops
    # restore every shop's margins
    for jid in (J1, J2):
        o = shops[jid]
        s.put(f"{API}/master/v3/pricing/{jid}", headers=master, json={
            "gold_per_g": o["gold_commission_per_g"], "silver_per_g": o["silver_commission_per_g"],
            "gold22_per_g": o["gold22_commission_per_g"], "gold18_per_g": o["gold18_commission_per_g"]})


# ── Karat rates ──
def test_price_karats_live(s):
    d = s.get(f"{API}/price", params={"jeweller_id": J1}).json()
    assert d["source"] == "mt5" and d["live"] is True
    k, base = d["karats"], d["base_rate"]
    assert set(k) == {"24K", "22K", "18K"}
    assert k["24K"] == d["buy"]
    assert abs(k["22K"] - base * 22 / 24) < 1.0  # margin is 0 for 22K/18K by default
    assert abs(k["18K"] - base * 18 / 24) < 1.0


# ── Per-karat margins (master) incl. negatives ──
def test_master_pricing_negative_margins(s, master, orig_pricing):
    o = orig_pricing[J2]
    r = s.put(f"{API}/master/v3/pricing/{J2}", headers=master, json={
        "gold_per_g": -25, "silver_per_g": -2, "gold22_per_g": -40.5, "gold18_per_g": 33})
    assert r.status_code == 200, r.text
    d = s.get(f"{API}/price", params={"jeweller_id": J2}).json()
    base = d["base_rate"]
    assert abs(d["karats"]["22K"] - (base * 22 / 24 - 40.5)) < 0.6
    assert abs(d["karats"]["18K"] - (base * 18 / 24 + 33)) < 0.6
    assert abs(d["buy"] - (base - 25)) < 0.6
    assert abs(d["silver"]["buy"] - (d["silver"]["base_rate"] - 2)) < 0.06 or d["silver"]["buy"] < d["silver"]["base_rate"]
    shop = [x for x in s.get(f"{API}/master/v3/pricing", headers=master).json()["shops"] if x["id"] == J2][0]
    assert shop["gold22_commission_per_g"] == -40.5 and shop["gold18_commission_per_g"] == 33
    # isolation: J1 karats unaffected
    d1 = s.get(f"{API}/price", params={"jeweller_id": J1}).json()
    assert abs(d1["karats"]["22K"] - (d1["base_rate"] * 22 / 24 + orig_pricing[J1]["gold22_commission_per_g"])) < 0.6


def test_master_pricing_out_of_range(s, master, orig_pricing):
    r = s.put(f"{API}/master/v3/pricing/{J2}", headers=master, json={"gold_per_g": 0, "silver_per_g": 0, "gold22_per_g": -5000})
    assert r.status_code == 422


# ── Per-karat margins (shop admin) ──
def test_shop_commission_22_18(s, patel, orig_pricing):
    r = s.put(f"{API}/jeweller/v3/commission", headers=patel, json={
        "gold_per_g": 10, "silver_per_g": 1, "gold22_per_g": -15, "gold18_per_g": -20})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["gold22_commission_per_g"] == -15 and d["gold18_commission_per_g"] == -20
    k = d["price"]["karats"]
    assert abs(k["22K"] - (d["price"]["base_rate"] * 22 / 24 - 15)) < 0.6
    st = s.get(f"{API}/jeweller/v3/settings", headers=patel).json()
    j = st.get("jeweller", st)
    assert j.get("gold22_commission_per_g") == -15


# ── X-Tenant-ID isolation ──
def test_tenant_header_mismatch_403(s, customer):
    r = s.get(f"{API}/vault", headers=customer | {"X-Tenant-ID": J2})
    assert r.status_code == 403


def test_tenant_header_match_200(s, customer):
    r = s.get(f"{API}/vault", headers=customer | {"X-Tenant-ID": J1})
    assert r.status_code == 200


def test_shop2_cannot_see_shop1(s, sharma, patel):
    o1 = s.get(f"{API}/jeweller/v3/orders", headers=sharma).json()
    o2 = s.get(f"{API}/jeweller/v3/orders", headers=patel).json()
    rows1 = o1.get("orders", o1) if isinstance(o1, dict) else o1
    rows2 = o2.get("orders", o2) if isinstance(o2, dict) else o2
    ids1 = {x["id"] for x in rows1}
    ids2 = {x["id"] for x in rows2}
    assert not (ids1 & ids2)
    h1 = s.get(f"{API}/jeweller/v3/holdings", headers=sharma).json()
    h1 = h1.get("customers", h1.get("rows", h1)) if isinstance(h1, dict) else h1
    assert h1, "sharma has holdings"
    cid = h1[0].get("id") or h1[0].get("customer_id")
    r = s.get(f"{API}/jeweller/v3/holdings/{cid}", headers=patel)
    assert r.status_code == 404
    h2 = s.get(f"{API}/jeweller/v3/holdings", headers=patel).json()
    h2 = h2.get("customers", h2.get("rows", h2)) if isinstance(h2, dict) else h2
    assert cid not in {(x.get("id") or x.get("customer_id")) for x in h2}


# ── App Studio ──
@pytest.fixture(scope="module")
def studio_orig(s, master):
    apps = {a["id"]: a for a in s.get(f"{API}/master/app-studio", headers=master).json()["apps"]}
    yield apps
    o = apps[J2]
    if o["app_name"]:
        s.put(f"{API}/master/app-studio/{J2}", headers=master, json={
            "app_name": o["app_name"], "bundle_id": o["bundle_id"], "theme_preset": o["theme_preset"],
            "logo_url": o["logo_url"], "splash_url": o["splash_url"], "app_version": o["app_version"],
            "support_email": o["support_email"], "store_short": o["store_short"], "store_long": o["store_long"],
            "store_keywords": o["store_keywords"]})
        s.put(f"{API}/master/app-studio/{J2}/status", headers=master, json={"status": o["app_status"]})


def test_studio_list(s, master, studio_orig):
    d = s.get(f"{API}/master/app-studio", headers=master).json()
    assert len(d["presets"]) == 5 and len(d["statuses"]) == 6
    assert {"royal_gold", "midnight_luxe", "ivory_classic", "emerald_heritage", "rose_gold"} == set(d["presets"])
    assert len(d["apps"]) >= 2


def _body(**kw):
    b = {"app_name": "Patel Gold", "bundle_id": "", "theme_preset": "emerald_heritage", "logo_url": "", "splash_url": "",
         "app_version": "1.0.0", "support_email": "", "store_short": "", "store_long": "", "store_keywords": ""}
    b.update(kw)
    return b


def test_studio_validation(s, master, studio_orig):
    assert s.put(f"{API}/master/app-studio/{J2}", headers=master, json=_body(app_name="P")).status_code == 422
    assert s.put(f"{API}/master/app-studio/{J2}", headers=master, json=_body(theme_preset="neon")).status_code == 400
    for bad in ("in..gold", "in.patel", "in.1patel.gold", "in.patel-gold.app", "in.patel gold.app"):
        assert s.put(f"{API}/master/app-studio/{J2}", headers=master, json=_body(bundle_id=bad)).status_code == 400, bad


def test_studio_duplicate_bundle_409(s, master, studio_orig):
    r = s.put(f"{API}/master/app-studio/{J1}", headers=master, json=_body(app_name="Sharma Gold", bundle_id="in.pateljewelleryhouse.gold"))
    assert r.status_code == 409
    # J1 untouched
    a = [x for x in s.get(f"{API}/master/app-studio", headers=master).json()["apps"] if x["id"] == J1][0]
    assert a["bundle_id"] == studio_orig[J1]["bundle_id"]


def test_studio_status_rejects_built_before_ready(s, master, studio_orig):
    if studio_orig[J1]["app_status"] != "details_pending":
        pytest.skip("J1 not in details_pending")
    r = s.put(f"{API}/master/app-studio/{J1}/status", headers=master, json={"status": "built"})
    assert r.status_code == 400


def test_studio_autobundle_and_status(s, master, studio_orig):
    r = s.put(f"{API}/master/app-studio/{J2}", headers=master, json=_body())
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bundle_id"] == "in.pateljewelleryhouse.gold"
    assert d["app_status"] in ("theme_selected", "config_ready")
    # upload a logo and set it -> config_ready
    buf = io.BytesIO()
    Image.new("RGB", (256, 256), "#0F5132").save(buf, "PNG")
    up = requests.post(f"{API}/master/v3/upload", headers=master, files={"file": ("logo.png", buf.getvalue(), "image/png")})
    assert up.status_code == 200, up.text
    url = up.json()["url"]
    d = s.put(f"{API}/master/app-studio/{J2}", headers=master, json=_body(logo_url=url, bundle_id="in.pateljewelleryhouse.gold")).json()
    assert d["app_status"] == "config_ready"
    assert d["config"]["assets"]["logoUrl"].endswith(url)
    r = s.put(f"{API}/master/app-studio/{J2}/status", headers=master, json={"status": "built"})
    assert r.status_code == 200 and r.json()["app_status"] == "built"


def test_studio_kit_zip(s, master, studio_orig):
    r = s.get(f"{API}/master/app-studio/{J2}/kit", headers=master)
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/zip")
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = set(z.namelist())
    need = {"config.json", "assets/icon.png", "assets/adaptive-icon.png", "assets/splash.png",
            "store/screenshots/1-home.png", "store/screenshots/2-rates.png", "store/screenshots/3-vault.png",
            "store/feature-graphic.png", "store/listing.md", "store/privacy-policy.html", "README.md"}
    missing = {n for n in need if n not in names and not any(x.endswith(n.split("/")[-1]) for x in names)}
    assert not missing, f"missing {missing}; have {sorted(names)}"
    find = lambda suf: next(x for x in names if x.endswith(suf))
    cfg = json.loads(z.read(find("config.json")))
    for k in ("tenantId", "appName", "bundleId", "packageName", "theme", "homeLayout", "assets", "store"):
        assert k in cfg, k
    assert cfg["tenantId"] == J2 and cfg["store"]["privacyPolicyUrl"].endswith(f"/api/tenant/{J2}/privacy")
    assert Image.open(io.BytesIO(z.read(find("icon.png")))).size == (1024, 1024)
    assert Image.open(io.BytesIO(z.read(find("1-home.png")))).size == (1290, 2796)
    assert Image.open(io.BytesIO(z.read(find("3-vault.png")))).size == (1290, 2796)
    assert "Vaultra" not in z.read(find("listing.md")).decode()


def test_kit_requires_details(s, master, studio_orig):
    if studio_orig[J1]["app_name"]:
        pytest.skip("J1 configured")
    assert s.get(f"{API}/master/app-studio/{J1}/kit", headers=master).status_code == 400


def test_studio_requires_master(s, patel):
    assert s.get(f"{API}/master/app-studio", headers=patel).status_code in (401, 403)


# ── Public tenant endpoints ──
def test_tenant_public(s):
    c = s.get(f"{API}/tenant/{J2}/config").json()
    assert c["tenantId"] == J2 and c["theme"]["primaryColor"]
    p = s.get(f"{API}/tenant/{J2}/privacy")
    assert p.status_code == 200 and "Patel" in p.text and "text/html" in p.headers["content-type"]
    t = s.get(f"{API}/tenant/{J2}/terms")
    assert t.status_code == 200 and "Patel" in t.text
    assert s.get(f"{API}/tenant/nope/config").status_code == 404
