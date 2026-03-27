import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useApi } from "@/hooks/useApi";

const C = Colors.light;

export default function ResetPasswordScreen() {
  const insets  = useSafeAreaInsets();
  const { post } = useApi();
  const { email } = useLocalSearchParams<{ email: string }>();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;

  const [otp,         setOtp]         = useState(["", "", "", "", "", ""]);
  const [password,    setPassword]    = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [resending,   setResending]   = useState(false);
  const [error,       setError]       = useState("");
  const [info,        setInfo]        = useState("");
  const [done,        setDone]        = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);

  function handleOtpChange(val: string, idx: number) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next  = [...otp];
    next[idx]   = digit;
    setOtp(next);
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
  }

  function handleOtpKey(e: any, idx: number) {
    if (e.nativeEvent.key === "Backspace" && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  async function handleReset() {
    setError(""); setInfo("");
    const code = otp.join("");
    if (code.length < 6)       { setError("Please enter the 6-digit OTP"); return; }
    if (password.length < 6)   { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPass) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      await post("/auth/reset-password", { email, otp: code, newPassword: password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Failed to reset password. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true); setError(""); setInfo("");
    try {
      await post("/auth/forgot-password", { email });
      setInfo("New OTP sent! Check your inbox.");
    } catch {
      setError("Could not resend OTP. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (done) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.doneWrap, { paddingTop: topPad + 60 }]}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle-outline" size={52} color="#FF7A18" />
          </View>
          <Text style={styles.doneTitle}>Password Reset!</Text>
          <Text style={styles.doneMsg}>
            Your password has been updated. You can now sign in with your new password.
          </Text>
          <Pressable onPress={() => router.replace("/sign-in")} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Back to Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <Pressable style={[styles.backBtn, { top: topPad + 12 }]} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 72 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={34} color="#fff" />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit OTP sent to{"\n"}
              <Text style={{ fontWeight: "700" }}>{email}</Text>
            </Text>
          </View>

          <View style={styles.card}>
            {/* ── 6 OTP digit boxes ── */}
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputs.current[i] = r; }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(v, i)}
                  onKeyPress={(e) => handleOtpKey(e, i)}
                  keyboardType="numeric"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {/* Resend */}
            <Pressable onPress={handleResend} disabled={resending} style={styles.resendRow}>
              {resending
                ? <ActivityIndicator size="small" color="#FF7A18" />
                : <Text style={styles.resendText}>Didn't receive it? <Text style={styles.resendLink}>Resend OTP</Text></Text>
              }
            </Pressable>

            {/* New password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showPass}
                  returnKeyType="next"
                />
                <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textTertiary} />
                </Pressable>
              </View>
            </View>

            {/* Confirm password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  placeholder="Repeat your new password"
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />
              </View>
            </View>

            {!!info  && <Text style={styles.infoText}>{info}</Text>}
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              onPress={handleReset}
              disabled={loading}
              style={({ pressed }) => [styles.resetBtn, { opacity: pressed || loading ? 0.8 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.resetBtnText}>Reset Password</Text>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FF7A18" },
  backBtn: {
    position: "absolute", left: 16, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  brand: { alignItems: "center", marginBottom: 24, gap: 12 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  subtitle: {
    fontSize: 14, color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20,
  },

  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 16 },

  otpRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginVertical: 4 },
  otpBox: {
    width: 46, height: 56, borderRadius: 12,
    borderWidth: 2, borderColor: "#E8E8E8",
    backgroundColor: "#F8F9FA",
    fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold",
    color: "#2C2C2C", textAlign: "center",
  },
  otpBoxFilled: { borderColor: "#FF7A18", backgroundColor: "#FFF3E9" },

  resendRow: { alignItems: "center" },
  resendText: { fontSize: 13, color: "#888", fontFamily: "Inter_400Regular" },
  resendLink: { color: "#FF7A18", fontWeight: "700", fontFamily: "Inter_700Bold" },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8F9FA", borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E8E8E8", paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#2C2C2C", paddingVertical: 13 },
  eyeBtn: { padding: 4 },
  infoText:  { fontSize: 13, color: "#2E7D32", fontFamily: "Inter_400Regular", textAlign: "center" },
  errorText: { fontSize: 13, color: "#E53935", fontFamily: "Inter_400Regular", textAlign: "center" },

  resetBtn: {
    backgroundColor: "#FF7A18", borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  resetBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },

  doneWrap: { flex: 1, paddingHorizontal: 28, alignItems: "center" },
  doneIcon: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  doneTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 12 },
  doneMsg: {
    fontSize: 15, color: "rgba(255,255,255,0.9)",
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22,
  },
  doneBtn: {
    marginTop: 32, backgroundColor: "#fff", borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 48,
  },
  doneBtnText: { color: "#FF7A18", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
