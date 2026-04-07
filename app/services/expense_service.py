from sqlalchemy.orm import Session
from app.repositories.expense_repo import ExpenseRepository

class ExpenseService:
    def __init__(self, db: Session):
        self.repo = ExpenseRepository(db)

    def add_expense(self, data: dict):
        return self.repo.create(data)

    def get_user_expenses(self, user_id: int):
        return self.repo.list_by_user(user_id)