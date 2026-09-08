import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import EmailStr, TypeAdapter, ValidationError

from core.database import get_db
from core.email import send_password_reset_email
from core.geocoding import resolve_country_from_coordinates
from core.security import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from core.deps import get_current_user
from core.schemas import EmailUpdate, LocationLookupRequest, LocationLookupResponse, PasswordResetConfirm, PasswordResetRequest, PasswordUpdate, TravelModeUpdate, UserCreate, UserResponse, Token
from models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])
email_adapter = TypeAdapter(EmailStr)


def auth_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Sprawdzenie, czy użytkownik już istnieje (po emailu lub nazwie)
    result = await db.execute(
        select(User).where(
            or_(User.email == user_data.email, User.username == user_data.username)
        )
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Użytkownik o takim emailu lub nazwie już istnieje."
        )

    hashed_pw = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        country_code=user_data.country_code,
        hashed_password=hashed_pw
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    try:
        email = email_adapter.validate_python(form_data.username).lower()
    except ValidationError:
        raise auth_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "INVALID_EMAIL_FORMAT", "Podaj poprawny adres e-mail.")

    try:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
    except SQLAlchemyError:
        raise auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_MIGRATION_REQUIRED", "Baza danych wymaga aktualizacji. Uruchom migracje backendu.")

    if not user or not verify_password(form_data.password, user.hashed_password):
        if user:
            user.failed_login_attempts += 1
            user.last_failed_login_at = datetime.now(timezone.utc)
            await db.commit()
            if user.failed_login_attempts >= 3:
                raise auth_error(status.HTTP_429_TOO_MANY_REQUESTS, "PASSWORD_RESET_AVAILABLE", "Trzy nieudane próby. Możesz teraz poprosić o link do zmiany hasła.")
        raise auth_error(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", "Nieprawidłowy e-mail lub hasło.")

    user.failed_login_attempts = 0
    user.last_failed_login_at = None
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(request: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await db.scalar(select(User).where(User.email == request.email.lower()))
    except SQLAlchemyError:
        raise auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_MIGRATION_REQUIRED", "Baza danych wymaga aktualizacji. Uruchom migracje backendu.")

    if not os.getenv("SMTP_HOST") or not os.getenv("SMTP_FROM"):
        raise auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "EMAIL_NOT_CONFIGURED", "Odzyskiwanie hasła wymaga skonfigurowania wysyłki e-maili.")

    if user:
        now = datetime.now(timezone.utc)
        if not user.reset_requested_at or now - user.reset_requested_at >= timedelta(minutes=5):
            token = secrets.token_urlsafe(32)
            user.reset_token_hash = hashlib.sha256(token.encode()).hexdigest()
            user.reset_token_expires_at = now + timedelta(minutes=30)
            user.reset_requested_at = now
            await db.commit()
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8081").rstrip("/")
            try:
                send_password_reset_email(user.email, f"{frontend_url}/reset-password?token={token}")
            except Exception:
                user.reset_token_hash = None
                user.reset_token_expires_at = None
                await db.commit()
                raise auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "EMAIL_DELIVERY_FAILED", "Nie udało się wysłać wiadomości z linkiem resetu.")

    # Jednolita odpowiedź nie ujawnia, czy konto o wskazanym adresie istnieje.
    return {"message": "Jeśli konto istnieje, link do zmiany hasła został wysłany."}


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_password_reset(reset: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(reset.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    user = await db.scalar(
        select(User).where(User.reset_token_hash == token_hash, User.reset_token_expires_at > now)
    )
    if not user:
        raise auth_error(status.HTTP_400_BAD_REQUEST, "INVALID_OR_EXPIRED_RESET_TOKEN", "Link do zmiany hasła jest nieprawidłowy lub wygasł.")

    user.hashed_password = get_password_hash(reset.new_password)
    user.failed_login_attempts = 0
    user.last_failed_login_at = None
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me/travel-mode", response_model=UserResponse)
async def update_travel_mode(
    update_data: TravelModeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Włącza tryb wyjazdowy; maksymalnie trzy nowe wyjazdy w miesiącu."""
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    if current_user.abroad_reset_month != current_month:
        current_user.abroad = 0
        current_user.abroad_reset_month = current_month

    if update_data.is_abroad and not current_user.is_abroad:
        if current_user.abroad >= 3:
            await db.commit()
            raise auth_error(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "ABROAD_LIMIT_REACHED",
                "Wykorzystano już 3 aktywacje wyjazdu w tym miesiącu. Limit odnowi się w kolejnym miesiącu.",
            )
        current_user.abroad += 1

    current_user.is_abroad = update_data.is_abroad
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/location-country", response_model=LocationLookupResponse)
async def lookup_location_country(
    request: LocationLookupRequest,
    current_user: User = Depends(get_current_user),
):
    # Geocoding jest wykonywany po stronie backendu, a nie przez wycofane
    # reverseGeocodeAsync w expo-location.
    country_code = await resolve_country_from_coordinates(request.lat, request.lon)
    return {"country_code": country_code}


@router.put("/me/email", status_code=status.HTTP_204_NO_CONTENT)
async def update_email(
    update_data: EmailUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(update_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aktualne hasło jest nieprawidłowe.")

    if update_data.email != current_user.email:
        result = await db.execute(select(User).where(User.email == update_data.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ten adres e-mail jest już używany.")
        current_user.email = update_data.email
        await db.commit()
        await db.refresh(current_user)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def update_password(
    update_data: PasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(update_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aktualne hasło jest nieprawidłowe.")

    current_user.hashed_password = get_password_hash(update_data.new_password)
    await db.commit()
