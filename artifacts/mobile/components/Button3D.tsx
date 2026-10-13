/**
 * Button3D – chunky, raised button that physically presses down.
 *
 * Structure:
 *   outer View (positioning styles, reserves `depth` px below)
 *     ├─ edge   (darker copy offset down by `depth`, carries the drop shadow)
 *     └─ face   (Animated, translateY on press; optional gradient; 1px highlight)
 *
 * The highlight is an absolutely-positioned overlay so it never adds height.
 */
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Insets,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

/** Darken a #RRGGBB color by `amount` (0–1). */
export function shadeColor(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  const ch = (shift: number) =>
    Math.max(0, Math.round(((n >> shift) & 255) * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

const OUTER_KEYS = new Set([
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
  "marginHorizontal", "marginVertical", "marginStart", "marginEnd",
  "position", "top", "left", "right", "bottom", "start", "end",
  "alignSelf", "flex", "flexBasis", "flexShrink", "zIndex",
]);
const SHADOW_KEYS = new Set(["shadowColor", "shadowOffset", "shadowOpacity", "shadowRadius", "elevation"]);

const USE_NATIVE = Platform.OS !== "web";

export interface Button3DProps {
  children?: React.ReactNode;
  onPress?: () => void;
  /** Face color (defaults to faceStyle backgroundColor) */
  color?: string;
  /** Darker bottom edge color (defaults to ~18% darker face) */
  edgeColor?: string;
  radius?: number;
  depth?: number;
  disabled?: boolean;
  /** Outer (positioning) style: margins, width, alignSelf, position… */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Inner face style: size, padding, alignment, flexDirection… */
  faceStyle?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Preserve an existing gradient face */
  gradientColors?: readonly [string, string, ...string[]];
  gradientStart?: { x: number; y: number };
  gradientEnd?: { x: number; y: number };
  hitSlop?: number | Insets;
  testID?: string;
  /** Disable haptics (e.g. when the existing handler already fires one) */
  haptics?: boolean;
  /** Reserve `depth` px below so the edge never overlaps siblings (default true) */
  reserveSpace?: boolean;
  /** Drop-shadow strength multiplier (0 disables) */
  shadow?: number;
  /** Clip face children to radius (default true; disable for overflowing badges) */
  clipFace?: boolean;
}

export default function Button3D({
  children,
  onPress,
  color,
  edgeColor,
  radius: radiusProp,
  depth = 4,
  disabled = false,
  style,
  accessibilityLabel,
  faceStyle: faceStyleProp,
  gradientColors,
  gradientStart,
  gradientEnd,
  hitSlop,
  testID,
  haptics = true,
  reserveSpace = true,
  shadow = 1,
  clipFace = true,
}: Button3DProps) {
  // Split face style: positioning goes to the outer wrapper, the rest stays on the face.
  const flat = (StyleSheet.flatten(
    typeof faceStyleProp === "function" ? faceStyleProp({ pressed: false }) : faceStyleProp,
  ) ?? {}) as ViewStyle;
  const outerFromFace: ViewStyle = {};
  const faceOnly: ViewStyle = {};
  for (const [k, v] of Object.entries(flat)) {
    if (OUTER_KEYS.has(k)) (outerFromFace as Record<string, unknown>)[k] = v;
    else if (k !== "opacity" && k !== "transform" && !SHADOW_KEYS.has(k)) (faceOnly as Record<string, unknown>)[k] = v;
  }
  const faceStyle = faceOnly;
  const radius = radiusProp ?? (typeof flat.borderRadius === "number" ? flat.borderRadius : 22);
  const faceColor = color ?? (typeof flat.backgroundColor === "string" ? flat.backgroundColor : "transparent");
  const edge =
    edgeColor ??
    (/^#[0-9a-f]{3,8}$/i.test(faceColor) ? shadeColor(faceColor, 0.18) : "#C65F16");

  const press = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ width: 44, height: 44 });
  const suppliedSlop = typeof hitSlop === "number"
    ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }
    : hitSlop;
  const horizontalSlop = Math.max(0, (44 - size.width) / 2);
  const verticalSlop = Math.max(0, (44 - size.height) / 2);
  const touchSlop = {
    top: Math.max(verticalSlop, suppliedSlop?.top ?? 0),
    bottom: Math.max(verticalSlop, suppliedSlop?.bottom ?? 0),
    left: Math.max(horizontalSlop, suppliedSlop?.left ?? 0),
    right: Math.max(horizontalSlop, suppliedSlop?.right ?? 0),
  };
  useEffect(() => {
    if (disabled) {
      press.stopAnimation();
      press.setValue(0);
    }
  }, [disabled, press]);

  const pressIn = useCallback(() => {
    if (disabled) return;
    if (haptics) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {
        // haptics unavailable – ignore
      }
    }
    Animated.timing(press, { toValue: 1, duration: 60, useNativeDriver: USE_NATIVE }).start();
  }, [disabled, haptics, press]);

  const pressOut = useCallback(() => {
    Animated.spring(press, {
      toValue: 0,
      useNativeDriver: USE_NATIVE,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [press]);

  const travel = Math.max(0, depth - 1);
  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  const shadowOpacity = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });

  const shadowStyle: ViewStyle =
    shadow > 0
      ? Platform.select<ViewStyle>({
          ios: {
            shadowColor: "#3A1A05",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.22 * shadow,
            shadowRadius: 5 * shadow,
          },
          android: { elevation: Math.round(3 * shadow) },
          default: {
            shadowColor: "#3A1A05",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.22 * shadow,
            shadowRadius: 5 * shadow,
          },
        }) ?? {}
      : {};

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={touchSlop}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize((previous) => previous.width === layout.width && previous.height === layout.height
          ? previous : { width: layout.width, height: layout.height });
      }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        reserveSpace ? { paddingBottom: depth } : null,
        { opacity: disabled ? 0.5 : 1 },
        outerFromFace,
        style,
      ]}
    >
      {/* Bottom edge + drop shadow (does not affect layout) */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            top: depth,
            bottom: reserveSpace ? 0 : -depth,
            borderRadius: radius,
            backgroundColor: edge,
            opacity: shadowOpacity,
          },
          shadowStyle,
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { top: depth, bottom: reserveSpace ? 0 : -depth, borderRadius: radius, backgroundColor: edge },
        ]}
      />
      {/* Face */}
      <Animated.View
        style={[
          clipFace ? styles.face : null,
          { borderRadius: radius, transform: [{ translateY }] },
        ]}
      >
        {gradientColors ? (
          <LinearGradient
            colors={gradientColors}
            start={gradientStart}
            end={gradientEnd}
            style={[{ borderRadius: radius }, faceStyle]}
          >
            {children}
          </LinearGradient>
        ) : (
          <View style={[{ backgroundColor: faceColor, borderRadius: radius }, faceStyle]}>{children}</View>
        )}
        {/* 1px top highlight – overlay, never adds height */}
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            { borderTopLeftRadius: radius, borderTopRightRadius: radius },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { overflow: "hidden" },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
});
