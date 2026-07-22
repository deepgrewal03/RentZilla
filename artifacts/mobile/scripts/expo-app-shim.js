// This shim is used by metro.config.js to intercept the "../../App" import
// from expo/AppEntry.js in pnpm monorepo EAS builds.
//
// In a standard (non-monorepo) Expo Router project, package.json "main" points
// to expo-router/entry directly. In an EAS pnpm monorepo build, pnpm may hoist
// the expo package to the workspace root, causing expo/AppEntry.js to be used
// as the Metro entry instead. AppEntry.js then tries to resolve "../../App"
// which fails in the pnpm virtual store path.
//
// Metro's resolveRequest hook intercepts that import and redirects here, which
// re-exports the App component from expo-router's qualified-entry module —
// the same component that expo-router/entry-classic.js uses.
export { App as default } from 'expo-router/build/qualified-entry';
