import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { useAuth } from "@/context/AuthContext";

const C = Colors.light;

export default function SignInScreen() {
  const { loginWithEmail } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    if (!email.trim()) { setError("Please enter your email"); return; }
    if (!password) { setError("Please enter your password"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError("Please enter a valid email address"); return; }

    setLoading(true);
    try {
      await loginWithEmail(email.trim().toLowerCase(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Sign in failed. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[C.navy, "#1E3A6E", C.navy]} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Ionicons name="car-outline" size={36} color={C.tint} />
            </View>
            <Text style={styles.appName}>RentZilla</Text>
            <Text style={styles.tagline}>Punjab's #1 Rental Marketplace</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to continue</Text>

            {/* Email */}
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
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.textTertiary} />
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [styles.loginBtn, { opacity: pressed || loading ? 0.8 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </Pressable>

            {/* Sign up link */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Don't have an account? </Text>
              <Pressable onPress={() => router.replace("/sign-up")}>
                <Text style={styles.switchLink}>Sign Up</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.navy },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  brand: { alignItems: "center", marginBottom: 32, gap: 10 },
  logoCircle: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: "rgba(232,116,42,0.15)",
    borderWidth: 2, borderColor: `${C.tint}40`,
    alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 34, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 18 },
  cardTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  cardSubtitle: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: -10 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    paddingVertical: 13,
  },
  eyeBtn: { padding: 4 },
  errorText: { fontSize: 13, color: C.error, fontFamily: "Inter_400Regular", textAlign: "center" },
  loginBtn: {
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  switchLink: { fontSize: 14, color: C.tint, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
