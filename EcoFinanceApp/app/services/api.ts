import axios from "axios";
import { Platform } from "react-native";

const MOBILE_BASE_URL = "http://192.168.1.8:8000";

function resolveBaseUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000`;
  }

  return MOBILE_BASE_URL;
}

const BASE_URL = resolveBaseUrl();

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  is_admin: boolean;
}

export interface Category {
  id: number;
  name: string;
  is_default: boolean;
}

export interface Expense {
  id: number;
  user_id: number;
  category_id: number;
  amount: number;
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

export interface AuthResponse {
  access_token: string;
  user: User;
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

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
    const fallbackMessage = "No fue posible conectar con el servidor.";
    const timeoutMessage =
      "El servidor tardó demasiado en responder. Verifica que FastAPI y MariaDB estén encendidos.";
    const detail =
      error.code === "ECONNABORTED"
        ? timeoutMessage
        : error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message ||
          fallbackMessage;

    return Promise.reject(new Error(detail));
  }
);

export const userService = {
  getUsers: async () => {
    const response = await api.get<User[]>("/users");
    return response.data;
  },
  getMe: async () => {
    const response = await api.get<User>("/users/me");
    return response.data;
  },
  createUser: async (payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => {
    const response = await api.post<AuthResponse>("/users", payload);
    return response.data;
  },
  login: async (payload: { email: string; password: string }) => {
    const response = await api.post<AuthResponse>("/users/login", payload);
    return response.data;
  },
  loginWithGoogle: async (payload: { id_token: string }) => {
    const response = await api.post<AuthResponse>("/users/google", payload);
    return response.data;
  },
  updateMe: async (payload: { name: string; email: string; phone?: string }) => {
    const response = await api.put<User>("/users/me", payload);
    return response.data;
  },
};

export const categoryService = {
  getCategories: async () => {
    const response = await api.get<Category[]>("/categories");
    return response.data;
  },
  createCategory: async (payload: { name: string }) => {
    const response = await api.post<Category>("/categories", payload);
    return response.data;
  },
  deleteCategory: async (categoryId: number) => {
    await api.delete(`/categories/${categoryId}`);
  },
};

export const expenseService = {
  getExpensesByUser: async (userId: number) => {
    const response = await api.get<Expense[]>(`/expenses/by-user/${userId}`);
    return response.data;
  },
  createExpense: async (payload: {
    user_id: number;
    category_id: number;
    amount: number;
    description: string;
    date: string;
  }) => {
    const response = await api.post<Expense>("/expenses", payload);
    return response.data;
  },
};

export const mlService = {
  getUserClusters: async (k = 3) => {
    const response = await api.get<ClusterUser[]>(`/ml/cluster-users?k=${k}`);
    return response.data;
  },
};

export default api;
