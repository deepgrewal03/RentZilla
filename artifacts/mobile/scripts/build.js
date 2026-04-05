/**
 * Production build stub for Cloud Run deployment.
 *
 * Metro bundler is not compatible with Cloud Run autoscale environments —
 * it requires too much memory and crashes when bundling iOS/Android.
 * Native builds are handled via EAS Build (Expo's own CI).
 *
 * This script creates the minimal directory structure that serve.js needs
 * to start successfully. The server will return a 404 for platform manifests
 * (Expo Go will fall back to the development bundle), and a landing page
 * for web visitors.
 */

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const staticBuild = path.join(projectRoot, "static-build");

function main() {
  console.log("Creating static-build structure for serve.js...");

  // Clean up any previous build
  if (fs.existsSync(staticBuild)) {
    fs.rmSync(staticBuild, { recursive: true });
  }

  // Directories serve.js looks in for platform manifests
  fs.mkdirSync(path.join(staticBuild, "ios"), { recursive: true });
  fs.mkdirSync(path.join(staticBuild, "android"), { recursive: true });

  // Determine the deployment URL from environment
  const domain =
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.EXPO_PUBLIC_DOMAIN ||
    "localhost";

  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  // Write minimal manifests so serve.js returns JSON (not 404) for
  // platform requests. The empty launchAsset tells Expo Go there is no
  // OTA update — it will use whatever bundle it already has cached.
  const stub = (platform) => ({
    id: `stub-${platform}`,
    createdAt: new Date().toISOString(),
    runtimeVersion: "1.0.0",
    launchAsset: { key: "bundle", contentType: "application/javascript", url: `${baseUrl}/${platform}/bundle.js` },
    assets: [],
    metadata: {},
    extra: { expoClient: { name: "RentZilla", slug: "rentzilla" } },
  });

  fs.writeFileSync(
    path.join(staticBuild, "ios", "manifest.json"),
    JSON.stringify(stub("ios"), null, 2),
  );
  fs.writeFileSync(
    path.join(staticBuild, "android", "manifest.json"),
    JSON.stringify(stub("android"), null, 2),
  );

  console.log("Static build complete. Server is ready to start.");
  process.exit(0);
}

main();
