"""Add failed-login tracking and password-reset fields.

Revision ID: g7f2c9a4d1b6
Revises: f6a1c3e8b4d2
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g7f2c9a4d1b6"
down_revision: Union[str, Sequence[str], None] = "f6a1c3e8b4d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("last_failed_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("reset_token_hash", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("reset_requested_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "reset_requested_at")
    op.drop_column("users", "reset_token_expires_at")
    op.drop_column("users", "reset_token_hash")
    op.drop_column("users", "last_failed_login_at")
    op.drop_column("users", "failed_login_attempts")
