const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Note: Metro's HmrServer._registerEntryPoint has been patched (HMR_PATCH) in
// node_modules/metro/src/HmrServer.js to silently catch errors caused by the
// Replit Expo web preview connecting with an unparseable URL (?platform=web).
// This keeps Metro alive after the HMR WebSocket connects.

const config = getDefaultConfig(__dirname);

// react-native-svg imports 'buffer' in its web-compatibility layer
// (ReactNativeSVG → fetchData.ts). For native iOS/Android builds,
// Buffer is already a global (via @react-native/polyfills), so we stub
// the explicit 'buffer' import to avoid Metro failing to resolve it.
const bufferStub = path.resolve(__dirname, "scripts/buffer-native-stub.js");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "buffer") {
    return { type: "sourceFile", filePath: bufferStub };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
