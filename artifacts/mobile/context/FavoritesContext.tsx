import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/constants/apiUrl";

const BASE_URL = API_BASE_URL;

interface FavoritesContextType {
  favoriteIds: Set<string>;
  isFavorited: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());

  const fetchFavorites = useCallback(async () => {
    if (!token) { setFavoriteIds(new Set()); return; }
    try {
      const res = await fetch(`${BASE_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: { id: string }[] = await res.json();
      setFavoriteIds(new Set(data.map((d) => d.id)));
    } catch { }
  }, [token]);

  useEffect(() => {
    if (user) fetchFavorites();
    else setFavoriteIds(new Set());
  }, [user?.id, fetchFavorites]);

  const toggle = useCallback(async (listingId: string) => {
    if (!token || pendingRef.current.has(listingId)) return;
    pendingRef.current.add(listingId);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });

    try {
      await fetch(`${BASE_URL}/api/favorites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingId }),
      });
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(listingId)) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
    } finally {
      pendingRef.current.delete(listingId);
    }
  }, [token]);

  const isFavorited = useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorited, toggle, refresh: fetchFavorites }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
