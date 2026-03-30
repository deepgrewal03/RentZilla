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
const FS = Math.min(Math.round(SW * 0.2), 90);
const ND = false; // must be false on web (rotateY / left / scale not in native driver)

export default function SplashAnimation({ onDone }: { onDone: () => void }) {
  // ─── measurement refs ────────────────────────────────────────────────────────
  const measured = useRef({ rW: 0, entW: 0, zW: 0, illaW: 0, done: 0 });
  const started = useRef(false);

  // ─── animated values (created once, set before first frame) ─────────────────
  const flip       = useRef(new Animated.Value(0)).current;   // 0=mirrored → 1=normal
  const screenOp   = useRef(new Animated.Value(1)).current;
  const rippleOp   = useRef(new Animated.Value(0)).current;
  const rippleScale = useRef(new Animated.Value(0.3)).current;
  const tagOp      = useRef(new Animated.Value(0)).current;
  const tagY       = useRef(new Animated.Value(14)).current;
  const lineW      = useRef(new Animated.Value(0)).current;
  const glowOp     = useRef(new Animated.Value(0)).current;

  // positions for the 4 letter groups (set after measurement)
  const rX    = useRef(new Animated.Value(0)).current;
  const zX    = useRef(new Animated.Value(0)).current;
  const entX  = useRef(new Animated.Value(0)).current;
  const illaX = useRef(new Animated.Value(0)).current;
  const entOp = useRef(new Animated.Value(0)).current;
  const illaOp = useRef(new Animated.Value(0)).current;
  const entSlide = useRef(new Animated.Value(12)).current; // small slide-in offset
  const illaSlide = useRef(new Animated.Value(12)).current;

  // ─── vertical center for letters ─────────────────────────────────────────────
  const letterTop = SH / 2 - FS * 0.58; // approx vertical center

  // ─── kick off the sequence once all widths are measured ──────────────────────
  function tryStart() {
    const m = measured.current;
    if (m.done < 4 || started.current) return;
    started.current = true;

    const { rW, entW, zW, illaW } = m;
    const totalW = rW + entW + zW + illaW;
    const INIT_GAP = 36; // gap between R and Z in the "R  Z" phase

    // Initial positions: R and Z centered with a gap
    const initRX  = SW / 2 - rW - INIT_GAP / 2;
    const initZX  = SW / 2 + INIT_GAP / 2;

    // Final positions: "RentZilla" word centered on screen
    const wordLeft = (SW - totalW) / 2;
    const finalRX   = wordLeft;
    const finalEntX = wordLeft + rW;
    const finalZX   = wordLeft + rW + entW;
    const finalIllaX = wordLeft + rW + entW + zW;

    // "ent" starts just to the right of R's initial position (moves with R group)
    const initEntX  = initRX + rW + 8; // slightly inward for slide-in feel
    const initIllaX = initZX + zW + 8;

    rX.setValue(initRX);
    zX.setValue(initZX);
    entX.setValue(initEntX);
    illaX.setValue(initIllaX);

    const easeOut = Easing.bezier(0.16, 1, 0.3, 1); // snappy ease-out (spring-like)

    Animated.sequence([
      // ── Phase 1 · Flip letters (800ms) ────────────────────────────────────────
      Animated.parallel([
        Animated.timing(flip,   { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
        Animated.timing(glowOp, { toValue: 1, duration: 600, useNativeDriver: ND }),
      ]),

      // ── Phase 2 · Hold "R  Z" (500ms) ─────────────────────────────────────────
      Animated.delay(500),

      // ── Phase 3 · Separate & reveal (800ms) ───────────────────────────────────
      Animated.parallel([
        // R glides to its final position (leftward)
        Animated.timing(rX, {
          toValue: finalRX, duration: 820,
          easing: easeOut, useNativeDriver: ND,
        }),
        // Z glides to its final position (rightward)
        Animated.timing(zX, {
          toValue: finalZX, duration: 820,
          easing: easeOut, useNativeDriver: ND,
        }),
        // "ent" tracks behind R and slides into place
        Animated.timing(entX, {
          toValue: finalEntX, duration: 820,
          easing: easeOut, useNativeDriver: ND,
        }),
        Animated.timing(entOp,    { toValue: 1, duration: 380, delay: 120, useNativeDriver: ND }),
        Animated.timing(entSlide, { toValue: 0, duration: 500, delay: 80,  easing: easeOut, useNativeDriver: ND }),
        // "illa" tracks behind Z and slides into place
        Animated.timing(illaX, {
          toValue: finalIllaX, duration: 820,
          easing: easeOut, useNativeDriver: ND,
        }),
        Animated.timing(illaOp,    { toValue: 1, duration: 380, delay: 120, useNativeDriver: ND }),
        Animated.timing(illaSlide, { toValue: 0, duration: 500, delay: 80,  easing: easeOut, useNativeDriver: ND }),
        // accent line expands
        Animated.timing(lineW, { toValue: 48, duration: 420, delay: 180, easing: easeOut, useNativeDriver: ND }),
        // tagline appears
        Animated.timing(tagOp, { toValue: 1, duration: 380, delay: 380, useNativeDriver: ND }),
        Animated.timing(tagY,  { toValue: 0,  duration: 440, delay: 320, easing: easeOut, useNativeDriver: ND }),
        // ripple burst
        Animated.sequence([
          Animated.timing(rippleOp,    { toValue: 0.55, duration: 80,  useNativeDriver: ND }),
          Animated.parallel([
            Animated.timing(rippleScale, { toValue: 2.8, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
            Animated.timing(rippleOp,    { toValue: 0,   duration: 650, useNativeDriver: ND }),
          ]),
        ]),
      ]),

      // ── Phase 4 · Hold "RentZilla" (1000ms) ───────────────────────────────────
      Animated.delay(1000),

      // ── Phase 5 · Fade to app / Sign In (500ms) ───────────────────────────────
      Animated.parallel([
        Animated.timing(screenOp, { toValue: 0, duration: 500, useNativeDriver: ND }),
        Animated.timing(glowOp,   { toValue: 0, duration: 350, useNativeDriver: ND }),
      ]),
    ]).start(() => onDone());
  }

  function measureLetter(key: "rW" | "entW" | "zW" | "illaW", w: number) {
    measured.current[key] = w;
    measured.current.done += 1;
    tryStart();
  }

  // ─── interpolations ──────────────────────────────────────────────────────────
  const rRotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "0deg"] });
  const zRotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["-180deg", "0deg"] });

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.root, { opacity: screenOp }]}>
      {/* Background */}
      <LinearGradient
        colors={["#060D1A", "#0F1F3D", "#080F1C"]}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient center glow */}
      <Animated.View style={[styles.ambientGlow, { opacity: glowOp }]} />

      {/* Ripple ring */}
      <Animated.View
        style={[
          styles.rippleRing,
          { opacity: rippleOp, transform: [{ scale: rippleScale }] },
        ]}
      />

      {/* ── Invisible measurement layer ────────────────────────────────────── */}
      <View style={styles.measureLayer} pointerEvents="none">
        <Text
          style={styles.letter}
          onLayout={(e) => measureLetter("rW", e.nativeEvent.layout.width)}
        >
          R
        </Text>
        <Text
          style={styles.letter}
          onLayout={(e) => measureLetter("entW", e.nativeEvent.layout.width)}
        >
          ent
        </Text>
        <Text
          style={styles.letter}
          onLayout={(e) => measureLetter("zW", e.nativeEvent.layout.width)}
        >
          Z
        </Text>
        <Text
          style={styles.letter}
          onLayout={(e) => measureLetter("illaW", e.nativeEvent.layout.width)}
        >
          illa
        </Text>
      </View>

      {/* ── R — absolutely positioned, flips in ────────────────────────────── */}
      <Animated.View
        style={[
          styles.letterWrap,
          { left: rX, top: letterTop },
          { transform: [{ perspective: 1000 }, { rotateY: rRotateY }] },
        ]}
      >
        <Text style={styles.letter}>R</Text>
      </Animated.View>

      {/* ── ent — slides in beside R ────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.letterWrap,
          {
            left: entX,
            top: letterTop,
            opacity: entOp,
            transform: [{ translateX: entSlide }],
          },
        ]}
      >
        <Text style={[styles.letter, styles.letterOrange]}>ent</Text>
      </Animated.View>

      {/* ── Z — absolutely positioned, flips in ────────────────────────────── */}
      <Animated.View
        style={[
          styles.letterWrap,
          { left: zX, top: letterTop },
          { transform: [{ perspective: 1000 }, { rotateY: zRotateY }] },
        ]}
      >
        <Text style={[styles.letter, styles.letterGold]}>Z</Text>
      </Animated.View>

      {/* ── illa — slides in beside Z ───────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.letterWrap,
          {
            left: illaX,
            top: letterTop,
            opacity: illaOp,
            transform: [{ translateX: illaSlide }],
          },
        ]}
      >
        <Text style={[styles.letter, styles.letterGold]}>illa</Text>
      </Animated.View>

      {/* ── Accent line ─────────────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.accentLine, { width: lineW, top: letterTop + FS * 1.15 + 18 }]}
      />

      {/* ── Tagline ─────────────────────────────────────────────────────────── */}
      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: tagOp,
            transform: [{ translateY: tagY }],
            top: letterTop + FS * 1.15 + 36,
          },
        ]}
      >
        Punjab's #1 Rental Marketplace
      </Animated.Text>

      {/* ── Bottom progress indicator ────────────────────────────────────────── */}
      <Animated.View style={[styles.dotRow, { opacity: tagOp }]}>
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
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
    backgroundColor: "rgba(255,122,24,0.07)",
    alignSelf: "center",
    top: SH * 0.5 - SW * 0.45,
  },
  rippleRing: {
    position: "absolute",
    width: SW * 0.55,
    height: SW * 0.55,
    borderRadius: SW * 0.275,
    borderWidth: 1.5,
    borderColor: "rgba(255,159,67,0.55)",
    alignSelf: "center",
    top: SH * 0.5 - SW * 0.275,
  },
  // invisible measurement layer — off-screen so no flicker
  measureLayer: {
    position: "absolute",
    top: -2000,
    left: 0,
    flexDirection: "row",
    opacity: 0,
  },
  letterWrap: {
    position: "absolute",
  },
  letter: {
    fontSize: FS,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    color: "#FF7A18",
    includeFontPadding: false,
    letterSpacing: -0.5,
  },
  letterOrange: {
    color: "#FF7A18",
  },
  letterGold: {
    color: "#FF9F43",
  },
  accentLine: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FF7A18",
    alignSelf: "center",
    left: SW / 2 - 24, // will be overridden by width animation centering
  },
  tagline: {
    position: "absolute",
    width: SW,
    textAlign: "center",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  dotRow: {
    position: "absolute",
    bottom: 52,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    alignSelf: "center",
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
