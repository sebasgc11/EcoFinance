from sqlalchemy.orm import Session
from app.models.expense import Expense

class ExpenseRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: dict) -> Expense:
        exp = Expense(**data)
        self.db.add(exp)
        self.db.commit()
        self.db.refresh(exp)
        return exp

    def list_by_user(self, user_id: int) -> list[Expense]:
        return (
            self.db.query(Expense)
            .filter(Expense.user_id == user_id)
            .order_by(Expense.date.desc(), Expense.id.desc())
            .all()
        )
