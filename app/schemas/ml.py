from pydantic import BaseModel

class ClusterUserOut(BaseModel):
    user_id: int
    cluster: int


class MonthlyTrendPoint(BaseModel):
    month: str
    expense: float
    income: float
    investment: float
    net_balance: float

class MovementTotals(BaseModel):
    expense: float
    income: float
    investment: float

class CategoryShare(BaseModel):
    category_id: int
    name: str
    total_amount: float
    percentage: float


class BenchmarkComparison(BaseModel):
    category_name: str
    user_or_global_percentage: float
    benchmark_percentage: float
    delta_percentage: float

class AdminInsightsOut(BaseModel):
    total_users: int
    users_with_expenses: int
    percent_investors: float
    percent_savers: float
    movement_totals: MovementTotals
    top_categories: list[CategoryShare]
    monthly_trends: list[MonthlyTrendPoint]
    benchmark_comparison: list[BenchmarkComparison]
    conclusions: list[str]
    suggestions: list[str]


class UserInsightsOut(BaseModel):
    user_id: int
    movement_totals: MovementTotals
    top_categories: list[CategoryShare]
    monthly_trends: list[MonthlyTrendPoint]
    benchmark_comparison: list[BenchmarkComparison]
    spending_vs_income_ratio: float
    recommended_saving_amount: float
    conclusions: list[str]
    suggestions: list[str]

class DatasetRow(BaseModel):
    user_id: int
    user_email: str
    category_id: int
    category_name: str
    amount: float
    movement_type: str
    date: str
    base_income: float | None
    income_frequency: str | None


class SyntheticDatasetRequest(BaseModel):
    users_count: int = 50
    months: int = 12
    seed: int = 42


class SyntheticDatasetOut(BaseModel):
    rows_generated: int
    sample: list[DatasetRow]
    rows: list[DatasetRow]


class PublicDatasetImportRequest(BaseModel):
    url: str
    category_column: str
    value_column: str
    top_n: int = 10


class PublicDatasetCategoryShare(BaseModel):
    category_name: str
    percentage: float


class PublicDatasetImportOut(BaseModel):
    source_url: str
    rows_used: int
    profile: list[PublicDatasetCategoryShare]


class CrispMLQRunRequest(BaseModel):
    include_synthetic: bool = True
    synthetic_users: int = 100
    synthetic_months: int = 12
    seed: int = 42


class CrispPhaseOut(BaseModel):
    phase: str
    status: str
    quality_gate_passed: bool
    notes: list[str] | None = None


class CrispDeploymentOut(BaseModel):
    deployed: bool
    model_version: str | None = None


class CrispMLQReportOut(BaseModel):
    framework: str
    run_id: str
    executed_at: str
    phases: list[dict]
    deployment: CrispDeploymentOut


class CrispModelStatusOut(BaseModel):
    has_model: bool
    metadata: dict | None = None


class UserRiskOut(BaseModel):
    user_id: int | None = None
    risk_probability: float | None = None
    risk_label: str | None = None
    model_version: str | None = None
    detail: str | None = None


class FinancialChatRequest(BaseModel):
    question: str
    target_user_id: int | None = None


class FinancialChatResponse(BaseModel):
    question: str
    answer: str
    target_user_id: int
    suggested_questions: list[str]
