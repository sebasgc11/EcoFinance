from pydantic import BaseModel, ConfigDict
from datetime import date

class ExpenseCreate(BaseModel):
    user_id: int
    category_id: int
    date: date
    amount: float
    description: str | None = None

class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    category_id: int
    date: date
    amount: float
    description: str | None = None