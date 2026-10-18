# Native notifications

## Permission policy

iOS/Android authorization is the only notification permission. The Settings panel reads the real OS status on focus and app resume. It never maintains a master or category ON/OFF preference. Users explicitly choose Enable Notifications before the native authorization prompt; denial sends them to device settings instead of repeatedly prompting. Android uses six stable system channels. Normal in-app audio settings do not affect system push notifications.

Legacy notification preferences in `user_settings` are retained only to avoid destructive schema changes; they are not consulted by delivery. The old write endpoint returns 410.

## Required activation steps

- Publish the API and additive development schema through the normal Publish flow. Do not run production DDL or add startup migrations.
- Build a new native binary; an OTA JavaScript update cannot install notification native modules, entitlements or Android Firebase resources.
- Android: configure Firebase for the existing `com.rentzillaapp.app` package, provide its correct `google-services.json` through the build configuration (`android.googleServicesFile`), and configure the matching FCM v1 sending credential on the Expo project. No Firebase file is currently supplied by this implementation; do not substitute a fabricated file.
- iOS: enable push for the existing `com.rentzilla.app` App ID and verify APNs credentials/provisioning on the Expo project. The Expo notifications plugin supplies the native entitlement/configuration.
- If Expo Enhanced Push Security is enabled, configure the server's `EXPO_ACCESS_TOKEN` through secure environment configuration. Never put this in an `EXPO_PUBLIC_*` variable.
- Do not paste APNs private keys, FCM service-account credentials, Expo access tokens or device tokens in chat, source control or logs.

## Delivery and lifecycle

The API observes existing inbox notifications, messages, new pending bookings and fulfilled Razorpay orders. It writes a deduplicated per-device delivery queue. Booking notices carry booking targets; messages carry chat targets; notification metadata supports listing targets. Other notices open the existing notification inbox, not a new page.

Only authenticated accounts can register a device. The server owns the account association. An installation-only random revocation credential permits offline logout cleanup after the account session is gone; it cannot read account data or register a device. Only its hash is stored on the server. Registration/revocation operations are serialized on the phone. Registration refreshes on login, foreground, reconnect and native token rotation.

Logout dismisses delivered notifications and attempts device revocation. Failed offline revocation is persisted and retried before another account registers. Already dispatched OS notifications cannot be recalled remotely, and an offline logout cannot contact the server until connectivity returns.

The queue retries transient errors, checks Expo receipts and removes unregistered devices. A successful receipt means APNs/FCM accepted delivery, not that the person saw it. OS permissions, Android channel settings, Focus/DND, connectivity and battery restrictions may suppress presentation.

The worker runs on API activity and a 15-second interval while the process is running. Persisted work resumes after restart. New events older than one day are not replayed; queued records are retained for seven days. For strict delivery/retry timing while an autoscaled API is asleep, run this worker on an always-running service or add a trusted scheduler. An in-process interval alone is not an always-on job service.

## Verification

Automated checks:

```sh
pnpm run typecheck:libs
pnpm --filter @workspace/mobile typecheck
RUN_PUSH_DB_TESTS=1 NODE_ENV=development pnpm --filter @workspace/api-server test
```

The opt-in push database test rolls back its fixtures and mocks the Expo network boundary. Never run it against production.

Physical-device release checks (not proven by a browser or mocked tests):

1. Fresh install: no launch-time native prompt; Settings reports Permission Not Requested.
2. Not Now: no permission granted, no native prompt.
3. Enable: genuine OS prompt, allow, token registration succeeds.
4. Deny: no repeated prompt; Manage Notification Settings opens this app's OS settings.
5. Change permission outside the app, return, and confirm updated status.
6. Android: disable Messages channel in system settings; other categories remain independent.
7. Receive booking/message/payment pushes in foreground, background and terminated states; tap into the correct authorized screen.
8. Logout and switch accounts; the previous account must not receive newly dispatched pushes on this device. Exercise offline cleanup and reconnect.
9. Confirm both APNs and FCM receipts on the real configured project without logging tokens.
