const primary     = "#FF7A18";
const primaryEnd  = "#FF9F43";
const primaryDark = "#E06010";
const navy        = "#0F1F3D"; // reserved for provider dashboard
const navyLight   = "#1A3060";
const gold        = "#FFA000"; // rating stars

export const GRADIENT_ORANGE: [string, string] = [primary, primaryEnd];

export default {
  light: {
    // Text
    text:            "#2C2C2C",
    textSecondary:   "#7A7A7A",
    textTertiary:    "#AEAEAE",

    // Backgrounds
    background:          "#F5F6FA",
    backgroundSecondary: "#FFFFFF",
    backgroundTertiary:  "#EAEAEA",

    // Brand
    tint:      primary,
    tintEnd:   primaryEnd,
    tintDark:  primaryDark,

    // Navy (provider screens only)
    navy,
    navyLight,

    // Accent
    gold,
    border:     "#EAEAEA",
    borderLight: "#F5F5F5",
    card:        "#FFFFFF",
    cardBorder:  "#EAEAEA",
    shadow:      "rgba(0,0,0,0.06)",
    overlay:     "rgba(0,0,0,0.4)",

    // Status
    success: "#22C55E",
    warning: "#F59E0B",
    error:   "#EF4444",

    // Tab bar
    tabIconDefault:  "#AEAEAE",
    tabIconSelected: primary,

    badge:     "#EF4444",
    badgeText: "#FFFFFF",
  },
};
