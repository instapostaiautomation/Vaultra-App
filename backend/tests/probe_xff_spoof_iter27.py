# Probe: is the per-IP login limit keyed on a client-controlled X-Forwarded-For value? (uses fake identities only)
import os
import sys
import uuid

import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
PUBLIC = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/") + "/api"
LOCAL = "http://localhost:8001/api"
SPOOF = "203.0.113." + str(uuid.uuid4().int % 200 + 10)
RUN = uuid.uuid4().hex[:6]

# 1) Lock per-IP counter for SPOOF via localhost: 4 fake users x 5 fails = 20 (jeweller kind)
for u in range(4):
    for i in range(5):
        r = requests.post(f"{LOCAL}/jeweller/login", json={"email": f"xff-{RUN}-{u}@example.com", "password": "w"}, headers={"X-Forwarded-For": SPOOF})
        assert r.status_code == 401, r.text
r = requests.post(f"{LOCAL}/jeweller/login", json={"email": f"xff-{RUN}-new@example.com", "password": "w"}, headers={"X-Forwarded-For": SPOOF})
print("local: 21st attempt from spoofed IP", SPOOF, "->", r.status_code, r.text)
r = requests.post(f"{LOCAL}/jeweller/login", json={"email": f"xff-{RUN}-new@example.com", "password": "w"}, headers={"X-Forwarded-For": "198.51.100.99"})
print("local: same attacker rotating XFF ->", r.status_code, r.text)
# 2) Does the public ingress forward client-supplied XFF as first hop?
r = requests.post(f"{PUBLIC}/jeweller/login", json={"email": f"xff-{RUN}-pub@example.com", "password": "w"}, headers={"X-Forwarded-For": SPOOF})
print("public: attempt with locked spoofed XFF ->", r.status_code, r.text)
sys.exit(0)
