// Brand gradient: #FF7A18 → #FFB347 (warm orange)
const primary   = "#FF7A18";
const primaryMid = "#FF9A3C";
const primaryEnd = "#FFB347";
const primaryDark = "#E06010";
const primaryLight = "#FFCB7A";
const navy      = "#0F1F3D";   // kept for provider dashboard only
const navyLight = "#1A3060";
const gold      = "#F5C842";
const green     = "#2E7D32";
const greenLight = "#E8F5E9";

export const GRADIENT_ORANGE: [string, string] = ["#FF7A18", "#FFB347"];

export default {
  light: {
    // Text
    text:            "#2D2D2D",
    textSecondary:   "#6B6B6B",
    textTertiary:    "#9CA3AF",

    // Backgrounds
    background:          "#F8F9FB",
    backgroundSecondary: "#FFFFFF",
    backgroundTertiary:  "#EFF2F7",

    // Brand
    tint:      primary,
    tintMid:   primaryMid,
    tintEnd:   primaryEnd,
    tintDark:  primaryDark,
    tintLight: primaryLight,

    // Navy (provider mode only)
    navy,
    navyLight,

    // Accent
    gold,
    green,
    greenLight,
    blue:      "#4FC3F7",
    blueDark:  "#0284C7",
    blueLight: "#E0F7FA",

    // Borders & cards
    border:     "#E5E9F0",
    borderLight: "#F0F3F9",
    card:        "#FFFFFF",
    cardBorder:  "#F0F3F9",
    shadow:      "rgba(255, 122, 24, 0.08)",
    overlay:     "rgba(45, 45, 45, 0.5)",

    // Status
    success: "#22C55E",
    warning: "#F59E0B",
    error:   "#EF4444",

    // Tab bar
    tabIconDefault:  "#9CA3AF",
    tabIconSelected: primary,

    // Misc
    badge:     "#EF4444",
    badgeText: "#FFFFFF",
  },
};
