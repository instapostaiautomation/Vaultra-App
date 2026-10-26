#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Vaultra DigiGold v2.0
PostgreSQL + SQLAlchemy + Multi-tenant Architecture
"""

import requests
import json
import sys
import time
from typing import Optional, Tuple

# Backend URL
BASE_URL = "https://vaultra-gold.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
MASTER_ADMIN = {"username": "admin", "password": "admin123"}
JEWELLER_ADMIN = {"email": "sharma@vaultra.in", "password": "jeweller123"}
EXISTING_CUSTOMER_PHONE = "9876543210"
NEW_CUSTOMER_PHONE = f"9999{int(time.time()) % 1000000:06d}"
GIFT_RECIPIENT_PHONE = f"9888{int(time.time()) % 1000000:06d}"
DEFAULT_JEWELLER_ID = "demo-jeweller-001"

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

def log_section(msg):
    print(f"\n{BLUE}{'='*70}\n{msg}\n{'='*70}{RESET}")

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_customer_token(phone: str, jeweller_id: str = DEFAULT_JEWELLER_ID, 
                       register_fields: Optional[dict] = None) -> Tuple[Optional[str], Optional[dict]]:
    """Get customer auth token via OTP flow"""
    try:
        # Step 1: Request OTP
        resp = requests.post(f"{BASE_URL}/auth/otp/request", 
                            json={"phone": phone, "jeweller_id": jeweller_id})
        if resp.status_code != 200:
            log_error(f"OTP request failed: {resp.status_code} - {resp.text}")
            return None, None
        
        data = resp.json()
        challenge_id = data.get("challenge_id")
        demo_otp = data.get("demo_otp")
        
        if not challenge_id or not demo_otp:
            log_error(f"Missing challenge_id or demo_otp: {data}")
            return None, None
        
        # Step 2: Verify OTP
        verify_payload = {
            "challenge_id": challenge_id,
            "otp": demo_otp,
            "jeweller_id": jeweller_id
        }
        
        if register_fields:
            verify_payload.update(register_fields)
        
        resp = requests.post(f"{BASE_URL}/auth/otp/verify", json=verify_payload)
        if resp.status_code != 200:
            log_error(f"OTP verify failed: {resp.status_code} - {resp.text}")
            return None, None
        
        data = resp.json()
        return data.get("access_token"), data.get("user")
    
    except Exception as e:
        log_error(f"Exception in get_customer_token: {e}")
        return None, None

def get_master_token() -> Optional[str]:
    """Get master admin token"""
    try:
        resp = requests.post(f"{BASE_URL}/master/login", json=MASTER_ADMIN)
        if resp.status_code != 200:
            log_error(f"Master login failed: {resp.status_code} - {resp.text}")
            return None
        return resp.json().get("access_token")
    except Exception as e:
        log_error(f"Exception in get_master_token: {e}")
        return None

def get_jeweller_token() -> Optional[str]:
    """Get jeweller admin token"""
    try:
        resp = requests.post(f"{BASE_URL}/jeweller/login", json=JEWELLER_ADMIN)
        if resp.status_code != 200:
            log_error(f"Jeweller login failed: {resp.status_code} - {resp.text}")
            return None
        return resp.json().get("access_token")
    except Exception as e:
        log_error(f"Exception in get_jeweller_token: {e}")
        return None

# ═══════════════════════════════════════════════════════════════════════════════
# TEST FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def test_public_apis():
    """Test public APIs: health, price, products, jewellers list"""
    log_section("TEST 1: Public APIs")
    
    try:
        # Health check
        resp = requests.get(f"{BASE_URL}/health")
        assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
        data = resp.json()
        assert data.get("status") == "ok", f"Health status not ok: {data}"
        assert data.get("db") == "postgresql", f"DB should be postgresql: {data}"
        log_success("Health check passed")
        
        # Price API
        resp = requests.get(f"{BASE_URL}/price")
        assert resp.status_code == 200, f"Price API failed: {resp.status_code}"
        data = resp.json()
        assert "buy" in data and "sell" in data, f"Missing buy/sell in price: {data}"
        assert "silver" in data, f"Missing silver in price: {data}"
        assert "buy" in data["silver"], f"Missing silver.buy: {data}"
        log_success(f"Price API passed - Gold: ₹{data['buy']}, Silver: ₹{data['silver']['buy']}")
        
        # Products list
        resp = requests.get(f"{BASE_URL}/products")
        assert resp.status_code == 200, f"Products API failed: {resp.status_code}"
        products = resp.json()
        assert isinstance(products, list), f"Products should be list: {type(products)}"
        assert len(products) > 0, "Products list is empty"
        log_success(f"Products API passed - {len(products)} products found")
        
        # Product detail
        if products:
            product_id = products[0]["id"]
            resp = requests.get(f"{BASE_URL}/products/{product_id}")
            assert resp.status_code == 200, f"Product detail failed: {resp.status_code}"
            product = resp.json()
            assert "features" in product, f"Missing features in product: {product}"
            assert isinstance(product["features"], list), "Features should be list"
            log_success(f"Product detail passed - {product.get('name')}")
        
        # Jewellers list
        resp = requests.get(f"{BASE_URL}/jewellers/list")
        assert resp.status_code == 200, f"Jewellers list failed: {resp.status_code}"
        jewellers = resp.json()
        assert isinstance(jewellers, list), f"Jewellers should be list: {type(jewellers)}"
        assert len(jewellers) > 0, "Jewellers list is empty"
        log_success(f"Jewellers list passed - {len(jewellers)} jewellers found")
        
        return True
    
    except AssertionError as e:
        log_error(f"Public APIs test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in public APIs test: {e}")
        return False

def test_customer_auth_existing():
    """Test customer auth with existing user"""
    log_section("TEST 2: Customer Auth - Existing User")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        assert user is not None, "Failed to get user data"
        assert user.get("phone") == EXISTING_CUSTOMER_PHONE, f"Phone mismatch: {user.get('phone')}"
        assert "wallet_id" in user, f"Missing wallet_id: {user}"
        assert "gold_grams" in user, f"Missing gold_grams: {user}"
        
        log_success(f"Existing user auth passed - {user.get('name')}, Wallet: {user.get('wallet_id')}")
        return True
    
    except AssertionError as e:
        log_error(f"Customer auth test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in customer auth test: {e}")
        return False

def test_customer_registration():
    """Test new customer registration with full fields"""
    log_section("TEST 3: Customer Registration - New User")
    
    try:
        register_fields = {
            "first_name": "Arjun",
            "last_name": "Mehta",
            "email": "arjun.mehta@example.com",
            "dob": "1992-03-15",
            "gender": "male",
            "referral_code": ""
        }
        
        token, user = get_customer_token(NEW_CUSTOMER_PHONE, register_fields=register_fields)
        assert token is not None, "Failed to get auth token for new user"
        assert user is not None, "Failed to get user data for new user"
        assert user.get("first_name") == "Arjun", f"First name mismatch: {user.get('first_name')}"
        assert user.get("last_name") == "Mehta", f"Last name mismatch: {user.get('last_name')}"
        assert user.get("email") == "arjun.mehta@example.com", f"Email mismatch: {user.get('email')}"
        assert user.get("gender") == "male", f"Gender mismatch: {user.get('gender')}"
        assert "wallet_id" in user, f"Missing wallet_id: {user}"
        assert "referral_code" in user, f"Missing referral_code: {user}"
        
        log_success(f"New user registration passed - {user.get('name')}, Wallet: {user.get('wallet_id')}")
        return True
    
    except AssertionError as e:
        log_error(f"Customer registration test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in customer registration test: {e}")
        return False

def test_gold_buying_flow():
    """Test complete gold buying flow: quote → buy → mock-confirm"""
    log_section("TEST 4: Gold Buying Flow (3 steps)")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        initial_gold = user.get("gold_grams", 0)
        
        # Step 1: Get quote
        resp = requests.post(f"{BASE_URL}/quote", json={"metal": "gold"}, headers=headers)
        assert resp.status_code == 200, f"Quote failed: {resp.status_code} - {resp.text}"
        quote = resp.json()
        assert "id" in quote, f"Missing quote id: {quote}"
        assert "buy" in quote, f"Missing buy price: {quote}"
        quote_id = quote["id"]
        log_success(f"Quote obtained - ID: {quote_id}, Buy: ₹{quote['buy']}")
        
        # Step 2: Create buy order
        buy_payload = {
            "quote_id": quote_id,
            "mode": "rupees",
            "value": 1000,
            "method": "upi"
        }
        resp = requests.post(f"{BASE_URL}/orders/buy", json=buy_payload, headers=headers)
        assert resp.status_code == 200, f"Buy order failed: {resp.status_code} - {resp.text}"
        order = resp.json()
        assert "id" in order, f"Missing order id: {order}"
        assert order.get("status") == "created", f"Order status should be created: {order}"
        order_id = order["id"]
        log_success(f"Buy order created - ID: {order_id}, Grams: {order.get('grams')}")
        
        # Step 3: Mock confirm payment
        confirm_payload = {"method": "upi", "success": True}
        resp = requests.post(f"{BASE_URL}/orders/{order_id}/mock-confirm", 
                           json=confirm_payload, headers=headers)
        assert resp.status_code == 200, f"Mock confirm failed: {resp.status_code} - {resp.text}"
        result = resp.json()
        assert result.get("status") == "paid", f"Status should be paid: {result}"
        assert "transaction" in result, f"Missing transaction: {result}"
        assert "user" in result, f"Missing user: {result}"
        
        updated_user = result["user"]
        updated_gold = updated_user.get("gold_grams", 0)
        assert updated_gold > initial_gold, f"Gold not credited: {initial_gold} -> {updated_gold}"
        
        log_success(f"Payment confirmed - Gold: {initial_gold}g → {updated_gold}g")
        return True
    
    except AssertionError as e:
        log_error(f"Gold buying flow test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in gold buying flow test: {e}")
        return False

def test_pool_accumulator():
    """Test pool accumulator tracking"""
    log_section("TEST 5: Pool Accumulator")
    
    try:
        master_token = get_master_token()
        assert master_token is not None, "Failed to get master token"
        
        headers = {"Authorization": f"Bearer {master_token}"}
        
        # Get pool status
        resp = requests.get(f"{BASE_URL}/master/pool", headers=headers)
        assert resp.status_code == 200, f"Pool API failed: {resp.status_code} - {resp.text}"
        pools = resp.json()
        assert isinstance(pools, list), f"Pools should be list: {type(pools)}"
        assert len(pools) > 0, "No pools found"
        
        current_pool = pools[0]
        assert "total_grams" in current_pool, f"Missing total_grams: {current_pool}"
        assert "threshold" in current_pool, f"Missing threshold: {current_pool}"
        assert "status" in current_pool, f"Missing status: {current_pool}"
        
        log_success(f"Pool accumulator passed - Current: {current_pool['total_grams']}g / {current_pool['threshold']}g, Status: {current_pool['status']}")
        return True
    
    except AssertionError as e:
        log_error(f"Pool accumulator test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in pool accumulator test: {e}")
        return False

def test_bifurcation_invoices():
    """Test bifurcation invoices"""
    log_section("TEST 6: Bifurcation Invoices")
    
    try:
        master_token = get_master_token()
        assert master_token is not None, "Failed to get master token"
        
        headers = {"Authorization": f"Bearer {master_token}"}
        
        resp = requests.get(f"{BASE_URL}/master/bifurcation-invoices", headers=headers)
        assert resp.status_code == 200, f"Bifurcation invoices failed: {resp.status_code} - {resp.text}"
        invoices = resp.json()
        assert isinstance(invoices, list), f"Invoices should be list: {type(invoices)}"
        
        log_success(f"Bifurcation invoices passed - {len(invoices)} invoices found")
        
        if len(invoices) > 0:
            invoice = invoices[0]
            assert "details" in invoice, f"Missing details: {invoice}"
            assert "total_grams" in invoice, f"Missing total_grams: {invoice}"
            log_info(f"Latest invoice: {invoice['total_grams']}g, {len(invoice.get('details', []))} entries")
        
        return True
    
    except AssertionError as e:
        log_error(f"Bifurcation invoices test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in bifurcation invoices test: {e}")
        return False

def test_master_admin_apis():
    """Test master admin APIs"""
    log_section("TEST 7: Master Admin APIs")
    
    try:
        master_token = get_master_token()
        assert master_token is not None, "Failed to get master token"
        
        headers = {"Authorization": f"Bearer {master_token}"}
        
        # Dashboard
        resp = requests.get(f"{BASE_URL}/master/dashboard", headers=headers)
        assert resp.status_code == 200, f"Dashboard failed: {resp.status_code} - {resp.text}"
        dashboard = resp.json()
        assert "jewellers" in dashboard, f"Missing jewellers count: {dashboard}"
        assert "customers" in dashboard, f"Missing customers count: {dashboard}"
        assert "total_grams" in dashboard, f"Missing total_grams: {dashboard}"
        assert "pool" in dashboard, f"Missing pool: {dashboard}"
        log_success(f"Dashboard passed - Jewellers: {dashboard['jewellers']}, Customers: {dashboard['customers']}, Gold: {dashboard['total_grams']}g")
        
        # Jewellers list
        resp = requests.get(f"{BASE_URL}/master/jewellers", headers=headers)
        assert resp.status_code == 200, f"Jewellers list failed: {resp.status_code} - {resp.text}"
        jewellers = resp.json()
        assert isinstance(jewellers, list), f"Jewellers should be list: {type(jewellers)}"
        assert len(jewellers) > 0, "No jewellers found"
        log_success(f"Jewellers list passed - {len(jewellers)} jewellers")
        
        # Transactions
        resp = requests.get(f"{BASE_URL}/master/transactions", headers=headers)
        assert resp.status_code == 200, f"Transactions failed: {resp.status_code} - {resp.text}"
        txns = resp.json()
        assert isinstance(txns, list), f"Transactions should be list: {type(txns)}"
        log_success(f"Transactions passed - {len(txns)} transactions")
        
        return True
    
    except AssertionError as e:
        log_error(f"Master admin APIs test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in master admin APIs test: {e}")
        return False

def test_jeweller_onboarding():
    """Test jeweller onboarding by master admin"""
    log_section("TEST 8: Jeweller Onboarding")
    
    try:
        master_token = get_master_token()
        assert master_token is not None, "Failed to get master token"
        
        headers = {"Authorization": f"Bearer {master_token}"}
        
        unique_id = int(time.time()) % 1000000
        onboard_payload = {
            "business_name": f"Test Jewellers {unique_id}",
            "owner_name": "Test Owner",
            "phone": f"9111{unique_id:06d}",
            "email": f"test{unique_id}@jeweller.com",
            "password": "test123",
            "city": "Mumbai",
            "state": "Maharashtra",
            "address": "Test Address",
            "pincode": "400001"
        }
        
        resp = requests.post(f"{BASE_URL}/master/jewellers", json=onboard_payload, headers=headers)
        assert resp.status_code == 200, f"Jeweller onboarding failed: {resp.status_code} - {resp.text}"
        jeweller = resp.json()
        assert "id" in jeweller, f"Missing jeweller id: {jeweller}"
        assert jeweller.get("business_name") == onboard_payload["business_name"], "Business name mismatch"
        
        log_success(f"Jeweller onboarding passed - {jeweller.get('business_name')}, ID: {jeweller.get('id')}")
        return True
    
    except AssertionError as e:
        log_error(f"Jeweller onboarding test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in jeweller onboarding test: {e}")
        return False

def test_jeweller_admin_apis():
    """Test jeweller admin APIs"""
    log_section("TEST 9: Jeweller Admin APIs")
    
    try:
        jeweller_token = get_jeweller_token()
        assert jeweller_token is not None, "Failed to get jeweller token"
        
        headers = {"Authorization": f"Bearer {jeweller_token}"}
        
        # Dashboard
        resp = requests.get(f"{BASE_URL}/jeweller/dashboard", headers=headers)
        assert resp.status_code == 200, f"Dashboard failed: {resp.status_code} - {resp.text}"
        dashboard = resp.json()
        assert "customers" in dashboard, f"Missing customers: {dashboard}"
        assert "total_grams" in dashboard, f"Missing total_grams: {dashboard}"
        log_success(f"Dashboard passed - Customers: {dashboard['customers']}, Gold: {dashboard['total_grams']}g")
        
        # Customers list
        resp = requests.get(f"{BASE_URL}/jeweller/customers", headers=headers)
        assert resp.status_code == 200, f"Customers list failed: {resp.status_code} - {resp.text}"
        customers = resp.json()
        assert isinstance(customers, list), f"Customers should be list: {type(customers)}"
        log_success(f"Customers list passed - {len(customers)} customers")
        
        # Customer lookup by wallet_id
        if customers:
            wallet_id = customers[0].get("wallet_id")
            resp = requests.get(f"{BASE_URL}/jeweller/customers/lookup", 
                              params={"wallet_id": wallet_id}, headers=headers)
            assert resp.status_code == 200, f"Lookup failed: {resp.status_code} - {resp.text}"
            lookup = resp.json()
            assert lookup.get("found") == True, f"Customer not found: {lookup}"
            log_success(f"Customer lookup passed - Wallet: {wallet_id}")
        
        # Transactions
        resp = requests.get(f"{BASE_URL}/jeweller/transactions", headers=headers)
        assert resp.status_code == 200, f"Transactions failed: {resp.status_code} - {resp.text}"
        txns = resp.json()
        assert isinstance(txns, list), f"Transactions should be list: {type(txns)}"
        log_success(f"Transactions passed - {len(txns)} transactions")
        
        return True
    
    except AssertionError as e:
        log_error(f"Jeweller admin APIs test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in jeweller admin APIs test: {e}")
        return False

def test_redemption_flow():
    """Test redemption approval by jeweller"""
    log_section("TEST 10: Redemption Flow")
    
    try:
        # Get customer with gold
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get customer token"
        
        wallet_id = user.get("wallet_id")
        gold_grams = user.get("gold_grams", 0)
        
        if gold_grams < 0.1:
            log_info(f"Customer has insufficient gold ({gold_grams}g), skipping redemption test")
            return True
        
        # Jeweller approves redemption
        jeweller_token = get_jeweller_token()
        assert jeweller_token is not None, "Failed to get jeweller token"
        
        headers = {"Authorization": f"Bearer {jeweller_token}"}
        
        redemption_payload = {
            "wallet_id": wallet_id,
            "grams": 0.05,
            "item": "Physical Gold Coin",
            "note": "Test redemption"
        }
        
        resp = requests.post(f"{BASE_URL}/jeweller/redemption/approve", 
                           json=redemption_payload, headers=headers)
        assert resp.status_code == 200, f"Redemption failed: {resp.status_code} - {resp.text}"
        result = resp.json()
        assert result.get("ok") == True, f"Redemption not ok: {result}"
        assert "transaction" in result, f"Missing transaction: {result}"
        assert "customer" in result, f"Missing customer: {result}"
        
        updated_customer = result["customer"]
        updated_gold = updated_customer.get("gold_grams", 0)
        assert updated_gold < gold_grams, f"Gold not deducted: {gold_grams} -> {updated_gold}"
        
        log_success(f"Redemption passed - {redemption_payload['grams']}g redeemed, Gold: {gold_grams}g → {updated_gold}g")
        return True
    
    except AssertionError as e:
        log_error(f"Redemption flow test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in redemption flow test: {e}")
        return False

def test_customer_vault_apis():
    """Test customer vault and transaction APIs"""
    log_section("TEST 11: Customer Vault & Transactions")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Vault
        resp = requests.get(f"{BASE_URL}/vault", headers=headers)
        assert resp.status_code == 200, f"Vault failed: {resp.status_code} - {resp.text}"
        vault = resp.json()
        assert "user" in vault, f"Missing user: {vault}"
        assert "current_value" in vault, f"Missing current_value: {vault}"
        assert "unrealized_pnl" in vault, f"Missing unrealized_pnl: {vault}"
        log_success(f"Vault passed - Value: ₹{vault['current_value']}, PnL: ₹{vault['unrealized_pnl']}")
        
        # Transactions
        resp = requests.get(f"{BASE_URL}/transactions", headers=headers)
        assert resp.status_code == 200, f"Transactions failed: {resp.status_code} - {resp.text}"
        txns = resp.json()
        assert isinstance(txns, list), f"Transactions should be list: {type(txns)}"
        log_success(f"Transactions passed - {len(txns)} transactions")
        
        return True
    
    except AssertionError as e:
        log_error(f"Customer vault APIs test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in customer vault APIs test: {e}")
        return False

def test_wallet_system():
    """Test wallet deposit/withdraw"""
    log_section("TEST 12: Wallet System")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get wallet info
        resp = requests.get(f"{BASE_URL}/wallet", headers=headers)
        assert resp.status_code == 200, f"Wallet info failed: {resp.status_code} - {resp.text}"
        wallet = resp.json()
        assert "balance" in wallet, f"Missing balance: {wallet}"
        assert "referral_balance" in wallet, f"Missing referral_balance: {wallet}"
        initial_balance = wallet["balance"]
        log_success(f"Wallet info passed - Balance: ₹{initial_balance}")
        
        # Deposit
        resp = requests.post(f"{BASE_URL}/wallet/deposit", 
                           json={"amount": 500}, headers=headers)
        assert resp.status_code == 200, f"Deposit failed: {resp.status_code} - {resp.text}"
        result = resp.json()
        assert result.get("ok") == True, f"Deposit not ok: {result}"
        new_balance = result.get("balance", 0)
        assert new_balance == initial_balance + 500, f"Balance mismatch: {initial_balance} + 500 != {new_balance}"
        log_success(f"Deposit passed - ₹{initial_balance} → ₹{new_balance}")
        
        # Withdraw
        resp = requests.post(f"{BASE_URL}/wallet/withdraw", 
                           json={"amount": 200}, headers=headers)
        assert resp.status_code == 200, f"Withdraw failed: {resp.status_code} - {resp.text}"
        result = resp.json()
        assert result.get("ok") == True, f"Withdraw not ok: {result}"
        final_balance = result.get("balance", 0)
        assert final_balance == new_balance - 200, f"Balance mismatch: {new_balance} - 200 != {final_balance}"
        log_success(f"Withdraw passed - ₹{new_balance} → ₹{final_balance}")
        
        return True
    
    except AssertionError as e:
        log_error(f"Wallet system test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in wallet system test: {e}")
        return False

def test_sip_apis():
    """Test SIP creation and management"""
    log_section("TEST 13: SIP APIs")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create SIP
        sip_payload = {"amount": 500, "frequency": "monthly"}
        resp = requests.post(f"{BASE_URL}/sips", json=sip_payload, headers=headers)
        assert resp.status_code == 200, f"SIP creation failed: {resp.status_code} - {resp.text}"
        sip = resp.json()
        assert "id" in sip, f"Missing SIP id: {sip}"
        assert sip.get("status") == "active", f"SIP status should be active: {sip}"
        sip_id = sip["id"]
        log_success(f"SIP created - ID: {sip_id}, Amount: ₹{sip.get('amount')}, Frequency: {sip.get('frequency')}")
        
        # List SIPs
        resp = requests.get(f"{BASE_URL}/sips", headers=headers)
        assert resp.status_code == 200, f"SIP list failed: {resp.status_code} - {resp.text}"
        sips = resp.json()
        assert isinstance(sips, list), f"SIPs should be list: {type(sips)}"
        log_success(f"SIP list passed - {len(sips)} SIPs")
        
        # Toggle SIP
        resp = requests.post(f"{BASE_URL}/sips/{sip_id}/toggle", headers=headers)
        assert resp.status_code == 200, f"SIP toggle failed: {resp.status_code} - {resp.text}"
        result = resp.json()
        assert result.get("status") == "paused", f"SIP should be paused: {result}"
        log_success(f"SIP toggled to paused")
        
        # Run SIP
        resp = requests.post(f"{BASE_URL}/sips/{sip_id}/toggle", headers=headers)  # Toggle back to active
        assert resp.status_code == 200, "Failed to toggle SIP back to active"
        
        resp = requests.post(f"{BASE_URL}/sips/{sip_id}/run", headers=headers)
        assert resp.status_code == 200, f"SIP run failed: {resp.status_code} - {resp.text}"
        txn = resp.json()
        assert txn.get("type") == "sip", f"Transaction type should be sip: {txn}"
        log_success(f"SIP run passed - Transaction: {txn.get('id')}")
        
        return True
    
    except AssertionError as e:
        log_error(f"SIP APIs test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in SIP APIs test: {e}")
        return False

def test_gift_gold():
    """Test gold gifting"""
    log_section("TEST 14: Gift Gold")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        gold_grams = user.get("gold_grams", 0)
        if gold_grams < 0.01:
            log_info(f"Customer has insufficient gold ({gold_grams}g), skipping gift test")
            return True
        
        headers = {"Authorization": f"Bearer {token}"}
        
        gift_payload = {
            "phone": GIFT_RECIPIENT_PHONE,
            "mode": "rupees",
            "value": 500,
            "theme": "diwali",
            "message": "Happy Diwali!"
        }
        
        resp = requests.post(f"{BASE_URL}/gifts", json=gift_payload, headers=headers)
        assert resp.status_code == 200, f"Gift failed: {resp.status_code} - {resp.text}"
        result = resp.json()
        assert "id" in result, f"Missing gift id: {result}"
        assert "grams" in result, f"Missing grams: {result}"
        log_success(f"Gift sent - {result.get('grams')}g to {gift_payload['phone']}")
        
        return True
    
    except AssertionError as e:
        log_error(f"Gift gold test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in gift gold test: {e}")
        return False

def test_alerts_apis():
    """Test alerts creation and management"""
    log_section("TEST 15: Alerts APIs")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create alert
        alert_payload = {
            "target": 7000,
            "metal": "gold",
            "alert_type": "alert"
        }
        resp = requests.post(f"{BASE_URL}/alerts", json=alert_payload, headers=headers)
        assert resp.status_code == 200, f"Alert creation failed: {resp.status_code} - {resp.text}"
        alert = resp.json()
        assert "id" in alert, f"Missing alert id: {alert}"
        alert_id = alert["id"]
        log_success(f"Alert created - ID: {alert_id}, Target: ₹{alert.get('target')}")
        
        # Create book alert
        book_payload = {
            "target": 7200,
            "metal": "gold",
            "alert_type": "book",
            "buy_amount": 1000
        }
        resp = requests.post(f"{BASE_URL}/alerts", json=book_payload, headers=headers)
        assert resp.status_code == 200, f"Book alert creation failed: {resp.status_code} - {resp.text}"
        book = resp.json()
        assert book.get("alert_type") == "book", f"Alert type should be book: {book}"
        log_success(f"Book alert created - Target: ₹{book.get('target')}, Buy: ₹{book.get('buy_amount')}")
        
        # List alerts
        resp = requests.get(f"{BASE_URL}/alerts", headers=headers)
        assert resp.status_code == 200, f"Alerts list failed: {resp.status_code} - {resp.text}"
        alerts = resp.json()
        assert isinstance(alerts, list), f"Alerts should be list: {type(alerts)}"
        log_success(f"Alerts list passed - {len(alerts)} alerts")
        
        return True
    
    except AssertionError as e:
        log_error(f"Alerts APIs test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in alerts APIs test: {e}")
        return False

def test_goals_apis():
    """Test goals creation and management"""
    log_section("TEST 16: Goals APIs")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create goal
        goal_payload = {
            "name": "Wedding Gold",
            "occasion": "wedding",
            "target_grams": 10,
            "months": 12
        }
        resp = requests.post(f"{BASE_URL}/goals", json=goal_payload, headers=headers)
        assert resp.status_code == 200, f"Goal creation failed: {resp.status_code} - {resp.text}"
        goal = resp.json()
        assert "id" in goal, f"Missing goal id: {goal}"
        log_success(f"Goal created - {goal.get('name')}, Target: {goal.get('target_grams')}g")
        
        # List goals
        resp = requests.get(f"{BASE_URL}/goals", headers=headers)
        assert resp.status_code == 200, f"Goals list failed: {resp.status_code} - {resp.text}"
        goals = resp.json()
        assert isinstance(goals, list), f"Goals should be list: {type(goals)}"
        log_success(f"Goals list passed - {len(goals)} goals")
        
        return True
    
    except AssertionError as e:
        log_error(f"Goals APIs test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in goals APIs test: {e}")
        return False

def test_notifications_apis():
    """Test notifications"""
    log_section("TEST 17: Notifications APIs")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get notifications
        resp = requests.get(f"{BASE_URL}/notifications", headers=headers)
        assert resp.status_code == 200, f"Notifications failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "notifications" in data, f"Missing notifications: {data}"
        assert "unread_count" in data, f"Missing unread_count: {data}"
        log_success(f"Notifications passed - {len(data['notifications'])} notifications, {data['unread_count']} unread")
        
        # Mark as read
        if data["unread_count"] > 0:
            resp = requests.post(f"{BASE_URL}/notifications/mark-read", headers=headers)
            assert resp.status_code == 200, f"Mark-read failed: {resp.status_code} - {resp.text}"
            result = resp.json()
            assert result.get("ok") == True, f"Mark-read not ok: {result}"
            log_success("Notifications marked as read")
        
        return True
    
    except AssertionError as e:
        log_error(f"Notifications APIs test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in notifications APIs test: {e}")
        return False

def test_referral_system():
    """Test referral system"""
    log_section("TEST 18: Referral System")
    
    try:
        token, user = get_customer_token(EXISTING_CUSTOMER_PHONE)
        assert token is not None, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get referral info
        resp = requests.get(f"{BASE_URL}/referral", headers=headers)
        assert resp.status_code == 200, f"Referral info failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "referral_code" in data, f"Missing referral_code: {data}"
        assert "referral_balance" in data, f"Missing referral_balance: {data}"
        assert "referral_count" in data, f"Missing referral_count: {data}"
        log_success(f"Referral info passed - Code: {data['referral_code']}, Balance: ₹{data['referral_balance']}, Count: {data['referral_count']}")
        
        return True
    
    except AssertionError as e:
        log_error(f"Referral system test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in referral system test: {e}")
        return False

def test_admin_web_panels():
    """Test admin web panels return HTML"""
    log_section("TEST 19: Admin Web Panels (HTML)")
    
    try:
        # Master admin panel
        resp = requests.get(f"{BASE_URL}/admin/master")
        assert resp.status_code == 200, f"Master admin panel failed: {resp.status_code}"
        assert "text/html" in resp.headers.get("content-type", ""), "Master admin should return HTML"
        assert len(resp.text) > 100, "Master admin HTML too short"
        log_success("Master admin panel passed - HTML returned")
        
        # Jeweller admin panel
        resp = requests.get(f"{BASE_URL}/admin/jeweller")
        assert resp.status_code == 200, f"Jeweller admin panel failed: {resp.status_code}"
        assert "text/html" in resp.headers.get("content-type", ""), "Jeweller admin should return HTML"
        assert len(resp.text) > 100, "Jeweller admin HTML too short"
        log_success("Jeweller admin panel passed - HTML returned")
        
        return True
    
    except AssertionError as e:
        log_error(f"Admin web panels test failed: {e}")
        return False
    except Exception as e:
        log_error(f"Exception in admin web panels test: {e}")
        return False

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN TEST RUNNER
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{BLUE}{'='*70}")
    print("VAULTRA DIGIGOLD v2.0 - COMPREHENSIVE BACKEND API TESTS")
    print("PostgreSQL + SQLAlchemy + Multi-tenant Architecture")
    print(f"{'='*70}{RESET}\n")
    
    tests = [
        ("Public APIs", test_public_apis),
        ("Customer Auth - Existing User", test_customer_auth_existing),
        ("Customer Registration - New User", test_customer_registration),
        ("Gold Buying Flow (3 steps)", test_gold_buying_flow),
        ("Pool Accumulator", test_pool_accumulator),
        ("Bifurcation Invoices", test_bifurcation_invoices),
        ("Master Admin APIs", test_master_admin_apis),
        ("Jeweller Onboarding", test_jeweller_onboarding),
        ("Jeweller Admin APIs", test_jeweller_admin_apis),
        ("Redemption Flow", test_redemption_flow),
        ("Customer Vault & Transactions", test_customer_vault_apis),
        ("Wallet System", test_wallet_system),
        ("SIP APIs", test_sip_apis),
        ("Gift Gold", test_gift_gold),
        ("Alerts APIs", test_alerts_apis),
        ("Goals APIs", test_goals_apis),
        ("Notifications APIs", test_notifications_apis),
        ("Referral System", test_referral_system),
        ("Admin Web Panels (HTML)", test_admin_web_panels),
    ]
    
    results = {}
    for name, test_func in tests:
        try:
            results[name] = test_func()
        except Exception as e:
            log_error(f"Unexpected error in {name}: {e}")
            results[name] = False
    
    # Summary
    log_section("TEST SUMMARY")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = f"{GREEN}✓ PASS{RESET}" if result else f"{RED}✗ FAIL{RESET}"
        print(f"{status} - {name}")
    
    print(f"\n{BLUE}{'='*70}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*70}{RESET}\n")
    
    if passed == total:
        print(f"{GREEN}✓ All backend tests passed!{RESET}\n")
        return 0
    else:
        print(f"{RED}✗ {total - passed} test(s) failed. Review errors above.{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
