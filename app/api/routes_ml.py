from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.ml import (
    AdminInsightsOut,
    ClusterUserOut,
    FinancialChatRequest,
    FinancialChatResponse,
    CrispMLQReportOut,
    CrispMLQRunRequest,
    CrispModelStatusOut,
    DatasetRow,
    PublicDatasetImportOut,
    PublicDatasetImportRequest,
    SyntheticDatasetOut,
    SyntheticDatasetRequest,
    UserRiskOut,
    UserInsightsOut,
)
from app.services.crisp_mlq_service import CrispMLQService
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

@router.get("/insights/admin", response_model=AdminInsightsOut)
def get_admin_insights(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = MLService(db)
    return service.get_admin_insights()

@router.get("/insights/me", response_model=UserInsightsOut)
def get_user_insights(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = MLService(db)
    return service.get_user_insights(user)

@router.get("/dataset/export", response_model=list[DatasetRow])
def export_dataset(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = MLService(db)
    return service.export_dataset_rows()


@router.post("/dataset/synthetic", response_model=SyntheticDatasetOut)
def generate_synthetic_dataset(
    payload: SyntheticDatasetRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = MLService(db)
    rows = service.generate_synthetic_dataset_rows(
        users_count=payload.users_count,
        months=payload.months,
        seed=payload.seed,
    )
    return {
        "rows_generated": len(rows),
        "sample": rows[:100],
        "rows": rows,
    }


@router.post("/dataset/public/import-from-url", response_model=PublicDatasetImportOut)
def import_public_dataset(
    payload: PublicDatasetImportRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = MLService(db)
    try:
        return service.import_public_dataset_profile(
            url=payload.url,
            category_column=payload.category_column,
            value_column=payload.value_column,
            top_n=payload.top_n,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/crisp-mlq/run", response_model=CrispMLQReportOut)
def run_crisp_mlq_pipeline(
    payload: CrispMLQRunRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = CrispMLQService(db)
    return service.run_pipeline(
        include_synthetic=payload.include_synthetic,
        synthetic_users=payload.synthetic_users,
        synthetic_months=payload.synthetic_months,
        seed=payload.seed,
    )


@router.get("/crisp-mlq/report/latest", response_model=dict)
def get_latest_crisp_mlq_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = CrispMLQService(db)
    return service.get_latest_report()


@router.get("/crisp-mlq/model-status", response_model=CrispModelStatusOut)
def get_crisp_mlq_model_status(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = CrispMLQService(db)
    return service.get_model_status()


@router.get("/risk/me", response_model=UserRiskOut)
def get_my_risk(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = CrispMLQService(db)
    return service.predict_user_risk(user.id)


@router.get("/risk/user/{user_id}", response_model=UserRiskOut)
def get_user_risk_admin(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = CrispMLQService(db)
    return service.predict_user_risk(user_id)


@router.post("/chat", response_model=FinancialChatResponse)
def financial_chat(
    payload: FinancialChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    target_user_id = payload.target_user_id or user.id
    if not user.is_admin and target_user_id != user.id:
        raise HTTPException(status_code=403, detail="No puedes consultar datos de otro usuario.")

    service = MLService(db)
    return service.chat_with_financial_ai(
        current_user=user,
        question=payload.question,
        target_user_id=target_user_id,
    )
