import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, Animated, Easing,
  Dimensions, ScrollView, ActivityIndicator,
} from "react-native";
import Svg, { Path, Circle, G, Text as SvgText } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

const { width: SW, height: SH } = Dimensions.get("window");
const WHEEL_SIZE = Math.min(SW - 56, 290);
const CX = WHEEL_SIZE / 2;
const CY = WHEEL_SIZE / 2;
const R  = WHEEL_SIZE / 2 - 8;
const N  = 7;

const SEGMENTS = [
  { label: "5% OFF",    discount: 5,  type: "discount", fill: "#FFCCD5", stroke: "#FF8FA3", text: "#880018" },
  { label: "10% OFF",   discount: 10, type: "discount", fill: "#FFE8C0", stroke: "#FFBA4D", text: "#7A3D00" },
  { label: "15% OFF",   discount: 15, type: "discount", fill: "#FEFFC0", stroke: "#E0DC00", text: "#5A5000" },
  { label: "20% OFF",   discount: 20, type: "discount", fill: "#C8F5C8", stroke: "#48C748", text: "#1A5A1A" },
  { label: "25% OFF",   discount: 25, type: "discount", fill: "#BFF0FF", stroke: "#2ECBF5", text: "#0A5A75" },
  { label: "30% OFF",   discount: 30, type: "discount", fill: "#E0D0FF", stroke: "#9D6FFF", text: "#3D0099" },
  { label: "Better\nLuck", discount: 0, type: "none",  fill: "#F2F2F2", stroke: "#C8C8C8", text: "#666666" },
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

  const spinAnim    = useRef(new Animated.Value(0)).current;
  const curAngle    = useRef(0);
  const spinRef     = useRef<Animated.CompositeAnimation | null>(null);

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
    if (visible && user) { loadStatus(); setResult(null); setConfetti(false); setError(""); }
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
    // Compute target: segment i lands at pointer = (2i+1)*180/7 mod 360
    const target = (2 * segIndex + 1) * 180 / N;
    let delta = target - (curAngle.current % 360);
    if (delta <= 0) delta += 360;
    const finalAngle = curAngle.current + delta + 5 * 360;
    curAngle.current = finalAngle;
    spinRef.current = Animated.timing(spinAnim, {
      toValue: finalAngle, duration: 4200, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    spinRef.current.start();
  }

  async function spin(type: "free" | "paid") {
    if (spinning) return;
    setSpinning(true); setResult(null); setError("");
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const endpoint = type === "free" ? "/wheel/free-spin" : "/wheel/paid-spin";
      const data = await post<{ segmentIndex: number; reward: { label: string; discountValue: number; type: string } }>(endpoint);
      doSpin(data.segmentIndex);
      setTimeout(() => {
        setResult({ label: data.reward.label, discount: data.reward.discountValue, type: data.reward.type });
        setSpinning(false);
        if (data.reward.type === "discount") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          launchConfetti();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        loadStatus();
      }, 4400);
    } catch (err: any) {
      setError(err?.message || "Spin failed. Please try again.");
      setSpinning(false);
    }
  }

  async function buySpin() {
    if (buying || spinning) return;
    setBuying(true); setError("");
    try {
      const data = await post<{ message: string; paidSpinBalance: number }>("/wheel/buy-spin");
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || "Purchase failed. Check your wallet balance.");
    } finally {
      setBuying(false);
    }
  }

  function formatCountdown(iso: string): string {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "now";
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
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

          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} bounces={false}>
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
                        <Text style={[s.badgeTxt, { color: "#7A3D00" }]}>
                          Next free in {status.nextFreeSpinAt ? formatCountdown(status.nextFreeSpinAt) : `${status.hoursUntilFree}h`}
                        </Text>
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
                        const lines = seg.label.split("\n");
                        return (
                          <G key={i}>
                            <Path d={segPath(i)} fill={seg.fill} stroke={seg.stroke} strokeWidth={1.5} />
                            {lines.length === 1 ? (
                              <SvgText
                                x={tp.x} y={tp.y}
                                fill={seg.text}
                                fontSize={i === 6 ? 9.5 : 11}
                                fontWeight="800"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                transform={`rotate(${tp.rot.toFixed(1)}, ${tp.x.toFixed(1)}, ${tp.y.toFixed(1)})`}
                              >
                                {seg.label}
                              </SvgText>
                            ) : (
                              <>
                                <SvgText
                                  x={tp.x} y={tp.y - 6}
                                  fill={seg.text} fontSize={9.5} fontWeight="800"
                                  textAnchor="middle" alignmentBaseline="middle"
                                  transform={`rotate(${tp.rot.toFixed(1)}, ${tp.x.toFixed(1)}, ${tp.y.toFixed(1)})`}
                                >
                                  {lines[0]}
                                </SvgText>
                                <SvgText
                                  x={tp.x} y={tp.y + 6}
                                  fill={seg.text} fontSize={9.5} fontWeight="800"
                                  textAnchor="middle" alignmentBaseline="middle"
                                  transform={`rotate(${tp.rot.toFixed(1)}, ${tp.x.toFixed(1)}, ${tp.y.toFixed(1)})`}
                                >
                                  {lines[1]}
                                </SvgText>
                              </>
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
                        <Text style={s.resultLoseTitle}>Better luck next time!</Text>
                        <Text style={s.resultLoseSub}>Free spin resets in 24 hours</Text>
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
                      <Pressable onPress={() => spin("free")} style={s.spinBtn}>
                        <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.spinBtnGrad}>
                          <Ionicons name="refresh-circle" size={22} color="#fff" />
                          <Text style={s.spinBtnTxt}>Spin Free!</Text>
                        </LinearGradient>
                      </Pressable>
                    )}

                    {!status.canFreeSpin && (status.paidSpinBalance ?? 0) > 0 && (
                      <Pressable onPress={() => spin("paid")} style={s.spinBtn}>
                        <LinearGradient colors={["#6C3AFF", "#9D6FFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.spinBtnGrad}>
                          <Ionicons name="ticket" size={22} color="#fff" />
                          <Text style={s.spinBtnTxt}>Use Paid Spin ({status.paidSpinBalance} left)</Text>
                        </LinearGradient>
                      </Pressable>
                    )}

                    {canBuyMore && (
                      <Pressable onPress={buySpin} disabled={buying} style={[s.buyBtn, buying && { opacity: 0.6 }]}>
                        {buying ? (
                          <ActivityIndicator size="small" color="#FF7A18" />
                        ) : (
                          <>
                            <Ionicons name="add-circle-outline" size={18} color="#FF7A18" />
                            <Text style={s.buyBtnTxt}>Buy Extra Spin · ₹0.99</Text>
                          </>
                        )}
                      </Pressable>
                    )}

                    <Text style={s.freeNote}>
                      {status.canFreeSpin ? "✓ 1 free spin per day" : "Need another spin? Only ₹0.99 from wallet"}
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
