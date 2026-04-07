from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseOut
from app.services.expense_service import ExpenseService

router = APIRouter(prefix="/expenses", tags=["Expenses"])

@router.post("", response_model=ExpenseOut)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin and payload.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes crear gastos para otro usuario.",
        )
    service = ExpenseService(db)
    return service.add_expense(payload.model_dump())

@router.get("/by-user/{user_id}", response_model=list[ExpenseOut])
def list_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin and user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes ver gastos de otro usuario.",
        )
    service = ExpenseService(db)
    return service.get_user_expenses(user_id)
