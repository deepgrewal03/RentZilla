import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as Application from "expo-application";
import * as IntentLauncher from "expo-intent-launcher";
import { Linking, Platform } from "react-native";
import { registerPushDevice, unregisterPushDevice } from "@workspace/api-client-react";

export type DeviceNotificationStatus = "allowed" | "disabled" | "not-requested" | "unsupported";
const IDENTITY_KEY = "@rentzilla:push_installation";
const REVOKE_KEY = "@rentzilla:push_revoke_pending";
let desiredAccount: string | null = null;
let generation = 0;
let queue: Promise<unknown> = Promise.resolve();

async function bounded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Notification registration timed out"));
        }, 12000);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function nativeNotificationsSupported() {
  return Platform.OS !== "web" && Constants.executionEnvironment !== "storeClient";
}
export function permissionStatus(p: Notifications.NotificationPermissionsStatus): DeviceNotificationStatus {
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      p.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL) return "allowed";
  return p.status === "undetermined" ? "not-requested" : "disabled";
}
export async function readNotificationStatus(): Promise<DeviceNotificationStatus> {
  if (!nativeNotificationsSupported()) return "unsupported";
  return permissionStatus(await Notifications.getPermissionsAsync());
}

// Stable channel IDs: never delete/recreate them to override users' OS choices.
export async function ensureNotificationChannels() {
  if (Platform.OS !== "android" || !nativeNotificationsSupported()) return;
  for (const [id, name] of [
    ["bookings", "Bookings"], ["messages", "Messages"], ["payments", "Payments"],
    ["rentals", "Rental Updates"], ["offers", "Offers & Promotions"], ["account", "Account & Security"],
  ]) {
    await Notifications.setNotificationChannelAsync(id, {
      name, importance: Notifications.AndroidImportance.DEFAULT, sound: "default",
    });
  }
}
export async function requestNativeNotificationPermission() {
  if (!nativeNotificationsSupported()) return "unsupported" as const;
  await ensureNotificationChannels();
  const existing = await Notifications.getPermissionsAsync();
  // Denied users go to settings, never an automatic/repeated permission request.
  if (permissionStatus(existing) !== "not-requested" || !existing.canAskAgain) return permissionStatus(existing);
  return permissionStatus(await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  }));
}
export async function openNativeNotificationSettings() {
  if (!nativeNotificationsSupported()) throw new Error("Open RentZilla on your phone to manage notification permissions.");
  if (Platform.OS === "android" && Application.applicationId) {
    try {
      await IntentLauncher.startActivityAsync("android.settings.APP_NOTIFICATION_SETTINGS", {
        extra: { "android.provider.extra.APP_PACKAGE": Application.applicationId },
      });
      return;
    } catch { /* Older Android builds support the app settings page instead. */ }
  }
  // Public iOS application settings URL; no private prefs: URL schemes.
  await Linking.openSettings();
}

async function installation() {
  const raw = await AsyncStorage.getItem(IDENTITY_KEY);
  if (raw) return JSON.parse(raw) as { installationId: string; secret: string };
  const secret = Array.from(await Crypto.getRandomBytesAsync(32), b => b.toString(16).padStart(2, "0")).join("");
  const identity = { installationId: Crypto.randomUUID(), secret };
  await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => {}).then(work);
  queue = next;
  return next;
}
async function revokePending() {
  if (await AsyncStorage.getItem(REVOKE_KEY) !== "yes") return;
  const raw = await AsyncStorage.getItem(IDENTITY_KEY);
  if (raw) await bounded(signal => unregisterPushDevice(JSON.parse(raw), { signal }));
  await AsyncStorage.removeItem(REVOKE_KEY);
}
export function setNotificationAccount(userId: string | null) {
  if (desiredAccount !== userId) { desiredAccount = userId; generation++; }
}
export function revokeThisPushDevice() {
  setNotificationAccount(null);
  return serial(async () => {
    if (!nativeNotificationsSupported()) return;
    // Keep revocation intent across offline logout/app restarts; no old auth token is stored.
    await AsyncStorage.setItem(REVOKE_KEY, "yes");
    await Notifications.dismissAllNotificationsAsync().catch(() => {});
    await revokePending();
  });
}
export function syncPushRegistration(userId: string | null, authToken: string | null) {
  const started = generation;
  return serial(async () => {
    if (!nativeNotificationsSupported()) return;
    await revokePending();
    if (!userId || !authToken || started !== generation || desiredAccount !== userId) return;
    await ensureNotificationChannels();
    if (await readNotificationStatus() !== "allowed") {
      await AsyncStorage.setItem(REVOKE_KEY, "yes");
      await revokePending();
      return;
    }
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error("Push notifications are not configured for this build.");
    // This registers native APNs/FCM first, then obtains the Expo routing token.
    const token = await bounded(() => Notifications.getExpoPushTokenAsync({ projectId }));
    const identity = await installation();
    if (started !== generation || desiredAccount !== userId) return;
    await bounded(signal => registerPushDevice({ ...identity, expoPushToken: token.data, platform: Platform.OS as "ios" | "android" }, {
      headers: { Authorization: `Bearer ${authToken}` }, signal,
    }));
  });
}

export function notificationDestination(data: Record<string, unknown>, userId: string | null): string | null {
  if (!userId || data.userId !== userId) return null;
  const id = data.targetId;
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(id)) return "/(tabs)?showNotifications=1";
  if (data.targetType === "booking") return `/booking/${id}`;
  if (data.targetType === "chat") return `/chat/${id}`;
  if (data.targetType === "listing") return `/listing/${id}`;
  return "/(tabs)?showNotifications=1";
}
