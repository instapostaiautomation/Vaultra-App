"""Iteration 4: Rate feed (simulated fallback), per-jeweller margins, custom domains, tenant resolve."""
import os
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
DEMO_J1 = "demo-jeweller-001"
DEFAULTS = {"gold_buy_markup_pct": 0, "gold_sell_discount_pct": 3,
            "silver_buy_markup_pct": 0, "silver_sell_discount_pct": 3}
TOL = 0.05


def close(a, b, tol=TOL):
    return abs(a - b) <= tol


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def master(s):
    r = s.post(f"{API}/master/login", json={"username": "admin", "password": "admin123"})
    if r.status_code != 200:
        pytest.skip(f"master login failed {r.text}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def jlogin(s, email):
    r = s.post(f"{API}/jeweller/login", json={"email": email, "password": "jeweller123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()["jeweller"]


@pytest.fixture(scope="module")
def sharma(s):
    h, j = jlogin(s, "sharma@vaultra.in")
    yield h, j
    s.put(f"{API}/jeweller/settings/margins", json=DEFAULTS, headers=h)  # reset


@pytest.fixture(scope="module")
def patel(s):
    h, j = jlogin(s, "patel@vaultra.in")
    yield h, j
    s.put(f"{API}/jeweller/settings/margins", json=DEFAULTS, headers=h)


@pytest.fixture(scope="module")
def j_ids(s, master):
    r = s.get(f"{API}/master/jewellers", headers=master)
    assert r.status_code == 200
    ids = [j["id"] for j in r.json()]
    yield ids
    for jid in ids:  # cleanup: clear all domains
        s.put(f"{API}/master/jewellers/{jid}/domains", json={"domain": "", "admin_domain": ""}, headers=master)


# ---- price / feed ----
class TestPriceFeed:
    def test_price_shape_and_default_margin(self, s):
        r = s.get(f"{API}/price", params={"jeweller_id": DEMO_J1})
        assert r.status_code == 200
        d = r.json()
        assert d["source"] == "simulated" and d["live"] is False
        assert isinstance(d["base_rate"], (int, float)) and d["base_rate"] > 1000
        assert "base_rate" in d["silver"]
        # defaults (sharma reset to defaults): buy = base, sell = base*0.97
        assert close(d["buy"], d["base_rate"] * 1.0), d
        assert close(d["sell"], d["base_rate"] * 0.97), d
        assert close(d["silver"]["buy"], d["silver"]["base_rate"]), d
        assert close(d["silver"]["sell"], d["silver"]["base_rate"] * 0.97), d

    def test_master_rate_feed(self, s, master):
        r = s.get(f"{API}/master/rate", headers=master)
        assert r.status_code == 200
        f = r.json()["feed"]
        assert f["source"] == "simulated" and f["configured"] is False
        assert "not configured" in f["error"]

    def test_master_rate_requires_auth(self, s):
        assert s.get(f"{API}/master/rate").status_code in (401, 403)


# ---- margins ----
class TestMargins:
    def test_validation(self, s, sharma):
        h, _ = sharma
        for bad in ({**DEFAULTS, "gold_buy_markup_pct": 51}, {**DEFAULTS, "gold_sell_discount_pct": -1},
                    {**DEFAULTS, "silver_buy_markup_pct": "abc"}, {"gold_buy_markup_pct": 1}):
            r = s.put(f"{API}/jeweller/settings/margins", json=bad, headers=h)
            assert r.status_code == 422, (bad, r.status_code, r.text)

    def test_requires_jeweller_auth(self, s, master):
        assert s.put(f"{API}/jeweller/settings/margins", json=DEFAULTS).status_code in (401, 403)
        assert s.put(f"{API}/jeweller/settings/margins", json=DEFAULTS, headers=master).status_code in (401, 403)

    def test_update_and_isolation(self, s, sharma, patel):
        h, j = sharma
        ph, pj = patel
        s.put(f"{API}/jeweller/settings/margins", json=DEFAULTS, headers=ph)
        body = {"gold_buy_markup_pct": 2.5, "gold_sell_discount_pct": 5,
                "silver_buy_markup_pct": 1.5, "silver_sell_discount_pct": 4}
        r = s.put(f"{API}/jeweller/settings/margins", json=body, headers=h)
        assert r.status_code == 200, r.text
        d = r.json()
        p = d["price"]
        assert close(p["buy"], p["base_rate"] * 1.025) and close(p["sell"], p["base_rate"] * 0.95), p
        assert close(p["silver"]["buy"], p["silver"]["base_rate"] * 1.015)
        assert close(p["silver"]["sell"], p["silver"]["base_rate"] * 0.96)
        # public price for this jeweller
        g = s.get(f"{API}/price", params={"jeweller_id": j["id"]}).json()
        assert close(g["buy"], g["base_rate"] * 1.025) and close(g["sell"], g["base_rate"] * 0.95), g
        # other jeweller unaffected
        o = s.get(f"{API}/price", params={"jeweller_id": pj["id"]}).json()
        assert close(o["buy"], o["base_rate"]) and close(o["sell"], o["base_rate"] * 0.97), o
        # persisted -> jeweller/me
        me = s.get(f"{API}/jeweller/me", headers=h).json()
        flat = str(me)
        assert "2.5" in flat, me

    def test_quote_uses_margin(self, s, sharma):
        h, j = sharma
        r = s.post(f"{API}/auth/otp/request", json={"phone": "9876543210", "jeweller_id": j["id"]})
        assert r.status_code == 200, r.text
        c = r.json()
        v = s.post(f"{API}/auth/otp/verify", json={"challenge_id": c["challenge_id"], "otp": c["demo_otp"],
                                                    "jeweller_id": j["id"]})
        assert v.status_code == 200, v.text
        ch = {"Authorization": f"Bearer {v.json()['access_token']}"}
        q = s.post(f"{API}/quote", headers=ch).json()
        p = s.get(f"{API}/price", params={"jeweller_id": j["id"]}).json()
        ratio = q["buy"] / q["sell"]
        assert close(ratio, 1.025 / 0.95, 0.002), (q, p)
        qs = s.post(f"{API}/quote", params={"metal": "silver"}, headers=ch).json()
        assert close(qs["buy"] / qs["sell"], 1.015 / 0.96, 0.002), qs
        # buy order locks the margin-applied quote rate
        o = s.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": 100}, headers=ch)
        assert o.status_code == 200, o.text
        assert o.json()["rate"] == q["buy"] and o.json()["status"] == "created"

    def test_reset_defaults(self, s, sharma):
        h, _ = sharma
        r = s.put(f"{API}/jeweller/settings/margins", json=DEFAULTS, headers=h)
        assert r.status_code == 200
        p = r.json()["price"]
        assert close(p["buy"], p["base_rate"]) and close(p["sell"], p["base_rate"] * 0.97)


# ---- domains ----
class TestDomains:
    def test_normalize_and_resolve(self, s, master, j_ids):
        jid = j_ids[0]
        r = s.put(f"{API}/master/jewellers/{jid}/domains",
                  json={"domain": "HTTPS://Gold.TestSharma.IN/path?x=1", "admin_domain": "http://admin.testsharma.in:443/"},
                  headers=master)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["domain"] == "gold.testsharma.in" and d["admin_domain"] == "admin.testsharma.in", d
        a = s.get(f"{API}/tenant/resolve", params={"host": "gold.testsharma.in"})
        assert a.status_code == 200 and a.json()["kind"] == "app" and a.json()["jeweller"]["id"] == jid
        b = s.get(f"{API}/tenant/resolve", params={"host": "ADMIN.testsharma.in:8080"})
        assert b.status_code == 200 and b.json()["kind"] == "admin", b.text
        chk = s.get(f"{API}/master/jewellers/{jid}/domain-check", headers=master)
        assert chk.status_code == 200
        cj = chk.json()
        assert cj["cname_target"] and len(cj["domains"]) == 2
        assert {x["kind"] for x in cj["domains"]} == {"app", "admin"}

    def test_invalid(self, s, master, j_ids):
        for bad in ("not a domain", "localhost", "abc", "-bad-.com", "a..b.com"):
            r = s.put(f"{API}/master/jewellers/{j_ids[0]}/domains", json={"domain": bad, "admin_domain": ""}, headers=master)
            assert r.status_code == 400, (bad, r.status_code, r.text)

    def test_same_app_admin(self, s, master, j_ids):
        r = s.put(f"{API}/master/jewellers/{j_ids[0]}/domains",
                  json={"domain": "x.testsharma.in", "admin_domain": "https://X.testsharma.in"}, headers=master)
        assert r.status_code == 400

    def test_conflict_other_jeweller(self, s, master, j_ids):
        assert len(j_ids) >= 2
        r = s.put(f"{API}/master/jewellers/{j_ids[1]}/domains",
                  json={"domain": "gold.testsharma.in", "admin_domain": ""}, headers=master)
        assert r.status_code == 409, r.text
        r = s.put(f"{API}/master/jewellers/{j_ids[1]}/domains",
                  json={"domain": "", "admin_domain": "admin.testsharma.in"}, headers=master)
        assert r.status_code == 409, r.text

    def test_404s_and_auth(self, s, master):
        assert s.get(f"{API}/tenant/resolve", params={"host": "unknown.example.com"}).status_code == 404
        assert s.get(f"{API}/tenant/resolve").status_code == 404
        assert s.put(f"{API}/master/jewellers/nope/domains", json={}, headers=master).status_code == 404
        assert s.get(f"{API}/master/jewellers/nope/domain-check", headers=master).status_code == 404
        assert s.put(f"{API}/master/jewellers/x/domains", json={}).status_code in (401, 403)

    def test_clear(self, s, master, j_ids):
        for jid in j_ids:
            r = s.put(f"{API}/master/jewellers/{jid}/domains", json={"domain": "", "admin_domain": ""}, headers=master)
            assert r.status_code == 200 and r.json()["domain"] == "" and r.json()["admin_domain"] == ""
        assert s.get(f"{API}/tenant/resolve", params={"host": "gold.testsharma.in"}).status_code == 404
