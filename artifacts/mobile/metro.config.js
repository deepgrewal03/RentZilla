const { getDefaultConfig } = require("expo/metro-config");

// Note: Metro's HmrServer._registerEntryPoint has been patched (HMR_PATCH) in
// node_modules/metro/src/HmrServer.js to silently catch errors caused by the
// Replit Expo web preview connecting with an unparseable URL (?platform=web).
// This keeps Metro alive after the HMR WebSocket connects.

module.exports = getDefaultConfig(__dirname);
