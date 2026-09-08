"""Add quest submission and review workflow.

Revision ID: e4c8b2d9f6a3
Revises: d3b7a4f8c9e1
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4c8b2d9f6a3"
down_revision: Union[str, Sequence[str], None] = "d3b7a4f8c9e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE quests SET status = 'approved' WHERE status = 'completed'")
    op.add_column("quests", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quests", sa.Column("submission_note", sa.String(length=1000), nullable=True))
    op.add_column("quests", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quests", sa.Column("reviewed_by_id", sa.Uuid(), nullable=True))
    op.add_column("quests", sa.Column("review_note", sa.String(length=1000), nullable=True))
    op.create_foreign_key("fk_quests_reviewed_by_id", "quests", "users", ["reviewed_by_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_quests_reviewed_by_id", "quests", type_="foreignkey")
    op.drop_column("quests", "review_note")
    op.drop_column("quests", "reviewed_by_id")
    op.drop_column("quests", "reviewed_at")
    op.drop_column("quests", "submission_note")
    op.drop_column("quests", "submitted_at")
