"""Set Jajkobi home country to Poland.

Revision ID: h8a3e6c1f5d9
Revises: g7f2c9a4d1b6
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op


revision: str = "h8a3e6c1f5d9"
down_revision: Union[str, Sequence[str], None] = "g7f2c9a4d1b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE users SET country_code = 'PL' WHERE username = 'Jajkobi'")


def downgrade() -> None:
    op.execute("UPDATE users SET country_code = NULL WHERE username = 'Jajkobi' AND country_code = 'PL'")
