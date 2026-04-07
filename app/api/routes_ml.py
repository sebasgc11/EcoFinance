from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.ml import ClusterUserOut
from app.services.ml_service import MLService

router = APIRouter(prefix="/ml", tags=["ML"])

@router.get("/cluster-users", response_model=list[ClusterUserOut] | dict)
def cluster_users(
    k: int = 3,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = MLService(db)
    return service.cluster_users(k=k)
