# Release checks

From the repository root, after `pnpm install --frozen-lockfile`, run:

```sh
pnpm release:check
```

Run this before every release review. It stops at the first failing step with
`[release-check] FAIL`, a named step or policy violation, and a nonzero exit code.
Success ends with `[release-check] PASS`.

The command runs:

1. Release-policy regression tests.
2. `expo install --check` for the mobile app's installed SDK/dependency compatibility.
3. `expo config --type introspect --json` and assertions on the resolved config:
   - Numeric app version 24 or newer (for example `24`, `24.0.0`, or `25`).
   - Integer Android `versionCode` of at least 24.
   - Explicit Android target and compile SDK of at least 35, with compile SDK
     no lower than target SDK. The current SDK 36 settings are preserved.
   - `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `RECORD_AUDIO`,
     `READ_EXTERNAL_STORAGE`, and `WRITE_EXTERNAL_STORAGE` must not be requested,
     must be blocked, and must have removal rules rather than grants in the
     generated Android manifest.
4. Shared-library TypeScript followed by mobile, API, and admin TypeScript checks.
5. API and admin production builds.
6. Expo production exports for Android, iOS, and web, including native Hermes bundles.

Use the same public build environment settings as the intended release. The
command inherits the environment and forces noninteractive production mode.
Expo compatibility checking may need network access. The admin build receives
`PORT=4173` and `BASE_PATH=/admin/` for its Vite configuration; it does not start a server.

Mobile output goes to ignored `generated-artifacts/release-check/mobile`; API
and admin output use their existing ignored `dist` directories. No signing,
deployment, database migration, or store upload occurs.

This is a source/config/bundle gate, not a signed native Gradle/Xcode build or
inspection of the final merged AAB manifest. Run the normal signed native build
and device/store checks separately before submission.

For a fast check of the policy validator itself:

```sh
pnpm release:check:test
```
