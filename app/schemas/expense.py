from pydantic import BaseModel, ConfigDict
from datetime import date

class ExpenseCreate(BaseModel):
    user_id: int
    category_id: int
    date: date
    amount: float
    movement_type: str = "expense"
    expected_return_rate: float | None = None
    expected_return_frequency: str | None = None
    description: str | None = None

class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    category_id: int
    date: date
    amount: float
    movement_type: str
    expected_return_rate: float | None = None
    expected_return_frequency: str | None = None
    description: str | None = None
