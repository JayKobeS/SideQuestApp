from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base

if TYPE_CHECKING:
    from .quest import Quest, QuestTemplate
    from .user import User


class Country(Base):
    """Słownik krajów ISO 3166-1 alpha-2.

    Kod jest kluczem głównym — jest stabilny, prosty do łączenia i niezależny
    od języka interfejsu. Nazwy są tłumaczone po stronie aplikacji przez Intl.
    """

    __tablename__ = "countries"

    id: Mapped[int] = mapped_column("serial_id", Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(2), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="country_ref")
    quest_templates: Mapped[list["QuestTemplate"]] = relationship(back_populates="country_ref")
    quests: Mapped[list["Quest"]] = relationship(back_populates="country_ref")
