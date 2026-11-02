"""Database engine and session management for PostgreSQL via SQLAlchemy async."""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False, pool_size=20, max_overflow=10)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Create all tables (idempotent)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Lightweight additive migrations for columns added after first release
        for stmt in (
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS admin_domain VARCHAR(200) DEFAULT ''",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS gold_buy_markup_pct DOUBLE PRECISION DEFAULT 0",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS gold_sell_discount_pct DOUBLE PRECISION DEFAULT 3",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS silver_buy_markup_pct DOUBLE PRECISION DEFAULT 0",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS silver_sell_discount_pct DOUBLE PRECISION DEFAULT 3",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS gold_commission_per_g DOUBLE PRECISION DEFAULT 0",
            "CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(100) PRIMARY KEY, value TEXT)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS making_pct DOUBLE PRECISION DEFAULT 12",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS silver_commission_per_g DOUBLE PRECISION DEFAULT 0",
            "ALTER TABLE pickups ALTER COLUMN transaction_id DROP NOT NULL",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS gold22_commission_per_g DOUBLE PRECISION DEFAULT 0",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS gold18_commission_per_g DOUBLE PRECISION DEFAULT 0",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS app_name VARCHAR(60) DEFAULT ''",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS bundle_id VARCHAR(120) DEFAULT ''",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS theme_preset VARCHAR(40) DEFAULT ''",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS splash_url VARCHAR(500) DEFAULT ''",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS app_status VARCHAR(30) DEFAULT 'details_pending'",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS app_version VARCHAR(20) DEFAULT '1.0.0'",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS store_short VARCHAR(80) DEFAULT ''",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS store_long TEXT DEFAULT ''",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS store_keywords VARCHAR(100) DEFAULT ''",
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS support_email VARCHAR(200) DEFAULT ''",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS purity VARCHAR(5) DEFAULT '22K'",
            "ALTER TABLE sips ADD COLUMN IF NOT EXISTS metal VARCHAR(10) DEFAULT 'gold'",
            "ALTER TABLE goals ADD COLUMN IF NOT EXISTS metal VARCHAR(10) DEFAULT 'gold'",
        ):
            await conn.execute(text(stmt))
