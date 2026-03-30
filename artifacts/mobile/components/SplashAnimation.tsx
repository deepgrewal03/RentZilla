import React, { useEffect, useRef } from "react";
import {
  Animated, Dimensions, StyleSheet, Text, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width: SW, height: SH } = Dimensions.get("window");
const FS = Math.min(Math.round(SW * 0.2), 90);
const ND = false; // useNativeDriver must be false for web (rotateY/scale)

export default function SplashAnimation({ onDone }: { onDone: () => void }) {
  // ── Animated values ────────────────────────────────────────────────────────
  const flip       = useRef(new Animated.Value(0)).current; // 0=mirrored → 1=normal
  const rzOpacity  = useRef(new Animated.Value(1)).current; // "R  Z" layer
  const fullOpacity = useRef(new Animated.Value(0)).current; // "RentZilla" layer
  const fullScale  = useRef(new Animated.Value(0.86)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagTransY  = useRef(new Animated.Value(12)).current;
  const lineWidth  = useRef(new Animated.Value(0)).current;
  const rippleOp   = useRef(new Animated.Value(0)).current;
  const rippleScale = useRef(new Animated.Value(0.4)).current;
  const screenOp   = useRef(new Animated.Value(1)).current;
  const glowOp     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // ── Phase 1 · Flip letters in (800ms) ────────────────────────────────
      Animated.parallel([
        Animated.timing(flip,   { toValue: 1, duration: 800, useNativeDriver: ND }),
        Animated.timing(glowOp, { toValue: 1, duration: 600, useNativeDriver: ND }),
      ]),

      // ── Phase 2 · Hold "R  Z" (500ms) ────────────────────────────────────
      Animated.delay(500),

      // ── Phase 3 · Expand to "RentZilla" + tagline (500ms) ────────────────
      Animated.parallel([
        // Cross-fade layers
        Animated.timing(rzOpacity,   { toValue: 0, duration: 280, useNativeDriver: ND }),
        Animated.timing(fullOpacity, { toValue: 1, duration: 400, useNativeDriver: ND }),
        Animated.timing(fullScale,   { toValue: 1, duration: 480, useNativeDriver: ND }),
        // Tagline slides up
        Animated.timing(tagOpacity,  { toValue: 1, duration: 350, delay: 180, useNativeDriver: ND }),
        Animated.timing(tagTransY,   { toValue: 0,  duration: 420, delay: 130, useNativeDriver: ND }),
        // Accent line expands
        Animated.timing(lineWidth,   { toValue: 48, duration: 400, delay: 100, useNativeDriver: ND }),
        // Ripple burst
        Animated.sequence([
          Animated.timing(rippleOp,    { toValue: 0.5, duration: 80,  useNativeDriver: ND }),
          Animated.parallel([
            Animated.timing(rippleScale, { toValue: 2.8, duration: 620, useNativeDriver: ND }),
            Animated.timing(rippleOp,    { toValue: 0,   duration: 620, useNativeDriver: ND }),
          ]),
        ]),
      ]),

      // ── Phase 4 · Hold "RentZilla" (1000ms) ──────────────────────────────
      Animated.delay(1000),

      // ── Phase 5 · Collapse back to "R  Z" (450ms) ────────────────────────
      Animated.parallel([
        Animated.timing(fullOpacity, { toValue: 0,  duration: 280, useNativeDriver: ND }),
        Animated.timing(fullScale,   { toValue: 0.86, duration: 420, useNativeDriver: ND }),
        Animated.timing(rzOpacity,   { toValue: 1,  duration: 320, delay: 110, useNativeDriver: ND }),
        Animated.timing(tagOpacity,  { toValue: 0,  duration: 220, useNativeDriver: ND }),
        Animated.timing(tagTransY,   { toValue: 12, duration: 280, useNativeDriver: ND }),
        Animated.timing(lineWidth,   { toValue: 0,  duration: 250, useNativeDriver: ND }),
      ]),

      // ── Phase 6 · Hold "R  Z" (500ms) ────────────────────────────────────
      Animated.delay(500),

      // ── Phase 7 · Premium fade-to-app (750ms) ────────────────────────────
      Animated.parallel([
        Animated.timing(screenOp, { toValue: 0, duration: 750, useNativeDriver: ND }),
        Animated.timing(glowOp,   { toValue: 0, duration: 500, useNativeDriver: ND }),
      ]),
    ]).start(() => onDone());
  }, []);

  // Letter flip interpolations: start reversed (180deg), rotate to normal (0deg)
  const rRotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "0deg"] });
  const zRotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["-180deg", "0deg"] });

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.root, { opacity: screenOp }]}>
      {/* ── Background gradient ── */}
      <LinearGradient
        colors={["#060D1A", "#0F1F3D", "#08111F"]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Ambient glow behind logo ── */}
      <Animated.View style={[styles.ambientGlow, { opacity: glowOp }]} />

      {/* ── Ripple ring burst ── */}
      <Animated.View
        style={[styles.rippleRing, { opacity: rippleOp, transform: [{ scale: rippleScale }] }]}
      />

      {/* ── Logo area ── */}
      <View style={styles.centerBlock}>

        {/* Stacked logo layers */}
        <View style={[styles.logoBox]}>

          {/* Layer 1 · "R  Z" with 3-D flip */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.layerCenter, { opacity: rzOpacity }]}>
            <View style={styles.rzRow}>
              <Animated.View style={{ transform: [{ perspective: 900 }, { rotateY: rRotateY }] }}>
                <Text style={styles.letter}>R</Text>
              </Animated.View>
              <View style={styles.rzGap} />
              <Animated.View style={{ transform: [{ perspective: 900 }, { rotateY: zRotateY }] }}>
                <Text style={styles.letter}>Z</Text>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Layer 2 · "RentZilla" full brand */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.layerCenter,
              { opacity: fullOpacity, transform: [{ scale: fullScale }] },
            ]}
          >
            <Text style={styles.brandRow} numberOfLines={1}>
              <Text style={styles.brandOrange}>Rent</Text>
              <Text style={styles.brandGold}>Zilla</Text>
            </Text>
          </Animated.View>
        </View>

        {/* ── Animated accent line ── */}
        <Animated.View style={[styles.accentLine, { width: lineWidth }]} />

        {/* ── Tagline ── */}
        <Animated.Text
          style={[styles.tagline, { opacity: tagOpacity, transform: [{ translateY: tagTransY }] }]}
        >
          Punjab's #1 Rental Marketplace
        </Animated.Text>
      </View>

      {/* ── Bottom progress dots ── */}
      <Animated.View style={[styles.dotRow, { opacity: tagOpacity }]}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  ambientGlow: {
    position: "absolute",
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
    backgroundColor: "rgba(255, 122, 24, 0.07)",
    alignSelf: "center",
    top: SH * 0.5 - SW * 0.45,
  },
  rippleRing: {
    position: "absolute",
    width: SW * 0.55,
    height: SW * 0.55,
    borderRadius: SW * 0.275,
    borderWidth: 1.5,
    borderColor: "rgba(255, 159, 67, 0.55)",
    alignSelf: "center",
  },
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoBox: {
    width: SW * 0.88,
    height: FS + 24,
    alignItems: "center",
    justifyContent: "center",
  },
  layerCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  rzRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rzGap: { width: 32 },
  letter: {
    fontSize: FS,
    fontWeight: "800",
    color: "#FF7A18",
    fontFamily: "Inter_700Bold",
    includeFontPadding: false,
    letterSpacing: -1,
  },
  brandRow: {
    fontSize: FS,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    includeFontPadding: false,
    letterSpacing: -1,
  },
  brandOrange: { color: "#FF7A18" },
  brandGold: { color: "#FF9F43" },
  accentLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FF7A18",
    marginTop: 22,
    marginBottom: 0,
  },
  tagline: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    letterSpacing: 3,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 14,
  },
  dotRow: {
    position: "absolute",
    bottom: 52,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dotActive: {
    width: 22,
    backgroundColor: "#FF7A18",
  },
});
