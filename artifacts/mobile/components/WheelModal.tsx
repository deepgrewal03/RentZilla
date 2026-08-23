import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, Animated, Easing,
  Dimensions, ScrollView, ActivityIndicator, Platform,
} from "react-native";
import Svg, { Path, Circle, G, Text as SvgText } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlowButton from "@/components/GlowButton";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { useRazorpay } from "@/hooks/useRazorpay";
import RazorpayCheckout from "@/components/RazorpayCheckout";

// ─── Audio Engine (Web Audio API) ─────────────────────────────────────────────

let _wheelAudioCtx: AudioContext | null = null;

function getWheelAudioCtx(): AudioContext | null {
  if (Platform.OS !== "web") return null;
  if (_wheelAudioCtx) return _wheelAudioCtx;
  const W = window as any;
  const AC = W.AudioContext || W.webkitAudioContext;
  if (!AC) return null;
  _wheelAudioCtx = new AC();
  return _wheelAudioCtx;
}

function resumeWheelCtx(): void {
  const ctx = getWheelAudioCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

/**
 * Short percussive tick. pitch 400–1400 Hz, louder and snappier at high speed.
 */
function playWheelTick(pitch: number, volume = 0.38): void {
  const ctx = getWheelAudioCtx();
  if (!ctx) return;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = Math.min(Math.max(pitch, 400), 1400);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
    osc.start(t);
    osc.stop(t + 0.052);
  } catch (_) {}
}

/**
 * Coin-toss reveal sound: sparkling C-major chord + three rapid dings.
 * Fires when the wheel lands on the result.
 */
function playCoinReveal(): void {
  const ctx = getWheelAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Chord tones (staggered)
    const chord = [
      { freq: 1047, delay: 0,    vol: 0.45, dur: 1.0 },
      { freq: 1319, delay: 0.06, vol: 0.30, dur: 0.85 },
      { freq: 1568, delay: 0.12, vol: 0.22, dur: 0.7 },
      { freq: 2093, delay: 0.18, vol: 0.11, dur: 0.5 },
    ];
    chord.forEach(({ freq, delay, vol, dur }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = now + delay;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    });
    // Rapid ding ding ding
    [0.38, 0.54, 0.68].forEach((delay, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 1047 + i * 262;
      const t0 = now + delay;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    });
  } catch (_) {}
}

/** Sad trombone-ish wobble for "Better Luck". */
function playBetterLuck(): void {
  const ctx = getWheelAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(330, now + 0.4);
    osc.frequency.linearRampToValueAtTime(262, now + 0.8);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc.start(now);
    osc.stop(now + 0.9);
  } catch (_) {}
}

// ─── Tick Scheduler ────────────────────────────────────────────────────────────
//
// Easing used: Easing.out(Easing.cubic) → y = 1 − (1−t)³
// Inverse      → t = 1 − ∛(1−y)
// Derivative   → dy/dt = 3·(1−t)²   (angular velocity, proportional)
//
// For each segment boundary crossing we:
//  1. Compute the normalised position y = crossAngle / totalDelta
//  2. Invert to get t → schedule setTimeout at t * duration
//  3. Compute angular velocity → map to pitch (fast = high, slow = low)
//  4. Play tick + haptic at that exact time

const SEGMENT_ANGLE = 360 / 7;       // 360 / N ≈ 51.43° (N=7, defined below but inlined here to avoid TDZ)

function scheduleWheelTicks(
  startAngle: number,
  totalDelta: number,
  duration: number,
): ReturnType<typeof setTimeout>[] {
  if (totalDelta <= 0) return [];

  const startCross = Math.ceil(startAngle / SEGMENT_ANGLE);
  const endCross   = Math.floor((startAngle + totalDelta) / SEGMENT_ANGLE);
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (let c = startCross; c <= endCross; c++) {
    const crossAngle = c * SEGMENT_ANGLE;
    const y = (crossAngle - startAngle) / totalDelta;  // 0 → 1
    if (y < 0 || y > 1) continue;

    // Invert Easing.out(Easing.cubic): t = 1 − cbrt(1 − y)
    const t     = 1 - Math.cbrt(1 - y);
    const timeMs = t * duration;

    // Angular velocity: d(position)/dt ∝ 3·(1−t)²
    const dydt  = 3 * Math.pow(1 - t, 2);
    const angVel = (totalDelta * dydt) / duration; // deg/ms

    // Pitch: ~1200 Hz at full speed (~10 deg/ms), down to ~450 Hz near stop
    const pitch  = 450 + Math.min(angVel * 75, 900);
    // Volume: slightly louder when faster
    const volume = 0.25 + Math.min(angVel * 0.04, 0.18);

    const timer = setTimeout(() => {
      playWheelTick(pitch, volume);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }, timeMs);

    timers.push(timer);
  }
  return timers;
}

const { width: SW, height: SH } = Dimensions.get("window");
const WHEEL_SIZE = Math.min(SW - 56, 290);
const CX = WHEEL_SIZE / 2;
const CY = WHEEL_SIZE / 2;
const R  = WHEEL_SIZE / 2 - 8;
const N  = 7;

const SEGMENTS = [
  { label: "5% OFF", sub: "on ₹100",  discount: 5,  type: "discount", fill: "#FFCCD5", stroke: "#FF8FA3", text: "#880018" },
  { label: "10% OFF", sub: "on ₹100", discount: 10, type: "discount", fill: "#FFE8C0", stroke: "#FFBA4D", text: "#7A3D00" },
  { label: "15% OFF", sub: "on ₹100", discount: 15, type: "discount", fill: "#FEFFC0", stroke: "#E0DC00", text: "#5A5000" },
  { label: "20% OFF", sub: "on ₹100", discount: 20, type: "discount", fill: "#C8F5C8", stroke: "#48C748", text: "#1A5A1A" },
  { label: "25% OFF", sub: "on ₹100", discount: 25, type: "discount", fill: "#BFF0FF", stroke: "#2ECBF5", text: "#0A5A75" },
  { label: "30% OFF", sub: "on ₹100", discount: 30, type: "discount", fill: "#E0D0FF", stroke: "#9D6FFF", text: "#3D0099" },
  { label: "Better\nLuck!", sub: "",   discount: 0,  type: "none",     fill: "#F2F2F2", stroke: "#C8C8C8", text: "#666666" },
];

function segPath(i: number): string {
  const step = (2 * Math.PI) / N;
  const a1 = -Math.PI / 2 + i * step;
  const a2 = a1 + step;
  const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
  const x2 = CX + R * Math.cos(a2), y2 = CY + R * Math.sin(a2);
  return `M ${CX.toFixed(1)} ${CY.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

function textPos(i: number): { x: number; y: number; rot: number } {
  const step = (2 * Math.PI) / N;
  const mid = -Math.PI / 2 + (i + 0.5) * step;
  const tr = R * 0.63;
  return { x: CX + tr * Math.cos(mid), y: CY + tr * Math.sin(mid), rot: (mid * 180) / Math.PI + 90 };
}

// Pre-build confetti particles (stable refs)
const CONF_COLORS = ["#FF7A18", "#FFD700", "#FF6B9D", "#00BFFF", "#7CFC00", "#FF4500", "#9370DB", "#FF1493"];
const CONF_N = 28;
const confParticles = Array.from({ length: CONF_N }, (_, i) => ({
  y:    new Animated.Value(-30),
  op:   new Animated.Value(1),
  color: CONF_COLORS[i % CONF_COLORS.length],
  size:  6 + (i % 5) * 2,
  xPos:  (i * 43) % SW,
  delay: (i * 55) % 500,
}));

interface WheelStatus {
  canFreeSpin: boolean;
  nextFreeSpinAt: string | null;
  hoursUntilFree: number;
  paidSpinBalance: number;
  paidSpinPrice: number;
  isGoldMember: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function WheelModal({ visible, onClose }: Props) {
  const { user } = useAuth();
  const { get, post } = useApi();
  const { initiatePayment, checkout, clearCheckout, loading: rzLoading } = useRazorpay();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const spinAnim     = useRef(new Animated.Value(0)).current;
  const curAngle     = useRef(0);
  const spinRef      = useRef<Animated.CompositeAnimation | null>(null);
  const tickTimers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [status,    setStatus]    = useState<WheelStatus | null>(null);
  const [spinning,  setSpinning]  = useState(false);
  const [result,    setResult]    = useState<{ label: string; discount: number; type: string } | null>(null);
  const [confetti,  setConfetti]  = useState(false);
  const [buying,    setBuying]    = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const rotation = spinAnim.interpolate({
    inputRange: [0, 360], outputRange: ["0deg", "360deg"], extrapolate: "extend",
  });

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await get<WheelStatus>("/wheel/status");
      setStatus(data);
    } catch {
      setError("Could not load wheel status");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    if (visible && user) {
      loadStatus(); setResult(null); setConfetti(false); setError("");
    }
    if (!visible) {
      // Clear any scheduled ticks when the modal is dismissed
      tickTimers.current.forEach(clearTimeout);
      tickTimers.current = [];
    }
  }, [visible, user]);

  function launchConfetti() {
    setConfetti(true);
    confParticles.forEach(p => {
      p.y.setValue(-30); p.op.setValue(1);
      p.xPos = Math.random() * SW;
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.y, { toValue: SH * 0.65, duration: 1900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0, duration: 1900, useNativeDriver: true }),
        ]),
      ]).start();
    });
    setTimeout(() => setConfetti(false), 2400);
  }

  function doSpin(segIndex: number) {
    const SPIN_DURATION = 4200;

    // Clear any leftover tick timers from a previous spin
    tickTimers.current.forEach(clearTimeout);
    tickTimers.current = [];

    // Land segment i under the pointer (top).
    // Rotating CW by X moves what was at (360-X) to the top.
    const target = 360 - (2 * segIndex + 1) * 180 / N;
    let delta = target - (curAngle.current % 360);
    if (delta <= 0) delta += 360;
    const totalDelta = delta + 5 * 360;
    const finalAngle = curAngle.current + totalDelta;

    // Schedule tick sounds at every segment crossing using the easing inverse
    tickTimers.current = scheduleWheelTicks(curAngle.current, totalDelta, SPIN_DURATION);

    curAngle.current = finalAngle;
    spinRef.current = Animated.timing(spinAnim, {
      toValue: finalAngle, duration: SPIN_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    spinRef.current.start();
  }

  async function spin(type: "free" | "paid") {
    if (spinning) return;
    setSpinning(true); setResult(null); setError("");

    // Unlock AudioContext on user gesture (required by browsers)
    resumeWheelCtx();

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const endpoint = type === "free" ? "/wheel/free-spin" : "/wheel/paid-spin";
      const data = await post<{ segmentIndex: number; reward: { label: string; discountValue: number; type: string } }>(endpoint, undefined);
      doSpin(data.segmentIndex);

      // Reveal result after animation completes
      setTimeout(() => {
        setResult({ label: data.reward.label, discount: data.reward.discountValue, type: data.reward.type });
        setSpinning(false);

        if (data.reward.type === "discount") {
          playCoinReveal();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          launchConfetti();
        } else {
          playBetterLuck();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        loadStatus();
      }, 4400);
    } catch (err: any) {
      // Clear scheduled ticks on error
      tickTimers.current.forEach(clearTimeout);
      tickTimers.current = [];
      setError(err?.message || "Spin failed. Please try again.");
      setSpinning(false);
    }
  }

  async function buySpin() {
    if (buying || spinning || rzLoading) return;
    setBuying(true); setError("");
    try {
      await initiatePayment({
        purpose: "wheel_spin",
        description: "Wheel of Fortune Spin — ₹1",
        onSuccess: async () => {
          await loadStatus();
          setBuying(false);
        },
        onError: (msg) => {
          setError(msg);
          setBuying(false);
        },
        onDismiss: () => {
          setBuying(false);
        },
      });
    } catch (err: any) {
      setError(err?.message || "Purchase failed. Please try again.");
      setBuying(false);
    }
  }

  const canSpin    = status?.canFreeSpin || (status?.paidSpinBalance ?? 0) > 0;
  const canBuyMore = !status?.canFreeSpin;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={!spinning ? onClose : undefined}>
      <View style={s.overlay}>
        {/* Confetti */}
        {confetti && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {confParticles.map((p, i) => (
              <Animated.View key={i} style={{
                position: "absolute", left: p.xPos,
                width: p.size, height: p.size, borderRadius: p.size / 2,
                backgroundColor: p.color,
                transform: [{ translateY: p.y }], opacity: p.op,
              }} />
            ))}
          </View>
        )}

        <View style={s.sheet}>
          {/* Header */}
          <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.hTitle}>🎡 Wheel of Fortune</Text>
              <Text style={s.hSub}>Spin to win discount promos!</Text>
            </View>
            {!spinning && (
              <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            )}
          </LinearGradient>

          <ScrollView contentContainerStyle={[s.body, { paddingBottom: 40 + bottomInset }]} showsVerticalScrollIndicator={false} bounces={false}>
            {loading ? (
              <View style={s.loadWrap}><ActivityIndicator size="large" color="#FF7A18" /></View>
            ) : (
              <>
                {/* Status badges */}
                {status && (
                  <View style={s.badges}>
                    {status.canFreeSpin ? (
                      <View style={[s.badge, { backgroundColor: "#E8F8E8", borderColor: "#48C748" }]}>
                        <Ionicons name="gift-outline" size={13} color="#1A6A1A" />
                        <Text style={[s.badgeTxt, { color: "#1A6A1A" }]}>Free spin ready!</Text>
                      </View>
                    ) : (
                      <View style={[s.badge, { backgroundColor: "#FFF3E0", borderColor: "#FFB74D" }]}>
                        <Ionicons name="time-outline" size={13} color="#7A3D00" />
                        <Text style={[s.badgeTxt, { color: "#7A3D00" }]}>Free again tomorrow</Text>
                      </View>
                    )}
                    {(status.paidSpinBalance ?? 0) > 0 && (
                      <View style={[s.badge, { backgroundColor: "#F3E8FF", borderColor: "#9D6FFF" }]}>
                        <Ionicons name="ticket-outline" size={13} color="#4A0099" />
                        <Text style={[s.badgeTxt, { color: "#4A0099" }]}>{status.paidSpinBalance} extra spin{status.paidSpinBalance !== 1 ? "s" : ""}</Text>
                      </View>
                    )}
                    {status.isGoldMember && (
                      <View style={[s.badge, { backgroundColor: "#FFF8DC", borderColor: "#F5C518" }]}>
                        <Text style={[s.badgeTxt, { color: "#8B6914" }]}>✦ Gold odds</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Wheel */}
                <View style={s.wheelOuter}>
                  {/* Glow ring */}
                  <View style={[s.glow, {
                    width: WHEEL_SIZE + 20, height: WHEEL_SIZE + 20,
                    borderRadius: (WHEEL_SIZE + 20) / 2,
                    top: -10, left: -10,
                  }]} />

                  <Animated.View style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, transform: [{ rotate: rotation }] }}>
                    <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
                      {SEGMENTS.map((seg, i) => {
                        const tp = textPos(i);
                        const mainLines = seg.label.split("\n");
                        const hasSub = seg.sub && seg.sub.length > 0;
                        const mainLH = 10;   // px between main lines
                        const subGap = 9;    // extra gap before sub line
                        const totalH = (mainLines.length - 1) * mainLH + (hasSub ? subGap : 0);
                        const baseY = tp.y - totalH / 2;
                        const rot = `rotate(${tp.rot.toFixed(1)}, ${tp.x.toFixed(1)}, ${tp.y.toFixed(1)})`;
                        const mainSize = mainLines.length === 1 ? 11 : 9.5;
                        return (
                          <G key={i}>
                            <Path d={segPath(i)} fill={seg.fill} stroke={seg.stroke} strokeWidth={1.5} />
                            {/* Main label lines */}
                            {mainLines.map((line, li) => (
                              <SvgText
                                key={`m${li}`}
                                x={tp.x} y={baseY + li * mainLH}
                                fill={seg.text}
                                fontSize={mainSize}
                                fontWeight="800"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                transform={rot}
                              >
                                {line}
                              </SvgText>
                            ))}
                            {/* Sub-label: "on ₹100" */}
                            {hasSub && (
                              <SvgText
                                x={tp.x}
                                y={baseY + (mainLines.length - 1) * mainLH + subGap}
                                fill={seg.text}
                                fontSize={7}
                                fontWeight="600"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                opacity={0.75}
                                transform={rot}
                              >
                                {seg.sub}
                              </SvgText>
                            )}
                          </G>
                        );
                      })}
                      <Circle cx={CX} cy={CY} r={22} fill="#FF7A18" stroke="#fff" strokeWidth={3} />
                      <Circle cx={CX} cy={CY} r={16} fill="#FF9F43" />
                      <SvgText x={CX} y={CY + 1} fill="#fff" fontSize={8} fontWeight="900" textAnchor="middle" alignmentBaseline="middle">SPIN</SvgText>
                    </Svg>
                  </Animated.View>

                  {/* Pointer */}
                  <View style={[s.pointer, { left: WHEEL_SIZE / 2 - 10 }]}>
                    <Svg width={20} height={24}>
                      <Path d="M 10 24 L 0 2 L 20 2 Z" fill="#FF7A18" />
                      <Path d="M 10 18 L 3 5 L 17 5 Z" fill="#FFD54F" />
                    </Svg>
                  </View>
                </View>

                {/* Result */}
                {result && (
                  <View style={[s.result, result.type === "discount" ? s.resultWin : s.resultLose]}>
                    {result.type === "discount" ? (
                      <>
                        <Text style={s.resultWinEmoji}>🎉</Text>
                        <Text style={s.resultWinTitle}>You won {result.discount}% OFF!</Text>
                        <Text style={s.resultWinSub}>Applies to first ₹100 of your next booking</Text>
                        <View style={s.resultTag}>
                          <Ionicons name="shield-checkmark" size={12} color="#1A6A1A" />
                          <Text style={s.resultTagTxt}>Saved to Promo Vault · Valid 30 days</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={{ fontSize: 28 }}>😔</Text>
                        <Text style={s.resultLoseTitle}>Better Luck Next Time!</Text>
                        <Text style={s.resultLoseSub}>Your free spin resets tomorrow. Try a paid spin!</Text>
                      </>
                    )}
                  </View>
                )}

                {error ? (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle-outline" size={15} color="#C0392B" />
                    <Text style={s.errorTxt}>{error}</Text>
                  </View>
                ) : null}

                {/* Buttons */}
                {status && !spinning && (
                  <View style={s.actions}>
                    {status.canFreeSpin && (
                      <GlowButton
                        title="Spin Free!"
                        color="#FF7A18"
                        onPress={() => spin("free")}
                        iconLeft={<Ionicons name="refresh-circle" size={22} color="#fff" />}
                        fullWidth
                        height={52}
                        fontSize={16}
                        borderRadius={14}
                        glowStrength={0.65}
                        style={{ marginBottom: 10 }}
                      />
                    )}

                    {!status.canFreeSpin && (status.paidSpinBalance ?? 0) > 0 && (
                      <GlowButton
                        title={`Use Paid Spin (${status.paidSpinBalance} left)`}
                        color="#6C3AFF"
                        onPress={() => spin("paid")}
                        iconLeft={<Ionicons name="ticket" size={22} color="#fff" />}
                        fullWidth
                        height={52}
                        fontSize={15}
                        borderRadius={14}
                        glowStrength={0.65}
                        style={{ marginBottom: 10 }}
                      />
                    )}

                    {canBuyMore && (
                      <GlowButton
                        title="Buy Extra Spin · ₹1"
                        color="#FF7A18"
                        onPress={buySpin}
                        loading={buying}
                        disabled={buying}
                        iconLeft={<Ionicons name="add-circle-outline" size={18} color="#fff" />}
                        fullWidth
                        height={44}
                        fontSize={14}
                        borderRadius={12}
                        glowStrength={0.45}
                        style={{ marginBottom: 8 }}
                      />
                    )}

                    <Text style={s.freeNote}>
                      {status.canFreeSpin ? "✓ 1 free spin per day" : "Need another spin? Only ₹1 via Razorpay"}
                    </Text>
                  </View>
                )}

                {spinning && (
                  <View style={s.spinningRow}>
                    <Text style={s.spinningTxt}>🎡 Spinning…</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
      {/* Razorpay checkout — rendered outside ScrollView per modal rule */}
      {checkout && (
        <RazorpayCheckout
          visible={checkout.visible}
          orderId={checkout.orderId}
          amount={checkout.amount}
          keyId={checkout.keyId}
          prefill={checkout.prefill}
          description={checkout.description}
          onSuccess={checkout.onSuccess}
          onDismiss={checkout.onDismiss}
        />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", maxHeight: SH * 0.93 },
  header:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  hTitle:  { fontSize: 18, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  hSub:    { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2, fontFamily: "Inter_400Regular" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  body:    { alignItems: "center", paddingBottom: 40, paddingTop: 8 },
  loadWrap:{ paddingVertical: 80, alignItems: "center" },

  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingHorizontal: 16, marginBottom: 12, marginTop: 8 },
  badge:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  badgeTxt: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  wheelOuter: { position: "relative", alignItems: "center", justifyContent: "center", marginVertical: 12 },
  glow: { position: "absolute", backgroundColor: "rgba(255,154,50,0.18)", shadowColor: "#FF9F43", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 0 },
  pointer:  { position: "absolute", top: -14 },

  result: { marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: 18, alignItems: "center", gap: 4, width: SW - 40 },
  resultWin: { backgroundColor: "#E8F8E8", borderWidth: 1.5, borderColor: "#48C748" },
  resultLose: { backgroundColor: "#F8F8F8", borderWidth: 1.5, borderColor: "#C8C8C8" },
  resultWinEmoji: { fontSize: 30 },
  resultWinTitle: { fontSize: 18, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#1A5A1A" },
  resultWinSub:   { fontSize: 12, color: "#2A7A2A", fontFamily: "Inter_400Regular" },
  resultTag: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, backgroundColor: "rgba(72,199,72,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  resultTagTxt: { fontSize: 11, color: "#1A6A1A", fontFamily: "Inter_600SemiBold" },
  resultLoseTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#555" },
  resultLoseSub:   { fontSize: 12, color: "#888", fontFamily: "Inter_400Regular" },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, margin: 16, padding: 12, backgroundColor: "#FFF0EE", borderRadius: 12, borderWidth: 1, borderColor: "#F5C6C0" },
  errorTxt: { fontSize: 13, color: "#C0392B", fontFamily: "Inter_400Regular", flex: 1 },

  actions: { width: "100%", paddingHorizontal: 20, gap: 10, marginTop: 12 },
  spinBtn: { borderRadius: 16, overflow: "hidden", shadowColor: "#FF7A18", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  spinBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  spinBtnTxt: { fontSize: 16, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14, borderWidth: 2, borderColor: "#FF7A18", backgroundColor: "#FFF5EE" },
  buyBtnTxt: { fontSize: 14, fontWeight: "700", color: "#FF7A18", fontFamily: "Inter_700Bold" },
  freeNote: { textAlign: "center", fontSize: 12, color: "#AEAEAE", fontFamily: "Inter_400Regular", marginTop: 4 },
  spinningRow: { paddingVertical: 16, alignItems: "center" },
  spinningTxt: { fontSize: 16, color: "#FF7A18", fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
