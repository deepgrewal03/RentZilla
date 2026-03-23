import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "customer" | "provider";

export interface User {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  role: UserRole;
  location: string | null;
  profileImage: string | null;
  rating: number | null;
  reviewCount: number;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loginWithPhone: (phone: string, name: string, role: UserRole) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      const storedUser = await AsyncStorage.getItem("auth_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function persist(u: User, t: string) {
    setUser(u);
    setToken(t);
    await AsyncStorage.setItem("auth_token", t);
    await AsyncStorage.setItem("auth_user", JSON.stringify(u));
  }

  async function loginWithPhone(phone: string, name: string, role: UserRole) {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name, role }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed");
    await persist(data.user, data.token);
  }

  async function loginWithEmail(email: string, password: string) {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed");
    await persist(data.user, data.token);
  }

  async function register(regData: RegisterData) {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regData),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Registration failed");
    await persist(data.user, data.token);
  }

  async function logout() {
    try {
      if (token) {
        await fetch(`${BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore network error
    }
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
  }

  function updateUser(data: Partial<User>) {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    AsyncStorage.setItem("auth_user", JSON.stringify(updated));
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, loginWithPhone, loginWithEmail, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
