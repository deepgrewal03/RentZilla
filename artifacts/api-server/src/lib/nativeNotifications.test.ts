import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { transformSync } from "esbuild";
import { isExpoPushToken, pushCategory, pushTarget, retryDelay } from "./pushPolicy.js";

function nativeFixture(initial = "undetermined", platform = "android") {
  const storage = new Map<string, string>();
  const calls: string[] = [];
  let permission = { status: initial, granted: initial === "granted", canAskAgain: initial === "undetermined" };
  let failRevoke = false;
  let failRegistration = false;
  const notifications = {
    IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
    AndroidImportance: { DEFAULT: 3 },
    getPermissionsAsync: async () => permission,
    setNotificationChannelAsync: async (id: string) => { calls.push(`channel:${id}`); },
    requestPermissionsAsync: async () => { calls.push("request"); return permission = { status: "granted", granted: true, canAskAgain: false }; },
    getExpoPushTokenAsync: async () => { calls.push("native-token"); return { data: "ExponentPushToken[test-only]" }; },
    dismissAllNotificationsAsync: async () => {},
  };
  const deps: Record<string, unknown> = {
    "@react-native-async-storage/async-storage": {
      getItem: async (key: string) => storage.get(key) ?? null,
      setItem: async (key: string, value: string) => { storage.set(key, value); },
      removeItem: async (key: string) => { storage.delete(key); },
    },
    "expo-crypto": { getRandomBytesAsync: async () => new Uint8Array(32).fill(1), randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    "expo-notifications": notifications,
    "expo-constants": { executionEnvironment: "standalone", easConfig: { projectId: "project" } },
    "expo-application": { applicationId: "com.rentzillaapp.app" },
    "expo-intent-launcher": { startActivityAsync: async (action: string, args: any) => {
      calls.push(action + ":" + args.extra["android.provider.extra.APP_PACKAGE"]);
    } },
    "react-native": { Platform: { OS: platform }, Linking: { openSettings: async () => { calls.push("app-settings"); } } },
    "@workspace/api-client-react": {
      registerPushDevice: async (_data: any, options: any) => {
        if (failRegistration) throw new Error("offline");
        calls.push(`register:${options.headers.Authorization}`);
      },
      unregisterPushDevice: async () => {
        if (failRevoke) throw new Error("offline");
        calls.push("revoke");
      },
    },
  };
  const source = readFileSync(new URL("../../../mobile/services/NativeNotifications.ts", import.meta.url), "utf8");
  const module = { exports: {} as any };
  runInNewContext(transformSync(source, { loader: "ts", format: "cjs" }).code, {
    module, exports: module.exports, AbortSignal, AbortController, setTimeout, clearTimeout, Uint8Array,
    require: (name: string) => {
      if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
      return deps[name];
    },
  });
  return { api: module.exports, calls, storage, setPermission: (p: any) => { permission = p; },
    offline: (v: boolean) => { failRevoke = v; }, failRegistration: (v: boolean) => { failRegistration = v; } };
}

test("native status is read from OS; registration never requests permission automatically", async () => {
  const f = nativeFixture();
  f.api.setNotificationAccount("a");
  await f.api.syncPushRegistration("a", "session-a");
  assert.equal(await f.api.readNotificationStatus(), "not-requested");
  assert.ok(!f.calls.includes("request"));
  assert.ok(!f.calls.includes("native-token"));
});
test("explicit Enable creates all six Android channels before requesting once", async () => {
  const f = nativeFixture();
  assert.equal(await f.api.requestNativeNotificationPermission(), "allowed");
  await f.api.requestNativeNotificationPermission();
  assert.equal(f.calls.filter(c => c === "request").length, 1);
  for (const id of ["bookings", "messages", "payments", "rentals", "offers", "account"]) {
    assert.ok(f.calls.indexOf(`channel:${id}`) < f.calls.indexOf("request"));
  }
});
test("denial never re-prompts, even when Android canAskAgain remains true", async () => {
  const f = nativeFixture("denied");
  f.setPermission({ status: "denied", granted: false, canAskAgain: true });
  assert.equal(await f.api.requestNativeNotificationPermission(), "disabled");
  assert.ok(!f.calls.includes("request"));
});
test("iOS provisional permission is allowed; settings uses public app settings", async () => {
  const f = nativeFixture("undetermined", "ios");
  f.setPermission({ status: "undetermined", granted: false, ios: { status: 3 } });
  assert.equal(await f.api.readNotificationStatus(), "allowed");
  await f.api.openNativeNotificationSettings();
  assert.ok(f.calls.includes("app-settings"));
});
test("Android opens this app's notification settings", async () => {
  const f = nativeFixture();
  await f.api.openNativeNotificationSettings();
  assert.ok(f.calls.includes("android.settings.APP_NOTIFICATION_SETTINGS:com.rentzillaapp.app"));
});
test("offline logout is retried before registering the next account; stale sync is ignored", async () => {
  const f = nativeFixture("granted");
  f.api.setNotificationAccount("a");
  await f.api.syncPushRegistration("a", "session-a");
  f.offline(true);
  await assert.rejects(f.api.revokeThisPushDevice());
  assert.equal(f.storage.get("@rentzilla:push_revoke_pending"), "yes");
  f.api.setNotificationAccount("b");
  f.offline(false);
  await f.api.syncPushRegistration("a", "session-a");
  await f.api.syncPushRegistration("b", "session-b");
  assert.equal(f.calls.filter(c => c === "register:Bearer session-a").length, 1);
  assert.ok(f.calls.indexOf("revoke") < f.calls.indexOf("register:Bearer session-b"));
});
test("revoked OS permission unregisters, and failures do not falsify permission status", async () => {
  const f = nativeFixture("granted");
  f.api.setNotificationAccount("a");
  await f.api.syncPushRegistration("a", "session-a");
  f.failRegistration(true);
  await assert.rejects(f.api.syncPushRegistration("a", "session-a"));
  assert.equal(await f.api.readNotificationStatus(), "allowed");
  f.setPermission({ status: "denied", granted: false, canAskAgain: false });
  await f.api.syncPushRegistration("a", "session-a");
  assert.ok(f.calls.includes("revoke"));
  assert.equal(await f.api.readNotificationStatus(), "disabled");
});
test("notification links validate account, target type and identifier", () => {
  const { api } = nativeFixture();
  assert.equal(api.notificationDestination({ userId: "a", targetType: "booking", targetId: "123" }, "a"), "/booking/123");
  assert.equal(api.notificationDestination({ userId: "a", targetType: "chat", targetId: "123" }, "a"), "/chat/123");
  assert.equal(api.notificationDestination({ userId: "a", targetType: "listing", targetId: "123" }, "a"), "/listing/123");
  assert.equal(api.notificationDestination({ userId: "a", targetType: "booking", targetId: "123" }, "b"), null);
  assert.equal(api.notificationDestination({ userId: "a", targetType: "chat", targetId: "../settings" }, "a"), "/(tabs)?showNotifications=1");
});
test("web never pretends to have native permission or registers a device", async () => {
  const f = nativeFixture("granted", "web");
  f.api.setNotificationAccount("a");
  await f.api.syncPushRegistration("a", "session-a");
  assert.equal(await f.api.readNotificationStatus(), "unsupported");
  assert.deepEqual(f.calls, []);
});
test("push routing and retries are bounded", () => {
  assert.ok(isExpoPushToken("ExponentPushToken[test-token]"));
  assert.ok(!isExpoPushToken("https://evil.invalid/token"));
  assert.equal(pushCategory("unknown"), "account");
  assert.equal(pushCategory("offers"), "offers");
  assert.deepEqual(pushTarget("chat", "../settings"), {});
  assert.equal(retryDelay(99), 3600);
});
