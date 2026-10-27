# Iteration 10 retest: product image_url, banner link, platform banner fallback, SIP freq validation, KYC decide guard, audit, goals shop
import os
import struct
import zlib

import pytest
import requests

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"
JID = "demo-jeweller-001"


def png_bytes():
    raw = b"\x00" + b"\xd4\xaf\x37" * 4
    data = raw * 4

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(data)) + chunk(b"IEND", b""))


@pytest.fixture(scope="module")
def sharma():
    r = requests.post(f"{API}/jeweller/login", json={"email": "sharma@vaultra.in", "password": "jeweller123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def master():
    r = requests.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def customer():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": "9876543210", "jeweller_id": JID})
    assert r.status_code == 200, r.text
    d = r.json()
    v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d.get("demo_otp") or "123456", "tenant": JID})
    assert v.status_code == 200, v.text
    tok = v.json().get("access_token") or v.json().get("token")
    return {"Authorization": f"Bearer {tok}"}


# Product image_url propagates to /products and /products/{id}; audit add/delete
class TestProductImage:
    def test_add_product_with_upload_then_delete(self, sharma, master):
        up = requests.post(f"{API}/jeweller/v3/upload", headers=sharma, files={"file": ("p.png", png_bytes(), "image/png")})
        assert up.status_code == 200, up.text
        url = up.json()["url"]
        r = requests.post(f"{API}/jeweller/products", headers=sharma,
                          json={"name": "TEST_Img Ring", "category": "rings", "grams": 2, "making_pct": 14, "image_url": url})
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        try:
            d = requests.get(f"{API}/products/{pid}").json()
            assert d["image_url"] == url
            assert d["making_pct"] == 14
            assert abs(d["total_price"] - (d["gold_value"] + d["making_amount"])) < 1
            lst = requests.get(f"{API}/products", params={"jeweller_id": JID}).json()
            row = next(p for p in lst if p["id"] == pid)
            assert row["image_url"] == url and row["total_price"] > row["gold_value"]
        finally:
            assert requests.delete(f"{API}/jeweller/products/{pid}", headers=sharma).status_code == 200
        lst = requests.get(f"{API}/products", params={"jeweller_id": JID}).json()
        assert all(p["id"] != pid for p in lst)
        audit = requests.get(f"{API}/master/v3/audit", headers=master).json()
        rows = audit if isinstance(audit, list) else audit.get("audit", audit.get("items", []))
        acts = [(a["action"], a.get("target")) for a in rows[:30]]
        assert ("product.add", "TEST_Img Ring") in acts, acts[:5]
        assert ("product.delete", "TEST_Img Ring") in acts, acts[:5]


# Banner link saved and returned to the app
class TestBannerLink:
    def test_banner_link_roundtrip(self, sharma):
        up = requests.post(f"{API}/jeweller/v3/upload", headers=sharma, files={"file": ("b.png", png_bytes(), "image/png")}).json()
        b = requests.post(f"{API}/jeweller/v3/banners", headers=sharma, json={"title": "TEST_SIP banner", "image_url": up["url"], "link": "sip"})
        assert b.status_code == 200, b.text
        bid = b.json()["id"]
        try:
            c = requests.get(f"{API}/content", params={"jeweller_id": JID}).json()
            row = next(x for x in c["banners"] if x["id"] == bid)
            assert row["link"] == "sip"
        finally:
            assert requests.delete(f"{API}/jeweller/v3/banners/{bid}", headers=sharma).status_code == 200


# Shop content returns platform banners; master default banner appears
class TestPlatformFallback:
    def test_platform_banners_in_shop_content(self, sharma, master):
        up = requests.post(f"{API}/master/v3/upload", headers=master, files={"file": ("m.png", png_bytes(), "image/png")})
        assert up.status_code == 200, up.text
        b = requests.post(f"{API}/master/v3/banners", headers=master, json={"title": "TEST_Platform banner", "image_url": up.json()["url"]})
        assert b.status_code == 200, b.text
        bid = b.json()["id"]
        try:
            d = requests.get(f"{API}/jeweller/v3/content", headers=sharma).json()
            assert "platform_banners" in d and "platform_faqs" in d
            assert any(x["id"] == bid for x in d["platform_banners"])
            assert all(x["id"] != bid for x in d["banners"])
            if not d["banners"]:
                app = requests.get(f"{API}/content", params={"jeweller_id": JID}).json()
                assert any(x["id"] == bid for x in app["banners"])
        finally:
            assert requests.delete(f"{API}/master/v3/banners/{bid}", headers=master).status_code == 200
        d = requests.get(f"{API}/jeweller/v3/content", headers=sharma).json()
        assert all(x["id"] != bid for x in d["platform_banners"])


# SIP frequency validation
class TestSipFrequency:
    def test_yearly_rejected(self, customer):
        r = requests.post(f"{API}/sips", headers=customer, json={"amount": 500, "frequency": "yearly"})
        assert r.status_code == 422

    @pytest.mark.parametrize("freq", ["daily", "weekly", "monthly"])
    def test_valid_freq(self, customer, freq):
        r = requests.post(f"{API}/sips", headers=customer, json={"amount": 500, "frequency": freq})
        assert r.status_code == 200, r.text
        assert r.json()["frequency"] == freq
        assert requests.delete(f"{API}/sips/{r.json()['id']}", headers=customer).status_code in (200, 204)


# Master KYC decide guard + goals shop column
class TestMasterGuards:
    def test_kyc_decide_non_pending_400(self, master):
        rows = requests.get(f"{API}/master/v3/kyc", headers=master, params={"status": "approved"}).json()
        rows = rows if isinstance(rows, list) else rows.get("customers", [])
        target = next((c for c in rows if c["kyc_status"] == "approved"), None)
        if not target:
            pytest.skip("no approved customer")
        r = requests.post(f"{API}/master/v3/kyc/{target['id']}/decide", headers=master, params={"approve": "false"})
        assert r.status_code == 400
        again = requests.get(f"{API}/master/v3/kyc", headers=master, params={"status": "approved"}).json()
        again = again if isinstance(again, list) else again.get("customers", [])
        assert any(c["id"] == target["id"] for c in again)

    def test_goals_have_shop(self, master):
        g = requests.get(f"{API}/master/v3/goals", headers=master).json()
        rows = g if isinstance(g, list) else g.get("goals", [])
        if not rows:
            pytest.skip("no goals")
        assert all("shop" in x for x in rows)
        assert any(x["shop"] for x in rows)


# Regression: making change + pricing save
class TestRegression:
    def test_making_change(self, sharma):
        cat = requests.get(f"{API}/jeweller/v3/catalogue", headers=sharma).json()
        p = cat["products"][0]
        orig = p["making_pct"]
        new = 22 if orig != 22 else 18
        assert requests.put(f"{API}/jeweller/v3/products/{p['id']}/making", headers=sharma, json={"making_pct": new}).status_code == 200
        p2 = next(x for x in requests.get(f"{API}/jeweller/v3/catalogue", headers=sharma).json()["products"] if x["id"] == p["id"])
        assert p2["making_pct"] == new
        assert abs(p2["total_price"] - p2["metal_value"] * (1 + new / 100)) < 1
        requests.put(f"{API}/jeweller/v3/products/{p['id']}/making", headers=sharma, json={"making_pct": orig})

    def test_pricing_save(self, master):
        pr = requests.get(f"{API}/master/v3/pricing", headers=master).json()
        assert "shops" in pr and pr["shops"]
        s = next(x for x in pr["shops"] if x["id"] == JID)
        og, osv = s["gold_commission_per_g"], s["silver_commission_per_g"]
        try:
            r = requests.put(f"{API}/master/v3/pricing/{JID}", headers=master, json={"gold_per_g": 40, "silver_per_g": 1.5})
            assert r.status_code == 200
            s2 = next(x for x in requests.get(f"{API}/master/v3/pricing", headers=master).json()["shops"] if x["id"] == JID)
            assert s2["gold_commission_per_g"] == 40 and s2["silver_commission_per_g"] == 1.5
            assert requests.put(f"{API}/master/v3/pricing/{JID}", headers=master, json={"gold_per_g": 1500, "silver_per_g": 0}).status_code == 422
        finally:
            requests.put(f"{API}/master/v3/pricing/{JID}", headers=master, json={"gold_per_g": og, "silver_per_g": osv})
