"""shop payments to master, SIP mandate fields

Revision ID: c5e2a7d81f39
Revises: b3d9e1f0a2c4
"""
from alembic import op

revision = "c5e2a7d81f39"
down_revision = "b3d9e1f0a2c4"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE TABLE IF NOT EXISTS shop_payments (
        id VARCHAR PRIMARY KEY, jeweller_id VARCHAR REFERENCES jewellers(id), amount DOUBLE PRECISION,
        paid_on VARCHAR(20), reference VARCHAR(120), note TEXT, created_by VARCHAR(120),
        created_at TIMESTAMP WITH TIME ZONE)""")
    op.execute("ALTER TABLE sips ADD COLUMN IF NOT EXISTS mandate_ref VARCHAR(40) DEFAULT ''")
    op.execute("ALTER TABLE sips ADD COLUMN IF NOT EXISTS last_status VARCHAR(20) DEFAULT ''")
    op.execute("ALTER TABLE sips ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT ''")
    op.execute("ALTER TABLE sips ADD COLUMN IF NOT EXISTS last_run TIMESTAMP WITH TIME ZONE")


def downgrade():
    op.execute("DROP TABLE IF EXISTS shop_payments")
    for c in ("mandate_ref", "last_status", "last_error", "last_run"):
        op.execute(f"ALTER TABLE sips DROP COLUMN IF EXISTS {c}")
