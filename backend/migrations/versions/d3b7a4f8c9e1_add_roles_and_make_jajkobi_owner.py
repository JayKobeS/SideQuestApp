"""Add supported roles and grant owner role to Jajkobi.

Revision ID: d3b7a4f8c9e1
Revises: c8e9d4f0a217
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op


revision: str = "d3b7a4f8c9e1"
down_revision: Union[str, Sequence[str], None] = "c8e9d4f0a217"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('user', 'moderator', 'admin', 'owner')",
    )
    op.execute("UPDATE users SET role = 'owner' WHERE username = 'Jajkobi'")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'user' WHERE username = 'Jajkobi' AND role = 'owner'")
    op.drop_constraint("ck_users_role", "users", type_="check")
