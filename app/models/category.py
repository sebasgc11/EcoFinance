from sqlalchemy import Boolean, Column, Integer, String
from app.models.base import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(60), unique=True, nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
