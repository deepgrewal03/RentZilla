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
import { useAuth, UserRole } from "@/context/AuthContext";

const C = Colors.light;

export default function AuthScreen() {
  const { loginWithPhone } = useAuth();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!phone.trim() || phone.trim().length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await loginWithPhone(phone.trim(), name.trim(), role);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch {
      setError("Could not connect. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[C.navy, "#1E3A6E", C.navy]} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
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
            <Text style={styles.cardTitle}>Enter your phone to get started</Text>
            <Text style={styles.cardSubtitle}>No password needed — it's that simple</Text>

            {/* Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.inputRow}>
                <View style={styles.dialCode}>
                  <Text style={styles.dialCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="98xxxxxxxx"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Your Name <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, styles.inputFull]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={C.textTertiary}
                returnKeyType="done"
              />
            </View>

            {/* Role */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>I want to</Text>
              <View style={styles.roleRow}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setRole("customer"); }}
                  style={[styles.roleBtn, role === "customer" && styles.roleBtnActive]}
                >
                  <Ionicons name="search-outline" size={18} color={role === "customer" ? "#fff" : C.text} />
                  <Text style={[styles.roleBtnText, role === "customer" && styles.roleBtnTextActive]}>Rent Things</Text>
                </Pressable>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setRole("provider"); }}
                  style={[styles.roleBtn, role === "provider" && styles.roleBtnActive]}
                >
                  <Ionicons name="storefront-outline" size={18} color={role === "provider" ? "#fff" : C.text} />
                  <Text style={[styles.roleBtnText, role === "provider" && styles.roleBtnTextActive]}>List & Earn</Text>
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [styles.loginBtn, { opacity: pressed || loading ? 0.8 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </Pressable>

            <Text style={styles.disclaimer}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.navy },
  scroll: { paddingHorizontal: 20 },
  brand: { alignItems: "center", marginBottom: 36, gap: 10 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(232, 116, 42, 0.15)",
    borderWidth: 2,
    borderColor: `${C.tint}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 36,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  card: {
    backgroundColor: C.backgroundSecondary,
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.text,
    lineHeight: 28,
  },
  cardSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: -14,
  },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  optional: {
    color: C.textSecondary,
    fontWeight: "400",
    fontFamily: "Inter_400Regular",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  dialCode: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: "center",
  },
  dialCodeText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  input: {
    flex: 1,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  inputFull: {
    flex: undefined,
    width: "100%",
  },
  roleRow: { flexDirection: "row", gap: 10 },
  roleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.backgroundTertiary,
  },
  roleBtnActive: {
    backgroundColor: C.tint,
    borderColor: C.tint,
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  roleBtnTextActive: { color: "#fff" },
  errorText: {
    fontSize: 13,
    color: C.error,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  loginBtn: {
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  disclaimer: {
    fontSize: 11,
    color: C.textTertiary,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
});
