"""Add quest templates and assignment lifecycle.

Revision ID: c8e9d4f0a217
Revises: f12ae0702553
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8e9d4f0a217"
down_revision: Union[str, Sequence[str], None] = "f12ae0702553"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quest_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="easy"),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("radius_km", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quest_templates_category", "quest_templates", ["category"])

    op.add_column("quests", sa.Column("template_id", sa.Uuid(), nullable=True))
    op.add_column("quests", sa.Column("description", sa.String(length=500), nullable=False, server_default=""))
    op.add_column("quests", sa.Column("category", sa.String(length=20), nullable=False, server_default="local"))
    op.add_column("quests", sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="easy"))
    op.add_column("quests", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("quests", sa.Column("radius_km", sa.Integer(), nullable=True))
    op.add_column("quests", sa.Column("status", sa.String(length=20), nullable=False, server_default="active"))
    op.add_column("quests", sa.Column("daily_key", sa.Date(), nullable=True))
    op.add_column("quests", sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")))
    op.add_column("quests", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now() + interval '7 days'")))
    op.add_column("quests", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))

    op.alter_column("quests", "country", existing_type=sa.String(length=100), nullable=True)
    op.alter_column("quests", "lat", existing_type=sa.Float(), nullable=True)
    op.alter_column("quests", "lon", existing_type=sa.Float(), nullable=True)
    op.create_foreign_key("fk_quests_template_id", "quests", "quest_templates", ["template_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_quests_category", "quests", ["category"])
    op.create_index("ix_quests_status", "quests", ["status"])
    op.create_unique_constraint("uq_quests_user_daily_key", "quests", ["user_id", "daily_key"])


def downgrade() -> None:
    op.drop_constraint("uq_quests_user_daily_key", "quests", type_="unique")
    op.drop_index("ix_quests_status", table_name="quests")
    op.drop_index("ix_quests_category", table_name="quests")
    op.drop_constraint("fk_quests_template_id", "quests", type_="foreignkey")
    op.alter_column("quests", "lon", existing_type=sa.Float(), nullable=False)
    op.alter_column("quests", "lat", existing_type=sa.Float(), nullable=False)
    op.alter_column("quests", "country", existing_type=sa.String(length=100), nullable=False)
    op.drop_column("quests", "completed_at")
    op.drop_column("quests", "expires_at")
    op.drop_column("quests", "assigned_at")
    op.drop_column("quests", "daily_key")
    op.drop_column("quests", "status")
    op.drop_column("quests", "radius_km")
    op.drop_column("quests", "city")
    op.drop_column("quests", "difficulty")
    op.drop_column("quests", "category")
    op.drop_column("quests", "description")
    op.drop_column("quests", "template_id")
    op.drop_index("ix_quest_templates_category", table_name="quest_templates")
    op.drop_table("quest_templates")
