from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from app.models.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    phone = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    base_income = Column(Float, nullable=True)
    income_frequency = Column(String(20), nullable=True)
    reset_code = Column(String(12), nullable=True)
    reset_code_expires_at = Column(DateTime, nullable=True)
