/**
 * Production build script for RentZilla mobile deployment.
 *
 * Uses `expo export` (batch Metro bundling, Hermes skipped via --no-bytecode)
 * instead of the old Metro HTTP server approach, which crashed when Terser
 * tried to minify 1756+ modules in the Cloud Run environment.
 *
 * Output layout (what serve.js reads):
 *   static-build/
 *     ios/manifest.json       ← EAS Update manifest for Expo Go iOS
 *     android/manifest.json   ← EAS Update manifest for Expo Go Android
 *     {timestamp}/
 *       _expo/static/js/ios/bundle.js
 *       _expo/static/js/android/bundle.js
 *       assets/{hash}         ← asset files (fonts, images, …)
 */

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const staticBuild = path.join(projectRoot, "static-build");
const exportDir = path.join(projectRoot, ".expo-export");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return EXT_MIME[ext.toLowerCase()] || "application/octet-stream";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const domain = getDeploymentDomain();
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
  const timestamp = `${Date.now()}-${process.pid}`;

  console.log(`Building for domain: ${baseUrl}${basePath}`);

  // ── 1. Clean up ─────────────────────────────────────────────────────────────
  if (fs.existsSync(staticBuild)) {
    fs.rmSync(staticBuild, { recursive: true });
  }
  if (fs.existsSync(exportDir)) {
    fs.rmSync(exportDir, { recursive: true });
  }

  // ── 2. Run expo export ──────────────────────────────────────────────────────
  console.log("Running expo export (this may take a few minutes)…");

  const exportResult = spawnSync(
    "pnpm",
    [
      "exec", "expo", "export",
      "--platform", "all",
      "--no-minify",
      "--no-bytecode",
      "--output-dir", exportDir,
    ],
    {
      stdio: "inherit",
      cwd: projectRoot,
      env: {
        ...process.env,
        EXPO_PUBLIC_DOMAIN: domain,
        EXPO_PUBLIC_REPL_ID: process.env.REPL_ID || "",
        EXPO_PUBLIC_GMAPS_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
        NODE_ENV: "production",
        NODE_OPTIONS: "--max-old-space-size=4096",
      },
    },
  );

  if (exportResult.status !== 0) {
    console.error("expo export failed with exit code:", exportResult.status);
    process.exit(1);
  }

  // ── 3. Read metadata ────────────────────────────────────────────────────────
  const metadataPath = path.join(exportDir, "metadata.json");
  if (!fs.existsSync(metadataPath)) {
    console.error("metadata.json not found in export output");
    process.exit(1);
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  console.log("Export complete. Processing assets…");

  // ── 4. Set up output directories ────────────────────────────────────────────
  fs.mkdirSync(path.join(staticBuild, "ios"), { recursive: true });
  fs.mkdirSync(path.join(staticBuild, "android"), { recursive: true });
  fs.mkdirSync(
    path.join(staticBuild, timestamp, "_expo", "static", "js", "ios"),
    { recursive: true },
  );
  fs.mkdirSync(
    path.join(staticBuild, timestamp, "_expo", "static", "js", "android"),
    { recursive: true },
  );
  fs.mkdirSync(path.join(staticBuild, timestamp, "assets"), { recursive: true });

  // ── 5. Process each platform ────────────────────────────────────────────────
  const platforms = ["ios", "android"];

  for (const platform of platforms) {
    const platformMeta = metadata.fileMetadata?.[platform];
    if (!platformMeta) {
      console.error(`No metadata found for platform: ${platform}`);
      process.exit(1);
    }

    // Copy bundle
    const bundleSrc = path.join(exportDir, platformMeta.bundle);
    if (!fs.existsSync(bundleSrc)) {
      console.error(`Bundle not found: ${bundleSrc}`);
      process.exit(1);
    }
    const bundleDest = path.join(
      staticBuild, timestamp, "_expo", "static", "js", platform, "bundle.js",
    );
    fs.copyFileSync(bundleSrc, bundleDest);
    const bundleHash = sha256File(bundleDest);
    const bundleUrl = `${baseUrl}${basePath}/${timestamp}/_expo/static/js/${platform}/bundle.js`;
    console.log(
      `${platform}: bundle copied (${(fs.statSync(bundleDest).size / 1024 / 1024).toFixed(1)} MB)`,
    );

    // Collect unique assets (by path to avoid duplicates)
    const seenAssets = new Set();
    const manifestAssets = [];

    for (const asset of (platformMeta.assets || [])) {
      if (seenAssets.has(asset.path)) continue;
      seenAssets.add(asset.path);

      const assetSrc = path.join(exportDir, asset.path);
      if (!fs.existsSync(assetSrc)) {
        console.warn(`  Asset not found, skipping: ${asset.path}`);
        continue;
      }
      const assetDest = path.join(staticBuild, timestamp, asset.path);
      fs.mkdirSync(path.dirname(assetDest), { recursive: true });
      fs.copyFileSync(assetSrc, assetDest);

      const assetHash = sha256File(assetSrc);
      manifestAssets.push({
        hash: assetHash,
        key: path.basename(asset.path),
        contentType: mimeForExt(asset.ext || ""),
        url: `${baseUrl}${basePath}/${timestamp}/${asset.path}`,
      });
    }
    console.log(`${platform}: ${manifestAssets.length} assets copied`);

    // Build EAS Update manifest
    const manifest = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      runtimeVersion: "1.0.0",
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
          hostUri: `${domain}${basePath}/${platform}`,
        },
      },
    };

    const manifestPath = path.join(staticBuild, platform, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`${platform}: manifest written → ${bundleUrl}`);
  }

  console.log(`\nBuild complete! Deployed to: ${baseUrl}${basePath}`);
  process.exit(0);
}

main();
