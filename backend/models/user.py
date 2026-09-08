import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String
from sqlalchemy.sql import func
from core.database import Base

# Importujemy model Quest tylko na potrzeby typowania statycznego
if TYPE_CHECKING:
    from .quest import Quest

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'moderator', 'admin', 'owner')", name="ck_users_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    # Tryb wyjazdowy jest ustawiany świadomie przez użytkownika po wejściu do aplikacji.
    # Licznik chroni przed wielokrotnym przełączaniem trybu w jednym miesiącu.
    is_abroad: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    abroad: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    abroad_reset_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String)
    
    role: Mapped[str] = mapped_column(String(20), default="user", server_default="user")
    xp: Mapped[int] = mapped_column(default=0)
    level: Mapped[int] = mapped_column(default=1)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), 
        nullable=True
    )
    failed_login_attempts: Mapped[int] = mapped_column(default=0)
    last_failed_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reset_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reset_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacja do Quest3w
    quests: Mapped[list["Quest"]] = relationship(
        back_populates="user",
        # Quest ma także reviewed_by_id wskazujące na users. To powiązanie
        # dotyczy wyłącznie właściciela misji.
        foreign_keys="Quest.user_id",
        cascade="all, delete-orphan"
    )
