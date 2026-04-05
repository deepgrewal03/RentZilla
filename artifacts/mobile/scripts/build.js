/**
 * Production build script for RentZilla mobile deployment.
 *
 * Uses `expo export` (batch Metro bundling, Hermes bytecode enabled for fast startup)
 * instead of the old Metro HTTP server approach, which crashed when Terser
 * tried to minify 1756+ modules in the Cloud Run environment.
 *
 * Output layout (what serve.js reads):
 *   static-build/
 *     build-info.json             ← diagnostic info (check via /build-info)
 *     ios/manifest.json           ← EAS Update manifest for Expo Go iOS
 *     android/manifest.json       ← EAS Update manifest for Expo Go Android
 *     {timestamp}/
 *       _expo/static/js/ios/bundle.js
 *       _expo/static/js/android/bundle.js
 *       assets/{hash}             ← asset files (fonts, images, …)
 */

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const staticBuild = path.join(projectRoot, "static-build");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the Expo SDK major version string (e.g. "54.0.0") from package.json. */
function getSdkVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
    const expoVersion = (pkg.dependencies?.expo || pkg.devDependencies?.expo || "54.0.0")
      .replace(/[^0-9.]/g, "")
      .split(".")
      .slice(0, 1)[0];
    return `${expoVersion}.0.0`;
  } catch {
    return "54.0.0";
  }
}

function getDeploymentDomain() {
  return (
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.EXPO_PUBLIC_DOMAIN ||
    "localhost"
  );
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

const EXT_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ttf: "font/ttf",
  otf: "font/opentype",
  woff: "font/woff",
  woff2: "font/woff2",
  js: "application/javascript",
  json: "application/json",
};

function mimeForExt(ext) {
  return EXT_MIME[(ext || "").toLowerCase()] || "application/octet-stream";
}

/** Run a command synchronously, stream output, return exit code. */
function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: projectRoot,
    ...opts,
  });
  if (result.error) {
    console.error("Spawn error:", result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

/** Export one platform. Returns the exportDir on success, null on failure. */
function exportPlatform(platform, domain) {
  const exportDir = path.join(projectRoot, `.expo-export-${platform}`);

  if (fs.existsSync(exportDir)) {
    fs.rmSync(exportDir, { recursive: true });
  }

  const env = {
    ...process.env,
    EXPO_PUBLIC_DOMAIN: domain,
    EXPO_PUBLIC_REPL_ID: process.env.REPL_ID || "",
    EXPO_PUBLIC_GMAPS_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
    NODE_ENV: "production",
    NODE_OPTIONS: "--max-old-space-size=4096",
  };

  const exitCode = run(
    "pnpm",
    [
      "exec", "expo", "export",
      "--platform", platform,
      "--no-minify",
      "--no-bytecode",
      "--output-dir", exportDir,
    ],
    { env },
  );

  if (exitCode !== 0) {
    console.error(`expo export --platform ${platform} failed (exit ${exitCode})`);
    return null;
  }

  const metadataPath = path.join(exportDir, "metadata.json");
  if (!fs.existsSync(metadataPath)) {
    console.error(`metadata.json not found for ${platform}`);
    return null;
  }

  return exportDir;
}

/** Copy bundle + assets, write manifest. Returns manifest URL on success. */
function processExport(platform, exportDir, timestamp, baseUrl, basePath) {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(exportDir, "metadata.json"), "utf-8"),
  );
  const platformMeta = metadata.fileMetadata?.[platform];
  if (!platformMeta) {
    console.error(`No metadata for platform: ${platform}`);
    return null;
  }

  // ── Bundle ────────────────────────────────────────────────────────────────
  const bundleSrc = path.join(exportDir, platformMeta.bundle);
  if (!fs.existsSync(bundleSrc)) {
    console.error(`Bundle not found: ${bundleSrc}`);
    return null;
  }
  // Preserve the real extension: .hbc (Hermes bytecode) or .js (plain JS)
  const bundleExt = path.extname(bundleSrc) || ".js";
  const bundleFilename = `bundle${bundleExt}`;
  const bundleDest = path.join(
    staticBuild, timestamp, "_expo", "static", "js", platform, bundleFilename,
  );
  fs.mkdirSync(path.dirname(bundleDest), { recursive: true });
  fs.copyFileSync(bundleSrc, bundleDest);

  const bundleBytes = fs.statSync(bundleDest).size;
  const bundleHash = sha256File(bundleDest);
  const bundleUrl = `${baseUrl}${basePath}/${timestamp}/_expo/static/js/${platform}/${bundleFilename}`;
  console.log(
    `${platform}: bundle ${(bundleBytes / 1024 / 1024).toFixed(1)} MB → ${bundleUrl}`,
  );

  // ── Assets ────────────────────────────────────────────────────────────────
  const seenPaths = new Set();
  const manifestAssets = [];

  for (const asset of (platformMeta.assets || [])) {
    if (seenPaths.has(asset.path)) continue;
    seenPaths.add(asset.path);

    const assetSrc = path.join(exportDir, asset.path);
    if (!fs.existsSync(assetSrc)) {
      console.warn(`  Asset missing, skipping: ${asset.path}`);
      continue;
    }
    const assetDest = path.join(staticBuild, timestamp, asset.path);
    fs.mkdirSync(path.dirname(assetDest), { recursive: true });
    fs.copyFileSync(assetSrc, assetDest);

    manifestAssets.push({
      hash: sha256File(assetSrc),
      key: path.basename(asset.path),
      contentType: mimeForExt(asset.ext),
      url: `${baseUrl}${basePath}/${timestamp}/${asset.path}`,
    });
  }
  console.log(`${platform}: ${manifestAssets.length} assets`);

  // ── Manifest ──────────────────────────────────────────────────────────────
  const manifest = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    runtimeVersion: getSdkVersion(),
    launchAsset: {
      hash: bundleHash,
      key: `bundle-${timestamp}-${platform}`,
      contentType: "application/javascript",
      url: bundleUrl,
    },
    assets: manifestAssets,
    metadata: {},
    extra: {
      expoClient: {
        name: "RentZilla",
        slug: "rentzilla",
        version: "1.0.0",
      },
    },
  };

  const manifestPath = path.join(staticBuild, platform, "manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`${platform}: manifest written`);
  return bundleUrl;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const domain = getDeploymentDomain();
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
  const timestamp = `${Date.now()}-${process.pid}`;
  const buildStarted = new Date().toISOString();

  console.log(`Building RentZilla for: ${baseUrl}${basePath}`);
  console.log(`Timestamp: ${timestamp}`);

  // ── Clean static-build ────────────────────────────────────────────────────
  if (fs.existsSync(staticBuild)) {
    fs.rmSync(staticBuild, { recursive: true });
  }
  fs.mkdirSync(staticBuild, { recursive: true });

  const buildInfo = {
    startedAt: buildStarted,
    domain,
    baseUrl,
    timestamp,
    platforms: {},
  };

  // ── Export each platform separately ──────────────────────────────────────
  // (Running them separately avoids port conflicts with any running dev server
  //  and keeps peak memory usage lower than bundling all platforms at once.)
  const platforms = ["ios", "android"];
  let anyFailed = false;

  for (const platform of platforms) {
    console.log(`\n━━━ Exporting ${platform.toUpperCase()} ━━━`);
    const exportDir = exportPlatform(platform, domain);

    if (!exportDir) {
      buildInfo.platforms[platform] = { status: "failed" };
      anyFailed = true;
      continue;
    }

    const bundleUrl = processExport(
      platform, exportDir, timestamp, baseUrl, basePath,
    );

    if (!bundleUrl) {
      buildInfo.platforms[platform] = { status: "failed" };
      anyFailed = true;
    } else {
      buildInfo.platforms[platform] = { status: "ok", bundleUrl };
    }

    // Clean up the temporary export directory to save disk space
    fs.rmSync(exportDir, { recursive: true });
  }

  // ── Write build-info.json (readable via /build-info route) ───────────────
  buildInfo.completedAt = new Date().toISOString();
  buildInfo.anyFailed = anyFailed;
  fs.writeFileSync(
    path.join(staticBuild, "build-info.json"),
    JSON.stringify(buildInfo, null, 2),
  );

  if (anyFailed) {
    console.error("\nBuild failed for one or more platforms. See build-info.json.");
    process.exit(1);
  }

  console.log(`\n✓ Build complete → ${baseUrl}${basePath}`);
  process.exit(0);
}

main();
