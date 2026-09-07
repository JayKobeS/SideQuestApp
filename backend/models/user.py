import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime
from sqlalchemy.sql import func
from core.database import Base

# Importujemy model Quest tylko na potrzeby typowania statycznego
if TYPE_CHECKING:
    from .quest import Quest

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    
    role: Mapped[str] = mapped_column(String(20), default="user")
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

    # Relacja do Quest3w
    quests: Mapped[list["Quest"]] = relationship(
        back_populates="user", 
        cascade="all, delete-orphan"
    )