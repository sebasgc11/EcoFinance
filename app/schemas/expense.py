from pydantic import BaseModel, ConfigDict
from datetime import date

class ExpenseCreate(BaseModel):
    user_id: int
    category_id: int
    date: date
    amount: float
    movement_type: str = "expense"
    description: str | None = None

class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    category_id: int
    date: date
    amount: float
    movement_type: str
    description: str | None = None
