from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

# ==========================
# SCHEMATY DLA QUESTÓW
# ==========================
class QuestBase(BaseModel):
    title: str
    country: str
    lat: float
    lon: float

class QuestResponse(QuestBase):
    id: UUID
    is_completed: bool
    created_at: datetime

    class Config:
        from_attributes = True  # Pozwala Pydanticowi czytać bezpośrednio z modeli SQLAlchemy

# ==========================
# SCHEMATY DLA UŻYTKOWNIKÓW
# ==========================
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    role: str
    level: int
    xp: int
    quests: list[QuestResponse] = []  # Dołączanie questów przypisanych do usera

    class Config:
        from_attributes = True

# ==========================
# SCHEMATY DLA AUTORYZACJI
# ==========================
class Token(BaseModel):
    access_token: str
    token_type: str 