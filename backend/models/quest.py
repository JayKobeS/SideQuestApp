import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from core.database import Base

# Obejście zapętlonego importu z user.py
if TYPE_CHECKING:
    from .user import User

class Quest(Base):
    __tablename__ = "quests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    
    title: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    
    is_completed: Mapped[bool] = mapped_column(default=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )

    # Relacja zwrotna
    user: Mapped["User"] = relationship(back_populates="quests")