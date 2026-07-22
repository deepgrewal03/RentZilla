const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

// Note: Metro's HmrServer._registerEntryPoint has been patched (HMR_PATCH) in
// node_modules/metro/src/HmrServer.js to silently catch errors caused by the
// Replit Expo web preview connecting with an unparseable URL (?platform=web).
// This keeps Metro alive after the HMR WebSocket connects.

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// ── TypeScript path alias: @/ → project root ─────────────────────────────────
// tsconfig.json has "paths": { "@/*": ["./*"] } with baseUrl ".".
// Metro does not read tsconfig, so we map the "@" bare name to the project root.
// Metro then resolves "@/constants/colors" as projectRoot + "/constants/colors".
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@": projectRoot,
};

// ── Monorepo / pnpm workspace support ────────────────────────────────────────
// EAS builds from the monorepo root. Without these settings Metro follows the
// real symlink path deep inside .pnpm/expo@.../node_modules/expo/AppEntry.js
// and its "../../App" import resolves to the wrong location.
// watchFolders lets Metro see packages that live outside the project root.
config.watchFolders = [monorepoRoot];

// nodeModulesPaths tells the resolver to look in both the local node_modules
// (for packages only in artifacts/mobile) and the workspace root node_modules
// (for hoisted packages exposed to EAS via .npmrc public-hoist-pattern).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// ── Razorpay tmp-dir crash fix ────────────────────────────────────────────────
// Razorpay (server-only SDK) creates ephemeral tmp dirs during install.
// Metro's FallbackWatcher crawls node_modules and crashes with ENOENT when
// those dirs disappear. We patch fs.watch to return a no-op EventEmitter-like
// stub so Metro's FallbackWatcher (which calls watcher.on/close) doesn't crash.
const { EventEmitter } = require("events");
const origWatch = fs.watch.bind(fs);

function noopWatcher() {
  const stub = new EventEmitter();
  stub.close = () => {};
  return stub;
}

fs.watch = function patchedWatch(filename, options, listener) {
  try {
    const name = String(filename);
    if (name.includes("razorpay")) return noopWatcher();
    const w = origWatch(filename, options, listener);
    if (!w || typeof w.on !== "function") return noopWatcher();
    return w;
  } catch (e) {
    return noopWatcher();
  }
};

// Block razorpay and api-server from module resolution entirely
const serverBlockPatterns = [
  new RegExp(".+razorpay.+"),
  new RegExp(path.resolve(__dirname, "../../artifacts/api-server").replace(/\\/g, "\\\\") + ".+"),
];
if (!config.resolver.blockList) config.resolver.blockList = [];
const existingBlock = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList];
config.resolver.blockList = [...existingBlock, ...serverBlockPatterns];

// ── react-native-svg buffer stub ───────────────────────────────────────────────
// react-native-svg imports 'buffer' in its web-compatibility layer
// (ReactNativeSVG → fetchData.ts). For native iOS/Android builds,
// Buffer is already a global (via @react-native/polyfills), so we stub
// the explicit 'buffer' import to avoid Metro failing to resolve it.
const bufferStub = path.resolve(__dirname, "scripts/buffer-native-stub.js");

// Shim used to redirect AppEntry.js → App imports in pnpm monorepo EAS builds
const appShimPath = path.resolve(__dirname, "scripts/expo-app-shim.js");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "buffer") {
    return { type: "sourceFile", filePath: bufferStub };
  }

  // TypeScript path alias: @/ → project root
  // extraNodeModules doesn't reliably handle @/ scoped-style imports in Metro.
  // Instead we intercept here and let Metro resolve the absolute path normally
  // (trying all extensions, platform suffixes, etc.).
  if (moduleName.startsWith("@/")) {
    const absolutePath = path.resolve(projectRoot, moduleName.slice(2));
    return context.resolveRequest(context, absolutePath, platform);
  }

  // In pnpm monorepo EAS builds, expo may be resolved from either the hoisted
  // root node_modules OR the deeply-nested pnpm virtual store. In both cases,
  // expo/AppEntry.js tries:  import App from '../../App'
  // which resolves to a path deep inside node_modules (not the project root)
  // and fails. We intercept ANY relative "…/App" import that originates from
  // inside node_modules and redirect to the expo-router App component instead.
  // This is safe because no legitimate app code inside node_modules should be
  // doing a bare relative "../../App" import.
  if (
    (moduleName === "../../App" ||
      moduleName === "../../../App" ||
      moduleName === "../App" ||
      (moduleName.endsWith("/App") && !moduleName.startsWith("."))) &&
    context.originModulePath.includes("node_modules")
  ) {
    return { type: "sourceFile", filePath: appShimPath };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
