import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { hasActiveGold, type GoldStatus } from "@/lib/bookingPrices";

export function useBookingGold() {
  const { token } = useAuth();
  const { get } = useApi();
  const [status, setStatus] = useState<GoldStatus | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [attempt, retry] = useState(0);
  useFocusEffect(useCallback(() => {
    let current = true;
    setStatus(null);
    setError(false);
    if (token) {
      get<GoldStatus>("/membership/status").then(value => {
        if (current) { setStatus(value); setNow(Date.now()); }
      }).catch(() => { if (current) setError(true); });
    }
    return () => { current = false; };
  }, [token, attempt]));
  useEffect(() => {
    if (!status?.expiresAt) return;
    const remaining = new Date(status.expiresAt).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining + 20, 2147483647));
    return () => clearTimeout(timer);
  }, [status, now]);
  return { status, active: hasActiveGold(status, now), error, retry: () => retry(v => v + 1) };
}
