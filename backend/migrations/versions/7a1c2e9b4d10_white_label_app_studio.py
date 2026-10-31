"""white-label app studio + karat margins

Revision ID: 7a1c2e9b4d10
Revises: 00e340a04c4e
"""
from alembic import op

revision = "7a1c2e9b4d10"
down_revision = "00e340a04c4e"
branch_labels = None
depends_on = None

COLS = [
    ("gold22_commission_per_g", "DOUBLE PRECISION DEFAULT 0"),
    ("gold18_commission_per_g", "DOUBLE PRECISION DEFAULT 0"),
    ("app_name", "VARCHAR(60) DEFAULT ''"),
    ("bundle_id", "VARCHAR(120) DEFAULT ''"),
    ("theme_preset", "VARCHAR(40) DEFAULT ''"),
    ("splash_url", "VARCHAR(500) DEFAULT ''"),
    ("app_status", "VARCHAR(30) DEFAULT 'details_pending'"),
    ("app_version", "VARCHAR(20) DEFAULT '1.0.0'"),
    ("store_short", "VARCHAR(80) DEFAULT ''"),
    ("store_long", "TEXT DEFAULT ''"),
    ("store_keywords", "VARCHAR(100) DEFAULT ''"),
    ("support_email", "VARCHAR(200) DEFAULT ''"),
]


def upgrade() -> None:
    for name, ddl in COLS:
        op.execute(f"ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS {name} {ddl}")


def downgrade() -> None:
    for name, _ in COLS:
        op.execute(f"ALTER TABLE jewellers DROP COLUMN IF EXISTS {name}")
