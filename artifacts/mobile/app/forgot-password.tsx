import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
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

export default function ForgotPasswordScreen() {
  const insets  = useSafeAreaInsets();
  const { post } = useApi();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [sent,    setSent]    = useState(false);

  async function handleSend() {
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError("Please enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      await post("/auth/forgot-password", { email: trimmed });
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.successWrap, { paddingTop: topPad + 48 }]}>
          <View style={styles.successIcon}>
            <Ionicons name="mail-open-outline" size={48} color="#FF7A18" />
          </View>
          <Text style={styles.successTitle}>OTP Sent!</Text>
          <Text style={styles.successMsg}>
            We sent a 6-digit code to{"\n"}
            <Text style={{ fontWeight: "700" }}>{email.trim().toLowerCase()}</Text>
            {"\n\n"}Check your inbox (and spam folder).
          </Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/reset-password", params: { email: email.trim().toLowerCase() } })
            }
            style={styles.continueBtn}
          >
            <LinearGradient colors={["#fff", "#fff"]} style={styles.continueBtnInner}>
              <Text style={styles.continueBtnText}>Enter OTP</Text>
              <Ionicons name="arrow-forward" size={18} color="#FF7A18" />
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={styles.backLink}>Back to Sign In</Text>
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
              <Ionicons name="lock-open-outline" size={36} color="#fff" />
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a one-time password to reset your account.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                />
              </View>
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              onPress={handleSend}
              disabled={loading}
              style={({ pressed }) => [styles.sendBtn, { opacity: pressed || loading ? 0.8 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.sendBtnText}>Send OTP</Text>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                </>
              )}
            </Pressable>

            <Pressable onPress={() => router.back()} style={styles.switchRow}>
              <Ionicons name="arrow-back-outline" size={14} color={C.textSecondary} />
              <Text style={styles.switchText}> Back to Sign In</Text>
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
  brand: { alignItems: "center", marginBottom: 28, gap: 12 },
  iconCircle: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  subtitle: {
    fontSize: 14, color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20,
  },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 18 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8F9FA", borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E8E8E8", paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#2C2C2C", paddingVertical: 13 },
  errorText: { fontSize: 13, color: "#E53935", fontFamily: "Inter_400Regular", textAlign: "center" },
  sendBtn: {
    backgroundColor: "#FF7A18", borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  sendBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 14, color: "#888", fontFamily: "Inter_400Regular" },

  successWrap: { flex: 1, paddingHorizontal: 28, alignItems: "center" },
  successIcon: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  successTitle: { fontSize: 30, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 12 },
  successMsg: {
    fontSize: 15, color: "rgba(255,255,255,0.9)",
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22,
  },
  continueBtn: { marginTop: 32, width: "100%", borderRadius: 14, overflow: "hidden" },
  continueBtnInner: {
    paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  continueBtnText: { color: "#FF7A18", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  backLink: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular" },
});
