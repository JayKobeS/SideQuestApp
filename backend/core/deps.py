from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
from uuid import UUID

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
        token_data_id = UUID(user_id_str)
    except jwt.PyJWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == token_data_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user