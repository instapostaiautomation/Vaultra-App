# Helper: poll /api/price and /api/master/rate feed state N times (used for restart checks)
import sys, time, requests
url = [l.split("=", 1)[1].strip().strip('"') for l in open("/app/frontend/.env") if l.startswith(("EXPO_BACKEND_URL=", "EXPO_PUBLIC_BACKEND_URL="))][0].rstrip("/")
n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
gap = float(sys.argv[2]) if len(sys.argv) > 2 else 2
tok = None
for i in range(n):
    t0 = time.strftime("%H:%M:%S")
    try:
        p = requests.get(f"{url}/api/price", params={"jeweller_id": "demo-jeweller-001"}, timeout=5)
        pj = p.json() if p.status_code == 200 else {}
        if not tok:
            r = requests.post(f"{url}/api/master/login", json={"username": "admin", "password": "admin123"}, timeout=5)
            tok = r.json().get("access_token") if r.status_code == 200 else None
        f = requests.get(f"{url}/api/master/rate", headers={"Authorization": f"Bearer {tok}"}, timeout=5).json().get("feed", {}) if tok else {}
        print(t0, "price", p.status_code, "offline", pj.get("offline"), "has_live", pj.get("has_live"), "buy", pj.get("buy"),
              "| feed", f.get("source"), f.get("provider"), (f.get("error") or "")[:110])
    except Exception as e:
        print(t0, "ERR", str(e)[:100])
    time.sleep(gap)
