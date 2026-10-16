import test from "node:test";
import assert from "node:assert/strict";
import { forbiddenPermissions, validateReleaseConfig } from "./release-policy.mjs";

function validConfig() {
  return {
    version: "24",
    android: { versionCode: 24, permissions: ["INTERNET"], blockedPermissions: [...forbiddenPermissions] },
    plugins: [["expo-build-properties", { android: { targetSdkVersion: 35, compileSdkVersion: 35 } }]],
    _internal: { modResults: { android: { manifest: { manifest: {
      "uses-permission": forbiddenPermissions.map((name) => ({
        $: { "android:name": name, "tools:node": "remove" },
      })),
    } } } } },
  };
}

test("accepts minimum versions and newer SDKs", () => {
  assert.deepEqual(validateReleaseConfig(validConfig()), []);
  const config = validConfig();
  config.version = "25.1.0";
  config.android.versionCode = 26;
  config.plugins[0][1].android = { targetSdkVersion: 36, compileSdkVersion: 36 };
  assert.deepEqual(validateReleaseConfig(config), []);
});

for (const version of ["23", "1.24.0", "invalid", "24beta", undefined]) {
  test(`rejects invalid/old app version ${version}`, () => {
    const config = validConfig();
    config.version = version;
    assert.match(validateReleaseConfig(config).join("\n"), /App version/);
  });
}
for (const versionCode of [23, "24", 24.5, undefined]) {
  test(`rejects invalid/old versionCode ${versionCode}`, () => {
    const config = validConfig();
    config.android.versionCode = versionCode;
    assert.match(validateReleaseConfig(config).join("\n"), /versionCode/);
  });
}
test("rejects missing or low SDK settings and compile/target mismatch", () => {
  for (const android of [{}, { targetSdkVersion: 34, compileSdkVersion: 34 }, { targetSdkVersion: 36, compileSdkVersion: 35 }]) {
    const config = validConfig();
    config.plugins[0][1].android = android;
    assert.ok(validateReleaseConfig(config).length);
  }
});
for (const permission of forbiddenPermissions) {
  test(`enforces all permission protections for ${permission}`, () => {
    for (const shorthand of [false, true]) {
      const config = validConfig();
      config.android.permissions.push(shorthand ? permission.replace("android.permission.", "") : permission);
      assert.match(validateReleaseConfig(config).join("\n"), /explicitly requested/);
    }
    const missingBlock = validConfig();
    missingBlock.android.blockedPermissions = forbiddenPermissions.filter((p) => p !== permission);
    assert.match(validateReleaseConfig(missingBlock).join("\n"), /blocked permission missing/);
    const granted = validConfig();
    const manifest = granted._internal.modResults.android.manifest.manifest;
    manifest["uses-permission"].find((p) => p.$["android:name"] === permission).$["tools:node"] = "merge";
    assert.match(validateReleaseConfig(granted).join("\n"), /manifest grants/);
    assert.match(validateReleaseConfig(granted).join("\n"), /dependency-removal rule/);
  });
}
test("fails closed when manifest introspection is absent", () => {
  const config = validConfig();
  delete config._internal;
  assert.match(validateReleaseConfig(config).join("\n"), /manifest is missing/);
});
