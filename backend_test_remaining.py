#!/usr/bin/env python3
"""
Test remaining endpoints that failed due to rate limiting
"""

import requests
import sys

BASE_URL = "https://vaultra-gold.preview.emergentagent.com/api"
DEMO_PHONE = "9876543210"

GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")

def log_error(msg):
    print(f"{RED}✗ {msg}{RESET}")

def log_info(msg):
    print(f"{YELLOW}ℹ {msg}{RESET}")

def get_auth_token():
    """Get auth token for demo phone"""
    # Step 1: Request OTP
    response = requests.post(f"{BASE_URL}/auth/otp/request", json={"phone": DEMO_PHONE})
    if response.status_code != 200:
        log_error(f"OTP request failed: {response.status_code}")
        return None
    
    data = response.json()
    challenge_id = data.get("challenge_id")
    demo_otp = data.get("demo_otp")
    
    # Step 2: Verify OTP
    response = requests.post(f"{BASE_URL}/auth/otp/verify", json={
        "challenge_id": challenge_id,
        "otp": demo_otp,
        "tenant": "vaultra"
    })
    
    if response.status_code != 200:
        log_error(f"OTP verify failed: {response.status_code}")
        return None
    
    return response.json().get("access_token")

def main():
    print(f"\n{BLUE}Testing Remaining Endpoints{RESET}\n")
    
    # Get token once and reuse
    log_info("Getting auth token...")
    token = get_auth_token()
    if not token:
        log_error("Failed to get auth token")
        return 1
    
    log_success("Auth token obtained")
    headers = {"Authorization": f"Bearer {token}"}
    
    results = {}
    
    # Test 13: GET /api/referral
    print(f"\n{BLUE}TEST 13: GET /api/referral{RESET}")
    try:
        response = requests.get(f"{BASE_URL}/referral", headers=headers)
        if response.status_code == 200:
            data = response.json()
            required = ["referral_code", "referral_balance", "referral_count", "referrals"]
            if all(f in data for f in required):
                log_success(f"Referral: Code={data['referral_code']}, Balance=₹{data['referral_balance']}, Count={data['referral_count']}")
                results["13. GET /api/referral"] = True
            else:
                log_error(f"Missing fields in response")
                results["13. GET /api/referral"] = False
        else:
            log_error(f"Failed: {response.status_code}")
            results["13. GET /api/referral"] = False
    except Exception as e:
        log_error(f"Exception: {e}")
        results["13. GET /api/referral"] = False
    
    # Test 14: GET /api/notifications
    print(f"\n{BLUE}TEST 14: GET /api/notifications{RESET}")
    try:
        response = requests.get(f"{BASE_URL}/notifications", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if "notifications" in data and "unread_count" in data:
                log_success(f"Notifications: Total={len(data['notifications'])}, Unread={data['unread_count']}")
                results["14. GET /api/notifications"] = True
            else:
                log_error("Missing fields")
                results["14. GET /api/notifications"] = False
        else:
            log_error(f"Failed: {response.status_code}")
            results["14. GET /api/notifications"] = False
    except Exception as e:
        log_error(f"Exception: {e}")
        results["14. GET /api/notifications"] = False
    
    # Test 15: GET /api/alerts
    print(f"\n{BLUE}TEST 15: GET /api/alerts{RESET}")
    try:
        response = requests.get(f"{BASE_URL}/alerts", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_success(f"Alerts: {len(data)} alerts")
                results["15. GET /api/alerts"] = True
            else:
                log_error("Expected list")
                results["15. GET /api/alerts"] = False
        else:
            log_error(f"Failed: {response.status_code}")
            results["15. GET /api/alerts"] = False
    except Exception as e:
        log_error(f"Exception: {e}")
        results["15. GET /api/alerts"] = False
    
    # Test 16: POST /api/alerts
    print(f"\n{BLUE}TEST 16: POST /api/alerts{RESET}")
    try:
        response = requests.post(f"{BASE_URL}/alerts", json={"target": 7000, "tenant": "vaultra"}, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if "id" in data and "target" in data:
                log_success(f"Alert created: ID={data['id']}, Target=₹{data['target']}")
                results["16. POST /api/alerts"] = True
            else:
                log_error("Missing fields")
                results["16. POST /api/alerts"] = False
        else:
            log_error(f"Failed: {response.status_code} - {response.text}")
            results["16. POST /api/alerts"] = False
    except Exception as e:
        log_error(f"Exception: {e}")
        results["16. POST /api/alerts"] = False
    
    # Test 17: POST /api/alerts/book
    print(f"\n{BLUE}TEST 17: POST /api/alerts/book{RESET}")
    try:
        response = requests.post(f"{BASE_URL}/alerts/book", 
                                json={"target": 7000, "metal": "gold", "buy_amount": 1000, "tenant": "vaultra"}, 
                                headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data.get("alert_type") == "book":
                log_success(f"Book alert: ID={data['id']}, Target=₹{data['target']}")
                results["17. POST /api/alerts/book"] = True
            else:
                log_error("alert_type not 'book'")
                results["17. POST /api/alerts/book"] = False
        else:
            log_error(f"Failed: {response.status_code}")
            results["17. POST /api/alerts/book"] = False
    except Exception as e:
        log_error(f"Exception: {e}")
        results["17. POST /api/alerts/book"] = False
    
    # Test 18: GET /api/vault
    print(f"\n{BLUE}TEST 18: GET /api/vault{RESET}")
    try:
        response = requests.get(f"{BASE_URL}/vault", params={"tenant": "vaultra"}, headers=headers)
        if response.status_code == 200:
            data = response.json()
            required = ["user", "buy_rate", "sell_rate", "current_value"]
            if all(f in data for f in required):
                log_success(f"Vault: Gold={data['user']['gold_grams']}g, Value=₹{data['current_value']}")
                results["18. GET /api/vault"] = True
            else:
                log_error("Missing fields")
                results["18. GET /api/vault"] = False
        else:
            log_error(f"Failed: {response.status_code}")
            results["18. GET /api/vault"] = False
    except Exception as e:
        log_error(f"Exception: {e}")
        results["18. GET /api/vault"] = False
    
    # Test 19: GET /api/goals
    print(f"\n{BLUE}TEST 19: GET /api/goals{RESET}")
    try:
        response = requests.get(f"{BASE_URL}/goals", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_success(f"Goals: {len(data)} goals")
                results["19. GET /api/goals"] = True
            else:
                log_error("Expected list")
                results["19. GET /api/goals"] = False
        else:
            log_error(f"Failed: {response.status_code}")
            results["19. GET /api/goals"] = False
    except Exception as e:
        log_error(f"Exception: {e}")
        results["19. GET /api/goals"] = False
    
    # Summary
    print(f"\n{BLUE}{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}{RESET}\n")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{test_name}: {status}")
    
    print(f"\n{BLUE}Total: {passed}/{total} tests passed{RESET}\n")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
