"""baseline

Revision ID: 00e340a04c4e
Revises: 
Create Date: 2026-10-29 08:52:01.733599

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '00e340a04c4e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Baseline: schema as of first production release (created by init_db)."""
    pass


def downgrade() -> None:
    pass
