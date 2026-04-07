from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.category import Category
from app.models.expense import Expense

class CategoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, is_default: bool = False) -> Category:
        existing_category = (
            self.db.query(Category)
            .filter(func.lower(Category.name) == name.strip().lower())
            .first()
        )

        if existing_category:
            existing_category.name = name.strip()
            existing_category.is_default = is_default or existing_category.is_default
            existing_category.is_active = True
            self.db.commit()
            self.db.refresh(existing_category)
            return existing_category

        cat = Category(name=name, is_default=is_default, is_active=True)
        self.db.add(cat)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def list_all(self) -> list[Category]:
        return (
            self.db.query(Category)
            .filter(Category.is_active.is_(True))
            .all()
        )

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
        category.is_active = False
        self.db.commit()
