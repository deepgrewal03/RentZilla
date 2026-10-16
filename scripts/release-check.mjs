import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateReleaseConfig } from "./release-policy.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const mobile = fileURLToPath(new URL("../artifacts/mobile/", import.meta.url));
const env = { ...process.env, CI: "1", NODE_ENV: "production" };

function run(label, args, options = {}) {
  console.log(`\n[release-check] ${label}`);
  const result = spawnSync("pnpm", args, {
    cwd: root,
    env,
    stdio: "inherit",
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (${result.error?.message ?? result.signal ?? `exit ${result.status}`}).`);
  }
  return result.stdout;
}

try {
  run("Release policy regression tests", ["run", "release:check:test"]);
  run("Expo dependency compatibility", ["exec", "expo", "install", "--check"], {
    cwd: mobile,
    // Do not let a developer's opt-out silently bypass the release gate.
    env: { ...env, EXPO_NO_DEPENDENCY_VALIDATION: "0" },
  });
  const json = run("Resolve Expo config and Android manifest", [
    "exec", "expo", "config", "--type", "introspect", "--json",
  ], { cwd: mobile, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 16 * 1024 * 1024 });
  let config;
  try {
    config = JSON.parse(json);
  } catch {
    throw new Error("Expo config did not return valid JSON.");
  }
  const errors = validateReleaseConfig(config);
  if (errors.length) throw new Error(`Release policy failed:\n- ${errors.join("\n- ")}`);
  console.log("[release-check] Version, Android SDK, and permission policy passed.");

  run("Shared library TypeScript", ["run", "typecheck:libs"]);
  for (const name of ["mobile", "api-server", "admin-panel"]) {
    run(`${name} TypeScript`, ["--filter", `@workspace/${name}`, "run", "typecheck"]);
  }
  run("API production build", ["--filter", "@workspace/api-server", "run", "build"]);
  run("Admin production build", ["--filter", "@workspace/admin-panel", "run", "build"], {
    // Vite requires these even for a build; no server is started.
    env: { ...env, PORT: "4173", BASE_PATH: "/admin/" },
  });
  run("Mobile production bundles (Android, iOS, web)", [
    "exec", "expo", "export", "--platform", "all",
    "--output-dir", "../../generated-artifacts/release-check/mobile",
  ], { cwd: mobile });
  console.log("\n[release-check] PASS — all release checks passed.");
} catch (error) {
  console.error(`\n[release-check] FAIL — ${error.message}`);
  process.exitCode = 1;
}
