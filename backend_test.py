#!/usr/bin/env python3
"""
Backend API Tests for Vaultra DigiGold - 7 New Features
Tests: Multi-step Registration, Silver Price, Silver Buy, Wallet System, Book Alert, Notifications, Product Detail
"""

import requests
import json
import sys
import time

# Backend URL from frontend/.env
BASE_URL = "https://vaultra-gold.preview.emergentagent.com/api"

# Test credentials
TEST_PHONE = "9876543210"
NEW_USER_PHONE = f"88880{int(time.time()) % 100000:05d}"  # Unique phone for each test run
REFERRAL_TEST_PHONE = f"77770{int(time.time()) % 100000:05d}"  # For referral test

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

def get_auth_token(phone, include_user_fields=False, referral_code=None):
    """Get auth token for a phone number"""
    log_info(f"Getting auth token for {phone}...")
    
    # Step 1: Request OTP
    response = requests.post(f"{BASE_URL}/auth/otp/request", json={"phone": phone})
    if response.status_code != 200:
        log_error(f"OTP request failed: {response.status_code} - {response.text}")
        return None, None
    
    data = response.json()
    challenge_id = data.get("challenge_id")
    demo_otp = data.get("demo_otp")
    is_new_user = data.get("is_new_user", False)
    
    if not challenge_id or not demo_otp:
        log_error(f"Missing challenge_id or demo_otp in response: {data}")
        return None, None
    
    log_info(f"OTP received: {demo_otp}, is_new_user: {is_new_user}")
    
    # Step 2: Verify OTP
    verify_payload = {
        "challenge_id": challenge_id,
        "otp": demo_otp,
        "tenant": "vaultra"
    }
    
    # Add user fields if requested (for new user registration)
    if include_user_fields:
        verify_payload.update({
            "first_name": "Rajesh",
            "last_name": "Kumar",
            "email": "rajesh.kumar@example.com",
            "dob": "1990-05-15",
            "gender": "male"
        })
        if referral_code:
            verify_payload["referral_code"] = referral_code
    
    response = requests.post(f"{BASE_URL}/auth/otp/verify", json=verify_payload)
    if response.status_code != 200:
        log_error(f"OTP verify failed: {response.status_code} - {response.text}")
        return None, None
    
    data = response.json()
    token = data.get("access_token")
    user = data.get("user", {})
    
    if not token:
        log_error(f"No access_token in response: {data}")
        return None, None
    
    log_success(f"Auth token obtained for {phone}")
    return token, user

def test_multi_step_registration():
    """Test 1: Multi-step Registration with new user fields"""
    print("\n" + "="*60)
    print("TEST 1: Multi-step Registration (new user fields)")
    print("="*60)
    
    try:
        # Use a unique phone number for new user
        new_phone = NEW_USER_PHONE
        log_info(f"Testing registration with phone: {new_phone}")
        
        # Step 1: Request OTP
        response = requests.post(f"{BASE_URL}/auth/otp/request", json={"phone": new_phone})
        
        if response.status_code != 200:
            log_error(f"OTP request failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        challenge_id = data.get("challenge_id")
        demo_otp = data.get("demo_otp")
        is_new_user = data.get("is_new_user")
        
        if not challenge_id or not demo_otp:
            log_error(f"Missing challenge_id or demo_otp: {data}")
            return False
        
        log_success(f"OTP request successful. OTP: {demo_otp}, is_new_user: {is_new_user}")
        
        # Step 2: Verify OTP with new user fields
        verify_payload = {
            "challenge_id": challenge_id,
            "otp": demo_otp,
            "tenant": "vaultra",
            "first_name": "Priya",
            "last_name": "Sharma",
            "email": "priya.sharma@example.com",
            "dob": "1995-08-20",
            "gender": "female"
        }
        
        response = requests.post(f"{BASE_URL}/auth/otp/verify", json=verify_payload)
        
        if response.status_code != 200:
            log_error(f"OTP verify failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        user = data.get("user", {})
        
        # Verify new fields are present in user response
        required_fields = ["first_name", "last_name", "email", "gender"]
        missing_fields = [f for f in required_fields if f not in user]
        
        if missing_fields:
            log_error(f"Missing user fields in response: {missing_fields}")
            log_error(f"User data: {json.dumps(user, indent=2)}")
            return False
        
        # Verify field values
        if user.get("first_name") != "Priya":
            log_error(f"first_name mismatch. Expected 'Priya', got: {user.get('first_name')}")
            return False
        
        if user.get("last_name") != "Sharma":
            log_error(f"last_name mismatch. Expected 'Sharma', got: {user.get('last_name')}")
            return False
        
        if user.get("email") != "priya.sharma@example.com":
            log_error(f"email mismatch. Expected 'priya.sharma@example.com', got: {user.get('email')}")
            return False
        
        if user.get("gender") != "female":
            log_error(f"gender mismatch. Expected 'female', got: {user.get('gender')}")
            return False
        
        log_success("Multi-step registration working correctly")
        log_info(f"User created: {user.get('first_name')} {user.get('last_name')}, Email: {user.get('email')}, Gender: {user.get('gender')}")
        return True
        
    except Exception as e:
        log_error(f"Exception in multi-step registration test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_silver_price_api():
    """Test 2: Silver Price API - GET /api/price should return silver data"""
    print("\n" + "="*60)
    print("TEST 2: Silver Price API")
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

def test_silver_buy():
    """Test 3: Silver Buy - POST /api/quote/silver and POST /api/orders/buy-silver"""
    print("\n" + "="*60)
    print("TEST 3: Silver Buy")
    print("="*60)
    
    try:
        # Get auth token
        token, user = get_auth_token(TEST_PHONE)
        if not token:
            log_error("Failed to get auth token for silver buy test")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get initial silver_grams
        initial_silver = user.get("silver_grams", 0)
        log_info(f"Initial silver_grams: {initial_silver}")
        
        # Step 1: Get silver quote
        quote_response = requests.post(f"{BASE_URL}/quote/silver", json={"tenant": "vaultra"})
        
        if quote_response.status_code != 200:
            log_error(f"Silver quote API failed with status {quote_response.status_code}")
            log_error(f"Response: {quote_response.text}")
            return False
        
        quote_data = quote_response.json()
        quote_id = quote_data.get("id")
        
        if not quote_id:
            log_error(f"No quote_id in response: {quote_data}")
            return False
        
        log_success(f"Silver quote obtained: {quote_id}")
        log_info(f"Silver rate: Buy ₹{quote_data.get('buy')}, Sell ₹{quote_data.get('sell')}")
        
        # Step 2: Buy silver
        buy_payload = {
            "quote_id": quote_id,
            "mode": "rupees",
            "value": 500,
            "method": "mock"
        }
        
        buy_response = requests.post(f"{BASE_URL}/orders/buy-silver", json=buy_payload, headers=headers)
        
        if buy_response.status_code != 200:
            log_error(f"Silver buy API failed with status {buy_response.status_code}")
            log_error(f"Response: {buy_response.text}")
            return False
        
        buy_data = buy_response.json()
        
        # Verify response fields
        if buy_data.get("status") != "completed":
            log_error(f"Buy status not completed: {buy_data.get('status')}")
            return False
        
        if "grams" not in buy_data:
            log_error(f"'grams' field missing in buy response: {buy_data}")
            return False
        
        if "user" not in buy_data:
            log_error(f"'user' field missing in buy response: {buy_data}")
            return False
        
        # Verify silver_grams increased
        updated_user = buy_data.get("user", {})
        updated_silver = updated_user.get("silver_grams", 0)
        
        if updated_silver <= initial_silver:
            log_error(f"silver_grams did not increase. Initial: {initial_silver}, Updated: {updated_silver}")
            return False
        
        log_success("Silver buy working correctly")
        log_info(f"Bought {buy_data.get('grams')} grams of silver for ₹{buy_data.get('total')}")
        log_info(f"Updated silver_grams: {updated_silver} (increased by {updated_silver - initial_silver})")
        return True
        
    except Exception as e:
        log_error(f"Exception in silver buy test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_wallet_system():
    """Test 4: Wallet System - GET /api/wallet, POST /api/wallet/deposit, POST /api/wallet/withdraw"""
    print("\n" + "="*60)
    print("TEST 4: Wallet System")
    print("="*60)
    
    try:
        # Get auth token
        token, user = get_auth_token(TEST_PHONE)
        if not token:
            log_error("Failed to get auth token for wallet test")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 1: Get wallet info
        wallet_response = requests.get(f"{BASE_URL}/wallet", headers=headers)
        
        if wallet_response.status_code != 200:
            log_error(f"Wallet info API failed with status {wallet_response.status_code}")
            log_error(f"Response: {wallet_response.text}")
            return False
        
        wallet_data = wallet_response.json()
        
        # Check required fields
        required_fields = ["balance", "referral_balance", "transactions"]
        missing_fields = [f for f in required_fields if f not in wallet_data]
        
        if missing_fields:
            log_error(f"Missing wallet fields: {missing_fields}")
            log_error(f"Wallet data: {json.dumps(wallet_data, indent=2)}")
            return False
        
        initial_balance = wallet_data.get("balance", 0)
        log_success("Wallet info API working correctly")
        log_info(f"Initial balance: ₹{initial_balance}, Referral balance: ₹{wallet_data.get('referral_balance')}")
        
        # Step 2: Deposit to wallet
        deposit_response = requests.post(f"{BASE_URL}/wallet/deposit", 
                                        json={"amount": 1000}, 
                                        headers=headers)
        
        if deposit_response.status_code != 200:
            log_error(f"Wallet deposit API failed with status {deposit_response.status_code}")
            log_error(f"Response: {deposit_response.text}")
            return False
        
        deposit_data = deposit_response.json()
        
        if not deposit_data.get("ok"):
            log_error(f"Deposit did not return ok: {deposit_data}")
            return False
        
        new_balance = deposit_data.get("balance", 0)
        
        if new_balance != initial_balance + 1000:
            log_error(f"Balance not updated correctly. Expected {initial_balance + 1000}, got {new_balance}")
            return False
        
        log_success("Wallet deposit working correctly")
        log_info(f"Deposited ₹1000, new balance: ₹{new_balance}")
        
        # Step 3: Withdraw from wallet
        withdraw_response = requests.post(f"{BASE_URL}/wallet/withdraw", 
                                         json={"amount": 500}, 
                                         headers=headers)
        
        if withdraw_response.status_code != 200:
            log_error(f"Wallet withdraw API failed with status {withdraw_response.status_code}")
            log_error(f"Response: {withdraw_response.text}")
            return False
        
        withdraw_data = withdraw_response.json()
        
        if not withdraw_data.get("ok"):
            log_error(f"Withdraw did not return ok: {withdraw_data}")
            return False
        
        final_balance = withdraw_data.get("balance", 0)
        
        if final_balance != new_balance - 500:
            log_error(f"Balance not updated correctly after withdraw. Expected {new_balance - 500}, got {final_balance}")
            return False
        
        log_success("Wallet withdraw working correctly")
        log_info(f"Withdrew ₹500, final balance: ₹{final_balance}")
        
        # Step 4: Test withdraw with insufficient balance
        large_withdraw_response = requests.post(f"{BASE_URL}/wallet/withdraw", 
                                               json={"amount": final_balance + 1000}, 
                                               headers=headers)
        
        if large_withdraw_response.status_code != 400:
            log_error(f"Withdraw with insufficient balance should return 400, got {large_withdraw_response.status_code}")
            return False
        
        log_success("Wallet insufficient balance check working correctly")
        log_info("Withdraw with amount > balance correctly rejected with 400")
        
        return True
        
    except Exception as e:
        log_error(f"Exception in wallet test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_book_alert():
    """Test 5: Book Alert - POST /api/alerts/book"""
    print("\n" + "="*60)
    print("TEST 5: Book Alert")
    print("="*60)
    
    try:
        # Get auth token
        token, user = get_auth_token(TEST_PHONE)
        if not token:
            log_error("Failed to get auth token for book alert test")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create book alert
        alert_payload = {
            "target": 7000,
            "metal": "gold",
            "buy_amount": 1000,
            "tenant": "vaultra"
        }
        
        response = requests.post(f"{BASE_URL}/alerts/book", json=alert_payload, headers=headers)
        
        if response.status_code != 200:
            log_error(f"Book alert API failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Verify response fields
        required_fields = ["id", "alert_type", "target", "metal", "buy_amount", "status"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            log_error(f"Missing alert fields: {missing_fields}")
            log_error(f"Alert data: {json.dumps(data, indent=2)}")
            return False
        
        # Verify alert_type is "book"
        if data.get("alert_type") != "book":
            log_error(f"alert_type should be 'book', got: {data.get('alert_type')}")
            return False
        
        # Verify values
        if data.get("target") != 7000:
            log_error(f"target mismatch. Expected 7000, got: {data.get('target')}")
            return False
        
        if data.get("metal") != "gold":
            log_error(f"metal mismatch. Expected 'gold', got: {data.get('metal')}")
            return False
        
        if data.get("buy_amount") != 1000:
            log_error(f"buy_amount mismatch. Expected 1000, got: {data.get('buy_amount')}")
            return False
        
        log_success("Book alert working correctly")
        log_info(f"Alert created: ID {data.get('id')}, Target ₹{data.get('target')}, Buy Amount ₹{data.get('buy_amount')}")
        return True
        
    except Exception as e:
        log_error(f"Exception in book alert test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_notifications_api():
    """Test 6: Notifications API - GET /api/notifications and POST /api/notifications/mark-read"""
    print("\n" + "="*60)
    print("TEST 6: Notifications API")
    print("="*60)
    
    try:
        # Get auth token
        token, user = get_auth_token(TEST_PHONE)
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
        
        # Step 2: Mark all as read (only if there are unread notifications)
        if data['unread_count'] > 0:
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
        else:
            log_info("No unread notifications to mark as read, skipping mark-read test")
        
        return True
        
    except Exception as e:
        log_error(f"Exception in notifications test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_product_detail_api():
    """Test 7: Product Detail API - GET /api/products/{product_id}"""
    print("\n" + "="*60)
    print("TEST 7: Product Detail API")
    print("="*60)
    
    # Test with heritage-24k-necklace (product ID is "p1" in server.py)
    product_id = "p1"  # Heritage 24K Necklace
    
    try:
        response = requests.get(f"{BASE_URL}/products/{product_id}")
        
        if response.status_code != 200:
            log_error(f"Product detail API failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ["description", "features", "gold_value", "total_price"]
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
        
        log_success("Product detail API working correctly")
        log_info(f"Product: {data.get('name')}, Gold Value: ₹{data['gold_value']}, Total: ₹{data['total_price']}")
        log_info(f"Features count: {len(data['features'])}")
        return True
        
    except Exception as e:
        log_error(f"Exception in product detail test: {str(e)}")
        return False

def main():
    print("\n" + "="*60)
    print("VAULTRA DIGIGOLD - BACKEND API TESTS")
    print("Testing 7 New Backend Features")
    print("="*60)
    
    results = {
        "1. Multi-step Registration": test_multi_step_registration(),
        "2. Silver Price API": test_silver_price_api(),
        "3. Silver Buy": test_silver_buy(),
        "4. Wallet System": test_wallet_system(),
        "5. Book Alert": test_book_alert(),
        "6. Notifications API": test_notifications_api(),
        "7. Product Detail API": test_product_detail_api()
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
