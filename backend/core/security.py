import os
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
from dotenv import load_dotenv

# Wczytanie zmiennych z pliku .env
load_dotenv()

# Pobranie wartości 
SECRET_KEY = os.getenv("SECRET_KEY", "super_tajny_domyslny_klucz")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))

# Konfiguracja bcrypt do hashowania haseł
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Sprawdza, czy podane hasło w czystym tekście pasuje do hasha z bazy."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Zamienia zwykłe hasło na bezpieczny hash."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Generuje token JWT z zapisanymi danymi (np. ID użytkownika)."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt