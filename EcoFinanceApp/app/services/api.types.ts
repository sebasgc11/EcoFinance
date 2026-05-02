export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  is_admin: boolean;
  base_income?: number | null;
  income_frequency?: string | null;
}

export interface Category {
  id: number;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

export interface Expense {
  id: number;
  user_id: number;
  category_id: number;
  amount: number;
  movement_type: "expense" | "income" | "investment";
  expected_return_rate?: number | null;
  expected_return_frequency?: "monthly" | "annual" | null;
  description: string;
  date: string;
  category_name?: string;
}

export interface ClusterUser {
  user_id: number;
  cluster: number;
  email?: string;
  total_expense?: number;
}

export interface MovementTotals {
  expense: number;
  income: number;
  investment: number;
}

export interface CategoryShare {
  category_id: number;
  name: string;
  total_amount: number;
  percentage: number;
}

export interface MonthlyTrendPoint {
  month: string;
  expense: number;
  income: number;
  investment: number;
  net_balance: number;
}

export interface BenchmarkComparison {
  category_name: string;
  user_or_global_percentage: number;
  benchmark_percentage: number;
  delta_percentage: number;
}

export interface AdminInsights {
  total_users: number;
  users_with_expenses: number;
  percent_investors: number;
  percent_savers: number;
  movement_totals: MovementTotals;
  top_categories: CategoryShare[];
  monthly_trends: MonthlyTrendPoint[];
  benchmark_comparison: BenchmarkComparison[];
  conclusions: string[];
  suggestions: string[];
}

export interface UserInsights {
  user_id: number;
  movement_totals: MovementTotals;
  top_categories: CategoryShare[];
  monthly_trends: MonthlyTrendPoint[];
  benchmark_comparison: BenchmarkComparison[];
  spending_vs_income_ratio: number;
  recommended_saving_amount: number;
  conclusions: string[];
  suggestions: string[];
}

export interface SyntheticDatasetResponse {
  rows_generated: number;
  sample: {
    user_id: number;
    user_email: string;
    category_id: number;
    category_name: string;
    amount: number;
    movement_type: "expense" | "income" | "investment";
    date: string;
    base_income?: number | null;
    income_frequency?: string | null;
  }[];
}

export interface CrispDeployment {
  deployed: boolean;
  model_version?: string | null;
}

export interface CrispMLQReport {
  framework: string;
  run_id: string;
  executed_at: string;
  phases: Record<string, unknown>[];
  deployment: CrispDeployment;
}

export interface UserRisk {
  user_id?: number | null;
  risk_probability?: number | null;
  risk_label?: "low" | "medium" | "high" | string | null;
  model_version?: string | null;
  detail?: string | null;
}

export interface FinancialChatRequest {
  question: string;
  target_user_id?: number;
}

export interface FinancialChatResponse {
  question: string;
  answer: string;
  target_user_id: number;
  suggested_questions: string[];
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface MessageResponse {
  message: string;
}
