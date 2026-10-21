#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Vaultra DigiGold
Tests ALL endpoints as requested in the review
"""

import requests
import json
import sys
import time

# Backend URL from frontend/.env
BASE_URL = "https://vaultra-gold.preview.emergentagent.com/api"

# Test credentials
DEMO_PHONE = "9876543210"
NEW_USER_PHONE = f"55550{int(time.time()) % 100000:05d}"

# Color codes
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

def log_test(msg):
    print(f"\n{BLUE}{'='*70}\n{msg}\n{'='*70}{RESET}")

def get_auth_token(phone, user_fields=None):
    """Get auth token for a phone number"""
    # Step 1: Request OTP
    response = requests.post(f"{BASE_URL}/auth/otp/request", json={"phone": phone})
    if response.status_code != 200:
        log_error(f"OTP request failed: {response.status_code} - {response.text}")
        return None, None
    
    data = response.json()
    challenge_id = data.get("challenge_id")
    demo_otp = data.get("demo_otp")
    
    # Step 2: Verify OTP
    verify_payload = {
        "challenge_id": challenge_id,
        "otp": demo_otp,
        "tenant": "vaultra"
    }
    
    if user_fields:
        verify_payload.update(user_fields)
    
    response = requests.post(f"{BASE_URL}/auth/otp/verify", json=verify_payload)
    if response.status_code != 200:
        log_error(f"OTP verify failed: {response.status_code} - {response.text}")
        return None, None
    
    data = response.json()
    return data.get("access_token"), data.get("user")

# ============================================================================
# TEST 1: Complete Signup Flow
# ============================================================================
def test_complete_signup_flow():
    log_test("TEST 1: Complete Signup Flow")
    
    try:
        phone = NEW_USER_PHONE
        log_info(f"Testing signup with phone: {phone}")
        
        # Step 1: Send OTP
        response = requests.post(f"{BASE_URL}/auth/otp/request", json={"phone": phone})
        
        if response.status_code != 200:
            log_error(f"Step 1 failed: OTP request returned {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        challenge_id = data.get("challenge_id")
        demo_otp = data.get("demo_otp")
        
        if not challenge_id or not demo_otp:
            log_error(f"Missing challenge_id or demo_otp: {data}")
            return False
        
        log_success(f"Step 1 PASS: OTP sent. challenge_id={challenge_id}, demo_otp={demo_otp}")
        
        # Step 2: Verify OTP
        verify_payload = {
            "challenge_id": challenge_id,
            "otp": demo_otp,
            "tenant": "vaultra"
        }
        
        response = requests.post(f"{BASE_URL}/auth/otp/verify", json=verify_payload)
        
        if response.status_code != 200:
            log_error(f"Step 2 failed: OTP verify returned {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        token = data.get("access_token")
        user = data.get("user")
        
        if not token or not user:
            log_error(f"Missing token or user data: {data}")
            return False
        
        log_success(f"Step 2 PASS: User authenticated. Token received, user_id={user.get('id')}")
        log_success(f"Complete signup flow working correctly")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 2: New User Registration with All Fields
# ============================================================================
def test_new_user_registration_with_fields():
    log_test("TEST 2: New User Registration with All Fields")
    
    try:
        phone = f"55551{int(time.time()) % 100000:05d}"
        log_info(f"Testing registration with phone: {phone}")
        
        # Step 1: Request OTP
        response = requests.post(f"{BASE_URL}/auth/otp/request", json={"phone": phone})
        
        if response.status_code != 200:
            log_error(f"OTP request failed: {response.status_code}")
            return False
        
        data = response.json()
        challenge_id = data.get("challenge_id")
        demo_otp = data.get("demo_otp")
        
        # Step 2: Verify with all fields
        verify_payload = {
            "challenge_id": challenge_id,
            "otp": demo_otp,
            "tenant": "vaultra",
            "first_name": "Test",
            "last_name": "User",
            "email": "test@demo.com",
            "dob": "01/01/1990",
            "gender": "Male"
        }
        
        response = requests.post(f"{BASE_URL}/auth/otp/verify", json=verify_payload)
        
        if response.status_code != 200:
            log_error(f"OTP verify failed: {response.status_code}")
            return False
        
        data = response.json()
        user = data.get("user", {})
        
        # Verify all fields
        checks = [
            ("first_name", "Test"),
            ("last_name", "User"),
            ("email", "test@demo.com"),
            ("gender", "Male")
        ]
        
        for field, expected in checks:
            actual = user.get(field)
            if actual != expected:
                log_error(f"{field} mismatch: expected '{expected}', got '{actual}'")
                return False
        
        log_success(f"All user fields correctly saved: {user.get('first_name')} {user.get('last_name')}, {user.get('email')}, {user.get('gender')}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 3: GET /api/price (with silver)
# ============================================================================
def test_price_api():
    log_test("TEST 3: GET /api/price (Gold + Silver)")
    
    try:
        response = requests.get(f"{BASE_URL}/price", params={"tenant": "vaultra"})
        
        if response.status_code != 200:
            log_error(f"Price API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        # Check gold fields
        gold_fields = ["buy", "sell", "change", "change_pct", "direction"]
        for field in gold_fields:
            if field not in data:
                log_error(f"Missing gold field: {field}")
                return False
        
        # Check silver object
        if "silver" not in data:
            log_error("Missing 'silver' object in response")
            return False
        
        silver = data["silver"]
        silver_fields = ["buy", "sell", "change", "change_pct", "direction"]
        for field in silver_fields:
            if field not in silver:
                log_error(f"Missing silver field: {field}")
                return False
        
        log_success(f"Gold: Buy ₹{data['buy']}, Sell ₹{data['sell']}, Direction: {data['direction']}")
        log_success(f"Silver: Buy ₹{silver['buy']}, Sell ₹{silver['sell']}, Direction: {silver['direction']}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 4: GET /api/products
# ============================================================================
def test_products_list():
    log_test("TEST 4: GET /api/products")
    
    try:
        response = requests.get(f"{BASE_URL}/products")
        
        if response.status_code != 200:
            log_error(f"Products API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        if not isinstance(data, list):
            log_error(f"Expected list, got {type(data)}")
            return False
        
        if len(data) == 0:
            log_error("Products list is empty")
            return False
        
        # Check first product has required fields
        product = data[0]
        required_fields = ["id", "name", "category", "grams", "making_charges"]
        for field in required_fields:
            if field not in product:
                log_error(f"Missing product field: {field}")
                return False
        
        log_success(f"Products list returned {len(data)} products")
        log_info(f"Sample product: {product['name']} ({product['grams']}g)")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 5: GET /api/products/{product_id}
# ============================================================================
def test_product_detail():
    log_test("TEST 5: GET /api/products/p1 (Product Detail)")
    
    try:
        response = requests.get(f"{BASE_URL}/products/p1")
        
        if response.status_code != 200:
            log_error(f"Product detail API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        required_fields = ["description", "features", "gold_value", "total_price", "live_rate"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        if not isinstance(data["features"], list) or len(data["features"]) == 0:
            log_error("Features should be a non-empty list")
            return False
        
        log_success(f"Product: {data.get('name')}, Gold Value: ₹{data['gold_value']}, Total: ₹{data['total_price']}")
        log_info(f"Features: {len(data['features'])} items")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 6: POST /api/quote (Gold Quote)
# ============================================================================
def test_gold_quote():
    log_test("TEST 6: POST /api/quote (Gold Quote)")
    
    try:
        response = requests.post(f"{BASE_URL}/quote", json={"tenant": "vaultra"})
        
        if response.status_code != 200:
            log_error(f"Quote API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        required_fields = ["id", "buy", "sell", "expires_at", "lock_seconds"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        log_success(f"Quote created: ID={data['id']}, Buy=₹{data['buy']}, Sell=₹{data['sell']}, Lock={data['lock_seconds']}s")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 7: POST /api/orders/buy (Gold Buy)
# ============================================================================
def test_gold_buy():
    log_test("TEST 7: POST /api/orders/buy (Gold Buy)")
    
    try:
        # Get auth token
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get quote
        quote_response = requests.post(f"{BASE_URL}/quote", json={"tenant": "vaultra"})
        if quote_response.status_code != 200:
            log_error("Failed to get quote")
            return False
        
        quote = quote_response.json()
        quote_id = quote.get("id")
        
        # Create order
        order_payload = {
            "quote_id": quote_id,
            "mode": "rupees",
            "value": 1000,
            "method": "mock"
        }
        
        order_response = requests.post(f"{BASE_URL}/orders/buy", json=order_payload, headers=headers)
        
        if order_response.status_code != 200:
            log_error(f"Order creation failed: {order_response.status_code}")
            log_error(f"Response: {order_response.text}")
            return False
        
        order = order_response.json()
        
        required_fields = ["id", "grams", "rate", "amount", "gst", "total", "status"]
        for field in required_fields:
            if field not in order:
                log_error(f"Missing order field: {field}")
                return False
        
        log_success(f"Order created: ID={order['id']}, Grams={order['grams']}, Total=₹{order['total']}, Status={order['status']}")
        
        # Mock confirm the order
        if order.get("provider") == "mock":
            confirm_response = requests.post(
                f"{BASE_URL}/orders/{order['id']}/mock-confirm",
                json={"method": "upi", "success": True},
                headers=headers
            )
            
            if confirm_response.status_code != 200:
                log_error(f"Mock confirm failed: {confirm_response.status_code}")
                return False
            
            confirm_data = confirm_response.json()
            if confirm_data.get("status") == "paid":
                log_success(f"Order confirmed and paid successfully")
        
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 8: POST /api/quote/silver (Silver Quote)
# ============================================================================
def test_silver_quote():
    log_test("TEST 8: POST /api/quote/silver (Silver Quote)")
    
    try:
        response = requests.post(f"{BASE_URL}/quote/silver", json={"tenant": "vaultra"})
        
        if response.status_code != 200:
            log_error(f"Silver quote API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        required_fields = ["id", "buy", "sell", "metal", "expires_at"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        if data.get("metal") != "silver":
            log_error(f"Metal should be 'silver', got: {data.get('metal')}")
            return False
        
        log_success(f"Silver quote: ID={data['id']}, Buy=₹{data['buy']}, Sell=₹{data['sell']}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 9: POST /api/orders/buy-silver (Silver Buy)
# ============================================================================
def test_silver_buy():
    log_test("TEST 9: POST /api/orders/buy-silver (Silver Buy)")
    
    try:
        # Get auth token
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        initial_silver = user.get("silver_grams", 0)
        
        # Get silver quote
        quote_response = requests.post(f"{BASE_URL}/quote/silver", json={"tenant": "vaultra"})
        if quote_response.status_code != 200:
            log_error("Failed to get silver quote")
            return False
        
        quote = quote_response.json()
        quote_id = quote.get("id")
        
        # Buy silver
        buy_payload = {
            "quote_id": quote_id,
            "mode": "rupees",
            "value": 500,
            "method": "mock"
        }
        
        buy_response = requests.post(f"{BASE_URL}/orders/buy-silver", json=buy_payload, headers=headers)
        
        if buy_response.status_code != 200:
            log_error(f"Silver buy failed: {buy_response.status_code}")
            log_error(f"Response: {buy_response.text}")
            return False
        
        data = buy_response.json()
        
        if data.get("status") != "completed":
            log_error(f"Status should be 'completed', got: {data.get('status')}")
            return False
        
        updated_user = data.get("user", {})
        updated_silver = updated_user.get("silver_grams", 0)
        
        if updated_silver <= initial_silver:
            log_error(f"Silver grams did not increase: {initial_silver} -> {updated_silver}")
            return False
        
        log_success(f"Silver buy successful: Bought {data.get('grams')}g for ₹{data.get('total')}")
        log_info(f"Silver grams: {initial_silver} -> {updated_silver}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 10: GET /api/wallet
# ============================================================================
def test_wallet_info():
    log_test("TEST 10: GET /api/wallet")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/wallet", headers=headers)
        
        if response.status_code != 200:
            log_error(f"Wallet API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        required_fields = ["balance", "referral_balance", "transactions"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        log_success(f"Wallet info: Balance=₹{data['balance']}, Referral=₹{data['referral_balance']}, Txns={len(data['transactions'])}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 11: POST /api/wallet/deposit
# ============================================================================
def test_wallet_deposit():
    log_test("TEST 11: POST /api/wallet/deposit")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get initial balance
        wallet_response = requests.get(f"{BASE_URL}/wallet", headers=headers)
        initial_balance = wallet_response.json().get("balance", 0)
        
        # Deposit
        deposit_response = requests.post(
            f"{BASE_URL}/wallet/deposit",
            json={"amount": 1000},
            headers=headers
        )
        
        if deposit_response.status_code != 200:
            log_error(f"Deposit failed: {deposit_response.status_code}")
            return False
        
        data = deposit_response.json()
        
        if not data.get("ok"):
            log_error("Deposit did not return ok")
            return False
        
        new_balance = data.get("balance", 0)
        
        if new_balance != initial_balance + 1000:
            log_error(f"Balance mismatch: expected {initial_balance + 1000}, got {new_balance}")
            return False
        
        log_success(f"Deposit successful: ₹{initial_balance} -> ₹{new_balance}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 12: POST /api/wallet/withdraw
# ============================================================================
def test_wallet_withdraw():
    log_test("TEST 12: POST /api/wallet/withdraw")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get initial balance
        wallet_response = requests.get(f"{BASE_URL}/wallet", headers=headers)
        initial_balance = wallet_response.json().get("balance", 0)
        
        if initial_balance < 500:
            log_info(f"Insufficient balance ({initial_balance}), depositing first...")
            requests.post(f"{BASE_URL}/wallet/deposit", json={"amount": 1000}, headers=headers)
            wallet_response = requests.get(f"{BASE_URL}/wallet", headers=headers)
            initial_balance = wallet_response.json().get("balance", 0)
        
        # Withdraw
        withdraw_response = requests.post(
            f"{BASE_URL}/wallet/withdraw",
            json={"amount": 500},
            headers=headers
        )
        
        if withdraw_response.status_code != 200:
            log_error(f"Withdraw failed: {withdraw_response.status_code}")
            return False
        
        data = withdraw_response.json()
        
        if not data.get("ok"):
            log_error("Withdraw did not return ok")
            return False
        
        new_balance = data.get("balance", 0)
        
        if new_balance != initial_balance - 500:
            log_error(f"Balance mismatch: expected {initial_balance - 500}, got {new_balance}")
            return False
        
        log_success(f"Withdraw successful: ₹{initial_balance} -> ₹{new_balance}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 13: GET /api/referral
# ============================================================================
def test_referral_info():
    log_test("TEST 13: GET /api/referral")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/referral", headers=headers)
        
        if response.status_code != 200:
            log_error(f"Referral API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        required_fields = ["referral_code", "referral_balance", "referral_count", "referrals"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        log_success(f"Referral info: Code={data['referral_code']}, Balance=₹{data['referral_balance']}, Count={data['referral_count']}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 14: GET /api/notifications
# ============================================================================
def test_notifications():
    log_test("TEST 14: GET /api/notifications")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/notifications", headers=headers)
        
        if response.status_code != 200:
            log_error(f"Notifications API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        required_fields = ["notifications", "unread_count"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        log_success(f"Notifications: Total={len(data['notifications'])}, Unread={data['unread_count']}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 15: GET /api/alerts
# ============================================================================
def test_alerts_list():
    log_test("TEST 15: GET /api/alerts")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/alerts", headers=headers)
        
        if response.status_code != 200:
            log_error(f"Alerts API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        if not isinstance(data, list):
            log_error(f"Expected list, got {type(data)}")
            return False
        
        log_success(f"Alerts list: {len(data)} alerts")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 16: POST /api/alerts (Price Alert)
# ============================================================================
def test_create_alert():
    log_test("TEST 16: POST /api/alerts (Price Alert)")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        alert_payload = {
            "target": 7000,
            "tenant": "vaultra"
        }
        
        response = requests.post(f"{BASE_URL}/alerts", json=alert_payload, headers=headers)
        
        if response.status_code != 200:
            log_error(f"Create alert failed: {response.status_code}")
            log_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        required_fields = ["id", "target", "status"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        log_success(f"Alert created: ID={data['id']}, Target=₹{data['target']}, Status={data['status']}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 17: POST /api/alerts/book (Book Alert)
# ============================================================================
def test_book_alert():
    log_test("TEST 17: POST /api/alerts/book (Book Alert)")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        alert_payload = {
            "target": 7000,
            "metal": "gold",
            "buy_amount": 1000,
            "tenant": "vaultra"
        }
        
        response = requests.post(f"{BASE_URL}/alerts/book", json=alert_payload, headers=headers)
        
        if response.status_code != 200:
            log_error(f"Book alert failed: {response.status_code}")
            return False
        
        data = response.json()
        
        required_fields = ["id", "alert_type", "target", "metal", "buy_amount"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        if data.get("alert_type") != "book":
            log_error(f"alert_type should be 'book', got: {data.get('alert_type')}")
            return False
        
        log_success(f"Book alert created: ID={data['id']}, Target=₹{data['target']}, Buy=₹{data['buy_amount']}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 18: GET /api/vault
# ============================================================================
def test_vault():
    log_test("TEST 18: GET /api/vault")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/vault", params={"tenant": "vaultra"}, headers=headers)
        
        if response.status_code != 200:
            log_error(f"Vault API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        required_fields = ["user", "buy_rate", "sell_rate", "current_value", "unrealized_pnl"]
        for field in required_fields:
            if field not in data:
                log_error(f"Missing field: {field}")
                return False
        
        log_success(f"Vault: Gold={data['user']['gold_grams']}g, Value=₹{data['current_value']}, PnL=₹{data['unrealized_pnl']}")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 19: GET /api/goals
# ============================================================================
def test_goals():
    log_test("TEST 19: GET /api/goals")
    
    try:
        token, user = get_auth_token(DEMO_PHONE)
        if not token:
            log_error("Failed to get auth token")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/goals", headers=headers)
        
        if response.status_code != 200:
            log_error(f"Goals API failed: {response.status_code}")
            return False
        
        data = response.json()
        
        if not isinstance(data, list):
            log_error(f"Expected list, got {type(data)}")
            return False
        
        log_success(f"Goals list: {len(data)} goals")
        return True
        
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print(f"\n{BLUE}{'='*70}")
    print("VAULTRA DIGIGOLD - COMPREHENSIVE BACKEND API TESTS")
    print("Testing ALL endpoints as requested")
    print(f"{'='*70}{RESET}\n")
    
    tests = [
        ("1. Complete Signup Flow", test_complete_signup_flow),
        ("2. New User Registration (All Fields)", test_new_user_registration_with_fields),
        ("3. GET /api/price (Gold + Silver)", test_price_api),
        ("4. GET /api/products", test_products_list),
        ("5. GET /api/products/{id}", test_product_detail),
        ("6. POST /api/quote (Gold)", test_gold_quote),
        ("7. POST /api/orders/buy (Gold)", test_gold_buy),
        ("8. POST /api/quote/silver", test_silver_quote),
        ("9. POST /api/orders/buy-silver", test_silver_buy),
        ("10. GET /api/wallet", test_wallet_info),
        ("11. POST /api/wallet/deposit", test_wallet_deposit),
        ("12. POST /api/wallet/withdraw", test_wallet_withdraw),
        ("13. GET /api/referral", test_referral_info),
        ("14. GET /api/notifications", test_notifications),
        ("15. GET /api/alerts", test_alerts_list),
        ("16. POST /api/alerts", test_create_alert),
        ("17. POST /api/alerts/book", test_book_alert),
        ("18. GET /api/vault", test_vault),
        ("19. GET /api/goals", test_goals),
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            log_error(f"Test {test_name} crashed: {str(e)}")
            results[test_name] = False
    
    # Summary
    print(f"\n{BLUE}{'='*70}")
    print("TEST SUMMARY")
    print(f"{'='*70}{RESET}\n")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{test_name}: {status}")
    
    print(f"\n{BLUE}Total: {passed}/{total} tests passed{RESET}")
    
    if passed == total:
        print(f"\n{GREEN}✓ ALL BACKEND TESTS PASSED!{RESET}\n")
        return 0
    else:
        print(f"\n{RED}✗ SOME TESTS FAILED{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
