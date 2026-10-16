export const forbiddenPermissions = [
  "READ_MEDIA_IMAGES",
  "READ_MEDIA_VIDEO",
  "RECORD_AUDIO",
  "READ_EXTERNAL_STORAGE",
  "WRITE_EXTERNAL_STORAGE",
].map((name) => `android.permission.${name}`);

const normalize = (name) =>
  name.includes(".") ? name : `android.permission.${name}`;

/** Validate Expo's resolved introspection output, not a static config file. */
export function validateReleaseConfig(config) {
  const errors = [];
  const version = config.version;
  if (typeof version !== "string" || !/^\d+(?:\.\d+){0,2}$/.test(version) ||
      Number(version.split(".")[0]) < 24) {
    errors.push("App version must be a numeric release version 24 or newer.");
  }
  if (!Number.isSafeInteger(config.android?.versionCode) || config.android.versionCode < 24) {
    errors.push("Android versionCode must be an integer 24 or newer.");
  }
  const buildProperties = config.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties",
  )?.[1]?.android;
  for (const field of ["targetSdkVersion", "compileSdkVersion"]) {
    if (!Number.isInteger(buildProperties?.[field]) || buildProperties[field] < 35) {
      errors.push(`expo-build-properties android.${field} must explicitly be 35 or newer.`);
    }
  }
  if (buildProperties?.compileSdkVersion < buildProperties?.targetSdkVersion) {
    errors.push("Android compileSdkVersion must not be lower than targetSdkVersion.");
  }
  const requested = new Set((config.android?.permissions ?? []).map(normalize));
  const blocked = new Set((config.android?.blockedPermissions ?? []).map(normalize));
  const manifest = config._internal?.modResults?.android?.manifest?.manifest;
  if (!manifest) errors.push("Resolved Android manifest is missing; use expo config --type introspect.");
  const declarations = [
    ...(manifest?.["uses-permission"] ?? []),
    ...(manifest?.["uses-permission-sdk-23"] ?? []),
  ];
  for (const permission of forbiddenPermissions) {
    if (requested.has(permission)) errors.push(`Forbidden permission explicitly requested: ${permission}`);
    if (!blocked.has(permission)) errors.push(`Required blocked permission missing: ${permission}`);
    const entries = declarations.filter((entry) => entry.$?.["android:name"] === permission);
    if (!entries.some((entry) => entry.$["tools:node"] === "remove")) {
      errors.push(`Android manifest is missing dependency-removal rule for ${permission}`);
    }
    if (entries.some((entry) => entry.$["tools:node"] !== "remove")) {
      errors.push(`Android manifest grants forbidden permission: ${permission}`);
    }
  }
  return errors;
}
