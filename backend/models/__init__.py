"""SQLAlchemy ORM models for Vaultra DigiGold multi-tenant platform."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, JSON, Enum as SAEnum, Index
)
from sqlalchemy.orm import relationship
from database import Base


def utcnow():
    return datetime.now(timezone.utc)


def gen_uuid():
    return str(uuid.uuid4())


# ─── Jeweller (Tenant) ───────────────────────────────────────────────────────
class Jeweller(Base):
    __tablename__ = "jewellers"

    id = Column(String, primary_key=True, default=gen_uuid)
    business_name = Column(String(200), nullable=False)
    owner_name = Column(String(200), nullable=False)
    phone = Column(String(15), unique=True, nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    pan = Column(String(10), default="")
    aadhaar = Column(String(12), default="")
    address = Column(Text, default="")
    city = Column(String(100), default="")
    state = Column(String(100), default="")
    pincode = Column(String(6), default="")
    logo_url = Column(String(500), default="")
    primary_color = Column(String(7), default="#D4AF37")
    secondary_color = Column(String(7), default="#1A1A2E")
    domain = Column(String(200), default="")
    min_redemption_grams = Column(Float, default=1.0)
    status = Column(String(20), default="active")  # active, suspended, pending
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    customers = relationship("Customer", back_populates="jeweller")
    products = relationship("Product", back_populates="jeweller")
    transactions = relationship("Transaction", back_populates="jeweller")


# ─── Customer ────────────────────────────────────────────────────────────────
class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=gen_uuid)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    phone = Column(String(15), nullable=False)
    first_name = Column(String(100), default="")
    last_name = Column(String(100), default="")
    email = Column(String(200), default="")
    dob = Column(String(20), default="")
    gender = Column(String(10), default="")
    wallet_id = Column(String(20), unique=True, nullable=False)  # Display ID for shop redemption
    gold_grams = Column(Float, default=0.0)
    silver_grams = Column(Float, default=0.0)
    invested = Column(Float, default=0.0)
    wallet_balance = Column(Float, default=0.0)
    referral_code = Column(String(10), unique=True, nullable=False)
    referral_balance = Column(Float, default=0.0)
    referred_by = Column(String, ForeignKey("customers.id"), nullable=True)
    kyc_status = Column(String(20), default="not_submitted")  # not_submitted, pending, approved, rejected
    kyc_data = Column(JSON, default=dict)
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    jeweller = relationship("Jeweller", back_populates="customers")
    transactions = relationship("Transaction", back_populates="customer")
    sips = relationship("SIP", back_populates="customer")
    alerts = relationship("Alert", back_populates="customer")
    goals = relationship("Goal", back_populates="customer")
    notifications = relationship("Notification", back_populates="customer")

    __table_args__ = (
        Index("ix_customer_jeweller_phone", "jeweller_id", "phone", unique=True),
    )


# ─── OTP Challenge ───────────────────────────────────────────────────────────
class OtpChallenge(Base):
    __tablename__ = "otp_challenges"

    id = Column(String, primary_key=True, default=gen_uuid)
    phone = Column(String(15), nullable=False)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    digest = Column(String(100), nullable=False)
    attempts = Column(Integer, default=0)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)


# ─── Transaction ─────────────────────────────────────────────────────────────
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=gen_uuid)
    invoice_no = Column(String(20), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    type = Column(String(30), nullable=False)  # buy, sell, sip, gift_sent, gift_received, redemption, reversal, buy_silver
    metal = Column(String(10), default="gold")
    grams = Column(Float, default=0.0)
    rate = Column(Float, default=0.0)
    amount = Column(Float, default=0.0)
    gst = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    method = Column(String(30), default="upi")
    status = Column(String(20), default="completed")  # completed, processing, failed, reversed
    note = Column(Text, default="")
    extra = Column(JSON, default=dict)
    pool_contribution = Column(Boolean, default=False)  # Whether this contributed to pool
    created_at = Column(DateTime(timezone=True), default=utcnow)

    customer = relationship("Customer", back_populates="transactions")
    jeweller = relationship("Jeweller", back_populates="transactions")

    __table_args__ = (
        Index("ix_txn_customer_date", "customer_id", "created_at"),
        Index("ix_txn_jeweller_date", "jeweller_id", "created_at"),
    )


# ─── Order (for payment flow) ───────────────────────────────────────────────
class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    metal = Column(String(10), default="gold")
    grams = Column(Float, default=0.0)
    rate = Column(Float, default=0.0)
    amount = Column(Float, default=0.0)
    gst = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    status = Column(String(20), default="created")  # created, paid, failed
    provider = Column(String(20), default="mock")
    payment_id = Column(String(100), default="")
    method = Column(String(30), default="")
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ─── Pool Accumulator ────────────────────────────────────────────────────────
class PoolAccumulator(Base):
    __tablename__ = "pool_accumulator"

    id = Column(String, primary_key=True, default=gen_uuid)
    total_grams = Column(Float, default=0.0)
    threshold_grams = Column(Float, default=10.0)
    status = Column(String(20), default="accumulating")  # accumulating, triggered, procured
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    procured_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class PoolContribution(Base):
    __tablename__ = "pool_contributions"

    id = Column(String, primary_key=True, default=gen_uuid)
    pool_id = Column(String, ForeignKey("pool_accumulator.id"), nullable=False)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    grams = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ─── Bifurcation Invoice ────────────────────────────────────────────────────
class BifurcationInvoice(Base):
    __tablename__ = "bifurcation_invoices"

    id = Column(String, primary_key=True, default=gen_uuid)
    pool_id = Column(String, ForeignKey("pool_accumulator.id"), nullable=False)
    total_grams = Column(Float, default=0.0)
    details = Column(JSON, default=list)  # [{jeweller_id, jeweller_name, customer_id, customer_name, grams}]
    status = Column(String(20), default="generated")
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ─── Product (Jewellery Catalog) ─────────────────────────────────────────────
class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_uuid)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(50), default="")
    grams = Column(Float, default=0.0)
    making_charges = Column(Float, default=0.0)
    image_url = Column(String(500), default="")
    tag = Column(String(50), default="")
    description = Column(Text, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    jeweller = relationship("Jeweller", back_populates="products")


# ─── Redemption / Pickup ─────────────────────────────────────────────────────
class Pickup(Base):
    __tablename__ = "pickups"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    item = Column(String(200), nullable=False)
    grams = Column(Float, default=0.0)
    making_charges = Column(Float, default=0.0)
    otp = Column(String(6), nullable=False)
    attempts = Column(Integer, default=0)
    locked = Column(Boolean, default=False)
    status = Column(String(20), default="pending")  # pending, collected, cancelled
    collected_at = Column(DateTime(timezone=True), nullable=True)
    collected_by = Column(String(100), default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ─── SIP ─────────────────────────────────────────────────────────────────────
class SIP(Base):
    __tablename__ = "sips"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    amount = Column(Float, default=0.0)
    frequency = Column(String(10), default="monthly")  # daily, weekly, monthly
    status = Column(String(20), default="active")  # active, paused, cancelled
    installments = Column(Integer, default=0)
    grams_accumulated = Column(Float, default=0.0)
    next_run = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    customer = relationship("Customer", back_populates="sips")


# ─── Price Alert ─────────────────────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    target = Column(Float, default=0.0)
    metal = Column(String(10), default="gold")
    alert_type = Column(String(10), default="alert")  # alert, book
    buy_amount = Column(Float, default=0.0)  # for book alert
    status = Column(String(20), default="active")  # active, triggered, deleted
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    triggered_price = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    customer = relationship("Customer", back_populates="alerts")


# ─── Gold Goal ───────────────────────────────────────────────────────────────
class Goal(Base):
    __tablename__ = "goals"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    name = Column(String(100), nullable=False)
    occasion = Column(String(50), default="custom")
    target_grams = Column(Float, default=0.0)
    months = Column(Integer, default=12)
    deadline = Column(DateTime(timezone=True), nullable=True)
    start_grams = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    customer = relationship("Customer", back_populates="goals")


# ─── Gift ────────────────────────────────────────────────────────────────────
class Gift(Base):
    __tablename__ = "gifts"

    id = Column(String, primary_key=True, default=gen_uuid)
    sender_id = Column(String, ForeignKey("customers.id"), nullable=False)
    recipient_id = Column(String, ForeignKey("customers.id"), nullable=False)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    grams = Column(Float, default=0.0)
    rate = Column(Float, default=0.0)
    amount = Column(Float, default=0.0)
    theme = Column(String(30), default="diwali")
    message = Column(Text, default="")
    seen = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ─── Notification ────────────────────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, default="")
    type = Column(String(30), default="general")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    customer = relationship("Customer", back_populates="notifications")


# ─── Wallet Transaction ──────────────────────────────────────────────────────
class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    type = Column(String(20), nullable=False)  # deposit, withdraw, referral, gift
    amount = Column(Float, default=0.0)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ─── Quote (Price Lock) ──────────────────────────────────────────────────────
class Quote(Base):
    __tablename__ = "quotes"

    id = Column(String, primary_key=True, default=gen_uuid)
    jeweller_id = Column(String, ForeignKey("jewellers.id"), nullable=False)
    metal = Column(String(10), default="gold")
    buy = Column(Float, default=0.0)
    sell = Column(Float, default=0.0)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ─── Master Admin ────────────────────────────────────────────────────────────
class MasterAdmin(Base):
    __tablename__ = "master_admins"

    id = Column(String, primary_key=True, default=gen_uuid)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    name = Column(String(200), default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)
