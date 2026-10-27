# Seed helper (iteration 9): creates SIPs + a goal for Meera Iyer so SIP/Goals panel tabs have data
import os
import requests

API = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/") + "/api"
r = requests.post(f"{API}/auth/otp/request", json={"phone": "9834567892", "jeweller_id": "demo-jeweller-001"}).json()
t = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": r["challenge_id"], "otp": r["demo_otp"], "tenant": "demo-jeweller-001"}).json()
H = {"Authorization": f"Bearer {t['access_token']}"}
s1 = requests.post(f"{API}/sips", headers=H, json={"amount": 500, "frequency": "monthly"})
print("sip1", s1.status_code, s1.text[:200])
s2 = requests.post(f"{API}/sips", headers=H, json={"amount": 200, "frequency": "weekly"})
print("sip2", s2.status_code)
s3 = requests.post(f"{API}/sips", headers=H, json={"amount": 300, "frequency": "yearly"})
print("sip invalid freq 'yearly':", s3.status_code, s3.text[:120])
id1 = s1.json().get("id") or s1.json().get("sip", {}).get("id")
id2 = s2.json().get("id") or s2.json().get("sip", {}).get("id")
print("run", requests.post(f"{API}/sips/{id1}/run", headers=H).status_code)
print("toggle", requests.post(f"{API}/sips/{id2}/toggle", headers=H).status_code)
if s3.status_code == 200:
    sid3 = s3.json().get("id") or s3.json().get("sip", {}).get("id")
    print("cancel invalid", requests.delete(f"{API}/sips/{sid3}", headers=H).status_code)
g = requests.post(f"{API}/goals", headers=H, json={"name": "TEST_Wedding", "occasion": "wedding", "target_grams": 10, "months": 12})
print("goal", g.status_code, g.text[:150])
