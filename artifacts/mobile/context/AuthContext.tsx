import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "customer" | "provider" | "both";
export type ActiveMode = "customer" | "provider";

export interface User {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  role: UserRole;
  roles: string[];
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
  activeMode: ActiveMode;
  setActiveMode: (mode: ActiveMode) => void;
  loginWithPhone: (phone: string, name: string, role: UserRole) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  countryCode?: string;
  dob?: string;
  password: string;
  role: UserRole;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function normalizeUser(u: any): User {
  return {
    ...u,
    roles: u.roles ?? (u.role === "both" ? ["customer", "provider"] : [u.role]),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMode, setActiveModeState] = useState<ActiveMode>("customer");

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      const storedUser = await AsyncStorage.getItem("auth_user");
      const storedMode = await AsyncStorage.getItem("active_mode");
      if (storedToken && storedUser) {
        const u = normalizeUser(JSON.parse(storedUser));
        setToken(storedToken);
        setUser(u);
        const mode = (storedMode as ActiveMode) ?? (u.role === "provider" ? "provider" : "customer");
        setActiveModeState(mode);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function persist(u: User, t: string) {
    const normalized = normalizeUser(u);
    setUser(normalized);
    setToken(t);
    const defaultMode: ActiveMode = normalized.role === "provider" ? "provider" : "customer";
    setActiveModeState(defaultMode);
    await AsyncStorage.setItem("auth_token", t);
    await AsyncStorage.setItem("auth_user", JSON.stringify(normalized));
    await AsyncStorage.setItem("active_mode", defaultMode);
  }

  async function setActiveMode(mode: ActiveMode) {
    setActiveModeState(mode);
    await AsyncStorage.setItem("active_mode", mode);
  }

  async function refreshUser() {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeUser(data);
        setUser(normalized);
        await AsyncStorage.setItem("auth_user", JSON.stringify(normalized));
      }
    } catch { }
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
    } catch { }
    setUser(null);
    setToken(null);
    await AsyncStorage.multiRemove(["auth_token", "auth_user", "active_mode"]);
  }

  function updateUser(data: Partial<User>) {
    if (!user) return;
    const updated = normalizeUser({ ...user, ...data });
    setUser(updated);
    AsyncStorage.setItem("auth_user", JSON.stringify(updated));
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, activeMode, setActiveMode, loginWithPhone, loginWithEmail, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
