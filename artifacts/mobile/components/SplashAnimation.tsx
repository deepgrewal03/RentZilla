/**
 * RentZilla Premium Splash Animation
 * ~4.5-second cinematic brand intro before Sign In.
 *
 * Timeline:
 *  0.0 – 0.8s  Initial mirrored "R Z" — fade-in + subtle scale-up
 *  0.8 – 1.8s  180° Y-axis flip reveal — overshoot spring easing
 *  1.8 – 2.3s  Pause — hold readable "R Z"
 *  2.3 – 3.2s  Magnetic separation — R glides left, Z glides right,
 *               "ent" and "illa" slide in; tagline fades up
 *  3.2 – 4.2s  Premium hold — full "RentZilla" + tagline
 *  4.2 – 4.6s  Smooth fade to Sign In
 */

import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");
const FS  = Math.min(Math.round(SW * 0.195), 86);
const ND  = false; // useNativeDriver=false required on web (rotateY, left, scale)

// ── Cubic bezier helpers ────────────────────────────────────────────────────
const ease   = Easing.bezier(0.4,  0,    0.2, 1   );   // material ease-in-out
const easeOut = Easing.bezier(0.16, 1,    0.3, 1   );   // snappy spring out
// overshoot: goes slightly past 0° then settles — "luxury settle" feel
const spring = Easing.bezier(0.175, 0.885, 0.32, 1.275);
// magnetic release: fast start, smooth decelerate
const magnet = Easing.bezier(0.22, 1, 0.36, 1);

export default function SplashAnimation({ onDone }: { onDone: () => void }) {
  // ── Animated values ────────────────────────────────────────────────────────
  const initOp    = useRef(new Animated.Value(0)).current;    // initial fade-in
  const initSc    = useRef(new Animated.Value(0.95)).current; // initial scale
  const flip      = useRef(new Animated.Value(0)).current;    // 0 = mirrored, 1 = normal
  const rSep      = useRef(new Animated.Value(0)).current;    // R glide: 0 → -26 → 0
  const zSep      = useRef(new Animated.Value(0)).current;    // Z glide: 0 → +26 → 0
  const rzOp      = useRef(new Animated.Value(1)).current;    // "R Z" layer opacity
  const brandOp   = useRef(new Animated.Value(0)).current;    // "RentZilla" layer opacity
  const brandSc   = useRef(new Animated.Value(0.93)).current; // "RentZilla" layer scale
  const entOp     = useRef(new Animated.Value(0)).current;    // "ent" opacity
  const entTx     = useRef(new Animated.Value(-13)).current;  // "ent" slide: -13 → 0
  const illaOp    = useRef(new Animated.Value(0)).current;    // "illa" opacity
  const illaTx    = useRef(new Animated.Value(13)).current;   // "illa" slide: 13 → 0
  const tagOp     = useRef(new Animated.Value(0)).current;
  const tagTy     = useRef(new Animated.Value(11)).current;
  const lineW     = useRef(new Animated.Value(0)).current;
  const dotOp     = useRef(new Animated.Value(0)).current;
  const ripOp     = useRef(new Animated.Value(0)).current;
  const ripSc     = useRef(new Animated.Value(0.35)).current;
  const screenOp  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([

      // ── 0.0s → 0.8s · Mirrored "R Z" fades + scales in ──────────────────
      Animated.parallel([
        Animated.timing(initOp, { toValue: 1, duration: 380, easing: ease, useNativeDriver: ND }),
        Animated.timing(initSc, { toValue: 1, duration: 800, easing: easeOut, useNativeDriver: ND }),
      ]),

      // ── 0.8s → 1.8s · 180° premium flip with spring overshoot ────────────
      Animated.timing(flip, {
        toValue: 1,
        duration: 1000,
        easing: spring,
        useNativeDriver: ND,
      }),

      // ── 1.8s → 2.3s · Pause — hold readable "R Z" ────────────────────────
      Animated.delay(500),

      // ── 2.3s → 3.2s · Magnetic separation + brand build ──────────────────
      Animated.parallel([
        // R glides left — magnetic release feel
        Animated.timing(rSep, {
          toValue: -26, duration: 880, easing: magnet, useNativeDriver: ND,
        }),
        // Z glides right — mirrored
        Animated.timing(zSep, {
          toValue: 26, duration: 880, easing: magnet, useNativeDriver: ND,
        }),
        // "R Z" layer fades out as letters spread
        Animated.timing(rzOp, {
          toValue: 0, duration: 320, useNativeDriver: ND,
        }),
        // "RentZilla" layer fades + scales in
        Animated.timing(brandOp, {
          toValue: 1, duration: 440, delay: 90, useNativeDriver: ND,
        }),
        Animated.timing(brandSc, {
          toValue: 1, duration: 500, delay: 70, easing: easeOut, useNativeDriver: ND,
        }),
        // "ent" slides in from the left
        Animated.timing(entOp, {
          toValue: 1, duration: 360, delay: 150, useNativeDriver: ND,
        }),
        Animated.timing(entTx, {
          toValue: 0, duration: 460, delay: 110, easing: easeOut, useNativeDriver: ND,
        }),
        // "illa" slides in from the right
        Animated.timing(illaOp, {
          toValue: 1, duration: 360, delay: 150, useNativeDriver: ND,
        }),
        Animated.timing(illaTx, {
          toValue: 0, duration: 460, delay: 110, easing: easeOut, useNativeDriver: ND,
        }),
        // Accent line expands
        Animated.timing(lineW, {
          toValue: 46, duration: 400, delay: 220, easing: easeOut, useNativeDriver: ND,
        }),
        // Tagline slides up
        Animated.timing(tagOp, {
          toValue: 1, duration: 340, delay: 340, useNativeDriver: ND,
        }),
        Animated.timing(tagTy, {
          toValue: 0, duration: 420, delay: 280, easing: easeOut, useNativeDriver: ND,
        }),
        // Progress dots
        Animated.timing(dotOp, {
          toValue: 1, duration: 280, delay: 420, useNativeDriver: ND,
        }),
        // Ripple burst
        Animated.sequence([
          Animated.timing(ripOp, { toValue: 0.5, duration: 70, useNativeDriver: ND }),
          Animated.parallel([
            Animated.timing(ripSc, {
              toValue: 2.8, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: ND,
            }),
            Animated.timing(ripOp, { toValue: 0, duration: 700, useNativeDriver: ND }),
          ]),
        ]),
      ]),

      // ── 3.2s → 4.2s · Premium hold — full "RentZilla" + tagline ────────────
      Animated.delay(1000),

      // ── 4.2s → 4.6s · Smooth fade to Sign In ────────────────────────────
      Animated.timing(screenOp, {
        toValue: 0,
        duration: 400,
        easing: ease,
        useNativeDriver: ND,
      }),

    ]).start(() => onDone());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3D flip interpolation — spring easing makes it feel like it "settles"
  const rRotateY = flip.interpolate({
    inputRange:  [0, 1],
    outputRange: ["180deg", "0deg"],
  });
  const zRotateY = flip.interpolate({
    inputRange:  [0, 1],
    outputRange: ["-180deg", "0deg"],
  });

  // Vertical center for the logo block
  const logoTopOffset = SH * 0.5 - FS * 0.6;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.root, { opacity: screenOp }]}>

      {/* ── Premium dark background ─────────────────────────────────────── */}
      <LinearGradient
        colors={["#0F172A", "#1E293B", "#0F172A"]}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Soft ambient glow behind letters ───────────────────────────── */}
      <Animated.View
        style={[
          styles.ambientGlow,
          { top: SH * 0.5 - SW * 0.44, opacity: initOp },
        ]}
      />

      {/* ── Ripple burst ring ───────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.rippleRing,
          {
            top: SH * 0.5 - SW * 0.265,
            opacity: ripOp,
            transform: [{ scale: ripSc }],
          },
        ]}
      />

      {/* ── Logo block — stacked layers, fades/scales together initially ── */}
      <Animated.View
        style={[
          styles.logoBlock,
          { top: logoTopOffset, opacity: initOp, transform: [{ scale: initSc }] },
        ]}
      >
        {/* ─ Layer 1 · "R  Z" with 3-D flip + separation glide ─ */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.layerCenter, { opacity: rzOp }]}>
          <View style={styles.rzRow}>
            {/* R — flips in, then glides left */}
            <Animated.View
              style={{
                transform: [
                  { perspective: 1100 },
                  { rotateY: rRotateY },
                  { translateX: rSep },
                ],
              }}
            >
              <Text style={styles.letter}>R</Text>
            </Animated.View>

            {/* Fixed gap between R and Z */}
            <View style={styles.rzGap} />

            {/* Z — flips in, then glides right */}
            <Animated.View
              style={{
                transform: [
                  { perspective: 1100 },
                  { rotateY: zRotateY },
                  { translateX: zSep },
                ],
              }}
            >
              <Text style={[styles.letter, styles.gold]}>Z</Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* ─ Layer 2 · "RentZilla" — scales + fades in; ent/illa slide in ─ */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.layerCenter,
            { opacity: brandOp, transform: [{ scale: brandSc }] },
          ]}
        >
          <View style={styles.rzRow}>
            {/* R — static anchor */}
            <Text style={styles.letter}>R</Text>

            {/* "ent" — slides in from the left */}
            <Animated.View
              style={{
                opacity: entOp,
                transform: [{ translateX: entTx }],
              }}
            >
              <Text style={styles.letter}>ent</Text>
            </Animated.View>

            {/* Z — static anchor */}
            <Text style={[styles.letter, styles.gold]}>Z</Text>

            {/* "illa" — slides in from the right */}
            <Animated.View
              style={{
                opacity: illaOp,
                transform: [{ translateX: illaTx }],
              }}
            >
              <Text style={[styles.letter, styles.gold]}>illa</Text>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* ── Accent line ─────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.accentLine,
          {
            top: logoTopOffset + FS * 1.14 + 20,
            width: lineW,
            opacity: tagOp,
          },
        ]}
      />

      {/* ── Tagline ─────────────────────────────────────────────────────── */}
      <Animated.Text
        style={[
          styles.tagline,
          {
            top: logoTopOffset + FS * 1.14 + 38,
            opacity: tagOp,
            transform: [{ translateY: tagTy }],
          },
        ]}
      >
        Rent Anything. Anytime. Anywhere.
      </Animated.Text>

      {/* ── Progress indicator dots ─────────────────────────────────────── */}
      <Animated.View style={[styles.dotRow, { opacity: dotOp }]}>
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
  },
  ambientGlow: {
    position: "absolute",
    width: SW * 0.88,
    height: SW * 0.88,
    borderRadius: SW * 0.44,
    backgroundColor: "rgba(255, 122, 24, 0.06)",
    alignSelf: "center",
  },
  rippleRing: {
    position: "absolute",
    width: SW * 0.53,
    height: SW * 0.53,
    borderRadius: SW * 0.265,
    borderWidth: 1.5,
    borderColor: "rgba(255, 159, 67, 0.5)",
    alignSelf: "center",
  },
  logoBlock: {
    position: "absolute",
    width: SW,
    height: FS * 1.3,
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
  rzGap: { width: 34 },
  letter: {
    fontSize: FS,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    color: "#FF7A18",
    includeFontPadding: false,
    letterSpacing: -0.5,
  },
  gold: {
    color: "#FF9F43",
  },
  accentLine: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FF7A18",
    alignSelf: "center",
  },
  tagline: {
    position: "absolute",
    width: SW,
    textAlign: "center",
    fontSize: 13.5,
    color: "rgba(255, 255, 255, 0.48)",
    fontFamily: "Inter_400Regular",
    letterSpacing: 1.6,
  },
  dotRow: {
    position: "absolute",
    bottom: 54,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    alignSelf: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  dotActive: {
    width: 22,
    backgroundColor: "#FF7A18",
  },
});
