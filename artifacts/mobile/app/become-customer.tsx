import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;
const TINT = "#FF7A18";

type Step = "intro" | "otp" | "success";

const STEP_LABELS = ["Intro", "Verify", "Done"];

function StepBar({ step }: { step: Step }) {
  const idx = ["intro", "otp", "success"].indexOf(step);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(progress, { toValue: idx / 2, useNativeDriver: false, tension: 80, friction: 12 }).start();
  }, [idx]);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View>
      <View style={ss.progressTrack}>
        <Animated.View style={[ss.progressFill, { width }]} />
      </View>
      <View style={ss.stepsRow}>
        {STEP_LABELS.map((label, i) => {
          const done   = i < idx;
          const active = i === idx;
          return (
            <React.Fragment key={label}>
              <View style={ss.stepItem}>
                <View style={[ss.dot, active && ss.dotActive, done && ss.dotDone]}>
                  {done ? (
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  ) : (
                    <Text style={[ss.dotNum, active && ss.dotNumActive]}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[ss.dotLabel, active && ss.dotLabelActive]}>{label}</Text>
              </View>
              {i < 2 && <View style={[ss.dotLine, done && ss.dotLineDone]} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  progressTrack: { height: 3, backgroundColor: C.borderLight },
  progressFill: { height: 3, backgroundColor: TINT },
  stepsRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12, gap: 0 },
  stepItem: { alignItems: "center", gap: 4 },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: C.border,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  dotActive: { borderColor: TINT, backgroundColor: `${TINT}18` },
  dotDone: { backgroundColor: TINT, borderColor: TINT },
  dotNum: { fontSize: 10, fontWeight: "700", color: C.textTertiary },
  dotNumActive: { color: TINT },
  dotLabel: { fontSize: 9, color: C.textTertiary, fontFamily: "Inter_500Medium" },
  dotLabelActive: { color: TINT, fontWeight: "700" },
  dotLine: { flex: 1, height: 2, backgroundColor: C.borderLight, marginTop: 10 },
  dotLineDone: { backgroundColor: TINT },
});

export default function BecomeCustomerScreen() {
  const { refreshUser, setActiveMode } = useAuth();
  const { post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;

  const [step, setStep] = useState<Step>("intro");

  const [sending, setSending]     = useState(false);
  const [devOtp, setDevOtp]       = useState<string | null>(null);
  const [otp, setOtp]             = useState("");
  const [otpTimer, setOtpTimer]   = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp">("sms");
  const timerRef = useRef<any>(null);

  function startTimer() {
    setOtpTimer(60);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  async function sendOtp() {
    setSending(true);
    try {
      const res = await post<{ otp: string; expiresAt: string }>("/roles/send-otp", { purpose: "role_upgrade" });
      setDevOtp(res.otp);
      startTimer();
      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send OTP");
    } finally { setSending(false); }
  }

  async function verifyAndUpgrade() {
    if (otp.length !== 6) { Alert.alert("Error", "Enter the 6-digit OTP"); return; }
    setVerifying(true);
    try {
      await post("/roles/verify-otp", { code: otp, purpose: "role_upgrade" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await submitUpgrade();
    } catch (e: any) {
      Alert.alert("Incorrect OTP", e.message || "Please try again");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setVerifying(false); }
  }

  async function submitUpgrade() {
    setSubmitting(true);
    try {
      await post("/roles/upgrade", { targetRole: "customer" });
      await refreshUser();
      await setActiveMode("customer");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("success");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Submission failed. Please try again.");
    } finally { setSubmitting(false); }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={() => {
            if (step === "intro") router.back();
            else if (step === "otp") setStep("intro");
            else router.replace("/(tabs)");
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Become a Customer</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepBar step={step} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 24 }]}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Step 1: Intro ── */}
          {step === "intro" && (
            <View style={styles.section}>
              <View style={styles.iconCircle}>
                <Ionicons name="person-circle-outline" size={48} color={TINT} />
              </View>
              <Text style={styles.stepTitle}>Enable Customer Mode</Text>
              <Text style={styles.stepSubtitle}>
                Add a customer account to your provider profile and enjoy both sides of RentZilla.
              </Text>

              <View style={styles.benefitsCard}>
                {[
                  { icon: "🔍", title: "Browse Listings",    desc: "Discover equipment, services and cars from other providers" },
                  { icon: "📅", title: "Make Bookings",      desc: "Book anything with a few taps — no calls needed" },
                  { icon: "⭐", title: "Leave Reviews",      desc: "Rate providers and help your community" },
                  { icon: "🔔", title: "Stay Updated",       desc: "Get real-time updates on your bookings and offers" },
                ].map((b) => (
                  <View key={b.title} style={styles.benefitRow}>
                    <Text style={styles.benefitIcon}>{b.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.benefitTitle}>{b.title}</Text>
                      <Text style={styles.benefitDesc}>{b.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.noteBox}>
                <Ionicons name="information-circle-outline" size={18} color={TINT} />
                <Text style={styles.noteText}>
                  Your own listings will not appear in your customer feed. You can switch between Customer and Provider mode anytime.
                </Text>
              </View>

              <Text style={[styles.noteText, { marginTop: 8, textAlign: "center" }]}>
                We'll send a verification code to confirm your identity.
              </Text>

              {/* OTP Channel Selector */}
              <View style={styles.channelCard}>
                <Text style={styles.channelLabel}>Receive OTP via</Text>
                <View style={styles.channelRow}>
                  <Pressable
                    onPress={() => { setOtpChannel("sms"); Haptics.selectionAsync(); }}
                    style={[styles.channelBtn, otpChannel === "sms" && styles.channelBtnActive]}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={otpChannel === "sms" ? "#fff" : TINT} />
                    <Text style={[styles.channelBtnText, otpChannel === "sms" && styles.channelBtnTextActive]}>SMS</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setOtpChannel("whatsapp"); Haptics.selectionAsync(); }}
                    style={[styles.channelBtn, otpChannel === "whatsapp" && styles.channelBtnActive]}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color={otpChannel === "whatsapp" ? "#fff" : "#25D366"} />
                    <Text style={[styles.channelBtnText, otpChannel === "whatsapp" && styles.channelBtnTextActive]}>WhatsApp</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={sendOtp} disabled={sending} style={styles.primaryBtn}>
                {sending ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <View style={styles.section}>
              <View style={styles.iconCircle}>
                <Ionicons name="keypad-outline" size={48} color={TINT} />
              </View>
              <Text style={styles.stepTitle}>Verify Your Identity</Text>
              <Text style={styles.stepSubtitle}>Enter the 6-digit verification code.</Text>

              {devOtp && (
                <View style={styles.devBox}>
                  <Ionicons name="bug-outline" size={16} color="#F59E0B" />
                  <Text style={styles.devText}>Dev OTP: <Text style={styles.devCode}>{devOtp}</Text></Text>
                </View>
              )}

              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="● ● ● ● ● ●"
                placeholderTextColor={C.textTertiary}
                textAlign="center"
              />

              <Pressable
                onPress={verifyAndUpgrade}
                disabled={verifying || submitting || otp.length !== 6}
                style={[styles.primaryBtn, otp.length !== 6 && styles.btnDisabled]}
              >
                {(verifying || submitting) ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Verify & Enable Customer</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={otpTimer > 0 ? undefined : sendOtp}
                disabled={otpTimer > 0 || sending}
                style={styles.resendBtn}
              >
                <Text style={[styles.resendText, otpTimer > 0 && { color: C.textTertiary }]}>
                  {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Resend code"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 3: Success ── */}
          {step === "success" && (
            <View style={[styles.section, { alignItems: "center", paddingTop: 40 }]}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark-circle" size={72} color="#22C55E" />
              </View>
              <Text style={styles.successTitle}>You're now a Customer too!</Text>
              <Text style={styles.successSubtitle}>
                Your account now has both Customer and Provider access. Use the mode switcher at the top of the home screen to switch anytime.
              </Text>

              <View style={styles.successTips}>
                {[
                  { icon: "person-outline",    text: "Switch to Customer mode to browse & book" },
                  { icon: "briefcase-outline", text: "Switch to Provider mode to manage your listings" },
                  { icon: "eye-off-outline",   text: "Your own listings are hidden from your customer feed" },
                ].map((tip) => (
                  <View key={tip.text} style={styles.tipRow}>
                    <View style={styles.tipIcon}>
                      <Ionicons name={tip.icon as any} size={16} color={TINT} />
                    </View>
                    <Text style={styles.tipText}>{tip.text}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.replace("/(tabs)/");
                }}
              >
                <Ionicons name="home-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Go to Customer Home</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },

  section: { gap: 16 },

  iconCircle: {
    alignSelf: "center", width: 90, height: 90, borderRadius: 45,
    backgroundColor: `${TINT}12`, borderWidth: 2, borderColor: `${TINT}25`,
    alignItems: "center", justifyContent: "center",
  },
  stepTitle: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  stepSubtitle: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  benefitsCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  benefitIcon: { fontSize: 22, lineHeight: 28 },
  benefitTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  benefitDesc: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },

  noteBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: `${TINT}0D`, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: `${TINT}22`,
  },
  noteText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 19, flex: 1 },

  channelCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10,
    borderWidth: 1, borderColor: C.borderLight,
  },
  channelLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  channelRow: { flexDirection: "row", gap: 10 },
  channelBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 10, paddingVertical: 10, borderWidth: 2, borderColor: C.borderLight, backgroundColor: "#F9FAFB",
  },
  channelBtnActive: { borderColor: TINT, backgroundColor: TINT },
  channelBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: TINT },
  channelBtnTextActive: { color: "#fff" },

  devBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FDE68A" },
  devText: { fontSize: 13, color: C.text, fontFamily: "Inter_400Regular" },
  devCode: { fontFamily: "Inter_700Bold", color: "#D97706", letterSpacing: 2 },

  otpInput: {
    alignSelf: "center", width: 220, height: 64, borderRadius: 14,
    backgroundColor: "#fff", borderWidth: 2, borderColor: C.border,
    fontSize: 28, letterSpacing: 12, fontFamily: "Inter_700Bold", color: C.text,
    textAlign: "center",
  },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: TINT, borderRadius: 14, paddingVertical: 15,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  btnDisabled: { opacity: 0.5 },

  resendBtn: { alignSelf: "center", paddingVertical: 8 },
  resendText: { fontSize: 14, color: TINT, fontFamily: "Inter_500Medium" },

  successCircle: { alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successTitle: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  successSubtitle: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 23 },

  successTips: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: C.borderLight, width: "100%",
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tipIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: `${TINT}12`, alignItems: "center", justifyContent: "center",
  },
  tipText: { flex: 1, fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
