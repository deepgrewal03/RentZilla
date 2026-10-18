import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "@/constants/apiUrl";
import { revokeThisPushDevice } from "@/services/NativeNotifications";

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
  photoUrl?: string | null;
  rating: number | null;
  reviewCount: number;
  createdAt: string;
  provider?: "email" | "google" | "apple";
  profileComplete?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  activeMode: ActiveMode;
  setActiveMode: (mode: ActiveMode) => void;
  loginWithPhone: (phone: string, name: string, role: UserRole) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<{ isNewUser: boolean; profileComplete: boolean }>;
  loginWithApple: (identityToken: string, appleUserId: string, fullName?: { givenName?: string | null; familyName?: string | null } | null, email?: string | null) => Promise<{ isNewUser: boolean; profileComplete: boolean }>;
  completeProfile: (data: CompleteProfileData) => Promise<void>;
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
  location?: string;
}

export interface CompleteProfileData {
  name?: string;
  phone: string;
  dob?: string;
  location?: string;
  role?: UserRole;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BASE_URL = API_BASE_URL;

function normalizeUser(u: any): User {
  return {
    ...u,
    roles: u.roles ?? (u.role === "both" ? ["customer", "provider"] : [u.role]),
    photoUrl: u.photo_url ?? u.photoUrl ?? null,
    profileComplete: u.profile_complete ?? u.profileComplete ?? true,
    provider: u.provider ?? u.auth_provider ?? "email",
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
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, role }),
      });
    } catch {
      throw new Error(`Cannot reach server. Check your internet connection.`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed");
    await persist(data.user, data.token);
  }

  async function loginWithEmail(email: string, password: string) {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error(`Cannot reach server. Check your internet connection.`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed");
    await persist(data.user, data.token);
  }

  async function loginWithGoogle(idToken: string): Promise<{ isNewUser: boolean; profileComplete: boolean }> {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken, device_type: "mobile" }),
      });
    } catch {
      throw new Error(`Cannot reach server. Check your internet connection.`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Google sign-in failed");
    await persist(data.user, data.token);
    return {
      isNewUser: data.is_new_user ?? false,
      profileComplete: data.profile_complete ?? true,
    };
  }

  async function loginWithApple(
    identityToken: string,
    appleUserId: string,
    fullName?: { givenName?: string | null; familyName?: string | null } | null,
    email?: string | null,
  ): Promise<{ isNewUser: boolean; profileComplete: boolean }> {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_token: identityToken,
          apple_user_id: appleUserId,
          full_name: fullName ?? null,
          email: email ?? null,
          device_type: "ios",
        }),
      });
    } catch {
      throw new Error(`Cannot reach server. Check your internet connection.`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Apple sign-in failed");
    await persist(data.user, data.token);
    return {
      isNewUser: data.is_new_user ?? false,
      profileComplete: data.profile_complete ?? true,
    };
  }

  async function completeProfile(profileData: CompleteProfileData) {
    if (!token) throw new Error("Not authenticated");
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/auth/complete-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileData),
      });
    } catch {
      throw new Error(`Cannot reach server. Check your internet connection.`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Profile update failed");
    if (data.token) {
      await persist(data.user, data.token);
    } else if (data.user) {
      const normalized = normalizeUser(data.user);
      setUser(normalized);
      await AsyncStorage.setItem("auth_user", JSON.stringify(normalized));
    }
  }

  async function register(regData: RegisterData) {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regData),
      });
    } catch {
      throw new Error(`Cannot reach server. Check your internet connection.`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Registration failed");
    await persist(data.user, data.token);
  }

  async function logout() {
    // Failure is retried on reconnect/startup using an installation-only revocation
    // credential. Never keep the previous account's auth token for cleanup.
    await revokeThisPushDevice().catch(() => {});
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
    <AuthContext.Provider value={{
      user, token, isLoading, activeMode, setActiveMode,
      loginWithPhone, loginWithEmail, loginWithGoogle, loginWithApple,
      completeProfile, register, logout, updateUser, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
