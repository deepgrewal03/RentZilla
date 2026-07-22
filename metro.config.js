// Root-level metro.config.js — picked up by EAS when it runs Metro from the
// monorepo root in a pnpm workspace build. Delegates all real config to the
// mobile artifact's metro.config.js so there is a single source of truth.
module.exports = require("./artifacts/mobile/metro.config.js");
