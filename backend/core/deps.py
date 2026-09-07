from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt
from uuid import UUID

from core.database import get_db
from core.security import SECRET_KEY, ALGORITHM
from models.user import User

# Wskazuje FastAPI, gdzie frontend ma wysyłać zapytania z logowaniem
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nie można zweryfikować danych uwierzytelniających",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Dekodowanie tokena
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
            
        # Zamiana stringa na UUID
        token_data_id = UUID(user_id_str)
        
    except jwt.PyJWTError:
        raise credentials_exception
        
    # Szukanie użytkownika w bazie
    user = db.query(User).filter(User.id == token_data_id).first()
    if user is None:
        raise credentials_exception
        
    return user