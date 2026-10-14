from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from pathlib import Path
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
import os, logging, uuid, random, asyncio, hmac, hashlib, secrets, math
import bcrypt, jwt, httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
RZP_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RZP_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RAZORPAY_ENABLED = bool(RZP_KEY_ID and RZP_KEY_SECRET)

app = FastAPI()
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger("vaultra")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

GST_RATE = 0.03
SELL_SPREAD = 0.97
QUOTE_SECONDS = 300
TENANTS = {
    "vaultra": {"id": "vaultra", "name": "Vaultra Gold Bullion", "markup": 0.0},
    "tanishq": {"id": "tanishq", "name": "Tanishq Partner", "markup": 12.40},
    "malabar": {"id": "malabar", "name": "Malabar Partner", "markup": 8.75},
}
PRODUCTS = [
    {"id": "p1", "name": "Heritage 24K Necklace", "category": "necklaces", "grams": 12.5, "making_charges": 4850, "image": "heritage-necklace", "tag": "Trending"},
    {"id": "p2", "name": "Minimalist 24K Gold Bangle", "category": "bangles", "grams": 8.2, "making_charges": 2650, "image": "minimalist-bangle", "tag": "Bestseller"},
    {"id": "p3", "name": "Classic Solitaire Ring", "category": "rings", "grams": 3.4, "making_charges": 1150, "image": "rings", "tag": "New"},
    {"id": "p4", "name": "Rope Twist Chain", "category": "chains", "grams": 6.8, "making_charges": 1980, "image": "chain", "tag": "Trending"},
    {"id": "p5", "name": "Royal Kada", "category": "kadas", "grams": 15.0, "making_charges": 5200, "image": "kada", "tag": "Premium"},
    {"id": "p6", "name": "Lakshmi Pendant Set", "category": "pendant-sets", "grams": 9.6, "making_charges": 3400, "image": "pendant-set", "tag": "Festive"},
    {"id": "p7", "name": "Gold Dial Watch", "category": "watches", "grams": 18.0, "making_charges": 7900, "image": "watch", "tag": "Luxury"},
    {"id": "p8", "name": "Tanmaniya Mangalsutra", "category": "necklaces", "grams": 7.1, "making_charges": 2300, "image": "tanmaniya", "tag": "Classic"},
]
COINS = [1, 2, 5, 10]

# ---------------- price engine (simulated live feed) ----------------
PRICE = {"base": 7285.50, "open": 7285.50, "prev": 7285.50, "updated_at": None}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def r4(x):
    return math.floor(x * 10000) / 10000


def r2(x):
    return round(x + 1e-9, 2)


def tenant_rate(tenant: str):
    t = TENANTS.get(tenant, TENANTS["vaultra"])
    buy = r2(PRICE["base"] + t["markup"])
    return buy, r2(buy * SELL_SPREAD)


def price_payload(tenant: str):
    buy, sell = tenant_rate(tenant)
    change = r2(PRICE["base"] - PRICE["open"])
    return {
        "tenant": tenant, "purity": "24K (99.9%)", "buy": buy, "sell": sell,
        "change": change, "change_pct": r2(change / PRICE["open"] * 100),
        "direction": "up" if PRICE["base"] >= PRICE["prev"] else "down",
        "gst_rate": GST_RATE, "updated_at": PRICE["updated_at"] or now_iso(),
    }


async def publish(channel: str, message: str, tenant: str = "all", meta: Optional[dict] = None):
    """Simulated Redis pub/sub: events are persisted to a capped-like collection and polled by staff consoles."""
    await db.events.insert_one({"id": str(uuid.uuid4()), "channel": channel, "message": message,
                                "tenant": tenant, "meta": meta or {}, "created_at": now_iso()})


async def price_loop():
    tick = 0
    while True:
        await asyncio.sleep(3)
        PRICE["prev"] = PRICE["base"]
        drift = (7285.50 - PRICE["base"]) * 0.05
        PRICE["base"] = r2(max(6900, min(7700, PRICE["base"] + drift + random.uniform(-4.5, 4.8))))
        PRICE["updated_at"] = now_iso()
        tick += 1
        if tick % 5 == 0:
            arrow = "▲" if PRICE["base"] >= PRICE["prev"] else "▼"
            await publish("price:tick", f"24K spot {arrow} ₹{PRICE['base']:,.2f}/g")
            count = await db.events.count_documents({})
            if count > 400:
                old = await db.events.find({}, {"_id": 1}).sort("created_at", 1).limit(count - 300).to_list(500)
                await db.events.delete_many({"_id": {"$in": [o["_id"] for o in old]}})


# ---------------- auth helpers ----------------
def make_token(sub: str, role: str, days: int = 7):
    n = datetime.now(timezone.utc)
    return jwt.encode({"sub": sub, "role": role, "iat": n, "exp": n + timedelta(days=days)}, JWT_SECRET, algorithm="HS256")


def decode(creds: Optional[HTTPAuthorizationCredentials], role: str):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        p = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if p.get("role") != role:
        raise HTTPException(403, "Forbidden")
    return p["sub"]


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    uid = decode(creds, "user")
    u = await db.users.find_one({"id": uid}, {"_id": 0})
    if not u:
        raise HTTPException(401, "User not found")
    return u


async def current_staff(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    sid = decode(creds, "staff")
    s = await db.staff.find_one({"staff_id": sid}, {"_id": 0, "pin_hash": 0})
    if not s:
        raise HTTPException(401, "Staff not found")
    return s


def otp_digest(code: str):
    return hmac.new(JWT_SECRET.encode(), code.encode(), hashlib.sha256).hexdigest()


def norm_phone(p: str):
    d = "".join(c for c in p if c.isdigit())
    return d[-10:]


def public_user(u: dict):
    grams = u.get("gold_grams", 0)
    return {k: u.get(k) for k in ["id", "phone", "name", "tenant", "kyc_status", "created_at"]} | {
        "gold_grams": r4(grams), "invested": r2(u.get("invested", 0)),
        "avg_buy_price": r2(u["invested"] / grams) if grams > 0 else 0,
        "kyc": {k: v for k, v in (u.get("kyc") or {}).items()},
    }


# ---------------- ledger helpers ----------------
def entries_for(t: dict):
    typ, amt, gst, total = t["type"], t.get("amount", 0), t.get("gst", 0), t.get("total", 0)
    if typ in ("buy", "sip", "counter_sale"):
        cash = {"counter_sale": "Store Cash / POS Terminal"}.get(typ, "Payment Gateway Clearing")
        return [{"account": cash, "debit": total, "credit": 0},
                {"account": "Customer Gold Liability", "debit": 0, "credit": amt},
                {"account": "GST Output Payable", "debit": 0, "credit": gst}]
    if typ == "sell":
        return [{"account": "Customer Gold Liability", "debit": amt, "credit": 0},
                {"account": "Customer Bank Payable", "debit": 0, "credit": amt}]
    if typ == "redemption":
        return [{"account": "Customer Gold Liability", "debit": amt, "credit": 0},
                {"account": "Physical Bullion Inventory", "debit": 0, "credit": amt}]
    return []


def invoice_no():
    return "VDG" + datetime.now(timezone.utc).strftime("%y%m%d") + str(random.randint(10000, 99999))


async def record_txn(user: dict, typ: str, grams: float, rate: float, amount: float, gst: float, total: float,
                     tenant: str, method: str, status: str = "completed", note: str = "", staff_id: str = None,
                     extra: Optional[dict] = None):
    t = {"id": str(uuid.uuid4()), "invoice_no": invoice_no(), "user_id": user["id"], "phone": user["phone"],
         "name": user.get("name") or "Customer", "tenant": tenant, "type": typ, "grams": r4(grams), "rate": rate,
         "amount": r2(amount), "gst": r2(gst), "total": r2(total), "method": method, "status": status,
         "note": note, "staff_id": staff_id, "created_at": now_iso()}
    if extra:
        t.update(extra)
    t["entries"] = entries_for(t)
    await db.transactions.insert_one(dict(t))
    t.pop("_id", None)
    return t


async def credit_gold(user_id: str, grams: float, amount: float):
    await db.users.update_one({"id": user_id}, {"$inc": {"gold_grams": grams, "invested": amount}})


async def debit_gold(user: dict, grams: float):
    bal = user.get("gold_grams", 0)
    if grams > bal + 1e-9:
        raise HTTPException(400, "Insufficient vault balance")
    avg = (user.get("invested", 0) / bal) if bal > 0 else 0
    await db.users.update_one({"id": user["id"]}, {"$inc": {"gold_grams": -grams, "invested": -avg * grams}})


# ---------------- models ----------------
class OtpRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=15)


class OtpVerify(BaseModel):
    challenge_id: str
    otp: str = Field(pattern=r"^\d{6}$")
    tenant: str = "vaultra"
    name: Optional[str] = None


class StaffLogin(BaseModel):
    staff_id: str
    pin: str = Field(pattern=r"^\d{4,6}$")


class ProfileUpdate(BaseModel):
    name: Optional[str] = None


class KycSubmit(BaseModel):
    full_name: str = Field(min_length=2)
    aadhaar: str = Field(pattern=r"^\d{12}$")
    pan: str = Field(pattern=r"^[A-Z]{5}\d{4}[A-Z]$")
    dob: str = ""


class BuyRequest(BaseModel):
    quote_id: str
    mode: str = "rupees"  # rupees | grams
    value: float = Field(gt=0)
    method: str = "upi"


class MockConfirm(BaseModel):
    method: str = "upi"
    success: bool = True


class SellRequest(BaseModel):
    grams: float = Field(gt=0)
    tenant: str = "vaultra"


class RedeemRequest(BaseModel):
    kind: str  # coin | product
    coin_grams: Optional[float] = None
    product_id: Optional[str] = None
    tenant: str = "vaultra"


class SipCreate(BaseModel):
    amount: float = Field(ge=100, le=100000)
    frequency: str = "monthly"  # daily | weekly | monthly
    tenant: str = "vaultra"


class KycDecision(BaseModel):
    approve: bool
    note: str = ""


class CollectRequest(BaseModel):
    otp: str = Field(pattern=r"^\d{6}$")


class CounterSale(BaseModel):
    phone: str
    name: Optional[str] = None
    grams: float = Field(gt=0, le=1000)
    method: str = "cash"


class ReverseRequest(BaseModel):
    reason: str = Field(min_length=3)


# ---------------- public ----------------
@api.get("/")
async def root():
    return {"app": "Vaultra DigiGold", "razorpay_enabled": RAZORPAY_ENABLED}


@api.get("/tenants")
async def tenants():
    return [{"id": t["id"], "name": t["name"]} for t in TENANTS.values()]


@api.get("/price")
async def get_price(tenant: str = "vaultra"):
    return price_payload(tenant)


@api.post("/quote")
async def create_quote(tenant: str = "vaultra"):
    buy, sell = tenant_rate(tenant)
    exp = datetime.now(timezone.utc) + timedelta(seconds=QUOTE_SECONDS)
    q = {"id": str(uuid.uuid4()), "tenant": tenant, "buy": buy, "sell": sell, "expires_at": exp.isoformat(),
         "created_at": now_iso()}
    await db.quotes.insert_one(dict(q))
    return q | {"lock_seconds": QUOTE_SECONDS}


@api.get("/products")
async def products(category: Optional[str] = None):
    return [p for p in PRODUCTS if not category or p["category"] == category]


@api.get("/config")
async def config():
    return {"razorpay_enabled": RAZORPAY_ENABLED, "gst_rate": GST_RATE, "coins": COINS}


# ---------------- customer auth ----------------
@api.post("/auth/otp/request")
async def otp_request(body: OtpRequest):
    phone = norm_phone(body.phone)
    if len(phone) != 10:
        raise HTTPException(400, "Enter a valid 10-digit mobile number")
    n = datetime.now(timezone.utc)
    recent = await db.otp_challenges.count_documents({"phone": phone, "created_at": {"$gt": (n - timedelta(minutes=1)).isoformat()}})
    if recent >= 5:
        raise HTTPException(429, "Too many requests. Try again in a minute")
    code = f"{secrets.randbelow(1_000_000):06d}"
    cid = str(uuid.uuid4())
    await db.otp_challenges.insert_one({"id": cid, "phone": phone, "digest": otp_digest(code), "attempts": 0,
                                        "used": False, "created_at": n.isoformat(),
                                        "expires_at": (n + timedelta(minutes=5)).isoformat()})
    exists = await db.users.find_one({"phone": phone}, {"_id": 0, "id": 1})
    return {"challenge_id": cid, "demo_otp": code, "expires_in": 300, "is_new_user": not exists}


@api.post("/auth/otp/verify")
async def otp_verify(body: OtpVerify):
    c = await db.otp_challenges.find_one({"id": body.challenge_id}, {"_id": 0})
    if not c or c["used"] or c["expires_at"] <= now_iso() or c["attempts"] >= 5:
        raise HTTPException(401, "Invalid or expired code")
    if not hmac.compare_digest(c["digest"], otp_digest(body.otp)):
        await db.otp_challenges.update_one({"id": body.challenge_id}, {"$inc": {"attempts": 1}})
        raise HTTPException(401, f"Incorrect OTP. {4 - c['attempts']} attempts left")
    await db.otp_challenges.update_one({"id": body.challenge_id}, {"$set": {"used": True}})
    u = await db.users.find_one({"phone": c["phone"]}, {"_id": 0})
    if not u:
        u = {"id": str(uuid.uuid4()), "phone": c["phone"], "name": (body.name or "").strip() or "Gold Saver",
             "tenant": body.tenant if body.tenant in TENANTS else "vaultra", "kyc_status": "not_submitted",
             "kyc": {}, "gold_grams": 0.0, "invested": 0.0, "created_at": now_iso()}
        await db.users.insert_one(dict(u))
        await publish("customer:registered", f"New customer +91 {c['phone'][:5]}xxxxx joined", u["tenant"])
    return {"access_token": make_token(u["id"], "user"), "user": public_user(u)}


@api.get("/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@api.patch("/me")
async def update_me(body: ProfileUpdate, user=Depends(current_user)):
    if body.name:
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": body.name.strip()}})
    return public_user(await db.users.find_one({"id": user["id"]}, {"_id": 0}))


@api.post("/kyc/submit")
async def kyc_submit(body: KycSubmit, user=Depends(current_user)):
    if user.get("kyc_status") in ("pending", "approved"):
        raise HTTPException(400, f"KYC already {user['kyc_status']}")
    kyc = {"full_name": body.full_name, "aadhaar": body.aadhaar, "pan": body.pan, "dob": body.dob,
           "submitted_at": now_iso()}
    await db.users.update_one({"id": user["id"]}, {"$set": {"kyc_status": "pending", "kyc": kyc}})
    await publish("kyc:submitted", f"KYC submitted by {body.full_name}", user["tenant"])
    return public_user(await db.users.find_one({"id": user["id"]}, {"_id": 0}))


# ---------------- vault ----------------
@api.get("/vault")
async def vault(tenant: str = "vaultra", user=Depends(current_user)):
    buy, sell = tenant_rate(tenant)
    pu = public_user(user)
    value = r2(pu["gold_grams"] * sell)
    pnl = r2(value - pu["invested"])
    pnl_pct = r2(pnl / pu["invested"] * 100) if pu["invested"] > 0 else 0
    pickups = await db.pickups.find({"user_id": user["id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"user": pu, "buy_rate": buy, "sell_rate": sell, "current_value": value, "unrealized_pnl": pnl,
            "unrealized_pct": pnl_pct, "pending_pickups": pickups}


@api.get("/transactions")
async def my_transactions(type: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if type and type != "all":
        q["type"] = {"$in": ["buy", "counter_sale"]} if type == "buy" else type
    return await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------------- buy / payments ----------------
async def finalize_order(order: dict, method: str, payment_id: str = ""):
    """Idempotent: only one caller can flip status created -> paid."""
    res = await db.orders.find_one_and_update({"id": order["id"], "status": "created"},
                                              {"$set": {"status": "paid", "payment_id": payment_id, "method": method,
                                                        "paid_at": now_iso()}})
    if not res:
        return await db.transactions.find_one({"order_id": order["id"]}, {"_id": 0})
    user = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
    await credit_gold(user["id"], order["grams"], order["amount"])
    t = await record_txn(user, order.get("txn_type", "buy"), order["grams"], order["rate"], order["amount"],
                         order["gst"], order["total"], order["tenant"], method,
                         extra={"order_id": order["id"], "payment_id": payment_id})
    await publish("vault:buy", f"{user.get('name')} bought {order['grams']:.4f}g (₹{order['total']:,.2f})", order["tenant"])
    return t


@api.post("/orders/buy")
async def buy(body: BuyRequest, request: Request, user=Depends(current_user)):
    q = await db.quotes.find_one({"id": body.quote_id}, {"_id": 0})
    if not q:
        raise HTTPException(400, "Price quote not found")
    if q["expires_at"] <= now_iso():
        raise HTTPException(409, "Price lock expired. Refresh the rate")
    rate = q["buy"]
    if body.mode == "grams":
        grams = r4(body.value)
        amount = r2(grams * rate)
    else:
        amount = r2(body.value)
        grams = r4(amount / rate)
    if amount < 10:
        raise HTTPException(400, "Minimum purchase is ₹10")
    if amount > 200000:
        raise HTTPException(400, "Maximum single purchase is ₹2,00,000")
    gst = r2(amount * GST_RATE)
    total = r2(amount + gst)
    order = {"id": str(uuid.uuid4()), "user_id": user["id"], "tenant": q["tenant"], "grams": grams, "rate": rate,
             "amount": amount, "gst": gst, "total": total, "status": "created", "txn_type": "buy",
             "provider": "razorpay" if RAZORPAY_ENABLED else "mock", "created_at": now_iso()}
    if RAZORPAY_ENABLED:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post("https://api.razorpay.com/v1/orders", auth=(RZP_KEY_ID, RZP_KEY_SECRET),
                             json={"amount": int(round(total * 100)), "currency": "INR", "receipt": order["id"][:32]})
        if r.status_code >= 400:
            raise HTTPException(502, "Payment gateway order creation failed")
        order["razorpay_order_id"] = r.json()["id"]
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        order["checkout_url"] = f"https://{host}/api/payments/checkout/{order['id']}"
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)
    return order


@api.post("/orders/{order_id}/mock-confirm")
async def mock_confirm(order_id: str, body: MockConfirm, user=Depends(current_user)):
    o = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["provider"] != "mock":
        raise HTTPException(400, "Order must be paid via Razorpay")
    if not body.success:
        await db.orders.update_one({"id": order_id, "status": "created"}, {"$set": {"status": "failed"}})
        raise HTTPException(402, "Payment declined")
    t = await finalize_order(o, body.method, "pay_mock_" + uuid.uuid4().hex[:14])
    return {"status": "paid", "transaction": t}


@api.get("/orders/{order_id}")
async def order_status(order_id: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    t = await db.transactions.find_one({"order_id": order_id}, {"_id": 0})
    return {"order": o, "transaction": t}


@api.get("/payments/checkout/{order_id}", response_class=HTMLResponse)
async def checkout_page(order_id: str, request: Request):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o or not o.get("razorpay_order_id"):
        raise HTTPException(404, "Order not found")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    cb = f"https://{host}/api/payments/callback"
    html = f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#fff;font-family:sans-serif"><script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>new Razorpay({{key:{RZP_KEY_ID!r},amount:{int(round(o["total"]*100))},currency:"INR",name:"Vaultra DigiGold",
description:"24K Gold {o["grams"]:.4f}g",order_id:{o["razorpay_order_id"]!r},callback_url:{cb!r},redirect:true,
theme:{{color:"#D4AF37"}}}}).open();</script></body></html>'''
    return HTMLResponse(html)


@api.post("/payments/callback")
async def payment_callback(request: Request):
    form = await request.form()
    pid, roid, sig = str(form.get("razorpay_payment_id", "")), str(form.get("razorpay_order_id", "")), str(form.get("razorpay_signature", ""))
    o = await db.orders.find_one({"razorpay_order_id": roid}, {"_id": 0}) if roid else None
    status = "failed"
    if o and pid and sig:
        expected = hmac.new(RZP_KEY_SECRET.encode(), f"{o['razorpay_order_id']}|{pid}".encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, sig):
            await finalize_order(o, "razorpay", pid)
            status = "success"
    return RedirectResponse(f"/api/payments/result?{urlencode({'status': status, 'order_id': o['id'] if o else ''})}", 303)


@api.get("/payments/result", response_class=HTMLResponse)
async def payment_result(status: str = "failed"):
    ok = status == "success"
    return HTMLResponse(f'<html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:40px"><h2 style="color:{"#16A34A" if ok else "#DC2626"}">{"Payment successful" if ok else "Payment failed"}</h2></body></html>')


# ---------------- sell / redeem / sip ----------------
@api.post("/sell")
async def sell(body: SellRequest, user=Depends(current_user)):
    if user.get("kyc_status") != "approved":
        raise HTTPException(403, "Complete KYC verification to sell gold")
    grams = r4(body.grams)
    _, rate = tenant_rate(body.tenant)
    await debit_gold(user, grams)
    amount = r2(grams * rate)
    t = await record_txn(user, "sell", grams, rate, amount, 0, amount, body.tenant, "bank_transfer", status="processing",
                         note="Credit to linked bank account in T+1")
    await publish("vault:sell", f"{user.get('name')} sold {grams:.4f}g (₹{amount:,.2f})", body.tenant)
    return t


@api.post("/redeem")
async def redeem(body: RedeemRequest, user=Depends(current_user)):
    if user.get("kyc_status") != "approved":
        raise HTTPException(403, "Complete KYC verification to redeem gold")
    making = 0
    if body.kind == "coin":
        if body.coin_grams not in COINS:
            raise HTTPException(400, "Invalid coin denomination")
        grams, item = float(body.coin_grams), f"{body.coin_grams:g}g 24K Gold Coin"
        making = 250 * len(str(int(body.coin_grams)))
    else:
        p = next((x for x in PRODUCTS if x["id"] == body.product_id), None)
        if not p:
            raise HTTPException(404, "Product not found")
        grams, item, making = p["grams"], p["name"], p["making_charges"]
    buy_rate, _ = tenant_rate(body.tenant)
    await debit_gold(user, grams)
    amount = r2(grams * buy_rate)
    otp = f"{secrets.randbelow(1_000_000):06d}"
    t = await record_txn(user, "redemption", grams, buy_rate, amount, 0, making, body.tenant, "vault_gold",
                         status="processing", note=f"{item} · In-store pickup", extra={"item": item, "making_charges": making})
    pickup = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": user.get("name"), "phone": user["phone"],
              "tenant": body.tenant, "item": item, "grams": grams, "making_charges": making, "otp": otp,
              "attempts": 0, "locked": False, "status": "pending", "txn_id": t["id"], "created_at": now_iso()}
    await db.pickups.insert_one(dict(pickup))
    pickup.pop("_id", None)
    await publish("pickup:created", f"Pickup booked: {item} for {user.get('name')}", body.tenant)
    return {"transaction": t, "pickup": pickup}


@api.get("/sips")
async def list_sips(user=Depends(current_user)):
    return await db.sips.find({"user_id": user["id"], "status": {"$ne": "cancelled"}}, {"_id": 0}).sort("created_at", -1).to_list(50)


def next_run(freq: str):
    d = {"daily": 1, "weekly": 7, "monthly": 30}.get(freq, 30)
    return (datetime.now(timezone.utc) + timedelta(days=d)).isoformat()


@api.post("/sips")
async def create_sip(body: SipCreate, user=Depends(current_user)):
    if body.frequency not in ("daily", "weekly", "monthly"):
        raise HTTPException(400, "Invalid frequency")
    s = {"id": str(uuid.uuid4()), "user_id": user["id"], "amount": r2(body.amount), "frequency": body.frequency,
         "tenant": body.tenant, "status": "active", "installments": 0, "grams_accumulated": 0.0,
         "next_run": next_run(body.frequency), "mandate": "UPI AutoPay", "created_at": now_iso()}
    await db.sips.insert_one(dict(s))
    s.pop("_id", None)
    await publish("sip:created", f"{user.get('name')} started ₹{body.amount:,.0f} {body.frequency} SIP", body.tenant)
    return s


@api.post("/sips/{sip_id}/toggle")
async def toggle_sip(sip_id: str, user=Depends(current_user)):
    s = await db.sips.find_one({"id": sip_id, "user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "SIP not found")
    ns = "paused" if s["status"] == "active" else "active"
    await db.sips.update_one({"id": sip_id}, {"$set": {"status": ns}})
    return s | {"status": ns}


@api.delete("/sips/{sip_id}")
async def cancel_sip(sip_id: str, user=Depends(current_user)):
    r = await db.sips.update_one({"id": sip_id, "user_id": user["id"]}, {"$set": {"status": "cancelled"}})
    if not r.matched_count:
        raise HTTPException(404, "SIP not found")
    return {"ok": True}


@api.post("/sips/{sip_id}/run")
async def run_sip(sip_id: str, user=Depends(current_user)):
    """Simulates the UPI AutoPay mandate debit for the next installment."""
    s = await db.sips.find_one({"id": sip_id, "user_id": user["id"], "status": "active"}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Active SIP not found")
    rate, _ = tenant_rate(s["tenant"])
    amount = s["amount"]
    gst = r2(amount * GST_RATE)
    grams = r4(amount / rate)
    await credit_gold(user["id"], grams, amount)
    t = await record_txn(user, "sip", grams, rate, amount, gst, r2(amount + gst), s["tenant"], "upi_autopay",
                         note=f"{s['frequency'].title()} SIP installment", extra={"sip_id": sip_id})
    await db.sips.update_one({"id": sip_id}, {"$inc": {"installments": 1, "grams_accumulated": grams},
                                              "$set": {"next_run": next_run(s["frequency"])}})
    await publish("sip:debit", f"SIP debit ₹{amount + gst:,.2f} for {user.get('name')}", s["tenant"])
    return t


# ---------------- staff / admin ----------------
def scope(staff: dict, tenant: Optional[str]):
    if staff["tenant"] != "all":
        return staff["tenant"]
    return tenant if tenant and tenant != "all" else None


def tq(t: Optional[str], key="tenant"):
    return {key: t} if t else {}


@api.post("/admin/login")
async def staff_login(body: StaffLogin):
    sid = body.staff_id.strip().upper()
    s = await db.staff.find_one({"staff_id": sid}, {"_id": 0})
    n = now_iso()
    if s and s.get("locked_until") and s["locked_until"] > n:
        raise HTTPException(423, "Account locked for 15 minutes after 5 failed attempts")
    ok = bool(s) and bcrypt.checkpw(body.pin.encode(), s["pin_hash"].encode())
    if not ok:
        if s:
            failed = s.get("failed", 0) + 1
            upd = {"failed": failed}
            if failed >= 5:
                upd = {"failed": 0, "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}
            await db.staff.update_one({"staff_id": sid}, {"$set": upd})
        raise HTTPException(401, "Invalid Staff ID or PIN")
    await db.staff.update_one({"staff_id": sid}, {"$set": {"failed": 0, "locked_until": None, "last_login": n}})
    s.pop("pin_hash", None)
    return {"access_token": make_token(sid, "staff", days=1), "staff": s}


@api.get("/admin/me")
async def staff_me(staff=Depends(current_staff)):
    return staff


@api.get("/admin/stats")
async def admin_stats(tenant: Optional[str] = None, staff=Depends(current_staff)):
    t = scope(staff, tenant)
    agg = await db.users.aggregate([{"$match": tq(t)}, {"$group": {"_id": None, "g": {"$sum": "$gold_grams"}, "n": {"$sum": 1}}}]).to_list(1)
    today = datetime.now(timezone.utc).date().isoformat()
    sales = await db.transactions.aggregate([{"$match": {"type": "counter_sale", "status": "completed", "created_at": {"$gte": today}} | tq(t)},
                                             {"$group": {"_id": None, "s": {"$sum": "$total"}, "n": {"$sum": 1}}}]).to_list(1)
    return {
        "tenant": t or "all",
        "vault_custody_grams": r4(agg[0]["g"]) if agg else 0, "customers": agg[0]["n"] if agg else 0,
        "counter_sales_today": r2(sales[0]["s"]) if sales else 0, "counter_sales_count": sales[0]["n"] if sales else 0,
        "pending_pickups": await db.pickups.count_documents({"status": "pending"} | tq(t)),
        "pending_kyc": await db.users.count_documents({"kyc_status": "pending"} | tq(t)),
        "price": price_payload(t or "vaultra"),
    }


@api.get("/admin/events")
async def admin_events(tenant: Optional[str] = None, staff=Depends(current_staff)):
    t = scope(staff, tenant)
    q = {"tenant": {"$in": [t, "all"]}} if t else {}
    return await db.events.find(q, {"_id": 0}).sort("created_at", -1).to_list(30)


@api.get("/admin/customers")
async def admin_customers(tenant: Optional[str] = None, search: str = "", staff=Depends(current_staff)):
    q = tq(scope(staff, tenant))
    if search:
        q["$or"] = [{"phone": {"$regex": search}}, {"name": {"$regex": search, "$options": "i"}}]
    rows = await db.users.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [public_user(u) for u in rows]


@api.get("/admin/customers/lookup")
async def lookup(phone: str, staff=Depends(current_staff)):
    u = await db.users.find_one({"phone": norm_phone(phone)}, {"_id": 0})
    return {"found": bool(u), "customer": public_user(u) if u else None}


@api.get("/admin/kyc-queue")
async def kyc_queue(tenant: Optional[str] = None, staff=Depends(current_staff)):
    rows = await db.users.find({"kyc_status": "pending"} | tq(scope(staff, tenant)), {"_id": 0}).sort("kyc.submitted_at", 1).to_list(200)
    return [public_user(u) for u in rows]


@api.get("/admin/kyc-reviewed")
async def kyc_reviewed(tenant: Optional[str] = None, staff=Depends(current_staff)):
    rows = await db.users.find({"kyc_status": {"$in": ["approved", "rejected"]}, "kyc.reviewed_by": {"$exists": True}} | tq(scope(staff, tenant)),
                               {"_id": 0}).sort("kyc.reviewed_at", -1).to_list(30)
    return [public_user(u) for u in rows]


@api.post("/admin/kyc/{user_id}/decision")
async def kyc_decide(user_id: str, body: KycDecision, staff=Depends(current_staff)):
    u = await db.users.find_one({"id": user_id, "kyc_status": "pending"}, {"_id": 0})
    if not u:
        raise HTTPException(404, "No pending KYC for this customer")
    if staff["tenant"] != "all" and u["tenant"] != staff["tenant"]:
        raise HTTPException(403, "Customer belongs to another store")
    st = "approved" if body.approve else "rejected"
    await db.users.update_one({"id": user_id}, {"$set": {"kyc_status": st, "kyc.reviewed_by": staff["staff_id"],
                                                         "kyc.reviewer_name": staff["name"], "kyc.reviewed_at": now_iso(),
                                                         "kyc.note": body.note}})
    await publish(f"kyc:{st}", f"KYC {st} for {u.get('name')} by {staff['staff_id']}", u["tenant"])
    return public_user(await db.users.find_one({"id": user_id}, {"_id": 0}))


@api.get("/admin/pickups")
async def admin_pickups(tenant: Optional[str] = None, status: str = "pending", staff=Depends(current_staff)):
    t = scope(staff, tenant)
    q = {"status": status} | tq(t)
    if status == "collected":
        q["collected_at"] = {"$gte": datetime.now(timezone.utc).date().isoformat()}
    rows = await db.pickups.find(q, {"_id": 0, "otp": 0}).sort("created_at", 1 if status == "pending" else -1).to_list(200)
    return rows


@api.post("/admin/pickups/{pickup_id}/collect")
async def collect(pickup_id: str, body: CollectRequest, staff=Depends(current_staff)):
    p = await db.pickups.find_one({"id": pickup_id, "status": "pending"}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Pending pickup not found")
    if p.get("locked"):
        raise HTTPException(423, "Pickup locked after 5 failed OTP attempts. Escalate to store manager")
    if not hmac.compare_digest(p["otp"], body.otp):
        attempts = p.get("attempts", 0) + 1
        locked = attempts >= 5
        await db.pickups.update_one({"id": pickup_id}, {"$set": {"attempts": attempts, "locked": locked}})
        if locked:
            await publish("pickup:locked", f"Pickup locked for {p['name']} after 5 failed OTPs", p["tenant"])
            raise HTTPException(423, "Pickup locked after 5 failed OTP attempts")
        raise HTTPException(400, f"Incorrect OTP. {5 - attempts} attempts left")
    n = now_iso()
    await db.pickups.update_one({"id": pickup_id}, {"$set": {"status": "collected", "collected_at": n,
                                                             "collected_by": staff["staff_id"], "collected_by_name": staff["name"]}})
    await db.transactions.update_one({"id": p["txn_id"]}, {"$set": {"status": "completed"}})
    await publish("pickup:collected", f"{p['item']} handed over to {p['name']} by {staff['staff_id']}", p["tenant"])
    return {"ok": True, "collected_at": n}


@api.post("/admin/counter-sale")
async def counter_sale(body: CounterSale, staff=Depends(current_staff)):
    if body.method not in ("cash", "card", "upi"):
        raise HTTPException(400, "Invalid payment method")
    phone = norm_phone(body.phone)
    if len(phone) != 10:
        raise HTTPException(400, "Invalid phone number")
    tenant = staff["tenant"] if staff["tenant"] != "all" else "vaultra"
    u = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not u:
        u = {"id": str(uuid.uuid4()), "phone": phone, "name": (body.name or "").strip() or "Walk-in Customer", "tenant": tenant,
             "kyc_status": "not_submitted", "kyc": {}, "gold_grams": 0.0, "invested": 0.0, "created_at": now_iso()}
        await db.users.insert_one(dict(u))
    rate, _ = tenant_rate(tenant)
    grams = r4(body.grams)
    amount = r2(grams * rate)
    gst = r2(amount * GST_RATE)
    await credit_gold(u["id"], grams, amount)
    t = await record_txn(u, "counter_sale", grams, rate, amount, gst, r2(amount + gst), tenant, body.method,
                         staff_id=staff["staff_id"], note=f"Counter sale by {staff['name']}")
    await publish("pos:sale", f"Counter sale {grams:.3f}g · ₹{t['total']:,.2f} ({body.method.upper()})", tenant)
    return t


@api.get("/admin/ledger")
async def admin_ledger(tenant: Optional[str] = None, type: Optional[str] = None, staff=Depends(current_staff)):
    q = tq(scope(staff, tenant))
    if type and type != "all":
        q["type"] = type
    return await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/admin/ledger/{txn_id}/reverse")
async def reverse(txn_id: str, body: ReverseRequest, staff=Depends(current_staff)):
    t = await db.transactions.find_one({"id": txn_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Transaction not found")
    if t["type"] == "reversal" or t["status"] in ("reversed", "failed"):
        raise HTTPException(400, "Transaction cannot be reversed")
    if staff["tenant"] != "all" and t["tenant"] != staff["tenant"]:
        raise HTTPException(403, "Transaction belongs to another store")
    u = await db.users.find_one({"id": t["user_id"]}, {"_id": 0})
    if t["type"] in ("buy", "sip", "counter_sale"):
        await debit_gold(u, t["grams"])
    elif t["type"] in ("sell", "redemption"):
        await credit_gold(u["id"], t["grams"], t["amount"])
        if t["type"] == "redemption":
            await db.pickups.update_one({"txn_id": txn_id, "status": "pending"}, {"$set": {"status": "cancelled"}})
    mirrored = [{"account": e["account"], "debit": e["credit"], "credit": e["debit"]} for e in t.get("entries", [])]
    rev = await record_txn(u, "reversal", t["grams"], t["rate"], t["amount"], t.get("gst", 0), t["total"], t["tenant"],
                           t["method"], staff_id=staff["staff_id"], note=body.reason, extra={"reversed_of": txn_id, "original_type": t["type"]})
    await db.transactions.update_one({"id": rev["id"]}, {"$set": {"entries": mirrored}})
    await db.transactions.update_one({"id": txn_id}, {"$set": {"status": "reversed", "reversal_id": rev["id"],
                                                               "reversal_reason": body.reason, "reversed_by": staff["staff_id"]}})
    await publish("ledger:reversal", f"{t['invoice_no']} reversed by {staff['staff_id']}: {body.reason}", t["tenant"])
    return rev | {"entries": mirrored}


# ---------------- seed ----------------
async def seed():
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("id", unique=True)
    await db.staff.create_index("staff_id", unique=True)
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    staff = [("STF001", "Arjun Mehta", "all", "HQ Admin", "1234"), ("STF002", "Priya Nair", "tanishq", "Store Manager", "5678"),
             ("STF003", "Rahul Menon", "malabar", "Counter Executive", "2468")]
    for sid, name, tenant, role, pin in staff:
        if not await db.staff.find_one({"staff_id": sid}):
            await db.staff.insert_one({"staff_id": sid, "name": name, "tenant": tenant, "role": role, "failed": 0,
                                       "locked_until": None, "pin_hash": bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()})
    if await db.users.find_one({"phone": "9876543210"}):
        return
    base = datetime.now(timezone.utc)
    people = [("9876543210", "Aarav Sharma", "vaultra", "approved"), ("9812345670", "Diya Patel", "vaultra", "pending"),
              ("9823456781", "Kabir Singh", "tanishq", "pending"), ("9834567892", "Meera Iyer", "tanishq", "approved"),
              ("9845678903", "Rohan Gupta", "malabar", "pending"), ("9856789014", "Ananya Reddy", "malabar", "approved"),
              ("9867890125", "Vihaan Joshi", "vaultra", "pending"), ("9878901236", "Isha Kapoor", "tanishq", "not_submitted")]
    for i, (phone, name, tenant, kyc) in enumerate(people):
        created = (base - timedelta(days=40 - i * 4)).isoformat()
        kycd = {}
        if kyc != "not_submitted":
            kycd = {"full_name": name, "aadhaar": f"{random.randint(2000, 9999)}{random.randint(1000, 9999)}{random.randint(1000, 9999)}",
                    "pan": f"{''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ') for _ in range(5))}{random.randint(1000, 9999)}{random.choice('ABCFGHLPT')}",
                    "dob": f"19{random.randint(75, 99)}-0{random.randint(1, 9)}-1{random.randint(0, 9)}",
                    "submitted_at": (base - timedelta(hours=60 - i * 7)).isoformat()}
            if kyc == "approved":
                kycd |= {"reviewed_by": "STF001", "reviewer_name": "Arjun Mehta", "reviewed_at": (base - timedelta(hours=30 - i)).isoformat()}
        u = {"id": str(uuid.uuid4()), "phone": phone, "name": name, "tenant": tenant, "kyc_status": kyc, "kyc": kycd,
             "gold_grams": 0.0, "invested": 0.0, "created_at": created}
        await db.users.insert_one(dict(u))
        for j in range(random.randint(2, 4)):
            rate = r2(7120 + random.uniform(-60, 120))
            amount = float(random.choice([1000, 2000, 2500, 5000, 10000]))
            grams = r4(amount / rate)
            typ = random.choice(["buy", "buy", "sip"])
            await credit_gold(u["id"], grams, amount)
            t = await record_txn(u, typ, grams, rate, amount, r2(amount * GST_RATE), r2(amount * (1 + GST_RATE)), tenant,
                                 "upi" if typ == "buy" else "upi_autopay", note="Seeded")
            await db.transactions.update_one({"id": t["id"]}, {"$set": {"created_at": (base - timedelta(days=30 - i * 3 - j)).isoformat()}})
    demo = await db.users.find_one({"phone": "9876543210"}, {"_id": 0})
    await db.sips.insert_one({"id": str(uuid.uuid4()), "user_id": demo["id"], "amount": 1000.0, "frequency": "monthly", "tenant": "vaultra",
                              "status": "active", "installments": 3, "grams_accumulated": 0.4181, "next_run": next_run("monthly"),
                              "mandate": "UPI AutoPay", "created_at": (base - timedelta(days=90)).isoformat()})
    for phone, item, grams, otp in [("9876543210", "1g 24K Gold Coin", 1.0, "482913"), ("9834567892", "2g 24K Gold Coin", 2.0, "135790"),
                                    ("9856789014", "1g 24K Gold Coin", 1.0, "246802")]:
        u = await db.users.find_one({"phone": phone}, {"_id": 0})
        if u["gold_grams"] < grams:
            await credit_gold(u["id"], grams, grams * 7200)
            u = await db.users.find_one({"phone": phone}, {"_id": 0})
        await debit_gold(u, grams)
        t = await record_txn(u, "redemption", grams, 7285.5, r2(grams * 7285.5), 0, 250, u["tenant"], "vault_gold", status="processing",
                             note=f"{item} · In-store pickup", extra={"item": item, "making_charges": 250})
        await db.pickups.insert_one({"id": str(uuid.uuid4()), "user_id": u["id"], "name": u["name"], "phone": phone, "tenant": u["tenant"],
                                     "item": item, "grams": grams, "making_charges": 250, "otp": otp, "attempts": 0, "locked": False,
                                     "status": "pending", "txn_id": t["id"], "created_at": now_iso()})
    await publish("system:boot", "Vaultra ledger node connected · redis://pubsub/vaultra-events")
    logger.info("Seeded demo data")


@app.on_event("startup")
async def startup():
    await seed()
    asyncio.create_task(price_loop())


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
