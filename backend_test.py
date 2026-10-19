#!/usr/bin/env python3
"""
Backend API Tests for Vaultra DigiGold - 9 New Features
Tests: Silver Price API, Product Detail API, Referral System, Notifications API
"""

import requests
import json
import sys

# Backend URL from frontend/.env
BASE_URL = "https://vaultra-gold.preview.emergentagent.com/api"

# Test credentials
TEST_PHONE = "9876543210"
NEW_USER_PHONE = "9999888877"  # For referral test

# Color codes for output
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

def get_auth_token(phone):
    """Get auth token for a phone number"""
    log_info(f"Getting auth token for {phone}...")
    
    # Step 1: Request OTP
    response = requests.post(f"{BASE_URL}/auth/otp/request", json={"phone": phone})
    if response.status_code != 200:
        log_error(f"OTP request failed: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    challenge_id = data.get("challenge_id")
    demo_otp = data.get("demo_otp")
    
    if not challenge_id or not demo_otp:
        log_error(f"Missing challenge_id or demo_otp in response: {data}")
        return None
    
    log_info(f"OTP received: {demo_otp}")
    
    # Step 2: Verify OTP
    verify_payload = {
        "challenge_id": challenge_id,
        "otp": demo_otp,
        "tenant": "vaultra"
    }
    
    response = requests.post(f"{BASE_URL}/auth/otp/verify", json=verify_payload)
    if response.status_code != 200:
        log_error(f"OTP verify failed: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    token = data.get("access_token")
    
    if not token:
        log_error(f"No access_token in response: {data}")
        return None
    
    log_success(f"Auth token obtained for {phone}")
    return token

def test_silver_price_api():
    """Test 1: Silver Price API - GET /api/price should return silver data"""
    print("\n" + "="*60)
    print("TEST 1: Silver Price API")
    print("="*60)
    
    try:
        response = requests.get(f"{BASE_URL}/price", params={"tenant": "vaultra"})
        
        if response.status_code != 200:
            log_error(f"Price API failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check if silver field exists
        if "silver" not in data:
            log_error("'silver' field missing in price response")
            log_error(f"Response data: {json.dumps(data, indent=2)}")
            return False
        
        silver = data["silver"]
        
        # Check required silver fields
        required_fields = ["buy", "sell", "change", "change_pct", "direction"]
        missing_fields = [f for f in required_fields if f not in silver]
        
        if missing_fields:
            log_error(f"Missing silver fields: {missing_fields}")
            log_error(f"Silver data: {json.dumps(silver, indent=2)}")
            return False
        
        # Validate data types and values
        if not isinstance(silver["buy"], (int, float)) or silver["buy"] <= 0:
            log_error(f"Invalid silver buy price: {silver['buy']}")
            return False
        
        if not isinstance(silver["sell"], (int, float)) or silver["sell"] <= 0:
            log_error(f"Invalid silver sell price: {silver['sell']}")
            return False
        
        if silver["direction"] not in ["up", "down"]:
            log_error(f"Invalid silver direction: {silver['direction']}")
            return False
        
        log_success("Silver price API working correctly")
        log_info(f"Silver Buy: ₹{silver['buy']}, Sell: ₹{silver['sell']}, Direction: {silver['direction']}")
        return True
        
    except Exception as e:
        log_error(f"Exception in silver price test: {str(e)}")
        return False

def test_product_detail_api():
    """Test 2: Product Detail API - GET /api/products/{product_id}"""
    print("\n" + "="*60)
    print("TEST 2: Product Detail API")
    print("="*60)
    
    # Test with heritage-24k-necklace (product ID from review request)
    # But looking at server.py, the actual product ID is "p1"
    product_id = "p1"  # Heritage 24K Necklace
    
    try:
        response = requests.get(f"{BASE_URL}/products/{product_id}")
        
        if response.status_code != 200:
            log_error(f"Product detail API failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ["description", "features", "gold_value", "total_price", "live_rate"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            log_error(f"Missing product fields: {missing_fields}")
            log_error(f"Product data: {json.dumps(data, indent=2)}")
            return False
        
        # Validate features is an array
        if not isinstance(data["features"], list) or len(data["features"]) == 0:
            log_error(f"'features' should be a non-empty array, got: {data['features']}")
            return False
        
        # Validate numeric fields
        if not isinstance(data["gold_value"], (int, float)) or data["gold_value"] <= 0:
            log_error(f"Invalid gold_value: {data['gold_value']}")
            return False
        
        if not isinstance(data["total_price"], (int, float)) or data["total_price"] <= 0:
            log_error(f"Invalid total_price: {data['total_price']}")
            return False
        
        if not isinstance(data["live_rate"], (int, float)) or data["live_rate"] <= 0:
            log_error(f"Invalid live_rate: {data['live_rate']}")
            return False
        
        log_success("Product detail API working correctly")
        log_info(f"Product: {data.get('name')}, Gold Value: ₹{data['gold_value']}, Total: ₹{data['total_price']}")
        log_info(f"Features count: {len(data['features'])}")
        return True
        
    except Exception as e:
        log_error(f"Exception in product detail test: {str(e)}")
        return False

def test_referral_system():
    """Test 3: Referral System - GET /api/referral and referral during signup"""
    print("\n" + "="*60)
    print("TEST 3: Referral System")
    print("="*60)
    
    try:
        # Step 1: Get auth token for existing user
        token = get_auth_token(TEST_PHONE)
        if not token:
            log_error("Failed to get auth token for referral test")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Get referral info
        response = requests.get(f"{BASE_URL}/referral", headers=headers)
        
        if response.status_code != 200:
            log_error(f"Referral API failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ["referral_code", "referral_balance", "referral_count", "referrals"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            log_error(f"Missing referral fields: {missing_fields}")
            log_error(f"Referral data: {json.dumps(data, indent=2)}")
            return False
        
        # Validate referral_code
        if not data["referral_code"] or not isinstance(data["referral_code"], str):
            log_error(f"Invalid referral_code: {data['referral_code']}")
            return False
        
        referral_code = data["referral_code"]
        
        # Validate referrals is an array
        if not isinstance(data["referrals"], list):
            log_error(f"'referrals' should be an array, got: {type(data['referrals'])}")
            return False
        
        log_success("Referral API working correctly")
        log_info(f"Referral Code: {referral_code}, Balance: ₹{data['referral_balance']}, Count: {data['referral_count']}")
        
        # Step 3: Test referral during new user signup
        log_info(f"Testing referral code application during signup...")
        
        # Request OTP for new user
        otp_response = requests.post(f"{BASE_URL}/auth/otp/request", json={"phone": NEW_USER_PHONE})
        if otp_response.status_code != 200:
            log_error(f"New user OTP request failed: {otp_response.status_code}")
            return False
        
        otp_data = otp_response.json()
        challenge_id = otp_data.get("challenge_id")
        demo_otp = otp_data.get("demo_otp")
        
        # Verify OTP with referral code
        verify_payload = {
            "challenge_id": challenge_id,
            "otp": demo_otp,
            "tenant": "vaultra",
            "name": "Test Referral User",
            "referral_code": referral_code
        }
        
        verify_response = requests.post(f"{BASE_URL}/auth/otp/verify", json=verify_payload)
        if verify_response.status_code != 200:
            log_error(f"New user signup with referral failed: {verify_response.status_code}")
            log_error(f"Response: {verify_response.text}")
            return False
        
        verify_data = verify_response.json()
        user_data = verify_data.get("user", {})
        
        # Check if referral was applied (new user should have ₹50 bonus)
        if user_data.get("referral_balance") != 50.0:
            log_error(f"Referral bonus not applied. Expected 50.0, got: {user_data.get('referral_balance')}")
            return False
        
        log_success("Referral code successfully applied during signup")
        log_info(f"New user referral balance: ₹{user_data.get('referral_balance')}")
        
        return True
        
    except Exception as e:
        log_error(f"Exception in referral test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_notifications_api():
    """Test 4: Notifications API - GET /api/notifications and POST /api/notifications/mark-read"""
    print("\n" + "="*60)
    print("TEST 4: Notifications API")
    print("="*60)
    
    try:
        # Get auth token
        token = get_auth_token(TEST_PHONE)
        if not token:
            log_error("Failed to get auth token for notifications test")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 1: Get notifications
        response = requests.get(f"{BASE_URL}/notifications", headers=headers)
        
        if response.status_code != 200:
            log_error(f"Notifications API failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ["notifications", "unread_count"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            log_error(f"Missing notification fields: {missing_fields}")
            log_error(f"Notification data: {json.dumps(data, indent=2)}")
            return False
        
        # Validate notifications is an array
        if not isinstance(data["notifications"], list):
            log_error(f"'notifications' should be an array, got: {type(data['notifications'])}")
            return False
        
        # Validate unread_count is a number
        if not isinstance(data["unread_count"], int):
            log_error(f"'unread_count' should be an integer, got: {type(data['unread_count'])}")
            return False
        
        log_success("Notifications GET API working correctly")
        log_info(f"Total notifications: {len(data['notifications'])}, Unread: {data['unread_count']}")
        
        # Step 2: Mark all as read
        mark_response = requests.post(f"{BASE_URL}/notifications/mark-read", headers=headers)
        
        if mark_response.status_code != 200:
            log_error(f"Mark-read API failed with status {mark_response.status_code}")
            log_error(f"Response: {mark_response.text}")
            return False
        
        mark_data = mark_response.json()
        
        if not mark_data.get("ok"):
            log_error(f"Mark-read did not return ok: {mark_data}")
            return False
        
        log_success("Notifications mark-read API working correctly")
        
        # Step 3: Verify unread_count is now 0
        verify_response = requests.get(f"{BASE_URL}/notifications", headers=headers)
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            if verify_data.get("unread_count") == 0:
                log_success("Unread count correctly updated to 0")
            else:
                log_error(f"Unread count should be 0, got: {verify_data.get('unread_count')}")
                return False
        
        return True
        
    except Exception as e:
        log_error(f"Exception in notifications test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*60)
    print("VAULTRA DIGIGOLD - BACKEND API TESTS")
    print("Testing 4 New Backend Features")
    print("="*60)
    
    results = {
        "Silver Price API": test_silver_price_api(),
        "Product Detail API": test_product_detail_api(),
        "Referral System": test_referral_system(),
        "Notifications API": test_notifications_api()
    }
    
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print(f"\n{GREEN}All backend tests passed!{RESET}")
        return 0
    else:
        print(f"\n{RED}Some tests failed. Please review the errors above.{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
