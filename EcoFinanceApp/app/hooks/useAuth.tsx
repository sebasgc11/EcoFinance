import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthToken, userService, User } from "../services/api";

const STORAGE_KEY = "@EcoFinanceApp:session";

export interface AuthUser extends User {
  phone?: string | null;
  firstName?: string;
  lastName?: string;
}

interface StoredSession {
  token: string;
  user: AuthUser;
}

interface AuthContextData {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
  }) => Promise<void>;
  updateProfile: (payload: {
    name: string;
    email: string;
    phone?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedSession = await AsyncStorage.getItem(STORAGE_KEY);

        if (storedSession) {
          const parsedSession = JSON.parse(storedSession) as StoredSession;
          setAuthToken(parsedSession.token);
          setToken(parsedSession.token);
          setUser(parsedSession.user);
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const persistSession = async (nextToken: string, nextUser: AuthUser) => {
    const session: StoredSession = { token: nextToken, user: nextUser };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  };

  const signIn = async ({ email, password }: { email: string; password: string }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const session = await userService.login({
      email: normalizedEmail,
      password,
    });
    await persistSession(session.access_token, session.user);
  };

  const signInWithGoogle = async (idToken: string) => {
    const session = await userService.loginWithGoogle({ id_token: idToken });
    await persistSession(session.access_token, session.user);
  };

  const signUp = async ({
    firstName,
    lastName,
    phone,
    email,
    password,
  }: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
  }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhone = phone.trim();
    const fullName = `${cleanFirstName} ${cleanLastName}`.trim();

    if (!cleanFirstName || !cleanLastName) {
      throw new Error("Los nombres y apellidos son obligatorios.");
    }

    if (!cleanPhone) {
      throw new Error("El telefono es obligatorio.");
    }

    const createdSession = await userService.createUser({
      name: fullName,
      email: normalizedEmail,
      phone: cleanPhone,
      password,
    });

    await persistSession(createdSession.access_token, {
      ...createdSession.user,
      phone: createdSession.user.phone ?? cleanPhone,
      firstName: cleanFirstName,
      lastName: cleanLastName,
    });
  };

  const updateProfile = async ({
    name,
    email,
    phone,
  }: {
    name: string;
    email: string;
    phone?: string;
  }) => {
    if (!token || !user) {
      throw new Error("No hay una sesión activa.");
    }

    const updatedUser = await userService.updateMe({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || "",
    });

    await persistSession(token, {
      ...user,
      ...updatedUser,
      firstName: updatedUser.name.split(" ")[0] || user.firstName,
      lastName:
        updatedUser.name.split(" ").slice(1).join(" ") || user.lastName,
    });
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      signIn,
      signInWithGoogle,
      signUp,
      updateProfile,
      signOut,
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}
