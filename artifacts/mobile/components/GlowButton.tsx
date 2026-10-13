/**
 * GlowButton – premium reusable CTA button
 *
 * Features:
 *  • Colored outer glow (iOS shadow) / elevation (Android)
 *  • Extra bottom glow strip for "floating" 3D look
 *  • Thin bright border (auto-brightened from fill color)
 *  • Top-edge glass reflection overlay
 *  • Spring press animation (scale 0.97 → 1.0 with bounce)
 *  • Loading indicator, disabled state, icon slots
 *  • Fully memoized – safe inside FlatList / ScrollView
 */

import Button3D, { shadeColor } from "@/components/Button3D";
import React, { useCallback, useRef, memo } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Color utilities
// ─────────────────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Brighten a hex color toward white by `amount` (0 = no change, 1 = white).
 * E.g. brightenColor("#FF7A18", 0.2) → 20% brighter orange
 */
export function brightenColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + Math.round((255 - r) * amount),
    g + Math.round((255 - g) * amount),
    b + Math.round((255 - b) * amount),
  );
}

/**
 * Return an rgba() string from a hex color + alpha.
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface GlowButtonProps {
  title: string;
  color?: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  borderRadius?: number;
  /** Glow intensity 0–1. Default 0.55. Pass 0 to disable all glow. */
  glowStrength?: number;
  height?: number;
  fontSize?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COLOR = "#FF7A18";
const DEFAULT_RADIUS = 14;
const DEFAULT_HEIGHT = 52;
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_GLOW = 0.55;

// Space below button reserved for the floating bottom glow strip
const BOTTOM_GLOW_SLOT = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const GlowButton = memo(function GlowButton({
  title,
  color = DEFAULT_COLOR,
  onPress,
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  borderRadius = DEFAULT_RADIUS,
  glowStrength = DEFAULT_GLOW,
  height = DEFAULT_HEIGHT,
  fontSize = DEFAULT_FONT_SIZE,
  style,
  textStyle,
}: GlowButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(1)).current;

  const isDisabled = disabled || loading;
  const gs = isDisabled ? 0 : glowStrength;

  // Derived palette
  const borderColor = brightenColor(color, 0.18);
  const glowColor = brightenColor(color, 0.20);
  const bottomGlowColor = brightenColor(color, 0.30);

  // ── Press handlers ──────────────────────────────────────────────────────────

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 60,
        bounciness: 0,
      }),
      Animated.timing(glowAnim, {
        toValue: 1.4,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, glowAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 7,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, glowAnim]);

  // ── iOS colored shadow (scales with press) ──────────────────────────────────
  // We put these on the Animated.View so they move with the scale transform.

  const iosShadowStyle: ViewStyle =
    Platform.OS === "ios" && gs > 0
      ? {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.55 * gs,
          shadowRadius: 12 * gs,
        }
      : {};

  // Android elevation on the button itself gives a natural drop shadow
  const androidElevation: ViewStyle =
    Platform.OS === "android" && gs > 0
      ? { elevation: Math.round(10 * gs) }
      : {};

  // ── Render (3D raised button) ───────────────────────────────────────────

  return (
    <Button3D
      onPress={onPress}
      disabled={isDisabled}
      color={color}
      edgeColor={shadeColor(color, 0.18)}
      radius={borderRadius}
      depth={4}
      accessibilityLabel={title}
      style={[fullWidth ? styles.fullWidth : styles.wrapper, style]}
      faceStyle={[styles.pressable, { height }]}
    >
      <View style={styles.row}>
        {!!iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={[styles.label, { fontSize }, textStyle]} numberOfLines={1}>
            {title}
          </Text>
        )}
        {!!iconRight && <View style={styles.iconRight}>{iconRight}</View>}
      </View>
    </Button3D>
  );
});

export default GlowButton;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    // alignSelf flex-start so it doesn't stretch to parent width by default
    alignSelf: "flex-start",
  },
  fullWidth: {
    alignSelf: "stretch",
  },

  // Android colored shadow backing
  androidGlow: {
    position: "absolute",
    top: 4,
    left: -5,
    right: -5,
    // bottom set inline
  },

  // Main button shell
  button: {
    borderWidth: 1.5,
    overflow: "hidden",
  },

  // Fills the button, handles press / ripple
  pressable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    overflow: "hidden",
  },

  // Glassy top-edge highlight — upper 38% of button height
  topReflection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "38%",
    backgroundColor: "rgba(255,255,255,0.13)",
    zIndex: 1,
  },

  // Label row
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },

  label: {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.4,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Bottom floating glow strip
  bottomGlow: {
    height: 10,
    marginHorizontal: 12,
    marginTop: 2,
  },
});
