"""Rebuild application tables with serial_id primary keys.

This intentional one-way migration resets SideQuest data and restores only the
initial owner account requested for the development database.

Revision ID: k4e8b1d6f2a9
Revises: j2a7d4c9e6b3
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from core.countries import COUNTRY_CODES
from core.security import get_password_hash


revision: str = "k4e8b1d6f2a9"
down_revision: Union[str, Sequence[str], None] = "j2a7d4c9e6b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Brak danych produkcyjnych: świadome odtworzenie schematu z serial_id.
    op.drop_table("quests")
    op.drop_table("quest_templates")
    op.drop_table("users")
    op.drop_table("countries")

    op.create_table(
        "countries",
        sa.Column("serial_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=2), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    countries = sa.table("countries", sa.column("code", sa.String()))
    op.bulk_insert(countries, [{"code": code} for code in sorted(COUNTRY_CODES)])

    op.create_table(
        "users",
        sa.Column("serial_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(length=50), nullable=False, unique=True),
        sa.Column("email", sa.String(length=100), nullable=False, unique=True),
        sa.Column("country_code", sa.String(length=2), sa.ForeignKey("countries.code", ondelete="SET NULL"), nullable=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_abroad", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("abroad", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("abroad_reset_month", sa.String(length=7), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_failed_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reset_token_hash", sa.String(length=64), nullable=True),
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reset_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("role IN ('user', 'moderator', 'admin', 'owner')", name="ck_users_role"),
    )
    op.create_index("ix_users_country_code", "users", ["country_code"])

    op.create_table(
        "quest_templates",
        sa.Column("serial_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="easy"),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("country_code", sa.String(length=2), sa.ForeignKey("countries.code", ondelete="SET NULL"), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("radius_km", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("lat IS NULL OR lat BETWEEN -90 AND 90", name="ck_quest_templates_lat_range"),
        sa.CheckConstraint("lon IS NULL OR lon BETWEEN -180 AND 180", name="ck_quest_templates_lon_range"),
    )
    op.create_index("ix_quest_templates_category", "quest_templates", ["category"])
    op.create_index("ix_quest_templates_country_code", "quest_templates", ["country_code"])

    op.create_table(
        "quests",
        sa.Column("serial_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_serial_id", sa.Integer(), sa.ForeignKey("users.serial_id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_serial_id", sa.Integer(), sa.ForeignKey("quest_templates.serial_id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("category", sa.String(length=20), nullable=False, server_default="local"),
        sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="easy"),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("country_code", sa.String(length=2), sa.ForeignKey("countries.code", ondelete="SET NULL"), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("radius_km", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("daily_key", sa.Date(), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submission_note", sa.String(length=1000), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by_serial_id", sa.Integer(), sa.ForeignKey("users.serial_id", ondelete="SET NULL"), nullable=True),
        sa.Column("review_note", sa.String(length=1000), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_serial_id", "daily_key", name="uq_quests_user_daily_key"),
        sa.CheckConstraint("lat IS NULL OR lat BETWEEN -90 AND 90", name="ck_quests_lat_range"),
        sa.CheckConstraint("lon IS NULL OR lon BETWEEN -180 AND 180", name="ck_quests_lon_range"),
    )
    op.create_index("ix_quests_category", "quests", ["category"])
    op.create_index("ix_quests_status", "quests", ["status"])
    op.create_index("ix_quests_country_code", "quests", ["country_code"])

    bind = op.get_bind()
    bind.execute(
        sa.text("""
            INSERT INTO users (username, email, country_code, hashed_password, role)
            VALUES (:username, :email, 'PL', :password, 'owner')
        """),
        {"username": "Jajkobi", "email": "bbkuba879@gmail.com", "password": get_password_hash("123456")},
    )


def downgrade() -> None:
    raise RuntimeError("Ta migracja celowo przebudowuje dane i nie ma bezpiecznego downgrade.")
