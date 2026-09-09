from pydantic import BaseModel, EmailStr, Field
from datetime import date, datetime
from typing import Literal
from pydantic import field_validator

from core.countries import normalize_country_code

# ==========================
# SCHEMATY DLA QUESTÓW
# ==========================
QuestCategory = Literal["daily", "local", "country", "world"]
QuestDifficulty = Literal["easy", "medium", "hard"]
QuestStatus = Literal["active", "pending_review", "approved", "rejected", "expired", "completed"]
UserRole = Literal["user", "moderator", "admin", "owner"]

class QuestBase(BaseModel):
    title: str
    description: str = ""
    category: QuestCategory
    difficulty: QuestDifficulty
    country: str | None = None
    country_code: str | None = None
    city: str | None = None
    lat: float | None = None
    lon: float | None = None
    radius_km: int | None = None

class QuestResponse(QuestBase):
    id: int
    template_id: int | None = None
    status: QuestStatus
    is_completed: bool
    expires_at: datetime
    daily_key: date | None = None
    submitted_at: datetime | None = None
    submission_note: str | None = None
    reviewed_at: datetime | None = None
    reviewed_by_id: int | None = None
    review_note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True  # Pozwala Pydanticowi czytać bezpośrednio z modeli SQLAlchemy

class QuestLocation(BaseModel):
    country: str | None = None
    country_code: str | None = None
    city: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    radius_km: int | None = Field(default=None, ge=1, le=100)

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, value: str | None) -> str | None:
        return normalize_country_code(value) if value else None

class ExploreQuestRequest(BaseModel):
    category: Literal["local", "country", "world"]
    location: QuestLocation | None = None

class QuestSubmissionRequest(BaseModel):
    note: str | None = Field(default=None, max_length=1000)

class QuestReviewRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=1000)

class QuestTemplateBase(BaseModel):
    title: str = Field(min_length=3, max_length=100)
    description: str = Field(min_length=10, max_length=500)
    category: QuestCategory
    difficulty: QuestDifficulty
    country: str | None = Field(default=None, max_length=100)
    country_code: str | None = None
    city: str | None = Field(default=None, max_length=100)
    lat: float | None = None
    lon: float | None = None
    radius_km: int | None = Field(default=None, ge=1, le=100)

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, value: str | None) -> str | None:
        return normalize_country_code(value) if value else None

class QuestTemplateCreate(QuestTemplateBase):
    is_active: bool = True

class QuestTemplateUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=100)
    description: str | None = Field(default=None, min_length=10, max_length=500)
    category: QuestCategory | None = None
    difficulty: QuestDifficulty | None = None
    country: str | None = Field(default=None, max_length=100)
    country_code: str | None = None
    city: str | None = Field(default=None, max_length=100)
    lat: float | None = None
    lon: float | None = None
    radius_km: int | None = Field(default=None, ge=1, le=100)
    is_active: bool | None = None

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, value: str | None) -> str | None:
        return normalize_country_code(value) if value else None

class QuestTemplateResponse(QuestTemplateBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================
# SCHEMATY DLA UŻYTKOWNIKÓW
# ==========================
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    country_code: str

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, value: str) -> str:
        return normalize_country_code(value)

class EmailUpdate(BaseModel):
    email: EmailStr
    current_password: str

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=6)

class TravelModeUpdate(BaseModel):
    is_abroad: bool

class LocationLookupRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)

class LocationLookupResponse(BaseModel):
    country_code: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    country_code: str | None = None
    is_abroad: bool = False
    abroad: int = 0
    abroad_reset_month: str | None = None
    role: UserRole
    level: int
    xp: int
    quests: list[QuestResponse] = []  # Dołączanie questów przypisanych do usera

    class Config:
        from_attributes = True

class UserAdminResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    country_code: str | None = None
    role: UserRole
    level: int
    xp: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserRoleUpdate(BaseModel):
    role: UserRole


class CountryResponse(BaseModel):
    id: int
    code: str

    class Config:
        from_attributes = True

# ==========================
# SCHEMATY DLA AUTORYZACJI
# ==========================
class Token(BaseModel):
    access_token: str
    token_type: str
