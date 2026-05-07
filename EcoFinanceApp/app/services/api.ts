import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type {
  AdminInsights,
  AuthResponse,
  Category,
  ClusterUser,
  CrispMLQReport,
  Expense,
  FinancialChatRequest,
  FinancialChatResponse,
  MessageResponse,
  SyntheticDatasetResponse,
  User,
  UserInsights,
  UserRisk,
} from "./api.types";

export * from "./api.types";

const API_PORT = 8000;
const FALLBACK_MOBILE_BASE_URL = `http://10.0.2.2:${API_PORT}`;

function isLanOrLocalHost(host: string) {
  if (host === "localhost" || host === "127.0.0.1") {
    return true;
  }

  return /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host);
}

function resolveBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `http://${window.location.hostname}:${API_PORT}`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host && isLanOrLocalHost(host)) {
      return `http://${host}:${API_PORT}`;
    }
  }

  return FALLBACK_MOBILE_BASE_URL;
}

const BASE_URL = resolveBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

const getData = async <T,>(url: string) => (await api.get<T>(url)).data;
const postData = async <T, P>(url: string, payload: P) =>
  (await api.post<T>(url, payload)).data;
const putData = async <T, P>(url: string, payload: P) =>
  (await api.put<T>(url, payload)).data;

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const fallbackMessage = `No fue posible conectar con el servidor (${BASE_URL}).`;
    const timeoutMessage =
      "El servidor tardó demasiado en responder. Verifica que FastAPI y MariaDB estén encendidos.";
    const networkMessage =
      `Error de red. Verifica que FastAPI este ejecutandose y que la app apunte a la URL correcta: ${BASE_URL}`;
    const isNetworkError = !error.response && (error.code === "ERR_NETWORK" || error.message === "Network Error");
    const detail =
      error.code === "ECONNABORTED"
        ? timeoutMessage
        : isNetworkError
          ? networkMessage
        : error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message ||
          fallbackMessage;

    return Promise.reject(new Error(detail));
  }
);

export const userService = {
  getUsers: () => getData<User[]>("/users"),
  getMe: () => getData<User>("/users/me"),
  createUser: async (payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    base_income?: number | null;
    income_frequency?: string | null;
  }) => postData<AuthResponse, typeof payload>("/users", payload),
  login: (payload: { email: string; password: string }) =>
    postData<AuthResponse, typeof payload>("/users/login", payload),
  loginWithGoogle: (payload: { id_token: string }) =>
    postData<AuthResponse, typeof payload>("/users/google", payload),
  requestPasswordReset: (payload: { email: string }) =>
    postData<MessageResponse, typeof payload>(
      "/users/password-reset/request",
      payload
    ),
  confirmPasswordReset: async (payload: {
    email: string;
    new_password: string;
  }) =>
    postData<MessageResponse, typeof payload>(
      "/users/password-reset/confirm",
      payload
    ),
  updateMe: async (payload: {
    name: string;
    email: string;
    phone?: string;
    base_income?: number | null;
    income_frequency?: string | null;
  }) => putData<User, typeof payload>("/users/me", payload),
};

export const categoryService = {
  getCategories: () => getData<Category[]>("/categories"),
  createCategory: (payload: { name: string }) =>
    postData<Category, typeof payload>("/categories", payload),
  deleteCategory: async (categoryId: number) => {
    await api.delete(`/categories/${categoryId}`);
  },
};

export const expenseService = {
  getExpensesByUser: (userId: number) => getData<Expense[]>(`/expenses/by-user/${userId}`),
  createExpense: async (payload: {
    user_id: number;
    category_id: number;
    amount: number;
    movement_type: "expense" | "income" | "investment";
    expected_return_rate?: number | null;
    expected_return_frequency?: "monthly" | "annual" | null;
    description: string;
    date: string;
  }) => postData<Expense, typeof payload>("/expenses", payload),
};

export const mlService = {
  getUserClusters: (k = 3) => getData<ClusterUser[]>(`/ml/cluster-users?k=${k}`),
  getAdminInsights: () => getData<AdminInsights>("/ml/insights/admin"),
  getMyInsights: () => getData<UserInsights>("/ml/insights/me"),
  generateSyntheticDataset: async (payload: {
    users_count: number;
    months: number;
    seed?: number;
  }) =>
    (
      await api.post<SyntheticDatasetResponse>(
        "/ml/dataset/synthetic",
        payload,
        { timeout: 120000 }
      )
    ).data,
  runCrispMLQPipeline: async (payload?: {
    include_synthetic?: boolean;
    synthetic_users?: number;
    synthetic_months?: number;
    seed?: number;
  }) =>
    (
      await api.post<CrispMLQReport>(
        "/ml/crisp-mlq/run",
        payload || {
          include_synthetic: true,
          synthetic_users: 100,
          synthetic_months: 12,
          seed: 42,
        },
        { timeout: 180000 }
      )
    ).data,
  getLatestCrispMLQReport: () =>
    getData<Record<string, unknown>>("/ml/crisp-mlq/report/latest"),
  getMyRisk: () => getData<UserRisk>("/ml/risk/me"),
  askFinancialAssistant: (payload: FinancialChatRequest) =>
    postData<FinancialChatResponse, FinancialChatRequest>("/ml/chat", payload),
};

export default api;
