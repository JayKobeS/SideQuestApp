"""Add explicit travel mode and monthly abroad activation counter.

Revision ID: i9d4b7e2f6c1
Revises: h8a3e6c1f5d9
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i9d4b7e2f6c1"
down_revision: Union[str, Sequence[str], None] = "h8a3e6c1f5d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_abroad", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("abroad", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("abroad_reset_month", sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "abroad_reset_month")
    op.drop_column("users", "abroad")
    op.drop_column("users", "is_abroad")
