# Iteration 25: MT5 0.1-lot booking (100g lots), fast rates, Master<->Shop dues, SIP UPI AutoPay mandate + scheduler.
# Run serially: pytest -p no:xdist -v
import json
import os
import time
from datetime import datetime, timedelta, timezone

import psycopg2
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
J1 = "demo-jeweller-001"
MT5_EXPECTED = {"gold_lot_g": 100.0, "silver_lot_g": 100.0, "min_volume": 0.1, "step": 0.1, "max_volume": 10.0}
PG = os.environ["DATABASE_URL_SYNC"].replace("postgresql+psycopg2://", "postgresql://")


def _tok(d):
    return d.get("access_token") or d.get("token")


def _sql(q, args=(), fetch=False):
    con = psycopg2.connect(PG)
    try:
        cur = con.cursor()
        cur.execute(q, args)
        res = cur.fetchall() if fetch else None
        con.commit()
        return res
    finally:
        con.close()


def _cust(phone):
    for _ in range(4):
        c = requests.post(f"{API}/auth/otp/request", json={"phone": phone}).json()
        if "challenge_id" in c:
            break
        time.sleep(30)
    assert "challenge_id" in c, c
    v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": c["challenge_id"], "otp": c["demo_otp"]})
    assert v.status_code == 200, v.text
    return {"Authorization": f"Bearer {_tok(v.json())}"}


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
def aarav():
    return _cust("9876543210")


def _me(h):
    return requests.get(f"{API}/me", headers=h).json()


def _pending():
    v = _sql("SELECT value FROM app_settings WHERE key='mt5_pending'", fetch=True)
    return json.loads(v[0][0]) if v else {"gold": 0.0, "silver": 0.0}


def _buy(h, rupees):
    for _ in range(12):
        q = requests.post(f"{API}/quote", json={}, headers=h).json()
        if "id" in q:
            break
        time.sleep(5)
    assert "id" in q, q
    o = requests.post(f"{API}/orders/buy", json={"quote_id": q["id"], "mode": "rupees", "value": rupees}, headers=h).json()
    assert "id" in o, o
    r = requests.post(f"{API}/orders/{o['id']}/mock-confirm", json={"method": "upi", "success": True}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


# MT5 config: 100g lots, 0.1 min volume / step
def test_mt5_config(master):
    d = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()
    for k, v in MT5_EXPECTED.items():
        assert float(d["config"][k]) == v, d["config"]
    assert d["config"]["enabled"] is True
    assert d["configured"] is True


# MT5 volume math: pending 25g after a buy -> books 0.2 lot (20g), ~5g stays pending (real demo order)
def test_mt5_volume_math(master, aarav):
    before = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()
    ids_before = {b["id"] for b in before["bookings"]}
    p0 = _pending()
    real_gold = float(p0.get("gold", 0))
    # inject so that pending after a ~0.03g buy lands at ~24.7..25g
    fake = 24.7 - real_gold
    _sql("UPDATE app_settings SET value=%s WHERE key='mt5_pending'", (json.dumps(p0 | {"gold": round(real_gold + fake, 4)}),))
    try:
        txn = _buy(aarav, 500)
        bought = float((txn.get("transaction") or txn).get("grams") or 0) if isinstance(txn, dict) else 0
        new = []
        for _ in range(20):
            time.sleep(1.5)
            d = requests.get(f"{API}/master/v3/mt5-bookings", headers=master).json()
            new = [b for b in d["bookings"] if b["id"] not in ids_before and b["metal"] == "gold"]
            if new:
                break
        print("NEW BOOKINGS:", new, "PENDING:", d["pending"], "bought:", bought)
        assert new, "No booking row created"
        b = new[0]
        assert abs(b["volume"] - 0.2) < 1e-6, b
        assert abs(b["grams"] - 20.0) < 1e-6, b
        if b["status"] == "booked":
            assert 4.0 < d["pending"]["gold"] < 6.0, d["pending"]
    finally:
        # remove injected grams; keep real customer grams (fake grams were consumed by the demo order)
        cur = _pending()
        real_now = round(real_gold + (bought if 'bought' in dir() else 0), 4)
        _sql("UPDATE app_settings SET value=%s WHERE key='mt5_pending'", (json.dumps(cur | {"gold": real_now}),))


# Rates refresh fast: updated_at changes within ~1s
def test_price_updates_fast():
    stamps = set()
    src = None
    for _ in range(8):
        d = requests.get(f"{API}/price").json()
        stamps.add(d.get("updated_at"))
        src = d.get("source")
        time.sleep(0.5)
    print("source", src, "distinct stamps", len(stamps))
    assert src == "mt5"
    assert len(stamps) >= 4


# Dues summary for all shops: payable = collected - commission, remaining = payable - paid
def test_master_dues_list(master):
    r = requests.get(f"{API}/master/v3/dues", headers=master)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["shops"] and "totals" in d
    for s in d["shops"]:
        for k in ("payable", "paid", "remaining", "commission", "gst", "collected"):
            assert k in s, s
        assert abs(s["payable"] - (s["collected"] - s["commission"])) < 0.02, s
        assert abs(s["remaining"] - (s["payable"] - s["paid"])) < 0.02, s
    assert abs(d["totals"]["remaining"] - sum(s["remaining"] for s in d["shops"])) < 0.1


# Dues detail: transactions with customer + payable; payable sums to summary
def test_master_dues_detail(master):
    d = requests.get(f"{API}/master/v3/dues/{J1}", headers=master).json()
    assert d["summary"]["id"] == J1
    assert d["transactions"], "no transactions"
    t = d["transactions"][0]
    for k in ("customer", "wallet_id", "payable", "commission", "total"):
        assert k in t, t
    assert abs(t["payable"] - (t["total"] - t["commission"])) < 0.02
    if d["summary"]["orders"] <= 500:
        assert abs(sum(x["payable"] for x in d["transactions"]) - d["summary"]["payable"]) < 1.0
    assert requests.get(f"{API}/master/v3/dues/nope-shop", headers=master).status_code == 404


# Record payment -> remaining drops, shop sees same numbers; delete restores
def test_dues_payment_cycle(master, sharma):
    s0 = requests.get(f"{API}/master/v3/dues/{J1}", headers=master).json()["summary"]
    r = requests.post(f"{API}/master/v3/dues/{J1}/payments", headers=master,
                      json={"amount": 1234.5, "paid_on": "2026-01-10", "reference": "TEST_UTR123", "note": "TEST_note"})
    assert r.status_code == 200, r.text
    s1 = r.json()
    pid = None
    try:
        assert abs(s1["remaining"] - (s0["remaining"] - 1234.5)) < 0.02, (s0, s1)
        assert abs(s1["paid"] - (s0["paid"] + 1234.5)) < 0.02
        det = requests.get(f"{API}/master/v3/dues/{J1}", headers=master).json()
        pay = [p for p in det["payments"] if p["reference"] == "TEST_UTR123"]
        assert pay and pay[0]["paid_on"] == "2026-01-10" and pay[0]["note"] == "TEST_note"
        pid = pay[0]["id"]
        sh = requests.get(f"{API}/jeweller/v3/dues", headers=sharma).json()
        assert sh["summary"]["id"] == J1
        assert abs(sh["summary"]["remaining"] - s1["remaining"]) < 0.02
        assert any(p["id"] == pid for p in sh["payments"])
    finally:
        if pid:
            assert requests.delete(f"{API}/master/v3/dues/payments/{pid}", headers=master).status_code == 200
    s2 = requests.get(f"{API}/master/v3/dues/{J1}", headers=master).json()["summary"]
    assert abs(s2["remaining"] - s0["remaining"]) < 0.02
    assert requests.delete(f"{API}/master/v3/dues/payments/{pid}", headers=master).status_code == 404


# Validation + access control
def test_dues_validation_and_auth(master, sharma):
    assert requests.post(f"{API}/master/v3/dues/{J1}/payments", headers=master, json={"amount": 0}).status_code == 422
    assert requests.post(f"{API}/master/v3/dues/{J1}/payments", headers=master, json={"amount": -5}).status_code == 422
    for m, u in (("get", "/master/v3/dues"), ("get", f"/master/v3/dues/{J1}"), ("post", f"/master/v3/dues/{J1}/payments")):
        r = getattr(requests, m)(f"{API}{u}", headers=sharma, json={"amount": 10})
        assert r.status_code in (401, 403), (u, r.status_code)
    assert requests.get(f"{API}/jeweller/v3/dues").status_code in (401, 403)


# SIP start: mandate + immediate first debit, grams credited (3% GST), notification + sip txn with commission
def test_sip_create_mandate(aarav):
    m0 = _me(aarav)
    g0 = float((m0.get("customer") or m0).get("gold_grams") or 0)
    r = requests.post(f"{API}/sips", headers=aarav, json={"amount": 500, "frequency": "monthly", "metal": "gold"})
    assert r.status_code == 200, r.text
    s = r.json()
    try:
        assert s["mandate_ref"].startswith("UPIMD"), s
        assert s["installments"] == 1 and s["grams_accumulated"] > 0 and s["last_status"] == "debited", s
        assert datetime.fromisoformat(s["next_run"]) > datetime.now(timezone.utc) + timedelta(days=25)
        m1 = _me(aarav)
        g1 = float((m1.get("customer") or m1).get("gold_grams") or 0)
        assert abs((g1 - g0) - s["grams_accumulated"]) < 0.0002, (g0, g1, s)
        lst = [x for x in requests.get(f"{API}/sips", headers=aarav).json() if x["id"] == s["id"]]
        assert lst and lst[0]["mandate_ref"] == s["mandate_ref"] and lst[0]["last_run"] and lst[0]["next_run"]
        rows = _sql("SELECT type, total, gst, grams, rate, extra FROM transactions WHERE extra->>'sip_id'=%s", (s["id"],), fetch=True)
        assert len(rows) == 1
        typ, total, gst, grams, rate, extra = rows[0]
        assert typ == "sip" and abs(total - 500) < 0.01 and abs(gst - 15) < 0.01
        assert abs(grams - (485 / rate)) < 0.0002
        assert "commission" in extra
        n = _sql("SELECT title FROM notifications WHERE customer_id=(SELECT customer_id FROM sips WHERE id=%s) AND title='SIP instalment successful' AND created_at > now() - interval '2 minutes'", (s["id"],), fetch=True)
        assert n, "notification missing"
        # Scheduler: push next_run into the past -> auto-debit within ~70s
        _sql("UPDATE sips SET next_run = now() - interval '1 minute' WHERE id=%s", (s["id"],))
        ok = False
        for _ in range(16):
            time.sleep(6)
            x = [y for y in requests.get(f"{API}/sips", headers=aarav).json() if y["id"] == s["id"]][0]
            if x["installments"] == 2:
                ok = True
                break
        print("SIP after scheduler:", x)
        assert ok, x
        assert datetime.fromisoformat(x["next_run"]) > datetime.now(timezone.utc) + timedelta(days=25)
    finally:
        requests.delete(f"{API}/sips/{s['id']}", headers=aarav)


# SIP validation: below ₹500 rejected
def test_sip_min_amount(aarav):
    r = requests.post(f"{API}/sips", headers=aarav, json={"amount": 100, "frequency": "monthly", "metal": "gold"})
    assert r.status_code in (400, 422), r.text
