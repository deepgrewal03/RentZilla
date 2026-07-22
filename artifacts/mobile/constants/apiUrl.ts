// ─── Production domain — hardcoded, never undefined ─────────────────────────
// In release builds __DEV__ is false, so the URL is a compile-time constant.
// In development the workflow injects EXPO_PUBLIC_DOMAIN (Replit dev URL).

const PRODUCTION_URL = "https://rent-organizer.replit.app";

export const API_BASE_URL: string = __DEV__
  ? (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : PRODUCTION_URL)
  : PRODUCTION_URL;
