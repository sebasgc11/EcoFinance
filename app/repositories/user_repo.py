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
    ) -> User:
        user = User(
            name=name,
            email=email,
            phone=phone,
            password_hash=hash_password(password),
            is_admin=is_admin,
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

    def update_user(self, user: User, name: str, email: str, phone: str | None) -> User:
        user.name = name
        user.email = email
        user.phone = phone
        self.db.commit()
        self.db.refresh(user)
        return user
