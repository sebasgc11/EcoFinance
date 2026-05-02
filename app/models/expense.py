from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey
from app.models.base import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    movement_type = Column(String(20), nullable=False, default="expense")
    expected_return_rate = Column(Float, nullable=True)
    expected_return_frequency = Column(String(20), nullable=True)
    description = Column(String(200), nullable=True)
