"""Add validated country codes to accounts and quests.

Revision ID: f6a1c3e8b4d2
Revises: e4c8b2d9f6a3
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a1c3e8b4d2"
down_revision: Union[str, Sequence[str], None] = "e4c8b2d9f6a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("country_code", sa.String(length=2), nullable=True))
    op.add_column("quest_templates", sa.Column("country_code", sa.String(length=2), nullable=True))
    op.add_column("quests", sa.Column("country_code", sa.String(length=2), nullable=True))


def downgrade() -> None:
    op.drop_column("quests", "country_code")
    op.drop_column("quest_templates", "country_code")
    op.drop_column("users", "country_code")
