import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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

const VEHICLE_TYPES = ["Car", "SUV", "Van", "Truck", "Bus", "Motorcycle", "Auto-Rickshaw", "Tractor"];

type Step = "intro" | "otp" | "form" | "success";

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
      {done && <Ionicons name="checkmark" size={12} color="#fff" />}
    </View>
  );
}

export default function BecomeProviderScreen() {
  const { user, updateUser, refreshUser } = useAuth();
  const { post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;

  const [step, setStep] = useState<Step>("intro");

  // OTP
  const [sending, setSending] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef<any>(null);

  // Form
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("Car");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const stepNum = step === "intro" ? 0 : step === "otp" ? 1 : step === "form" ? 2 : 3;
    Animated.spring(progress, { toValue: stepNum / 3, useNativeDriver: false, tension: 80, friction: 12 }).start();
  }, [step]);

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

  async function verifyOtp() {
    if (otp.length !== 6) { Alert.alert("Error", "Enter the 6-digit OTP"); return; }
    setVerifying(true);
    try {
      await post("/roles/verify-otp", { code: otp, purpose: "role_upgrade" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("form");
    } catch (e: any) {
      Alert.alert("Incorrect OTP", e.message || "Please try again");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setVerifying(false); }
  }

  async function submitProviderForm() {
    if (!licenseNumber.trim()) { Alert.alert("Required", "License number is required"); return; }
    if (!vehicleMake.trim()) { Alert.alert("Required", "Vehicle make is required"); return; }
    if (!vehicleModel.trim()) { Alert.alert("Required", "Vehicle model is required"); return; }
    setSubmitting(true);
    try {
      await post("/roles/upgrade", {
        targetRole: "provider",
        licenseNumber,
        vehicleType,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleColor,
      });
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("success");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to upgrade role");
    } finally { setSubmitting(false); }
  }

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Become a Provider</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {/* Steps indicator */}
      <View style={styles.stepsRow}>
        {(["intro", "otp", "form"] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <StepDot
              active={step === s}
              done={["intro", "otp", "form"].indexOf(step) > i}
            />
            {i < 2 && <View style={styles.stepLine} />}
          </React.Fragment>
        ))}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Step 1: Intro ── */}
        {step === "intro" && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>🚗</Text>
            </View>
            <Text style={styles.stepTitle}>Become a Provider</Text>
            <Text style={styles.stepSubtitle}>
              List your vehicles, equipment, and services. Earn money by renting out to customers across Punjab.
            </Text>

            <View style={styles.benefitsCard}>
              {[
                { icon: "💰", title: "Earn Income", desc: "Set your own prices and earn from idle assets" },
                { icon: "📅", title: "Flexible Schedule", desc: "Accept or decline bookings on your terms" },
                { icon: "🔒", title: "Secure Payments", desc: "Get paid directly to your account" },
                { icon: "⭐", title: "Build Reputation", desc: "Grow your ratings with positive reviews" },
              ].map((b) => (
                <View key={b.title} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{b.icon}</Text>
                  <View>
                    <Text style={styles.benefitTitle}>{b.title}</Text>
                    <Text style={styles.benefitDesc}>{b.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.noteText}>
              We'll send a verification code to confirm your identity before proceeding.
            </Text>

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
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="keypad-outline" size={48} color={C.tint} />
            </View>
            <Text style={styles.stepTitle}>Verify Your Identity</Text>
            <Text style={styles.stepSubtitle}>
              Enter the 6-digit verification code.
            </Text>

            {devOtp && (
              <View style={styles.devOtpBox}>
                <Ionicons name="bug-outline" size={16} color="#F59E0B" />
                <Text style={styles.devOtpText}>Dev mode — Your OTP: <Text style={styles.devOtpCode}>{devOtp}</Text></Text>
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

            <Pressable onPress={verifyOtp} disabled={verifying || otp.length !== 6} style={[styles.primaryBtn, otp.length !== 6 && styles.btnDisabled]}>
              {verifying ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Verify Code</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={otpTimer > 0 ? undefined : sendOtp}
              disabled={otpTimer > 0 || sending}
              style={styles.resendBtn}
            >
              <Text style={[styles.resendText, otpTimer > 0 && { color: C.textTertiary }]}>
                {otpTimer > 0 ? `Resend code in ${otpTimer}s` : "Resend code"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 3: Driver Form ── */}
        {step === "form" && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-text-outline" size={48} color={C.tint} />
            </View>
            <Text style={styles.stepTitle}>Provider Details</Text>
            <Text style={styles.stepSubtitle}>Tell us about your vehicle and license to get started.</Text>

            <View style={styles.formCard}>
              <Text style={styles.formSection}>Driver Information</Text>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>License Number *</Text>
                <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="e.g. PB-1234-567890" placeholderTextColor={C.textTertiary} autoCapitalize="characters" />
              </View>

              <Text style={[styles.formSection, { marginTop: 20 }]}>Vehicle Details</Text>

              <Text style={styles.fieldLabel}>Vehicle Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={styles.typeRow}>
                  {VEHICLE_TYPES.map((vt) => (
                    <Pressable key={vt} onPress={() => setVehicleType(vt)} style={[styles.typeChip, vehicleType === vt && styles.typeChipSelected]}>
                      <Text style={[styles.typeChipText, vehicleType === vt && styles.typeChipTextSelected]}>{vt}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.row2}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Make *</Text>
                  <TextInput style={styles.input} value={vehicleMake} onChangeText={setVehicleMake} placeholder="e.g. Maruti" placeholderTextColor={C.textTertiary} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Model *</Text>
                  <TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g. Swift" placeholderTextColor={C.textTertiary} />
                </View>
              </View>

              <View style={styles.row2}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Year</Text>
                  <TextInput style={styles.input} value={vehicleYear} onChangeText={setVehicleYear} placeholder="e.g. 2020" placeholderTextColor={C.textTertiary} keyboardType="number-pad" maxLength={4} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Color</Text>
                  <TextInput style={styles.input} value={vehicleColor} onChangeText={setVehicleColor} placeholder="e.g. White" placeholderTextColor={C.textTertiary} autoCapitalize="words" />
                </View>
              </View>
            </View>

            <View style={styles.approvalNote}>
              <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
              <Text style={styles.approvalText}>Your application will be reviewed and approved within 24 hours.</Text>
            </View>

            <Pressable onPress={submitProviderForm} disabled={submitting} style={styles.primaryBtn}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Submit Application</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* ── Step 4: Success ── */}
        {step === "success" && (
          <View style={[styles.stepContainer, { alignItems: "center" }]}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark-circle" size={80} color="#22C55E" />
            </View>
            <Text style={styles.successTitle}>You're now a Provider! 🎉</Text>
            <Text style={styles.successSubtitle}>
              Your account now has both Customer and Provider access. Your provider application is under review — you'll be notified once approved.
            </Text>

            <View style={styles.nextStepCard}>
              <Text style={styles.nextStepTitle}>What's next?</Text>
              {[
                "Switch to Provider Mode from the home screen",
                "Add your first listing from the Dashboard",
                "Set your availability and pricing",
                "Start accepting bookings!",
              ].map((s, i) => (
                <View key={i} style={styles.nextStepRow}>
                  <View style={styles.nextStepNum}><Text style={styles.nextStepNumText}>{i + 1}</Text></View>
                  <Text style={styles.nextStepText}>{s}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => router.replace("/(tabs)")} style={styles.primaryBtn}>
              <Ionicons name="home-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Go to Home</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: botPad + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F5F7" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },

  progressTrack: { height: 3, backgroundColor: C.borderLight },
  progressFill: { height: 3, backgroundColor: C.tint },

  stepsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 0 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.border, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  stepDotActive: { borderColor: C.tint, backgroundColor: `${C.tint}20` },
  stepDotDone: { backgroundColor: C.tint, borderColor: C.tint },
  stepLine: { flex: 1, height: 2, backgroundColor: C.border, maxWidth: 60 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  stepContainer: { gap: 16 },

  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${C.tint}15`, alignSelf: "center",
    alignItems: "center", justifyContent: "center",
  },
  iconEmoji: { fontSize: 48 },
  stepTitle: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  stepSubtitle: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  benefitsCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  benefitIcon: { fontSize: 24, lineHeight: 28 },
  benefitTitle: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  benefitDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },

  noteText: { fontSize: 13, color: C.textSecondary, textAlign: "center", fontFamily: "Inter_400Regular" },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: C.tint, borderRadius: 14, paddingVertical: 16,
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },

  devOtpBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  devOtpText: { fontSize: 13, color: "#92400E", fontFamily: "Inter_400Regular" },
  devOtpCode: { fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 2 },

  otpInput: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 2, borderColor: C.tint,
    paddingHorizontal: 24, paddingVertical: 18,
    fontSize: 32, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text,
    letterSpacing: 10, textAlign: "center",
  },
  resendBtn: { alignItems: "center" },
  resendText: { fontSize: 14, color: C.tint, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  formCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 0,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  formSection: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 6 },
  input: {
    backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.text,
  },
  typeRow: { flexDirection: "row", gap: 8, paddingRight: 4 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: "#fff" },
  typeChipSelected: { borderColor: C.tint, backgroundColor: `${C.tint}12` },
  typeChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  typeChipTextSelected: { color: C.tint, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  row2: { flexDirection: "row", gap: 10 },

  approvalNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#EBF4FF", borderRadius: 12, padding: 14,
  },
  approvalText: { flex: 1, fontSize: 13, color: "#1E40AF", fontFamily: "Inter_400Regular", lineHeight: 18 },

  successCircle: { alignSelf: "center", marginBottom: 8 },
  successTitle: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  successSubtitle: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  nextStepCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  nextStepTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  nextStepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nextStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: `${C.tint}15`, alignItems: "center", justifyContent: "center" },
  nextStepNumText: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  nextStepText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
});
