import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { useAuth } from "./AuthContext";
import {
  DeviceNotificationStatus, nativeNotificationsSupported, notificationDestination,
  readNotificationStatus, requestNativeNotificationPermission, syncPushRegistration,
  setNotificationAccount,
} from "@/services/NativeNotifications";

type State = {
  status: DeviceNotificationStatus | null; error: string | null; busy: boolean;
  refresh: () => Promise<void>; enable: () => Promise<void>;
};
const NotificationContext = createContext<State | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useAuth();
  const userId = user?.id ?? null;
  const navigation = useRootNavigationState();
  const [status, setStatus] = useState<DeviceNotificationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<Notifications.NotificationResponse | null>(null);
  const lastHandled = useRef<string | null>(null);
  const activeUser = useRef(userId);
  activeUser.current = userId;

  const refresh = useCallback(async () => {
    try {
      setStatus(await readNotificationStatus());
    } catch {
      setStatus(null);
      setError("Could not read device notification permission. Please try again.");
      return;
    }
    setError(null);
    try {
      if (!isLoading && activeUser.current === userId) await syncPushRegistration(userId, token);
    } catch {
      // OS permission and delivery registration are different facts.
      setError("Could not refresh notification registration. Check your connection and try again.");
    }
  }, [userId, token, isLoading]);
  const enable = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await requestNativeNotificationPermission());
      await refresh();
    } catch {
      setError("Could not request device permission. Please try again or open your phone settings.");
    } finally { setBusy(false); }
  }, [refresh]);

  useEffect(() => {
    if (isLoading) return;
    setNotificationAccount(userId);
    void refresh();
    const app = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    let wasConnected = false;
    const network = NetInfo.addEventListener(state => {
      const connected = state.isConnected === true;
      if (connected && !wasConnected) void refresh();
      wasConnected = connected;
    });
    const rotation = nativeNotificationsSupported() ? Notifications.addPushTokenListener(() => { void refresh(); }) : null;
    return () => { app.remove(); network(); rotation?.remove(); };
  }, [refresh, userId, isLoading]);

  useEffect(() => {
    if (!nativeNotificationsSupported()) return;
    Notifications.setNotificationHandler({
      handleNotification: async notification => {
        const belongsToUser = notification.request.content.data.userId === activeUser.current && activeUser.current !== null;
        return {
          shouldShowBanner: belongsToUser, shouldShowList: belongsToUser,
          shouldPlaySound: belongsToUser, shouldSetBadge: false,
        };
      },
    });
    const listener = Notifications.addNotificationResponseReceivedListener(setResponse);
    Notifications.getLastNotificationResponseAsync().then(setResponse).catch(() => {});
    return () => { listener.remove(); Notifications.setNotificationHandler(null); };
  }, []);
  useEffect(() => {
    if (!response || isLoading || !navigation?.key || !userId) return;
    const id = response.notification.request.identifier;
    if (lastHandled.current === id) return;
    lastHandled.current = id;
    const destination = notificationDestination(response.notification.request.content.data, userId);
    if (destination) router.push(destination as any);
    void Notifications.clearLastNotificationResponseAsync();
    setResponse(null);
  }, [response, userId, isLoading, navigation?.key]);

  return <NotificationContext.Provider value={{ status, error, busy, refresh, enable }}>{children}</NotificationContext.Provider>;
}
export function useNativeNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("NotificationProvider is required");
  return value;
}
