# Seed helper (iteration 9): two TEST customers with pending KYC for master approve/reject UI test
import os
import requests

API = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/") + "/api"
for phone, name in (("9000000901", "TEST Approve"), ("9000000902", "TEST Reject")):
    r = requests.post(f"{API}/auth/otp/request", json={"phone": phone, "jeweller_id": "demo-jeweller-002"}).json()
    t = requests.post(f"{API}/auth/otp/verify", json={"challenge_id": r["challenge_id"], "otp": r["demo_otp"],
                                                   "tenant": "demo-jeweller-002", "first_name": name}).json()
    H = {"Authorization": f"Bearer {t['access_token']}"}
    k = requests.post(f"{API}/kyc/submit", headers=H, json={"full_name": name, "aadhaar": "123412341234", "pan": "ABCDE1234F"})
    print(phone, k.status_code, k.text[:100])
