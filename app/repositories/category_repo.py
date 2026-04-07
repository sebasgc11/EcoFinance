from sqlalchemy.orm import Session
from app.models.category import Category
from app.models.expense import Expense

class CategoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, is_default: bool = False) -> Category:
        cat = Category(name=name, is_default=is_default)
        self.db.add(cat)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def list_all(self) -> list[Category]:
        return self.db.query(Category).all()

    def get_by_id(self, category_id: int) -> Category | None:
        return self.db.query(Category).filter(Category.id == category_id).first()

    def has_expenses(self, category_id: int) -> bool:
        expense = (
            self.db.query(Expense)
            .filter(Expense.category_id == category_id)
            .first()
        )
        return expense is not None

    def delete(self, category: Category) -> None:
        self.db.delete(category)
        self.db.commit()
