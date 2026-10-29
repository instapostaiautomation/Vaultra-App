# Iteration 12: quick backend regression for customer-app luxe redesign (jewellers support_phone, price feed, products, auth, vault, buy)
import os

import pytest
import requests

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"
JID = "demo-jeweller-001"


@pytest.fixture(scope="module")
def cust():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": "9876543210", "jeweller_id": JID})
    assert r.status_code == 200, r.text
    d = r.json()
    v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": d["challenge_id"], "otp": d["demo_otp"], "jeweller_id": JID})
    assert v.status_code == 200, v.text
    tok = v.json().get("access_token") or v.json().get("token")
    return {"Authorization": f"Bearer {tok}"}


# Jewellers list includes support_phone (drawer footer contact)
def test_jewellers_list_support_phone():
    r = requests.get(f"{API}/jewellers/list")
    assert r.status_code == 200
    js = {j["id"]: j for j in r.json()}
    assert js[JID]["business_name"] == "Sharma Gold & Jewellers"
    assert js[JID]["support_phone"] and len(js[JID]["support_phone"]) == 10


# Live MT5 price feed
def test_price_live_mt5():
    r = requests.get(f"{API}/price", params={"tenant": JID})
    assert r.status_code == 200
    d = r.json()
    assert d["source"] == "mt5" and d["live"] is True
    assert d["buy"] > 0 and d["silver"]["buy"] > 0


# Products include making_pct and total_price = gold value + making %
def test_products_making_pct():
    r = requests.get(f"{API}/products", params={"jeweller_id": JID})
    assert r.status_code == 200
    ps = r.json()
    assert len(ps) > 0
    p = ps[0]
    assert "making_pct" in p and "total_price" in p
    d = requests.get(f"{API}/products/{p['id']}").json()
    assert abs(d["total_price"] - (d["gold_value"] + d["gold_value"] * d["making_pct"] / 100)) < 2


# Wrong OTP rejected
def test_wrong_otp_rejected():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": "9823456781", "jeweller_id": JID}).json()
    bad = "000000" if r["demo_otp"] != "000000" else "111111"
    v = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": r["challenge_id"], "otp": bad, "jeweller_id": JID})
    assert v.status_code == 401


# Authenticated vault + me
def test_vault_and_me(cust):
    v = requests.get(f"{API}/vault", headers=cust)
    assert v.status_code == 200
    assert "gold_grams" in v.json()["user"]
    m = requests.get(f"{API}/me", headers=cust)
    assert m.status_code == 200 and m.json().get("phone", "").endswith("9876543210")


# Buy + mock confirm
def test_buy_mock_confirm(cust):
    q = requests.post(f"{API}/quote", headers=cust, json={"tenant": JID})
    assert q.status_code == 200, q.text
    o = requests.post(f"{API}/orders/buy", headers=cust, json={"quote_id": q.json()["id"], "mode": "rupees", "value": 100})
    assert o.status_code == 200, o.text
    oid = o.json()["id"]
    c = requests.post(f"{API}/orders/{oid}/mock-confirm", headers=cust, json={"method": "upi", "success": True})
    assert c.status_code == 200, c.text


# Notifications, referral, sips, gifts reachable
@pytest.mark.parametrize("path", ["notifications", "referral", "sips", "gifts", "transactions"])
def test_customer_endpoints(cust, path):
    r = requests.get(f"{API}/{path}", headers=cust)
    assert r.status_code == 200, r.text
