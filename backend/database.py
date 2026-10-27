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
            "ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS silver_commission_per_g DOUBLE PRECISION DEFAULT 0",
        ):
            await conn.execute(text(stmt))
