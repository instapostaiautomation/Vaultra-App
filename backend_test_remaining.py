#!/usr/bin/env python3
"""
Test remaining APIs with rate limit handling
"""

import requests
import time
import sys

BASE_URL = "https://vaultra-gold.preview.emergentagent.com/api"
EXISTING_CUSTOMER_PHONE = "9876543210"
DEFAULT_JEWELLER_ID = "demo-jeweller-001"

GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def log_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")

def log_error(msg):
    print(f"{RED}✗ {msg}{RESET}")

def log_info(msg):
    print(f"{YELLOW}ℹ {msg}{RESET}")

def get_customer_token():
    """Get customer token with retry"""
    for attempt in range(3):
        try:
            resp = requests.post(f"{BASE_URL}/auth/otp/request", 
                                json={"phone": EXISTING_CUSTOMER_PHONE, "jeweller_id": DEFAULT_JEWELLER_ID})
            if resp.status_code == 429:
                log_info(f"Rate limited, waiting 10 seconds... (attempt {attempt + 1}/3)")
                time.sleep(10)
                continue
            
            if resp.status_code != 200:
                log_error(f"OTP request failed: {resp.status_code}")
                return None
            
            data = resp.json()
            challenge_id = data.get("challenge_id")
            demo_otp = data.get("demo_otp")
            
            resp = requests.post(f"{BASE_URL}/auth/otp/verify", 
                               json={"challenge_id": challenge_id, "otp": demo_otp, "jeweller_id": DEFAULT_JEWELLER_ID})
            if resp.status_code != 200:
                log_error(f"OTP verify failed: {resp.status_code}")
                return None
            
            return resp.json().get("access_token")
        
        except Exception as e:
            log_error(f"Exception: {e}")
            return None
    
    return None

def test_sip_apis():
    """Test SIP APIs"""
    print("\n" + "="*60)
    print("TEST: SIP APIs")
    print("="*60)
    
    token = get_customer_token()
    if not token:
        log_error("Failed to get token")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Create SIP
        resp = requests.post(f"{BASE_URL}/sips", json={"amount": 500, "frequency": "monthly"}, headers=headers)
        assert resp.status_code == 200, f"SIP creation failed: {resp.status_code} - {resp.text}"
        sip = resp.json()
        sip_id = sip["id"]
        log_success(f"SIP created - ID: {sip_id}")
        
        # List SIPs
        resp = requests.get(f"{BASE_URL}/sips", headers=headers)
        assert resp.status_code == 200, f"SIP list failed: {resp.status_code}"
        log_success(f"SIP list passed - {len(resp.json())} SIPs")
        
        # Toggle SIP
        resp = requests.post(f"{BASE_URL}/sips/{sip_id}/toggle", headers=headers)
        assert resp.status_code == 200, f"SIP toggle failed: {resp.status_code}"
        log_success("SIP toggled")
        
        return True
    except AssertionError as e:
        log_error(str(e))
        return False

def test_alerts_apis():
    """Test Alerts APIs"""
    print("\n" + "="*60)
    print("TEST: Alerts APIs")
    print("="*60)
    
    time.sleep(5)  # Rate limit delay
    
    token = get_customer_token()
    if not token:
        log_error("Failed to get token")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Create alert
        resp = requests.post(f"{BASE_URL}/alerts", 
                           json={"target": 7000, "metal": "gold", "alert_type": "alert"}, 
                           headers=headers)
        assert resp.status_code == 200, f"Alert creation failed: {resp.status_code} - {resp.text}"
        log_success(f"Alert created - ID: {resp.json()['id']}")
        
        # Create book alert
        resp = requests.post(f"{BASE_URL}/alerts", 
                           json={"target": 7200, "metal": "gold", "alert_type": "book", "buy_amount": 1000}, 
                           headers=headers)
        assert resp.status_code == 200, f"Book alert failed: {resp.status_code} - {resp.text}"
        log_success("Book alert created")
        
        # List alerts
        resp = requests.get(f"{BASE_URL}/alerts", headers=headers)
        assert resp.status_code == 200, f"Alerts list failed: {resp.status_code}"
        log_success(f"Alerts list passed - {len(resp.json())} alerts")
        
        return True
    except AssertionError as e:
        log_error(str(e))
        return False

def test_goals_apis():
    """Test Goals APIs"""
    print("\n" + "="*60)
    print("TEST: Goals APIs")
    print("="*60)
    
    time.sleep(5)  # Rate limit delay
    
    token = get_customer_token()
    if not token:
        log_error("Failed to get token")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Create goal
        resp = requests.post(f"{BASE_URL}/goals", 
                           json={"name": "Wedding Gold", "occasion": "wedding", "target_grams": 10, "months": 12}, 
                           headers=headers)
        assert resp.status_code == 200, f"Goal creation failed: {resp.status_code} - {resp.text}"
        log_success(f"Goal created - {resp.json()['name']}")
        
        # List goals
        resp = requests.get(f"{BASE_URL}/goals", headers=headers)
        assert resp.status_code == 200, f"Goals list failed: {resp.status_code}"
        log_success(f"Goals list passed - {len(resp.json())} goals")
        
        return True
    except AssertionError as e:
        log_error(str(e))
        return False

def test_notifications_apis():
    """Test Notifications APIs"""
    print("\n" + "="*60)
    print("TEST: Notifications APIs")
    print("="*60)
    
    time.sleep(5)  # Rate limit delay
    
    token = get_customer_token()
    if not token:
        log_error("Failed to get token")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Get notifications
        resp = requests.get(f"{BASE_URL}/notifications", headers=headers)
        assert resp.status_code == 200, f"Notifications failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "notifications" in data, "Missing notifications field"
        assert "unread_count" in data, "Missing unread_count field"
        log_success(f"Notifications passed - {len(data['notifications'])} notifications, {data['unread_count']} unread")
        
        # Mark as read
        if data["unread_count"] > 0:
            resp = requests.post(f"{BASE_URL}/notifications/mark-read", headers=headers)
            assert resp.status_code == 200, f"Mark-read failed: {resp.status_code}"
            log_success("Notifications marked as read")
        
        return True
    except AssertionError as e:
        log_error(str(e))
        return False

def test_referral_system():
    """Test Referral System"""
    print("\n" + "="*60)
    print("TEST: Referral System")
    print("="*60)
    
    time.sleep(5)  # Rate limit delay
    
    token = get_customer_token()
    if not token:
        log_error("Failed to get token")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(f"{BASE_URL}/referral", headers=headers)
        assert resp.status_code == 200, f"Referral info failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "referral_code" in data, "Missing referral_code"
        assert "referral_balance" in data, "Missing referral_balance"
        assert "referral_count" in data, "Missing referral_count"
        log_success(f"Referral info passed - Code: {data['referral_code']}, Balance: ₹{data['referral_balance']}, Count: {data['referral_count']}")
        
        return True
    except AssertionError as e:
        log_error(str(e))
        return False

def test_gift_gold():
    """Test Gift Gold"""
    print("\n" + "="*60)
    print("TEST: Gift Gold")
    print("="*60)
    
    time.sleep(5)  # Rate limit delay
    
    token = get_customer_token()
    if not token:
        log_error("Failed to get token")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # First check if user has enough gold
        resp = requests.get(f"{BASE_URL}/vault", headers=headers)
        if resp.status_code == 200:
            vault = resp.json()
            gold_grams = vault.get("user", {}).get("gold_grams", 0)
            if gold_grams < 0.01:
                log_info(f"Customer has insufficient gold ({gold_grams}g), skipping gift test")
                return True
        
        gift_phone = f"9888{int(time.time()) % 1000000:06d}"
        resp = requests.post(f"{BASE_URL}/gifts", 
                           json={"phone": gift_phone, "mode": "rupees", "value": 100, "theme": "diwali", "message": "Test gift"}, 
                           headers=headers)
        assert resp.status_code == 200, f"Gift failed: {resp.status_code} - {resp.text}"
        result = resp.json()
        log_success(f"Gift sent - {result.get('grams')}g to {gift_phone}")
        
        return True
    except AssertionError as e:
        log_error(str(e))
        return False

def main():
    print("\n" + "="*60)
    print("VAULTRA DIGIGOLD - REMAINING API TESTS")
    print("="*60)
    
    results = {
        "SIP APIs": test_sip_apis(),
        "Alerts APIs": test_alerts_apis(),
        "Goals APIs": test_goals_apis(),
        "Notifications APIs": test_notifications_apis(),
        "Referral System": test_referral_system(),
        "Gift Gold": test_gift_gold(),
    }
    
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for name, result in results.items():
        status = f"{GREEN}✓ PASS{RESET}" if result else f"{RED}✗ FAIL{RESET}"
        print(f"{status} - {name}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
