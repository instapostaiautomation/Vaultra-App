"""Vaultra DigiGold — Multi-tenant Digital Gold Platform Backend
FastAPI + PostgreSQL (SQLAlchemy async)
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from pathlib import Path
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, update, delete, func, and_, or_, desc, asc, text
from sqlalchemy.ext.asyncio import AsyncSession
import os, logging, uuid, random, asyncio, hmac, hashlib, secrets, math
import bcrypt, jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import get_db, init_db, AsyncSessionLocal
from models import (
    Jeweller, Customer, OtpChallenge, Transaction, Order, PoolAccumulator,
    PoolContribution, BifurcationInvoice, Product, Pickup, SIP, Alert, Goal,
    Gift, Notification, WalletTransaction, Quote, MasterAdmin
)

JWT_SECRET = os.environ['JWT_SECRET']
SETU_CLIENT_ID = os.environ.get('SETU_CLIENT_ID', '')
SETU_CLIENT_SECRET = os.environ.get('SETU_CLIENT_SECRET', '')

app = FastAPI(title="Vaultra DigiGold API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger("vaultra")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

GST_RATE = 0.03
SELL_SPREAD = 0.97
QUOTE_SECONDS = 300
POOL_THRESHOLD = 10.0  # grams

# ─── Price Engine (Simulated) ────────────────────────────────────────────────
PRICE = {"base": 7285.50, "open": 7285.50, "prev": 7285.50, "updated_at": None}
SILVER_PRICE = {"base": 92.50, "open": 92.50, "prev": 92.50, "updated_at": None}


def now_utc():
    return datetime.now(timezone.utc)


def now_iso():
    return now_utc().isoformat()


def r4(x):
    return math.floor(x * 10000) / 10000


def r2(x):
    return round(x + 1e-9, 2)


def gold_rate():
    return r2(PRICE["base"]), r2(PRICE["base"] * SELL_SPREAD)


def silver_rate():
    return r2(SILVER_PRICE["base"]), r2(SILVER_PRICE["base"] * SELL_SPREAD)


def price_payload():
    buy, sell = gold_rate()
    change = r2(PRICE["base"] - PRICE["open"])
    silver_buy, silver_sell = silver_rate()
    silver_change = r2(SILVER_PRICE["base"] - SILVER_PRICE["open"])
    return {
        "purity": "24K (99.9%)", "buy": buy, "sell": sell,
        "change": change, "change_pct": r2(change / PRICE["open"] * 100) if PRICE["open"] else 0,
        "direction": "up" if PRICE["base"] >= PRICE["prev"] else "down",
        "gst_rate": GST_RATE, "updated_at": PRICE["updated_at"] or now_iso(),
        "silver": {
            "buy": silver_buy, "sell": silver_sell,
            "change": silver_change,
            "change_pct": r2(silver_change / SILVER_PRICE["open"] * 100) if SILVER_PRICE["open"] else 0,
            "direction": "up" if SILVER_PRICE["base"] >= SILVER_PRICE["prev"] else "down",
        },
    }


async def price_loop():
    while True:
        await asyncio.sleep(3)
        PRICE["prev"] = PRICE["base"]
        drift = (7285.50 - PRICE["base"]) * 0.05
        PRICE["base"] = r2(max(6900, min(7700, PRICE["base"] + drift + random.uniform(-4.5, 4.8))))
        PRICE["updated_at"] = now_iso()
        SILVER_PRICE["prev"] = SILVER_PRICE["base"]
        sd = (92.50 - SILVER_PRICE["base"]) * 0.05
        SILVER_PRICE["base"] = r2(max(80, min(110, SILVER_PRICE["base"] + sd + random.uniform(-0.15, 0.18))))
        SILVER_PRICE["updated_at"] = now_iso()


# ─── Auth Helpers ─────────────────────────────────────────────────────────────
def make_token(sub: str, role: str, extra: dict = None, days: int = 7):
    n = now_utc()
    payload = {"sub": sub, "role": role, "iat": n, "exp": n + timedelta(days=days)}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(creds: Optional[HTTPAuthorizationCredentials], role: str):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        p = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if p.get("role") != role:
        raise HTTPException(403, "Forbidden")
    return p


async def get_current_customer(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db: AsyncSession = Depends(get_db)):
    p = decode_token(creds, "customer")
    result = await db.execute(select(Customer).where(Customer.id == p["sub"]))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(401, "Customer not found")
    return customer


async def get_current_jeweller(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db: AsyncSession = Depends(get_db)):
    p = decode_token(creds, "jeweller")
    result = await db.execute(select(Jeweller).where(Jeweller.id == p["sub"]))
    jeweller = result.scalar_one_or_none()
    if not jeweller:
        raise HTTPException(401, "Jeweller not found")
    return jeweller


async def get_master_admin(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db: AsyncSession = Depends(get_db)):
    p = decode_token(creds, "master_admin")
    result = await db.execute(select(MasterAdmin).where(MasterAdmin.id == p["sub"]))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(401, "Admin not found")
    return admin


def otp_digest(code: str):
    return hmac.new(JWT_SECRET.encode(), code.encode(), hashlib.sha256).hexdigest()


def norm_phone(p: str):
    d = "".join(c for c in p if c.isdigit())
    return d[-10:]


def gen_wallet_id():
    return "VW" + secrets.token_hex(4).upper()


def gen_referral_code():
    return "VDG" + secrets.token_hex(3).upper()[:5]


def invoice_no():
    return "VDG" + now_utc().strftime("%y%m%d") + str(random.randint(10000, 99999))


def customer_dict(c: Customer):
    """Serialize customer for API response."""
    grams = c.gold_grams or 0
    return {
        "id": c.id, "phone": c.phone, "wallet_id": c.wallet_id,
        "first_name": c.first_name, "last_name": c.last_name,
        "name": f"{c.first_name} {c.last_name}".strip() or "Gold Saver",
        "email": c.email, "dob": c.dob, "gender": c.gender,
        "jeweller_id": c.jeweller_id,
        "gold_grams": r4(grams), "silver_grams": r4(c.silver_grams or 0),
        "invested": r2(c.invested or 0),
        "avg_buy_price": r2(c.invested / grams) if grams > 0 else 0,
        "kyc_status": c.kyc_status, "kyc": c.kyc_data or {},
        "referral_code": c.referral_code,
        "referral_balance": r2(c.referral_balance or 0),
        "wallet_balance": r2(c.wallet_balance or 0),
        "referred_by": c.referred_by,
        "created_at": c.created_at.isoformat() if c.created_at else "",
    }


def jeweller_dict(j: Jeweller):
    return {
        "id": j.id, "business_name": j.business_name, "owner_name": j.owner_name,
        "phone": j.phone, "email": j.email, "address": j.address,
        "city": j.city, "state": j.state, "pincode": j.pincode,
        "logo_url": j.logo_url, "primary_color": j.primary_color,
        "secondary_color": j.secondary_color, "domain": j.domain,
        "min_redemption_grams": j.min_redemption_grams,
        "status": j.status,
        "created_at": j.created_at.isoformat() if j.created_at else "",
    }


def txn_dict(t: Transaction):
    return {
        "id": t.id, "invoice_no": t.invoice_no, "customer_id": t.customer_id,
        "jeweller_id": t.jeweller_id, "type": t.type, "metal": t.metal,
        "grams": r4(t.grams), "rate": r2(t.rate), "amount": r2(t.amount),
        "gst": r2(t.gst), "total": r2(t.total), "method": t.method,
        "status": t.status, "note": t.note, "extra": t.extra or {},
        "created_at": t.created_at.isoformat() if t.created_at else "",
    }


# ─── Pydantic Models ─────────────────────────────────────────────────────────
class OtpRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=15)
    jeweller_id: str = ""


class OtpVerify(BaseModel):
    challenge_id: str
    otp: str = Field(pattern=r"^\d{6}$")
    jeweller_id: str = ""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    referral_code: Optional[str] = None


class BuyRequest(BaseModel):
    quote_id: str
    mode: str = "rupees"
    value: float = Field(gt=0)
    method: str = "upi"


class MockConfirm(BaseModel):
    method: str = "upi"
    success: bool = True


class SellRequest(BaseModel):
    grams: float = Field(gt=0)


class RedeemRequest(BaseModel):
    kind: str  # coin | product
    coin_grams: Optional[float] = None
    product_id: Optional[str] = None


class SipCreate(BaseModel):
    amount: float = Field(ge=100, le=100000)
    frequency: str = "monthly"


class GiftCreate(BaseModel):
    phone: str
    recipient_name: Optional[str] = None
    mode: str = "grams"
    value: float = Field(gt=0)
    theme: str = "diwali"
    message: str = Field(default="", max_length=240)


class AlertCreateModel(BaseModel):
    target: float = Field(gt=0)
    metal: str = "gold"
    alert_type: str = "alert"  # alert | book
    buy_amount: Optional[float] = None


class GoalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    occasion: str = "custom"
    target_grams: float = Field(gt=0, le=1000)
    months: int = Field(ge=1, le=120)


class KycSubmit(BaseModel):
    full_name: str = Field(min_length=2)
    aadhaar: str = Field(min_length=12, max_length=12)
    pan: str = Field(min_length=10, max_length=10)
    dob: str = ""


class WalletDeposit(BaseModel):
    amount: float = Field(gt=0, le=500000)


class WalletWithdraw(BaseModel):
    amount: float = Field(gt=0)


class JewellerOnboard(BaseModel):
    business_name: str = Field(min_length=2)
    owner_name: str = Field(min_length=2)
    phone: str = Field(min_length=10, max_length=15)
    email: str
    password: str = Field(min_length=4)
    pan: str = ""
    aadhaar: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    logo_url: str = ""
    primary_color: str = "#D4AF37"
    secondary_color: str = "#1A1A2E"
    domain: str = ""
    min_redemption_grams: float = 1.0


class JewellerLogin(BaseModel):
    email: str
    password: str


class MasterAdminLogin(BaseModel):
    username: str
    password: str


class RedemptionApprove(BaseModel):
    wallet_id: str
    grams: float = Field(gt=0)
    item: str = "Physical Gold"
    note: str = ""


class ProductCreate(BaseModel):
    name: str = Field(min_length=2)
    category: str = ""
    grams: float = Field(gt=0)
    making_charges: float = 0
    image_url: str = ""
    tag: str = ""
    description: str = ""


class PoolThresholdUpdate(BaseModel):
    threshold: float = Field(gt=0)


class MinRedemptionUpdate(BaseModel):
    min_grams: float = Field(gt=0)


# ─── Pool Logic ───────────────────────────────────────────────────────────────
async def add_to_pool(db: AsyncSession, txn: Transaction, customer: Customer):
    """Add grams to the active pool and check threshold."""
    result = await db.execute(
        select(PoolAccumulator).where(PoolAccumulator.status == "accumulating").order_by(desc(PoolAccumulator.created_at))
    )
    pool = result.scalar_one_or_none()
    if not pool:
        pool = PoolAccumulator(id=str(uuid.uuid4()), total_grams=0.0, threshold_grams=POOL_THRESHOLD)
        db.add(pool)
        await db.flush()

    contrib = PoolContribution(
        id=str(uuid.uuid4()), pool_id=pool.id, transaction_id=txn.id,
        customer_id=customer.id, jeweller_id=txn.jeweller_id, grams=txn.grams
    )
    db.add(contrib)
    pool.total_grams = r4(pool.total_grams + txn.grams)

    triggered = False
    if pool.total_grams >= pool.threshold_grams:
        pool.status = "triggered"
        pool.triggered_at = now_utc()
        triggered = True
        # Generate bifurcation invoice
        contribs = await db.execute(
            select(PoolContribution).where(PoolContribution.pool_id == pool.id)
        )
        details = []
        for c in contribs.scalars().all():
            j_result = await db.execute(select(Jeweller.business_name).where(Jeweller.id == c.jeweller_id))
            j_name = j_result.scalar_one_or_none() or "Unknown"
            cust_result = await db.execute(
                select(Customer.first_name, Customer.last_name).where(Customer.id == c.customer_id)
            )
            cust_row = cust_result.one_or_none()
            cust_name = f"{cust_row[0]} {cust_row[1]}".strip() if cust_row else "Customer"
            details.append({
                "jeweller_id": c.jeweller_id, "jeweller_name": j_name,
                "customer_id": c.customer_id, "customer_name": cust_name,
                "grams": r4(c.grams)
            })
        invoice = BifurcationInvoice(
            id=str(uuid.uuid4()), pool_id=pool.id,
            total_grams=r4(pool.total_grams), details=details
        )
        db.add(invoice)
        # Start a new pool
        new_pool = PoolAccumulator(id=str(uuid.uuid4()), total_grams=0.0, threshold_grams=pool.threshold_grams)
        db.add(new_pool)

    await db.flush()
    return pool, triggered


# ═══════════════════ PUBLIC ROUTES ════════════════════════════════════════════
@api.get("/")
async def root():
    return {"app": "Vaultra DigiGold", "version": "2.0"}


@api.get("/price")
async def get_price():
    return price_payload()


@api.get("/config")
async def config():
    return {"gst_rate": GST_RATE, "coins": [1, 2, 5, 10]}


@api.get("/health")
async def health():
    return {"status": "ok", "db": "postgresql"}


# ─── Jeweller Config (for white-label) ────────────────────────────────────────
@api.get("/jeweller/{jeweller_id}/config")
async def jeweller_config(jeweller_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Jeweller).where(Jeweller.id == jeweller_id, Jeweller.status == "active"))
    j = result.scalar_one_or_none()
    if not j:
        raise HTTPException(404, "Jeweller not found")
    return {
        "id": j.id, "business_name": j.business_name,
        "logo_url": j.logo_url, "primary_color": j.primary_color,
        "secondary_color": j.secondary_color,
        "min_redemption_grams": j.min_redemption_grams,
    }


@api.get("/jewellers/list")
async def list_jewellers_public(db: AsyncSession = Depends(get_db)):
    """Public list of active jewellers for app selection."""
    result = await db.execute(select(Jeweller).where(Jeweller.status == "active").order_by(Jeweller.business_name))
    return [{"id": j.id, "business_name": j.business_name, "city": j.city, "logo_url": j.logo_url} for j in result.scalars().all()]


# ─── Products (Public) ────────────────────────────────────────────────────────
@api.get("/products")
async def list_products(jeweller_id: str = "", category: str = "", db: AsyncSession = Depends(get_db)):
    q = select(Product).where(Product.is_active == True)
    if jeweller_id:
        q = q.where(Product.jeweller_id == jeweller_id)
    if category:
        q = q.where(Product.category == category)
    result = await db.execute(q.order_by(Product.created_at.desc()))
    prods = result.scalars().all()
    buy, _ = gold_rate()
    return [{
        "id": p.id, "name": p.name, "category": p.category, "grams": p.grams,
        "making_charges": p.making_charges, "image_url": p.image_url, "tag": p.tag,
        "description": p.description, "jeweller_id": p.jeweller_id,
        "gold_value": r2(p.grams * buy), "total_price": r2(p.grams * buy + p.making_charges),
        "live_rate": buy,
    } for p in prods]


@api.get("/products/{product_id}")
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Product not found")
    buy, _ = gold_rate()
    return {
        "id": p.id, "name": p.name, "category": p.category, "grams": p.grams,
        "making_charges": p.making_charges, "image_url": p.image_url, "tag": p.tag,
        "description": p.description, "jeweller_id": p.jeweller_id,
        "gold_value": r2(p.grams * buy), "total_price": r2(p.grams * buy + p.making_charges),
        "live_rate": buy,
        "features": ["24K 99.9% Pure Gold", "BIS Hallmarked", "LBMA Certified",
                      "Insured Delivery", "Lifetime Buyback Guarantee"],
    }


# ═══════════════════ CUSTOMER AUTH ════════════════════════════════════════════
@api.post("/auth/otp/request")
async def otp_request(body: OtpRequest, db: AsyncSession = Depends(get_db)):
    phone = norm_phone(body.phone)
    if len(phone) != 10:
        raise HTTPException(400, "Enter a valid 10-digit mobile number")

    # Find default jeweller if not specified
    jeweller_id = body.jeweller_id
    if not jeweller_id:
        result = await db.execute(select(Jeweller).where(Jeweller.status == "active").order_by(Jeweller.created_at).limit(1))
        j = result.scalar_one_or_none()
        if j:
            jeweller_id = j.id
        else:
            raise HTTPException(400, "No active jeweller found")

    # Rate limiting
    cutoff = now_utc() - timedelta(minutes=1)
    count_result = await db.execute(
        select(func.count()).select_from(OtpChallenge).where(
            OtpChallenge.phone == phone, OtpChallenge.created_at > cutoff
        )
    )
    if count_result.scalar() >= 5:
        raise HTTPException(429, "Too many requests. Try again in a minute")

    code = f"{secrets.randbelow(1_000_000):06d}"
    cid = str(uuid.uuid4())
    challenge = OtpChallenge(
        id=cid, phone=phone, jeweller_id=jeweller_id,
        digest=otp_digest(code), expires_at=now_utc() + timedelta(minutes=5)
    )
    db.add(challenge)
    await db.commit()

    # Check if user exists
    exists = await db.execute(
        select(Customer.id).where(Customer.phone == phone, Customer.jeweller_id == jeweller_id)
    )
    is_new = exists.scalar_one_or_none() is None

    return {"challenge_id": cid, "demo_otp": code, "expires_in": 300, "is_new_user": is_new, "jeweller_id": jeweller_id}


@api.post("/auth/otp/verify")
async def otp_verify(body: OtpVerify, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OtpChallenge).where(OtpChallenge.id == body.challenge_id))
    c = result.scalar_one_or_none()
    if not c or c.used or c.expires_at <= now_utc() or c.attempts >= 5:
        raise HTTPException(401, "Invalid or expired code")

    if not hmac.compare_digest(c.digest, otp_digest(body.otp)):
        c.attempts += 1
        await db.commit()
        raise HTTPException(401, f"Incorrect OTP. {4 - c.attempts + 1} attempts left")

    c.used = True
    await db.flush()

    jeweller_id = body.jeweller_id or c.jeweller_id

    # Find or create customer
    cust_result = await db.execute(
        select(Customer).where(Customer.phone == c.phone, Customer.jeweller_id == jeweller_id)
    )
    customer = cust_result.scalar_one_or_none()

    if not customer:
        fname = (body.first_name or "").strip()
        lname = (body.last_name or "").strip()
        customer = Customer(
            id=str(uuid.uuid4()), jeweller_id=jeweller_id, phone=c.phone,
            first_name=fname or "Gold", last_name=lname or "Saver",
            email=(body.email or "").strip(), dob=(body.dob or "").strip(),
            gender=(body.gender or "").strip(),
            wallet_id=gen_wallet_id(), referral_code=gen_referral_code(),
        )
        # Handle referral
        if body.referral_code:
            ref_result = await db.execute(
                select(Customer).where(Customer.referral_code == body.referral_code.strip().upper())
            )
            referrer = ref_result.scalar_one_or_none()
            if referrer and referrer.id != customer.id:
                customer.referred_by = referrer.id
                customer.referral_balance = 50.0
                referrer.referral_balance = (referrer.referral_balance or 0) + 50.0
                # Notifications
                db.add(Notification(
                    id=str(uuid.uuid4()), customer_id=referrer.id,
                    title="Referral Bonus!", type="referral",
                    message=f"Your friend {fname} joined! ₹50 added to your rewards."
                ))
                db.add(Notification(
                    id=str(uuid.uuid4()), customer_id=customer.id,
                    title="Welcome Bonus!", type="referral",
                    message="₹50 referral bonus credited to your rewards!"
                ))
        db.add(customer)

    await db.commit()
    await db.refresh(customer)

    token = make_token(customer.id, "customer", {"jeweller_id": jeweller_id})
    return {"access_token": token, "user": customer_dict(customer)}


# ═══════════════════ CUSTOMER ENDPOINTS ═══════════════════════════════════════
@api.get("/me")
async def me(customer: Customer = Depends(get_current_customer)):
    return customer_dict(customer)


@api.patch("/me")
async def update_me(
    first_name: Optional[str] = None, last_name: Optional[str] = None,
    customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)
):
    if first_name:
        customer.first_name = first_name.strip()
    if last_name:
        customer.last_name = last_name.strip()
    await db.commit()
    await db.refresh(customer)
    return customer_dict(customer)


# ─── KYC ──────────────────────────────────────────────────────────────────────
@api.post("/kyc/submit")
async def kyc_submit(body: KycSubmit, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    if customer.kyc_status in ("pending", "approved"):
        raise HTTPException(400, f"KYC already {customer.kyc_status}")
    customer.kyc_status = "pending"
    customer.kyc_data = {
        "full_name": body.full_name, "aadhaar": body.aadhaar,
        "pan": body.pan, "dob": body.dob, "submitted_at": now_iso()
    }
    await db.commit()
    await db.refresh(customer)
    return customer_dict(customer)


# ─── Vault ────────────────────────────────────────────────────────────────────
@api.get("/vault")
async def vault(customer: Customer = Depends(get_current_customer)):
    buy, sell = gold_rate()
    cu = customer_dict(customer)
    value = r2(cu["gold_grams"] * sell)
    pnl = r2(value - cu["invested"])
    pnl_pct = r2(pnl / cu["invested"] * 100) if cu["invested"] > 0 else 0
    return {
        "user": cu, "buy_rate": buy, "sell_rate": sell,
        "current_value": value, "unrealized_pnl": pnl, "unrealized_pct": pnl_pct,
    }


# ─── Transactions ─────────────────────────────────────────────────────────────
@api.get("/transactions")
async def my_transactions(
    type: Optional[str] = None,
    customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)
):
    q = select(Transaction).where(Transaction.customer_id == customer.id)
    if type and type != "all":
        q = q.where(Transaction.type == type)
    q = q.order_by(desc(Transaction.created_at)).limit(200)
    result = await db.execute(q)
    return [txn_dict(t) for t in result.scalars().all()]


# ─── Quote & Buy ──────────────────────────────────────────────────────────────
@api.post("/quote")
async def create_quote(
    metal: str = "gold",
    customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)
):
    if metal == "silver":
        buy, sell = silver_rate()
    else:
        buy, sell = gold_rate()
    exp = now_utc() + timedelta(seconds=QUOTE_SECONDS)
    q = Quote(
        id=str(uuid.uuid4()), jeweller_id=customer.jeweller_id,
        metal=metal, buy=buy, sell=sell, expires_at=exp
    )
    db.add(q)
    await db.commit()
    return {"id": q.id, "metal": metal, "buy": buy, "sell": sell,
            "expires_at": exp.isoformat(), "lock_seconds": QUOTE_SECONDS}


@api.post("/orders/buy")
async def buy(body: BuyRequest, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Quote).where(Quote.id == body.quote_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(400, "Price quote not found")
    if q.expires_at <= now_utc():
        raise HTTPException(409, "Price lock expired. Refresh the rate")

    rate = q.buy
    metal = q.metal or "gold"
    if body.mode == "grams":
        grams = r4(body.value)
        amount = r2(grams * rate)
    else:
        amount = r2(body.value)
        grams = r4(amount / rate)

    if amount < 10:
        raise HTTPException(400, "Minimum purchase is ₹10")
    gst = r2(amount * GST_RATE)
    total = r2(amount + gst)

    order = Order(
        id=str(uuid.uuid4()), customer_id=customer.id, jeweller_id=customer.jeweller_id,
        metal=metal, grams=grams, rate=rate, amount=amount, gst=gst, total=total,
        provider="mock"
    )
    db.add(order)
    await db.commit()
    return {
        "id": order.id, "metal": metal, "grams": r4(grams), "rate": rate,
        "amount": r2(amount), "gst": r2(gst), "total": r2(total),
        "status": "created", "provider": "mock"
    }


@api.post("/orders/{order_id}/mock-confirm")
async def mock_confirm(order_id: str, body: MockConfirm,
                       customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id, Order.customer_id == customer.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "created":
        raise HTTPException(400, "Order already processed")
    if not body.success:
        order.status = "failed"
        await db.commit()
        raise HTTPException(402, "Payment declined")

    order.status = "paid"
    order.method = body.method
    order.payment_id = "pay_mock_" + uuid.uuid4().hex[:14]
    order.paid_at = now_utc()

    # Credit gold/silver
    metal = order.metal or "gold"
    if metal == "silver":
        customer.silver_grams = r4((customer.silver_grams or 0) + order.grams)
    else:
        customer.gold_grams = r4((customer.gold_grams or 0) + order.grams)
        customer.invested = r2((customer.invested or 0) + order.amount)

    txn_type = f"buy{'_silver' if metal == 'silver' else ''}"
    txn = Transaction(
        id=str(uuid.uuid4()), invoice_no=invoice_no(), customer_id=customer.id,
        jeweller_id=customer.jeweller_id, type=txn_type, metal=metal,
        grams=order.grams, rate=order.rate, amount=order.amount,
        gst=order.gst, total=order.total, method=body.method,
        status="completed", extra={"order_id": order.id, "payment_id": order.payment_id},
        pool_contribution=True
    )
    db.add(txn)
    await db.flush()

    # Add to pool
    if metal == "gold":
        await add_to_pool(db, txn, customer)

    await db.commit()
    await db.refresh(customer)

    return {"status": "paid", "transaction": txn_dict(txn), "user": customer_dict(customer)}


# ─── Sell ─────────────────────────────────────────────────────────────────────
@api.post("/sell")
async def sell(body: SellRequest, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    if customer.kyc_status != "approved":
        raise HTTPException(403, "Complete KYC verification to sell gold")
    grams = r4(body.grams)
    if grams > (customer.gold_grams or 0):
        raise HTTPException(400, "Insufficient vault balance")
    _, rate = gold_rate()
    amount = r2(grams * rate)
    avg = (customer.invested / customer.gold_grams) if customer.gold_grams > 0 else 0
    customer.gold_grams = r4(customer.gold_grams - grams)
    customer.invested = r2(customer.invested - avg * grams)
    txn = Transaction(
        id=str(uuid.uuid4()), invoice_no=invoice_no(), customer_id=customer.id,
        jeweller_id=customer.jeweller_id, type="sell", grams=grams, rate=rate,
        amount=amount, gst=0, total=amount, method="bank_transfer", status="processing",
        note="Credit to linked bank account in T+1"
    )
    db.add(txn)
    await db.commit()
    return txn_dict(txn)


# ─── Redeem ───────────────────────────────────────────────────────────────────
@api.post("/redeem")
async def redeem(body: RedeemRequest, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    # Check minimum redemption for their jeweller
    j_result = await db.execute(select(Jeweller).where(Jeweller.id == customer.jeweller_id))
    jeweller = j_result.scalar_one_or_none()
    min_grams = jeweller.min_redemption_grams if jeweller else 1.0

    coins = [1, 2, 5, 10]
    making = 0
    if body.kind == "coin":
        if body.coin_grams not in coins:
            raise HTTPException(400, "Invalid coin denomination")
        grams = float(body.coin_grams)
        item = f"{body.coin_grams:g}g 24K Gold Coin"
        making = 250
    else:
        prod_result = await db.execute(select(Product).where(Product.id == body.product_id))
        p = prod_result.scalar_one_or_none()
        if not p:
            raise HTTPException(404, "Product not found")
        grams, item, making = p.grams, p.name, p.making_charges

    if grams < min_grams:
        raise HTTPException(400, f"Minimum redemption is {min_grams}g for your jeweller")
    if grams > (customer.gold_grams or 0):
        raise HTTPException(400, "Insufficient vault balance")

    buy_rate, _ = gold_rate()
    avg = (customer.invested / customer.gold_grams) if customer.gold_grams > 0 else 0
    customer.gold_grams = r4(customer.gold_grams - grams)
    customer.invested = r2(customer.invested - avg * grams)
    amount = r2(grams * buy_rate)

    otp = f"{secrets.randbelow(1_000_000):06d}"
    txn = Transaction(
        id=str(uuid.uuid4()), invoice_no=invoice_no(), customer_id=customer.id,
        jeweller_id=customer.jeweller_id, type="redemption", grams=grams, rate=buy_rate,
        amount=amount, gst=0, total=making, method="vault_gold", status="processing",
        note=f"{item} · In-store pickup", extra={"item": item, "making_charges": making}
    )
    db.add(txn)
    await db.flush()

    pickup = Pickup(
        id=str(uuid.uuid4()), customer_id=customer.id, jeweller_id=customer.jeweller_id,
        transaction_id=txn.id, item=item, grams=grams, making_charges=making, otp=otp
    )
    db.add(pickup)
    await db.commit()
    return {
        "transaction": txn_dict(txn),
        "pickup": {"id": pickup.id, "item": item, "grams": grams, "otp": otp, "status": "pending"},
        "wallet_id": customer.wallet_id,
    }


# ─── SIP ──────────────────────────────────────────────────────────────────────
@api.get("/sips")
async def list_sips(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SIP).where(SIP.customer_id == customer.id, SIP.status != "cancelled").order_by(desc(SIP.created_at))
    )
    sips = result.scalars().all()
    return [{"id": s.id, "amount": r2(s.amount), "frequency": s.frequency, "status": s.status,
             "installments": s.installments, "grams_accumulated": r4(s.grams_accumulated),
             "next_run": s.next_run.isoformat() if s.next_run else "", "created_at": s.created_at.isoformat()} for s in sips]


@api.post("/sips")
async def create_sip(body: SipCreate, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    days = {"daily": 1, "weekly": 7, "monthly": 30}.get(body.frequency, 30)
    sip = SIP(
        id=str(uuid.uuid4()), customer_id=customer.id, jeweller_id=customer.jeweller_id,
        amount=r2(body.amount), frequency=body.frequency,
        next_run=now_utc() + timedelta(days=days)
    )
    db.add(sip)
    await db.commit()
    return {"id": sip.id, "amount": r2(sip.amount), "frequency": sip.frequency, "status": "active",
            "installments": 0, "grams_accumulated": 0.0}


@api.post("/sips/{sip_id}/toggle")
async def toggle_sip(sip_id: str, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SIP).where(SIP.id == sip_id, SIP.customer_id == customer.id))
    sip = result.scalar_one_or_none()
    if not sip:
        raise HTTPException(404, "SIP not found")
    sip.status = "paused" if sip.status == "active" else "active"
    await db.commit()
    return {"id": sip.id, "status": sip.status}


@api.delete("/sips/{sip_id}")
async def cancel_sip(sip_id: str, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SIP).where(SIP.id == sip_id, SIP.customer_id == customer.id))
    sip = result.scalar_one_or_none()
    if not sip:
        raise HTTPException(404, "SIP not found")
    sip.status = "cancelled"
    await db.commit()
    return {"ok": True}


@api.post("/sips/{sip_id}/run")
async def run_sip(sip_id: str, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SIP).where(SIP.id == sip_id, SIP.customer_id == customer.id, SIP.status == "active"))
    sip = result.scalar_one_or_none()
    if not sip:
        raise HTTPException(404, "Active SIP not found")
    rate, _ = gold_rate()
    grams = r4(sip.amount / rate)
    gst = r2(sip.amount * GST_RATE)
    customer.gold_grams = r4((customer.gold_grams or 0) + grams)
    customer.invested = r2((customer.invested or 0) + sip.amount)
    txn = Transaction(
        id=str(uuid.uuid4()), invoice_no=invoice_no(), customer_id=customer.id,
        jeweller_id=customer.jeweller_id, type="sip", grams=grams, rate=rate,
        amount=sip.amount, gst=gst, total=r2(sip.amount + gst), method="upi_autopay",
        status="completed", note=f"{sip.frequency.title()} SIP installment",
        extra={"sip_id": sip_id}, pool_contribution=True
    )
    db.add(txn)
    sip.installments += 1
    sip.grams_accumulated = r4(sip.grams_accumulated + grams)
    days = {"daily": 1, "weekly": 7, "monthly": 30}.get(sip.frequency, 30)
    sip.next_run = now_utc() + timedelta(days=days)
    await db.flush()
    await add_to_pool(db, txn, customer)
    await db.commit()
    return txn_dict(txn)


# ─── Gifts ────────────────────────────────────────────────────────────────────
GIFT_THEMES = ("diwali", "birthday", "wedding", "thank_you", "congrats")


@api.post("/gifts")
async def send_gift(body: GiftCreate, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    phone = norm_phone(body.phone)
    if len(phone) != 10:
        raise HTTPException(400, "Enter a valid 10-digit mobile number")
    if phone == customer.phone:
        raise HTTPException(400, "You can't gift gold to yourself")
    if body.theme not in GIFT_THEMES:
        raise HTTPException(400, "Invalid greeting card")

    rate, _ = gold_rate()
    g = r4(body.value) if body.mode == "grams" else r4(body.value / rate)
    if g < 0.001:
        raise HTTPException(400, "Minimum gift is 0.001g")
    if g > (customer.gold_grams or 0):
        raise HTTPException(400, "Insufficient vault balance")

    avg = (customer.invested / customer.gold_grams) if customer.gold_grams > 0 else 0
    customer.gold_grams = r4(customer.gold_grams - g)
    customer.invested = r2(customer.invested - avg * g)
    amount = r2(g * rate)

    # Find or create recipient
    rec_result = await db.execute(select(Customer).where(Customer.phone == phone, Customer.jeweller_id == customer.jeweller_id))
    rec = rec_result.scalar_one_or_none()
    if not rec:
        rec = Customer(
            id=str(uuid.uuid4()), jeweller_id=customer.jeweller_id, phone=phone,
            first_name=(body.recipient_name or "Gold").strip(), last_name="Saver",
            wallet_id=gen_wallet_id(), referral_code=gen_referral_code(),
        )
        db.add(rec)
        await db.flush()

    rec.gold_grams = r4((rec.gold_grams or 0) + g)
    rec.invested = r2((rec.invested or 0) + amount)

    gift = Gift(
        id=str(uuid.uuid4()), sender_id=customer.id, recipient_id=rec.id,
        jeweller_id=customer.jeweller_id, grams=g, rate=rate, amount=amount,
        theme=body.theme, message=body.message.strip()
    )
    db.add(gift)
    # Create transactions
    t1 = Transaction(id=str(uuid.uuid4()), invoice_no=invoice_no(), customer_id=customer.id,
                     jeweller_id=customer.jeweller_id, type="gift_sent", grams=g, rate=rate,
                     amount=amount, total=amount, method="vault_gold", note=f"Gift to {rec.first_name}")
    t2 = Transaction(id=str(uuid.uuid4()), invoice_no=invoice_no(), customer_id=rec.id,
                     jeweller_id=customer.jeweller_id, type="gift_received", grams=g, rate=rate,
                     amount=amount, total=amount, method="vault_gold",
                     note=f"Gift from {customer.first_name}")
    db.add(t1)
    db.add(t2)
    await db.commit()
    return {"id": gift.id, "grams": r4(g), "amount": r2(amount), "recipient_phone": phone}


@api.get("/gifts")
async def list_gifts(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    sent = await db.execute(select(Gift).where(Gift.sender_id == customer.id).order_by(desc(Gift.created_at)))
    received = await db.execute(select(Gift).where(Gift.recipient_id == customer.id).order_by(desc(Gift.created_at)))
    sent_list = [{"id": g.id, "grams": r4(g.grams), "amount": r2(g.amount), "theme": g.theme,
                  "message": g.message, "created_at": g.created_at.isoformat()} for g in sent.scalars().all()]
    rec_list = [{"id": g.id, "grams": r4(g.grams), "amount": r2(g.amount), "theme": g.theme,
                 "message": g.message, "seen": g.seen, "created_at": g.created_at.isoformat()} for g in received.scalars().all()]
    return {"sent": sent_list, "received": rec_list, "unseen": sum(1 for r in rec_list if not r.get("seen"))}


# ─── Alerts ───────────────────────────────────────────────────────────────────
@api.get("/alerts")
async def list_alerts(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Alert).where(Alert.customer_id == customer.id, Alert.status != "deleted").order_by(desc(Alert.created_at))
    )
    return [{"id": a.id, "target": r2(a.target), "metal": a.metal, "alert_type": a.alert_type,
             "buy_amount": r2(a.buy_amount or 0), "status": a.status,
             "created_at": a.created_at.isoformat()} for a in result.scalars().all()]


@api.post("/alerts")
async def create_alert(body: AlertCreateModel, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    alert = Alert(
        id=str(uuid.uuid4()), customer_id=customer.id, jeweller_id=customer.jeweller_id,
        target=r2(body.target), metal=body.metal, alert_type=body.alert_type,
        buy_amount=r2(body.buy_amount or 0)
    )
    db.add(alert)
    await db.commit()
    return {"id": alert.id, "target": r2(alert.target), "metal": alert.metal,
            "alert_type": alert.alert_type, "status": "active"}


@api.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.customer_id == customer.id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Alert not found")
    a.status = "deleted"
    await db.commit()
    return {"ok": True}


# ─── Goals ────────────────────────────────────────────────────────────────────
@api.get("/goals")
async def list_goals(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Goal).where(Goal.customer_id == customer.id).order_by(Goal.created_at))
    return [{"id": g.id, "name": g.name, "occasion": g.occasion, "target_grams": r4(g.target_grams),
             "months": g.months, "deadline": g.deadline.isoformat() if g.deadline else "",
             "start_grams": r4(g.start_grams), "created_at": g.created_at.isoformat()} for g in result.scalars().all()]


@api.post("/goals")
async def create_goal(body: GoalCreate, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    count = await db.execute(select(func.count()).select_from(Goal).where(Goal.customer_id == customer.id))
    if count.scalar() >= 5:
        raise HTTPException(400, "You can have up to 5 goals")
    goal = Goal(
        id=str(uuid.uuid4()), customer_id=customer.id, name=body.name.strip(),
        occasion=body.occasion, target_grams=r4(body.target_grams), months=body.months,
        deadline=now_utc() + timedelta(days=round(body.months * 30.44)),
        start_grams=r4(customer.gold_grams or 0)
    )
    db.add(goal)
    await db.commit()
    return {"id": goal.id, "name": goal.name, "target_grams": r4(goal.target_grams), "months": goal.months}


@api.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Goal).where(Goal.id == goal_id, Goal.customer_id == customer.id))
    g = result.scalar_one_or_none()
    if not g:
        raise HTTPException(404, "Goal not found")
    await db.delete(g)
    await db.commit()
    return {"ok": True}


# ─── Wallet ───────────────────────────────────────────────────────────────────
@api.get("/wallet")
async def wallet_info(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WalletTransaction).where(WalletTransaction.customer_id == customer.id).order_by(desc(WalletTransaction.created_at)).limit(100)
    )
    txns = [{"id": t.id, "type": t.type, "amount": r2(t.amount), "description": t.description,
             "created_at": t.created_at.isoformat()} for t in result.scalars().all()]
    return {
        "balance": r2(customer.wallet_balance or 0),
        "referral_balance": r2(customer.referral_balance or 0),
        "transactions": txns
    }


@api.post("/wallet/deposit")
async def wallet_deposit(body: WalletDeposit, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    txn = WalletTransaction(
        id=str(uuid.uuid4()), customer_id=customer.id, type="deposit",
        amount=r2(body.amount), description="Wallet deposit via UPI"
    )
    db.add(txn)
    customer.wallet_balance = r2((customer.wallet_balance or 0) + body.amount)
    await db.commit()
    return {"ok": True, "balance": r2(customer.wallet_balance)}


@api.post("/wallet/withdraw")
async def wallet_withdraw(body: WalletWithdraw, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    if body.amount > (customer.wallet_balance or 0):
        raise HTTPException(400, "Insufficient wallet balance")
    txn = WalletTransaction(
        id=str(uuid.uuid4()), customer_id=customer.id, type="withdraw",
        amount=r2(body.amount), description="Wallet withdrawal to bank"
    )
    db.add(txn)
    customer.wallet_balance = r2((customer.wallet_balance or 0) - body.amount)
    await db.commit()
    return {"ok": True, "balance": r2(customer.wallet_balance)}


# ─── Referral ─────────────────────────────────────────────────────────────────
@api.get("/referral")
async def referral_info(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    count = await db.execute(select(func.count()).select_from(Customer).where(Customer.referred_by == customer.id))
    refs = await db.execute(
        select(Customer.first_name, Customer.last_name, Customer.created_at)
        .where(Customer.referred_by == customer.id).order_by(desc(Customer.created_at)).limit(50)
    )
    referrals = [{"name": f"{r[0]} {r[1]}".strip(), "joined": r[2].isoformat() if r[2] else ""} for r in refs.all()]
    return {
        "referral_code": customer.referral_code,
        "referral_balance": r2(customer.referral_balance or 0),
        "referral_count": count.scalar(),
        "referrals": referrals,
    }


# ─── Notifications ────────────────────────────────────────────────────────────
@api.get("/notifications")
async def list_notifications(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification).where(Notification.customer_id == customer.id).order_by(desc(Notification.created_at)).limit(50)
    )
    notifs = [{"id": n.id, "title": n.title, "message": n.message, "type": n.type,
               "read": n.read, "created_at": n.created_at.isoformat()} for n in result.scalars().all()]
    return {"notifications": notifs, "unread_count": sum(1 for n in notifs if not n.get("read"))}


@api.post("/notifications/mark-read")
async def mark_notifications_read(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(Notification).where(Notification.customer_id == customer.id, Notification.read == False).values(read=True)
    )
    await db.commit()
    return {"ok": True}


# ═══════════════════ JEWELLER ADMIN ═══════════════════════════════════════════
@api.post("/jeweller/login")
async def jeweller_login(body: JewellerLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Jeweller).where(Jeweller.email == body.email.strip().lower()))
    j = result.scalar_one_or_none()
    if not j or not bcrypt.checkpw(body.password.encode(), j.password_hash.encode()):
        raise HTTPException(401, "Invalid email or password")
    if j.status != "active":
        raise HTTPException(403, "Account suspended")
    return {"access_token": make_token(j.id, "jeweller", days=1), "jeweller": jeweller_dict(j)}


@api.get("/jeweller/me")
async def jeweller_me(jeweller: Jeweller = Depends(get_current_jeweller)):
    return jeweller_dict(jeweller)


@api.get("/jeweller/dashboard")
async def jeweller_dashboard(jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    # Customer count
    cust_count = await db.execute(select(func.count()).select_from(Customer).where(Customer.jeweller_id == jeweller.id))
    # Total grams
    grams_result = await db.execute(
        select(func.sum(Customer.gold_grams)).where(Customer.jeweller_id == jeweller.id)
    )
    # Total revenue
    rev_result = await db.execute(
        select(func.sum(Transaction.total)).where(
            Transaction.jeweller_id == jeweller.id, Transaction.status == "completed",
            Transaction.type.in_(["buy", "sip", "buy_silver"])
        )
    )
    # Active wallets
    active_wallets = await db.execute(
        select(func.count()).select_from(Customer).where(Customer.jeweller_id == jeweller.id, Customer.gold_grams > 0)
    )
    # Pending pickups
    pending_pickups = await db.execute(
        select(func.count()).select_from(Pickup).where(Pickup.jeweller_id == jeweller.id, Pickup.status == "pending")
    )
    # Pending KYC
    pending_kyc = await db.execute(
        select(func.count()).select_from(Customer).where(Customer.jeweller_id == jeweller.id, Customer.kyc_status == "pending")
    )
    return {
        "customers": cust_count.scalar() or 0,
        "total_grams": r4(grams_result.scalar() or 0),
        "total_revenue": r2(rev_result.scalar() or 0),
        "active_wallets": active_wallets.scalar() or 0,
        "pending_pickups": pending_pickups.scalar() or 0,
        "pending_kyc": pending_kyc.scalar() or 0,
        "min_redemption_grams": jeweller.min_redemption_grams,
        "price": price_payload(),
    }


@api.get("/jeweller/customers")
async def jeweller_customers(search: str = "", jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    q = select(Customer).where(Customer.jeweller_id == jeweller.id)
    if search:
        q = q.where(or_(Customer.phone.contains(search), Customer.first_name.ilike(f"%{search}%")))
    result = await db.execute(q.order_by(desc(Customer.created_at)).limit(500))
    return [customer_dict(c) for c in result.scalars().all()]


@api.get("/jeweller/customers/lookup")
async def jeweller_lookup(wallet_id: str = "", phone: str = "",
                          jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    """Lookup customer by Wallet ID or phone for redemption."""
    q = select(Customer).where(Customer.jeweller_id == jeweller.id)
    if wallet_id:
        q = q.where(Customer.wallet_id == wallet_id.strip().upper())
    elif phone:
        q = q.where(Customer.phone == norm_phone(phone))
    else:
        raise HTTPException(400, "Provide wallet_id or phone")
    result = await db.execute(q)
    c = result.scalar_one_or_none()
    return {"found": bool(c), "customer": customer_dict(c) if c else None}


@api.post("/jeweller/redemption/approve")
async def jeweller_approve_redemption(body: RedemptionApprove, jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    """Jeweller verifies Wallet ID and approves redemption (deducts grams)."""
    result = await db.execute(
        select(Customer).where(Customer.wallet_id == body.wallet_id.strip().upper(), Customer.jeweller_id == jeweller.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "Customer not found with this Wallet ID")
    if body.grams > (customer.gold_grams or 0):
        raise HTTPException(400, f"Customer has only {r4(customer.gold_grams)}g available")
    if body.grams < jeweller.min_redemption_grams:
        raise HTTPException(400, f"Minimum redemption is {jeweller.min_redemption_grams}g")

    avg = (customer.invested / customer.gold_grams) if customer.gold_grams > 0 else 0
    customer.gold_grams = r4(customer.gold_grams - body.grams)
    customer.invested = r2(customer.invested - avg * body.grams)
    buy_rate, _ = gold_rate()
    amount = r2(body.grams * buy_rate)

    txn = Transaction(
        id=str(uuid.uuid4()), invoice_no=invoice_no(), customer_id=customer.id,
        jeweller_id=jeweller.id, type="redemption", grams=body.grams, rate=buy_rate,
        amount=amount, total=amount, method="in_store", status="completed",
        note=f"{body.item} - Redeemed at store. {body.note}".strip(),
        extra={"item": body.item, "approved_by": jeweller.owner_name}
    )
    db.add(txn)
    await db.commit()
    return {"ok": True, "transaction": txn_dict(txn), "customer": customer_dict(customer)}


@api.get("/jeweller/transactions")
async def jeweller_transactions(type: str = "", jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    q = select(Transaction).where(Transaction.jeweller_id == jeweller.id)
    if type and type != "all":
        q = q.where(Transaction.type == type)
    result = await db.execute(q.order_by(desc(Transaction.created_at)).limit(200))
    return [txn_dict(t) for t in result.scalars().all()]


@api.get("/jeweller/pickups")
async def jeweller_pickups(status: str = "pending", jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Pickup).where(Pickup.jeweller_id == jeweller.id, Pickup.status == status).order_by(Pickup.created_at)
    )
    pickups = result.scalars().all()
    out = []
    for p in pickups:
        c_result = await db.execute(select(Customer).where(Customer.id == p.customer_id))
        c = c_result.scalar_one_or_none()
        out.append({
            "id": p.id, "item": p.item, "grams": r4(p.grams),
            "making_charges": r2(p.making_charges), "status": p.status,
            "customer_name": f"{c.first_name} {c.last_name}".strip() if c else "Customer",
            "wallet_id": c.wallet_id if c else "",
            "created_at": p.created_at.isoformat() if p.created_at else "",
        })
    return out


@api.post("/jeweller/pickups/{pickup_id}/collect")
async def jeweller_collect(pickup_id: str, otp: str = "",
                           jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Pickup).where(Pickup.id == pickup_id, Pickup.jeweller_id == jeweller.id, Pickup.status == "pending")
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Pending pickup not found")
    if p.locked:
        raise HTTPException(423, "Pickup locked after too many failed attempts")
    if not hmac.compare_digest(p.otp, otp):
        p.attempts += 1
        if p.attempts >= 5:
            p.locked = True
        await db.commit()
        raise HTTPException(400, f"Incorrect OTP. {5 - p.attempts} attempts left")
    p.status = "collected"
    p.collected_at = now_utc()
    p.collected_by = jeweller.owner_name
    await db.execute(update(Transaction).where(Transaction.id == p.transaction_id).values(status="completed"))
    await db.commit()
    return {"ok": True, "collected_at": p.collected_at.isoformat()}


@api.get("/jeweller/kyc-queue")
async def jeweller_kyc_queue(jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer).where(Customer.jeweller_id == jeweller.id, Customer.kyc_status == "pending").order_by(Customer.created_at)
    )
    return [customer_dict(c) for c in result.scalars().all()]


@api.post("/jeweller/kyc/{customer_id}/decide")
async def jeweller_kyc_decide(customer_id: str, approve: bool = True, note: str = "",
                              jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.jeweller_id == jeweller.id, Customer.kyc_status == "pending")
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "No pending KYC for this customer")
    c.kyc_status = "approved" if approve else "rejected"
    kyc = c.kyc_data or {}
    kyc["reviewed_by"] = jeweller.owner_name
    kyc["reviewed_at"] = now_iso()
    kyc["note"] = note
    c.kyc_data = kyc
    await db.commit()
    return customer_dict(c)


@api.put("/jeweller/settings/min-redemption")
async def update_min_redemption(body: MinRedemptionUpdate, jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    jeweller.min_redemption_grams = body.min_grams
    await db.commit()
    return {"ok": True, "min_redemption_grams": jeweller.min_redemption_grams}


# ─── Jeweller Product Catalog ────────────────────────────────────────────────
@api.get("/jeweller/products")
async def jeweller_products(jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product).where(Product.jeweller_id == jeweller.id).order_by(desc(Product.created_at))
    )
    buy, _ = gold_rate()
    return [{
        "id": p.id, "name": p.name, "category": p.category, "grams": p.grams,
        "making_charges": p.making_charges, "image_url": p.image_url, "tag": p.tag,
        "description": p.description, "is_active": p.is_active,
        "gold_value": r2(p.grams * buy), "total_price": r2(p.grams * buy + p.making_charges),
    } for p in result.scalars().all()]


@api.post("/jeweller/products")
async def jeweller_add_product(body: ProductCreate, jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    p = Product(
        id=str(uuid.uuid4()), jeweller_id=jeweller.id, name=body.name,
        category=body.category, grams=body.grams, making_charges=body.making_charges,
        image_url=body.image_url, tag=body.tag, description=body.description
    )
    db.add(p)
    await db.commit()
    return {"id": p.id, "name": p.name}


@api.delete("/jeweller/products/{product_id}")
async def jeweller_delete_product(product_id: str, jeweller: Jeweller = Depends(get_current_jeweller), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id, Product.jeweller_id == jeweller.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Product not found")
    p.is_active = False
    await db.commit()
    return {"ok": True}


# ═══════════════════ MASTER ADMIN ═════════════════════════════════════════════
@api.post("/master/login")
async def master_login(body: MasterAdminLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MasterAdmin).where(MasterAdmin.username == body.username))
    admin = result.scalar_one_or_none()
    if not admin or not bcrypt.checkpw(body.password.encode(), admin.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": make_token(admin.id, "master_admin", days=1), "admin": {"id": admin.id, "name": admin.name}}


@api.get("/master/dashboard")
async def master_dashboard(admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    jeweller_count = await db.execute(select(func.count()).select_from(Jeweller))
    customer_count = await db.execute(select(func.count()).select_from(Customer))
    total_grams = await db.execute(select(func.sum(Customer.gold_grams)))
    total_revenue = await db.execute(
        select(func.sum(Transaction.total)).where(Transaction.status == "completed", Transaction.type.in_(["buy", "sip", "buy_silver"]))
    )
    # Current pool
    pool_result = await db.execute(
        select(PoolAccumulator).where(PoolAccumulator.status == "accumulating").order_by(desc(PoolAccumulator.created_at)).limit(1)
    )
    pool = pool_result.scalar_one_or_none()

    return {
        "jewellers": jeweller_count.scalar() or 0,
        "customers": customer_count.scalar() or 0,
        "total_grams": r4(total_grams.scalar() or 0),
        "total_revenue": r2(total_revenue.scalar() or 0),
        "pool": {
            "current_grams": r4(pool.total_grams) if pool else 0,
            "threshold": pool.threshold_grams if pool else POOL_THRESHOLD,
            "progress_pct": r2((pool.total_grams / pool.threshold_grams) * 100) if pool and pool.threshold_grams else 0,
        },
        "price": price_payload(),
    }


@api.get("/master/jewellers")
async def master_jewellers(admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Jeweller).order_by(desc(Jeweller.created_at)))
    jewellers = result.scalars().all()
    out = []
    for j in jewellers:
        cust_count = await db.execute(select(func.count()).select_from(Customer).where(Customer.jeweller_id == j.id))
        grams_sum = await db.execute(select(func.sum(Customer.gold_grams)).where(Customer.jeweller_id == j.id))
        out.append(jeweller_dict(j) | {"customer_count": cust_count.scalar() or 0, "total_grams": r4(grams_sum.scalar() or 0)})
    return out


@api.post("/master/jewellers")
async def master_onboard_jeweller(body: JewellerOnboard, admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    # Check uniqueness
    existing = await db.execute(select(Jeweller).where(or_(Jeweller.email == body.email.lower(), Jeweller.phone == norm_phone(body.phone))))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Jeweller with this email or phone already exists")

    j = Jeweller(
        id=str(uuid.uuid4()), business_name=body.business_name.strip(),
        owner_name=body.owner_name.strip(), phone=norm_phone(body.phone),
        email=body.email.strip().lower(),
        password_hash=bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
        pan=body.pan, aadhaar=body.aadhaar, address=body.address,
        city=body.city, state=body.state, pincode=body.pincode,
        logo_url=body.logo_url, primary_color=body.primary_color,
        secondary_color=body.secondary_color, domain=body.domain,
        min_redemption_grams=body.min_redemption_grams,
    )
    db.add(j)

    # Add default products for the jeweller
    default_products = [
        ("Heritage 24K Necklace", "necklaces", 12.5, 4850, "Trending"),
        ("Minimalist Gold Bangle", "bangles", 8.2, 2650, "Bestseller"),
        ("Classic Solitaire Ring", "rings", 3.4, 1150, "New"),
        ("Rope Twist Chain", "chains", 6.8, 1980, "Trending"),
        ("Royal Kada", "kadas", 15.0, 5200, "Premium"),
        ("Lakshmi Pendant Set", "pendant-sets", 9.6, 3400, "Festive"),
        ("Gold Dial Watch", "watches", 18.0, 7900, "Luxury"),
        ("Tanmaniya Mangalsutra", "necklaces", 7.1, 2300, "Classic"),
    ]
    for name, cat, grams, mc, tag in default_products:
        db.add(Product(
            id=str(uuid.uuid4()), jeweller_id=j.id, name=name,
            category=cat, grams=grams, making_charges=mc, tag=tag,
            description=f"Exquisite {name} in 24K 99.9% pure gold. Weight: {grams}g. BIS Hallmarked."
        ))

    await db.commit()
    return jeweller_dict(j)


@api.post("/master/jewellers/{jeweller_id}/toggle")
async def master_toggle_jeweller(jeweller_id: str, admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Jeweller).where(Jeweller.id == jeweller_id))
    j = result.scalar_one_or_none()
    if not j:
        raise HTTPException(404, "Jeweller not found")
    j.status = "suspended" if j.status == "active" else "active"
    await db.commit()
    return {"id": j.id, "status": j.status}


@api.get("/master/pool")
async def master_pool(admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    pools = await db.execute(select(PoolAccumulator).order_by(desc(PoolAccumulator.created_at)).limit(10))
    return [{"id": p.id, "total_grams": r4(p.total_grams), "threshold": p.threshold_grams,
             "status": p.status, "triggered_at": p.triggered_at.isoformat() if p.triggered_at else None,
             "created_at": p.created_at.isoformat()} for p in pools.scalars().all()]


@api.get("/master/bifurcation-invoices")
async def master_invoices(admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BifurcationInvoice).order_by(desc(BifurcationInvoice.created_at)).limit(20))
    return [{"id": i.id, "pool_id": i.pool_id, "total_grams": r4(i.total_grams),
             "details": i.details, "status": i.status,
             "created_at": i.created_at.isoformat()} for i in result.scalars().all()]


@api.get("/master/transactions")
async def master_transactions(jeweller_id: str = "", type: str = "",
                              admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    q = select(Transaction)
    if jeweller_id:
        q = q.where(Transaction.jeweller_id == jeweller_id)
    if type and type != "all":
        q = q.where(Transaction.type == type)
    result = await db.execute(q.order_by(desc(Transaction.created_at)).limit(200))
    return [txn_dict(t) for t in result.scalars().all()]


@api.get("/master/customers")
async def master_customers(jeweller_id: str = "", search: str = "",
                           admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    q = select(Customer)
    if jeweller_id:
        q = q.where(Customer.jeweller_id == jeweller_id)
    if search:
        q = q.where(or_(Customer.phone.contains(search), Customer.first_name.ilike(f"%{search}%")))
    result = await db.execute(q.order_by(desc(Customer.created_at)).limit(500))
    return [customer_dict(c) for c in result.scalars().all()]


@api.put("/master/pool/threshold")
async def master_update_threshold(body: PoolThresholdUpdate, admin: MasterAdmin = Depends(get_master_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PoolAccumulator).where(PoolAccumulator.status == "accumulating").order_by(desc(PoolAccumulator.created_at)).limit(1)
    )
    pool = result.scalar_one_or_none()
    if pool:
        pool.threshold_grams = body.threshold
    await db.commit()
    return {"ok": True, "threshold": body.threshold}


@api.get("/master/rate")
async def master_rate(admin: MasterAdmin = Depends(get_master_admin)):
    return price_payload()


# ═══════════════════ SEED DATA ════════════════════════════════════════════════
async def seed_data():
    """Seed demo jeweller, customers, and master admin."""
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        existing = await db.execute(select(MasterAdmin).where(MasterAdmin.username == "admin"))
        if existing.scalar_one_or_none():
            logger.info("Database already seeded")
            return

        # Master admin
        admin = MasterAdmin(
            id=str(uuid.uuid4()), username="admin", name="Vaultra Super Admin",
            password_hash=bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
        )
        db.add(admin)

        # Demo jeweller
        jeweller = Jeweller(
            id="demo-jeweller-001", business_name="Sharma Gold & Jewellers",
            owner_name="Rajesh Sharma", phone="9999000001",
            email="sharma@vaultra.in",
            password_hash=bcrypt.hashpw("jeweller123".encode(), bcrypt.gensalt()).decode(),
            address="Shop No. 12, Gold Market", city="Mumbai", state="Maharashtra",
            pincode="400001", primary_color="#D4AF37", secondary_color="#1A1A2E",
            min_redemption_grams=1.0,
        )
        db.add(jeweller)

        # Second jeweller
        jeweller2 = Jeweller(
            id="demo-jeweller-002", business_name="Patel Jewellery House",
            owner_name="Amit Patel", phone="9999000002",
            email="patel@vaultra.in",
            password_hash=bcrypt.hashpw("jeweller123".encode(), bcrypt.gensalt()).decode(),
            address="15, Jewellers Lane", city="Ahmedabad", state="Gujarat",
            pincode="380001", primary_color="#B8860B", secondary_color="#2D2D44",
            min_redemption_grams=0.5,
        )
        db.add(jeweller2)

        await db.flush()

        # Default products for jewellers
        for jid in [jeweller.id, jeweller2.id]:
            products_data = [
                ("Heritage 24K Necklace", "necklaces", 12.5, 4850, "Trending"),
                ("Minimalist Gold Bangle", "bangles", 8.2, 2650, "Bestseller"),
                ("Classic Solitaire Ring", "rings", 3.4, 1150, "New"),
                ("Rope Twist Chain", "chains", 6.8, 1980, "Trending"),
                ("Royal Kada", "kadas", 15.0, 5200, "Premium"),
                ("Lakshmi Pendant Set", "pendant-sets", 9.6, 3400, "Festive"),
                ("Gold Dial Watch", "watches", 18.0, 7900, "Luxury"),
                ("Tanmaniya Mangalsutra", "necklaces", 7.1, 2300, "Classic"),
            ]
            for name, cat, grams, mc, tag in products_data:
                db.add(Product(
                    id=str(uuid.uuid4()), jeweller_id=jid, name=name,
                    category=cat, grams=grams, making_charges=mc, tag=tag,
                    description=f"Exquisite {name} in 24K 99.9% pure gold. Weight: {grams}g. BIS Hallmarked."
                ))

        # Create initial pool
        pool = PoolAccumulator(id=str(uuid.uuid4()), total_grams=0.0, threshold_grams=POOL_THRESHOLD)
        db.add(pool)

        # Demo customers for jeweller 1
        base = now_utc()
        demo_customers = [
            ("9876543210", "Aarav", "Sharma", "approved"),
            ("9812345670", "Diya", "Patel", "pending"),
            ("9823456781", "Kabir", "Singh", "not_submitted"),
            ("9834567892", "Meera", "Iyer", "approved"),
        ]
        for phone, fname, lname, kyc in demo_customers:
            kyc_data = {}
            if kyc != "not_submitted":
                kyc_data = {
                    "full_name": f"{fname} {lname}", "aadhaar": f"{random.randint(200000000000, 999999999999)}",
                    "pan": f"{''.join(random.choice('ABCDEFGHJKL') for _ in range(5))}{random.randint(1000, 9999)}{'ABCFGHLPT'[random.randint(0,8)]}",
                    "dob": f"19{random.randint(80, 99)}-0{random.randint(1,9)}-{random.randint(10,28)}",
                    "submitted_at": now_iso(),
                }
                if kyc == "approved":
                    kyc_data["reviewed_by"] = "Rajesh Sharma"
                    kyc_data["reviewed_at"] = now_iso()

            c = Customer(
                id=str(uuid.uuid4()), jeweller_id=jeweller.id, phone=phone,
                first_name=fname, last_name=lname,
                wallet_id=gen_wallet_id(), referral_code=gen_referral_code(),
                kyc_status=kyc, kyc_data=kyc_data,
                gold_grams=0.0, silver_grams=0.0, invested=0.0,
                created_at=base - timedelta(days=random.randint(10, 60))
            )
            db.add(c)
            await db.flush()

            # Seed some transactions
            seed_txns = []
            for _ in range(random.randint(2, 4)):
                rate = r2(7120 + random.uniform(-60, 120))
                amount = float(random.choice([1000, 2000, 2500, 5000]))
                grams = r4(amount / rate)
                c.gold_grams = r4(c.gold_grams + grams)
                c.invested = r2(c.invested + amount)
                gst = r2(amount * GST_RATE)
                txn = Transaction(
                    id=str(uuid.uuid4()), invoice_no=invoice_no(), customer_id=c.id,
                    jeweller_id=jeweller.id, type=random.choice(["buy", "buy", "sip"]),
                    grams=grams, rate=rate, amount=amount, gst=gst,
                    total=r2(amount + gst), method="upi", status="completed",
                    pool_contribution=True,
                    created_at=base - timedelta(days=random.randint(1, 30))
                )
                db.add(txn)
                seed_txns.append((txn, c, grams))
                pool.total_grams = r4(pool.total_grams + grams)

            # Flush transactions first so FKs are satisfied
            await db.flush()
            for txn, cust, g in seed_txns:
                db.add(PoolContribution(
                    id=str(uuid.uuid4()), pool_id=pool.id, transaction_id=txn.id,
                    customer_id=cust.id, jeweller_id=jeweller.id, grams=g
                ))

        # Demo customers for jeweller 2
        for phone, fname, lname, kyc in [("9845678903", "Rohan", "Gupta", "approved"), ("9856789014", "Ananya", "Reddy", "pending")]:
            kyc_data = {}
            if kyc != "not_submitted":
                kyc_data = {"full_name": f"{fname} {lname}", "aadhaar": f"{random.randint(200000000000, 999999999999)}",
                            "pan": f"ABCDE{random.randint(1000, 9999)}F", "submitted_at": now_iso()}
                if kyc == "approved":
                    kyc_data["reviewed_by"] = "Amit Patel"
                    kyc_data["reviewed_at"] = now_iso()
            c = Customer(
                id=str(uuid.uuid4()), jeweller_id=jeweller2.id, phone=phone,
                first_name=fname, last_name=lname,
                wallet_id=gen_wallet_id(), referral_code=gen_referral_code(),
                kyc_status=kyc, kyc_data=kyc_data,
                gold_grams=r4(random.uniform(1, 5)), silver_grams=0.0,
                invested=r2(random.uniform(5000, 30000)),
                created_at=base - timedelta(days=random.randint(10, 40))
            )
            db.add(c)

        await db.commit()
        logger.info("Seeded demo data with 2 jewellers, 6 customers, master admin")


# ═══════════════════ ADMIN WEB PANELS ═════════════════════════════════════════
from fastapi.responses import FileResponse
TEMPLATES = ROOT_DIR / "templates"


@app.get("/api/admin/master")
async def master_panel():
    return FileResponse(TEMPLATES / "master_admin.html", media_type="text/html")


@app.get("/api/admin/jeweller")
async def jeweller_panel():
    return FileResponse(TEMPLATES / "jeweller_admin.html", media_type="text/html")


# ═══════════════════ STARTUP ══════════════════════════════════════════════════
@app.on_event("startup")
async def startup():
    await init_db()
    await seed_data()
    asyncio.create_task(price_loop())
    logger.info("Vaultra DigiGold v2.0 started with PostgreSQL")


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
