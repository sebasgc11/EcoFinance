from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut
from app.repositories.category_repo import CategoryRepository

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.post("", response_model=CategoryOut)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = CategoryRepository(db)
    return repo.create(payload.name)

@router.get("", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = CategoryRepository(db)
    return repo.list_all()


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = CategoryRepository(db)
    category = repo.get_by_id(category_id)

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La categoria no existe.",
        )

    if category.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Las categorias base no se pueden eliminar.",
        )

    repo.delete(category)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
