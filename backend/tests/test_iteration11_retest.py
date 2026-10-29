# Iteration 11 retest: audit target names for banner/FAQ delete, SIP cancelled filter & summary, product tag/total_price
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


def audit_rows(master):
    return requests.get(f"{API}/master/v3/audit", headers=master).json()[:40]


def upload(h, path):
    r = requests.post(f"{API}/{path}/v3/upload", headers=h, files={"file": ("b.png", png_bytes(), "image/png")})
    assert r.status_code == 200, r.text
    return r.json()["url"]


# Audit: banner/FAQ delete target is title/question (shop + master)
class TestAuditTargets:
    def test_shop_banner_delete_audit(self, sharma, master):
        b = requests.post(f"{API}/jeweller/v3/banners", headers=sharma, json={"title": "TEST_Audit Shop Banner", "image_url": upload(sharma, "jeweller")})
        assert b.status_code == 200, b.text
        bid = b.json()["id"]
        assert requests.delete(f"{API}/jeweller/v3/banners/{bid}", headers=sharma).status_code == 200
        acts = [(a["action"], a["target"]) for a in audit_rows(master)]
        assert ("banner.delete", "TEST_Audit Shop Banner") in acts, acts[:5]
        assert all(t != bid for _, t in acts)

    def test_shop_faq_delete_audit(self, sharma, master):
        f = requests.post(f"{API}/jeweller/v3/faqs", headers=sharma, json={"question": "TEST_Audit shop question?", "answer": "Answer here"})
        assert f.status_code == 200, f.text
        fid = f.json()["id"]
        assert requests.delete(f"{API}/jeweller/v3/faqs/{fid}", headers=sharma).status_code == 200
        acts = [(a["action"], a["target"]) for a in audit_rows(master)]
        assert ("faq.delete", "TEST_Audit shop question?") in acts, acts[:5]

    def test_master_banner_delete_audit(self, master):
        b = requests.post(f"{API}/master/v3/banners", headers=master, json={"title": "TEST_Audit Master Banner", "image_url": upload(master, "master")})
        assert b.status_code == 200, b.text
        bid = b.json()["id"]
        assert requests.delete(f"{API}/master/v3/banners/{bid}", headers=master).status_code == 200
        acts = [(a["action"], a["target"]) for a in audit_rows(master)]
        assert ("banner.delete", "TEST_Audit Master Banner") in acts, acts[:5]

    def test_master_faq_delete_audit(self, master):
        f = requests.post(f"{API}/master/v3/faqs", headers=master, json={"question": "TEST_Audit master question?", "answer": "Answer here"})
        assert f.status_code == 200, f.text
        fid = f.json()["id"]
        assert requests.delete(f"{API}/master/v3/faqs/{fid}", headers=master).status_code == 200
        acts = [(a["action"], a["target"]) for a in audit_rows(master)]
        assert ("faq.delete", "TEST_Audit master question?") in acts, acts[:5]


# SIPs: cancelled filter, summary.total excludes cancelled
class TestSipCancelled:
    def test_summary_excludes_cancelled(self, sharma):
        d = requests.get(f"{API}/jeweller/v3/sips", headers=sharma).json()
        s, rows = d["summary"], d["sips"]
        assert "cancelled" in s
        assert s["cancelled"] == sum(1 for x in rows if x["status"] == "cancelled")
        assert s["total"] == sum(1 for x in rows if x["status"] != "cancelled")
        assert s["paused"] == sum(1 for x in rows if x["status"] == "paused")

    def test_cancelled_filter(self, sharma):
        d = requests.get(f"{API}/jeweller/v3/sips", headers=sharma, params={"status": "cancelled"})
        assert d.status_code == 200
        rows = d.json()["sips"]
        assert all(x["status"] == "cancelled" for x in rows)
        print("cancelled rows:", len(rows))

    def test_active_paused_filters(self, sharma):
        for st in ("active", "paused"):
            rows = requests.get(f"{API}/jeweller/v3/sips", headers=sharma, params={"status": st}).json()["sips"]
            assert all(x["status"] == st for x in rows)

    def test_master_sips_summary(self, master):
        d = requests.get(f"{API}/master/v3/sips", headers=master).json()
        assert d["summary"]["total"] == sum(1 for x in d["sips"] if x["status"] != "cancelled")


# Products: tag field and total_price present
class TestProducts:
    def test_products_tags_and_total(self):
        lst = requests.get(f"{API}/products", params={"jeweller_id": JID}).json()
        assert lst
        for p in lst:
            assert "tag" in p and p["total_price"] > 0
        print("tags:", [(p["name"], p["tag"]) for p in lst])
