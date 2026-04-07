from datetime import datetime

from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password, verify_password

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        name: str,
        email: str,
        password: str,
        phone: str | None = None,
        is_admin: bool = False,
        base_income: float | None = None,
        income_frequency: str | None = None,
    ) -> User:
        user = User(
            name=name,
            email=email,
            phone=phone,
            password_hash=hash_password(password),
            is_admin=is_admin,
            base_income=base_income,
            income_frequency=income_frequency,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def authenticate(self, email: str, password: str) -> User | None:
        user = self.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            return None
        return user

    def list_all(self) -> list[User]:
        return self.db.query(User).all()

    def update_user(
        self,
        user: User,
        name: str,
        email: str,
        phone: str | None,
        base_income: float | None,
        income_frequency: str | None,
    ) -> User:
        user.name = name
        user.email = email
        user.phone = phone
        user.base_income = base_income
        user.income_frequency = income_frequency
        self.db.commit()
        self.db.refresh(user)
        return user

    def save_reset_code(
        self, user: User, code: str, expires_at: datetime
    ) -> User:
        user.reset_code = code
        user.reset_code_expires_at = expires_at
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_password(self, user: User, new_password: str) -> User:
        user.password_hash = hash_password(new_password)
        user.reset_code = None
        user.reset_code_expires_at = None
        self.db.commit()
        self.db.refresh(user)
        return user
