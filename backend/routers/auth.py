from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from core.database import get_db
from core.security import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from core.deps import get_current_user
from core.schemas import UserCreate, UserResponse, Token
from models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    # Sprawdzenie, czy użytkownik już istnieje (po emailu lub nazwie)
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Użytkownik o takim emailu lub nazwie już istnieje."
        )
    
    # Hashowanie hasła i zapis do bazy
    hashed_pw = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pw
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm oczekuje pól "username" i "password". 
    # W naszym przypadku w polu "username" frontend może wysłać email lub nazwę użytkownika.
    user = db.query(User).filter(
        (User.email == form_data.username) | (User.username == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy login lub hasło",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Generowanie tokena
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Zwraca profil zalogowanego użytkownika wraz z jego questami.
    Wymaga przekazania tokena w nagłówku 'Authorization: Bearer <token>'.
    """
    return current_user