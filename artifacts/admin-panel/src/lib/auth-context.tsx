import React, { createContext, useContext, useState, useEffect } from "react";
import { getAuth, setAuth, clearAuth, type AuthState } from "./api";

interface AuthCtx {
  auth: AuthState | null;
  login: (state: AuthState) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ auth: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(getAuth);

  function login(state: AuthState) {
    setAuth(state);
    setAuthState(state);
  }

  function logout() {
    clearAuth();
    setAuthState(null);
  }

  return <Ctx.Provider value={{ auth, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
