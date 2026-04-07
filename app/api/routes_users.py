from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, get_current_user, require_admin
from app.core.google_auth import verify_google_id_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    AuthResponse,
    GoogleAuthIn,
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)
from app.repositories.user_repo import UserRepository

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("", response_model=AuthResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    repo = UserRepository(db)
    existing_user = repo.get_by_email(payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un usuario con ese correo.",
        )
    user = repo.create(
        payload.name,
        payload.email,
        payload.password,
        payload.phone,
        False,
        payload.base_income,
        payload.income_frequency,
    )
    return {"access_token": create_access_token(user), "user": user}


@router.post("/password-reset/request", response_model=MessageResponse)
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    repo = UserRepository(db)
    email = payload.email.strip().lower()
    user = repo.get_by_email(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe una cuenta con ese correo.",
        )

    return {"message": "Ahora puedes definir una nueva contraseña para esta cuenta."}


@router.post("/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    repo = UserRepository(db)
    email = payload.email.strip().lower()
    user = repo.get_by_email(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe una cuenta con ese correo.",
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 6 caracteres.",
        )

    repo.update_password(user, payload.new_password)
    return {"message": "Tu contraseña fue actualizada correctamente."}


@router.post("/login", response_model=AuthResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    repo = UserRepository(db)
    user = repo.authenticate(payload.email, payload.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
        )

    return {"access_token": create_access_token(user), "user": user}


@router.post("/google", response_model=AuthResponse)
def google_login(payload: GoogleAuthIn, db: Session = Depends(get_db)):
    google_payload = verify_google_id_token(payload.id_token)
    repo = UserRepository(db)
    email = google_payload["email"].strip().lower()
    user = repo.get_by_email(email)

    if not user:
        user = repo.create(
            name=google_payload.get("name") or email.split("@")[0],
            email=email,
            password=google_payload.get("sub", email),
            phone=None,
            is_admin=False,
            base_income=None,
            income_frequency=None,
        )

    return {"access_token": create_access_token(user), "user": user}

@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    repo = UserRepository(db)
    return repo.list_all()


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = UserRepository(db)
    normalized_email = payload.email.strip().lower()
    existing_user = repo.get_by_email(normalized_email)

    if existing_user and existing_user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un usuario con ese correo.",
        )

    return repo.update_user(
        current_user,
        payload.name.strip(),
        normalized_email,
        payload.phone.strip() if payload.phone else None,
        payload.base_income,
        payload.income_frequency.strip() if payload.income_frequency else None,
    )
