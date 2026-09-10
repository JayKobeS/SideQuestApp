from datetime import date, datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Float, Integer, String, JSON, UniqueConstraint
from sqlalchemy.sql import func
from core.database import Base
from .country import Country

# Obejście zapętlonego importu z user.py
if TYPE_CHECKING:
    from .user import User


class QuestTemplate(Base):
    __tablename__ = "quest_templates"
    __table_args__ = (
        CheckConstraint("lat IS NULL OR lat BETWEEN -90 AND 90", name="ck_quest_templates_lat_range"),
        CheckConstraint("lon IS NULL OR lon BETWEEN -180 AND 180", name="ck_quest_templates_lon_range"),
    )

    id: Mapped[int] = mapped_column("serial_id", Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(20), index=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="easy")
    xp_reward: Mapped[int] = mapped_column(Integer, default=100, server_default="100")
    medal: Mapped[str | None] = mapped_column(String(20), nullable=True)

    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code", ondelete="SET NULL"), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    radius_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    country_ref: Mapped["Country | None"] = relationship(back_populates="quest_templates")

class Quest(Base):
    __tablename__ = "quests"
    __table_args__ = (
        UniqueConstraint("user_serial_id", "daily_key", "template_serial_id", name="uq_quests_user_day_template"),
        CheckConstraint("lat IS NULL OR lat BETWEEN -90 AND 90", name="ck_quests_lat_range"),
        CheckConstraint("lon IS NULL OR lon BETWEEN -180 AND 180", name="ck_quests_lon_range"),
    )

    id: Mapped[int] = mapped_column("serial_id", Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column("user_serial_id", ForeignKey("users.serial_id", ondelete="CASCADE"))
    template_id: Mapped[int | None] = mapped_column("template_serial_id", ForeignKey("quest_templates.serial_id", ondelete="SET NULL"), nullable=True)

    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500), default="")
    category: Mapped[str] = mapped_column(String(20), default="local", index=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="easy")
    xp_reward: Mapped[int] = mapped_column(Integer, default=100, server_default="100")
    medal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code", ondelete="SET NULL"), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    radius_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    daily_key: Mapped[date | None] = mapped_column(Date, nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submission_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_id: Mapped[int | None] = mapped_column("reviewed_by_serial_id", ForeignKey("users.serial_id", ondelete="SET NULL"), nullable=True)
    review_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_completed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )

    # Relacja zwrotna
    # reviewed_by_id jest drugim kluczem obcym do users; jawnie wskazujemy
    # user_id, aby SQLAlchemy nie zgadywało relacji podczas logowania.
    user: Mapped["User"] = relationship(back_populates="quests", foreign_keys=[user_id])
    country_ref: Mapped["Country | None"] = relationship(back_populates="quests")


class DailyQuestSet(Base):
    __tablename__ = "daily_quest_sets"
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    template_ids: Mapped[list[int]] = mapped_column(JSON)
