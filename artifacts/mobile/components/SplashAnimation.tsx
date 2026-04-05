/**
 * RentZilla Premium Splash Animation — 8 seconds cinematic
 *
 * Timeline:
 *  0.0 – 1.5s  Background fades in; R drops from top, Z rises from bottom → meet center (mirrored)
 *  1.5 – 2.5s  180° Y-axis flip reveal — spring easing with luxury settle
 *  2.5 – 3.0s  Hold — readable "R Z" centered
 *  3.0 – 4.7s  Magnetic expand → "ent"/"illa" slide in, full "RentZilla" + tagline
 *  4.7 – 7.0s  Premium hold — full brand visible
 *  7.0 – 8.5s  Smooth fade out → Sign In screen beneath
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
const ND  = false; // useNativeDriver=false required on web (rotateY, translateY, scale)

// ── Easing curves ───────────────────────────────────────────────────────────
const ease     = Easing.bezier(0.4,   0,     0.2,  1);     // material standard
const easeOut  = Easing.bezier(0.16,  1,     0.3,  1);     // snappy settle
const spring   = Easing.bezier(0.175, 0.885, 0.32, 1.275); // spring overshoot
const magnet   = Easing.bezier(0.22,  1,     0.36, 1);     // fast start, smooth stop
// Cinematic glide — smooth momentum, gentle deceleration at rest
const cinematic = Easing.bezier(0.25, 0.46, 0.45, 0.94);

export default function SplashAnimation({ onDone }: { onDone: () => void }) {
  // ── Animated values ──────────────────────────────────────────────────────
  const bgOp    = useRef(new Animated.Value(0)).current;          // bg fade-in
  const rEntryY = useRef(new Animated.Value(-SH * 0.5)).current;  // R from top
  const zEntryY = useRef(new Animated.Value(SH * 0.5)).current;   // Z from bottom
  const rEntryO = useRef(new Animated.Value(0)).current;          // R opacity entry
  const zEntryO = useRef(new Animated.Value(0)).current;          // Z opacity entry
  const flip    = useRef(new Animated.Value(0)).current;          // 0=mirrored → 1=normal
  const rSep    = useRef(new Animated.Value(0)).current;          // R glide left
  const zSep    = useRef(new Animated.Value(0)).current;          // Z glide right
  const rzOp    = useRef(new Animated.Value(1)).current;          // "R Z" layer opacity
  const brandOp = useRef(new Animated.Value(0)).current;          // "RentZilla" opacity
  const brandSc = useRef(new Animated.Value(0.93)).current;       // "RentZilla" scale
  const entOp   = useRef(new Animated.Value(0)).current;          // "ent" opacity
  const entTx   = useRef(new Animated.Value(-13)).current;        // "ent" slide
  const illaOp  = useRef(new Animated.Value(0)).current;          // "illa" opacity
  const illaTx  = useRef(new Animated.Value(13)).current;         // "illa" slide
  const tagOp   = useRef(new Animated.Value(0)).current;          // tagline opacity
  const tagTy   = useRef(new Animated.Value(11)).current;         // tagline slide
  const lineW   = useRef(new Animated.Value(0)).current;          // accent line width
  const dotOp   = useRef(new Animated.Value(0)).current;          // dots opacity
  const ripOp   = useRef(new Animated.Value(0)).current;          // ripple opacity
  const ripSc   = useRef(new Animated.Value(0.35)).current;       // ripple scale
  const screenOp = useRef(new Animated.Value(1)).current;         // full screen fade-out

  useEffect(() => {
    Animated.sequence([

      // ── 0.0s → 1.5s · R drops from top, Z rises from bottom ─────────────
      Animated.parallel([
        // Background softly fades in
        Animated.timing(bgOp, {
          toValue: 1, duration: 600, easing: ease, useNativeDriver: ND,
        }),
        // R opacity — fade in as it enters frame
        Animated.timing(rEntryO, {
          toValue: 1, duration: 500, easing: ease, useNativeDriver: ND,
        }),
        // Z opacity — fade in as it enters frame
        Animated.timing(zEntryO, {
          toValue: 1, duration: 500, easing: ease, useNativeDriver: ND,
        }),
        // R cinematic glide from top to center
        Animated.timing(rEntryY, {
          toValue: 0, duration: 1400, easing: cinematic, useNativeDriver: ND,
        }),
        // Z cinematic glide from bottom to center
        Animated.timing(zEntryY, {
          toValue: 0, duration: 1400, easing: cinematic, useNativeDriver: ND,
        }),
      ]),

      // ── 1.5s → 2.5s · 180° flip reveal with luxury spring settle ─────────
      Animated.timing(flip, {
        toValue: 1, duration: 1000, easing: spring, useNativeDriver: ND,
      }),

      // ── 2.5s → 3.0s · Hold — readable "R Z" centered ─────────────────────
      Animated.delay(500),

      // ── 3.0s → 4.7s · Magnetic expansion + full brand build ─────────────
      Animated.parallel([
        // R glides left — magnetic release
        Animated.timing(rSep, {
          toValue: -26, duration: 1000, easing: magnet, useNativeDriver: ND,
        }),
        // Z glides right — mirrored magnetic
        Animated.timing(zSep, {
          toValue: 26, duration: 1000, easing: magnet, useNativeDriver: ND,
        }),
        // "R Z" layer fades out
        Animated.timing(rzOp, {
          toValue: 0, duration: 380, useNativeDriver: ND,
        }),
        // "RentZilla" layer fades + scales in
        Animated.timing(brandOp, {
          toValue: 1, duration: 500, delay: 100, useNativeDriver: ND,
        }),
        Animated.timing(brandSc, {
          toValue: 1, duration: 560, delay: 80, easing: easeOut, useNativeDriver: ND,
        }),
        // "ent" luxury slide in from left
        Animated.timing(entOp, {
          toValue: 1, duration: 400, delay: 180, useNativeDriver: ND,
        }),
        Animated.timing(entTx, {
          toValue: 0, duration: 520, delay: 130, easing: easeOut, useNativeDriver: ND,
        }),
        // "illa" luxury slide in from right
        Animated.timing(illaOp, {
          toValue: 1, duration: 400, delay: 180, useNativeDriver: ND,
        }),
        Animated.timing(illaTx, {
          toValue: 0, duration: 520, delay: 130, easing: easeOut, useNativeDriver: ND,
        }),
        // Accent line expands
        Animated.timing(lineW, {
          toValue: 46, duration: 450, delay: 260, easing: easeOut, useNativeDriver: ND,
        }),
        // Tagline slides up softly
        Animated.timing(tagOp, {
          toValue: 1, duration: 400, delay: 380, useNativeDriver: ND,
        }),
        Animated.timing(tagTy, {
          toValue: 0, duration: 480, delay: 320, easing: easeOut, useNativeDriver: ND,
        }),
        // Progress dots
        Animated.timing(dotOp, {
          toValue: 1, duration: 320, delay: 480, useNativeDriver: ND,
        }),
        // Ripple burst
        Animated.sequence([
          Animated.timing(ripOp, { toValue: 0.5, duration: 70, useNativeDriver: ND }),
          Animated.parallel([
            Animated.timing(ripSc, {
              toValue: 2.8, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: ND,
            }),
            Animated.timing(ripOp, { toValue: 0, duration: 800, useNativeDriver: ND }),
          ]),
        ]),
      ]),

      // ── 4.7s → 7.0s · Premium hold — full brand visible ─────────────────
      Animated.delay(2300),

      // ── 7.0s → 8.5s · Smooth 1.5s fade out → Sign In ────────────────────
      Animated.timing(screenOp, {
        toValue: 0, duration: 1500, easing: ease, useNativeDriver: ND,
      }),

    ]).start(() => onDone());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3D flip: mirrored (180°) → normal (0°) with spring overshoot
  const rRotateY = flip.interpolate({
    inputRange:  [0, 1],
    outputRange: ["180deg", "0deg"],
  });
  const zRotateY = flip.interpolate({
    inputRange:  [0, 1],
    outputRange: ["-180deg", "0deg"],
  });

  const logoTopOffset = SH * 0.5 - FS * 0.6;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.root, { opacity: screenOp }]}>

      {/* ── Background — fades in softly ──────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: bgOp }]}>
        <LinearGradient
          colors={["#0F172A", "#1E293B", "#0F172A"]}
          start={{ x: 0.4, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* ── Soft ambient glow ─────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.ambientGlow,
          { top: SH * 0.5 - SW * 0.44, opacity: bgOp },
        ]}
      />

      {/* ── Ripple burst ring ─────────────────────────────────────────────── */}
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

      {/* ── Logo block ────────────────────────────────────────────────────── */}
      <View style={[styles.logoBlock, { top: logoTopOffset }]}>

        {/* Layer 1 · "R Z" — enters from top/bottom, flips, glides apart */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.layerCenter, { opacity: rzOp }]}>
          <View style={styles.rzRow}>

            {/* R: drops from top → flips → glides left */}
            <Animated.View
              style={{
                opacity: rEntryO,
                transform: [
                  { translateY: rEntryY },
                  { perspective: 1100 },
                  { rotateY: rRotateY },
                  { translateX: rSep },
                ],
              }}
            >
              <Text style={styles.letter}>R</Text>
            </Animated.View>

            <View style={styles.rzGap} />

            {/* Z: rises from bottom → flips → glides right */}
            <Animated.View
              style={{
                opacity: zEntryO,
                transform: [
                  { translateY: zEntryY },
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

        {/* Layer 2 · "RentZilla" — scales + fades in; ent/illa slide in */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.layerCenter,
            { opacity: brandOp, transform: [{ scale: brandSc }] },
          ]}
        >
          <View style={styles.rzRow}>
            <Text style={styles.letter}>R</Text>
            <Animated.View style={{ opacity: entOp, transform: [{ translateX: entTx }] }}>
              <Text style={styles.letter}>ent</Text>
            </Animated.View>
            <Text style={[styles.letter, styles.gold]}>Z</Text>
            <Animated.View style={{ opacity: illaOp, transform: [{ translateX: illaTx }] }}>
              <Text style={[styles.letter, styles.gold]}>illa</Text>
            </Animated.View>
          </View>
        </Animated.View>

      </View>

      {/* ── Accent line ───────────────────────────────────────────────────── */}
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

      {/* ── Tagline ───────────────────────────────────────────────────────── */}
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

      {/* ── Progress dots ─────────────────────────────────────────────────── */}
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
    overflow: "hidden",
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
    overflow: "visible",
  },
  layerCenter: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  rzRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
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
    color: "#0F1F3D",
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
