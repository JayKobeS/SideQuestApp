from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import jwt

from core.database import get_db
from core.security import SECRET_KEY, ALGORITHM
from models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")  # uwaga: poprawiony URL!


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nie można zweryfikować danych uwierzytelniających",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        token_data_id = int(user_id_str)
    except (jwt.PyJWTError, TypeError, ValueError):
        raise credentials_exception

    try:
        result = await db.execute(
            select(User).options(selectinload(User.quests)).where(User.id == token_data_id)
        )
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DATABASE_MIGRATION_REQUIRED", "message": "Baza danych wymaga aktualizacji. Uruchom migracje backendu."},
        )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user


def require_roles(*allowed_roles: str) -> Callable:
    """Tworzy zależność FastAPI dla endpointów moderatora, administratora i ownera."""
    async def role_guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nie masz uprawnień do wykonania tej operacji.",
            )
        return current_user

    return role_guard


require_moderator = require_roles("moderator", "admin", "owner")
require_admin = require_roles("admin", "owner")
require_owner = require_roles("owner")
