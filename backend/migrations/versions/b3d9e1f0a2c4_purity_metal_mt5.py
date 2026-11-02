"""product purity, silver SIP/goals, MT5 bookings

Revision ID: b3d9e1f0a2c4
Revises: 7a1c2e9b4d10
"""
from alembic import op

revision = "b3d9e1f0a2c4"
down_revision = "7a1c2e9b4d10"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS purity VARCHAR(5) DEFAULT '22K'")
    op.execute("ALTER TABLE sips ADD COLUMN IF NOT EXISTS metal VARCHAR(10) DEFAULT 'gold'")
    op.execute("ALTER TABLE goals ADD COLUMN IF NOT EXISTS metal VARCHAR(10) DEFAULT 'gold'")
    op.execute("""CREATE TABLE IF NOT EXISTS mt5_bookings (
        id VARCHAR PRIMARY KEY, metal VARCHAR(10), symbol VARCHAR(40), volume DOUBLE PRECISION, grams DOUBLE PRECISION,
        status VARCHAR(20), ticket VARCHAR(40), price DOUBLE PRECISION, error TEXT, trigger VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE)""")


def downgrade():
    op.execute("DROP TABLE IF EXISTS mt5_bookings")
    op.execute("ALTER TABLE goals DROP COLUMN IF EXISTS metal")
    op.execute("ALTER TABLE sips DROP COLUMN IF EXISTS metal")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS purity")
