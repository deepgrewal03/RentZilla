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
import { useLang } from "@/context/LanguageContext";

const C = Colors.light;

export default function SignUpScreen() {
  const { register } = useAuth();
  const { t, language, toggleLanguage } = useLang();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isPa = language === "pa";

  function err(en: string, pa: string) { return isPa ? pa : en; }

  function validate() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = err("First name is required", "ਪਹਿਲਾ ਨਾਮ ਲਾਜ਼ਮੀ ਹੈ");
    if (!lastName.trim()) e.lastName = err("Last name is required", "ਆਖਰੀ ਨਾਮ ਲਾਜ਼ਮੀ ਹੈ");
    if (!email.trim()) {
      e.email = err("Email is required", "ਈਮੇਲ ਲਾਜ਼ਮੀ ਹੈ");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = err("Enter a valid email address", "ਸਹੀ ਈਮੇਲ ਪਤਾ ਦਾਖਲ ਕਰੋ");
    }
    if (mobile && mobile.trim().length < 10) e.mobile = err("Enter a valid 10-digit mobile number", "10-ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਾਖਲ ਕਰੋ");
    if (!password) {
      e.password = err("Password is required", "ਪਾਸਵਰਡ ਲਾਜ਼ਮੀ ਹੈ");
    } else if (password.length < 6) {
      e.password = err("Password must be at least 6 characters", "ਪਾਸਵਰਡ ਘੱਟੋ ਘੱਟ 6 ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ");
    }
    if (!confirmPassword) {
      e.confirmPassword = err("Please confirm your password", "ਕਿਰਪਾ ਕਰਕੇ ਪਾਸਵਰਡ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ");
    } else if (password !== confirmPassword) {
      e.confirmPassword = err("Passwords do not match", "ਪਾਸਵਰਡ ਮੇਲ ਨਹੀਂ ਖਾਂਦੇ");
    }
    if (!agreedToTerms) e.terms = err("You must agree to the Terms and Conditions", "ਤੁਹਾਨੂੰ ਨਿਯਮਾਂ ਅਤੇ ਸ਼ਰਤਾਂ ਨਾਲ ਸਹਿਮਤ ਹੋਣਾ ਪਵੇਗਾ");
    return e;
  }

  async function handleRegister() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await register({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim().toLowerCase(), mobile: mobile.trim(), password, role });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      setErrors({ general: err.message || (isPa ? "ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਅਸਫਲ ਰਹੀ" : "Registration failed. Please try again.") });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[C.navy, "#1E3A6E", C.navy]} style={StyleSheet.absoluteFill} />

      {/* Language toggle */}
      <Pressable onPress={toggleLanguage} style={[styles.langToggle, { top: topPad + 12 }]}>
        <Text style={styles.langToggleText}>{language === "en" ? "ਪੰਜਾਬੀ" : "EN"}</Text>
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 56 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Ionicons name="car-outline" size={30} color={C.tint} />
            </View>
            <Text style={styles.appName}>{t.createAccount}</Text>
            <Text style={styles.tagline}>{t.joinTagline}</Text>
          </View>

          <View style={styles.card}>
            {errors.general ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{errors.general}</Text></View> : null}

            {/* Name Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t.firstName} *</Text>
                <TextInput
                  style={[styles.input, errors.firstName && styles.inputError]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder={isPa ? "ਗੁਰਪ੍ਰੀਤ" : "Gurpreet"}
                  placeholderTextColor={C.textTertiary}
                  autoCapitalize="words"
                />
                {errors.firstName ? <Text style={styles.fieldError}>{errors.firstName}</Text> : null}
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t.lastName} *</Text>
                <TextInput
                  style={[styles.input, errors.lastName && styles.inputError]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={isPa ? "ਸਿੰਘ" : "Singh"}
                  placeholderTextColor={C.textTertiary}
                  autoCapitalize="words"
                />
                {errors.lastName ? <Text style={styles.fieldError}>{errors.lastName}</Text> : null}
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.emailAddress} *</Text>
              <View style={[styles.iconInput, errors.email && styles.inputError]}>
                <Ionicons name="mail-outline" size={17} color={C.textTertiary} />
                <TextInput
                  style={styles.iconInputText}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t.emailPlaceholder}
                  placeholderTextColor={C.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
            </View>

            {/* Mobile */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.mobileNumber} <Text style={styles.optional}>({t.optional})</Text></Text>
              <View style={[styles.iconInput, errors.mobile && styles.inputError]}>
                <Text style={styles.dialCode}>+91</Text>
                <TextInput
                  style={styles.iconInputText}
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="98xxxxxxxx"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              {errors.mobile ? <Text style={styles.fieldError}>{errors.mobile}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.password} *</Text>
              <View style={[styles.iconInput, errors.password && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={17} color={C.textTertiary} />
                <TextInput
                  style={styles.iconInputText}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.minPassword}
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={17} color={C.textTertiary} />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.confirmPassword} *</Text>
              <View style={[styles.iconInput, errors.confirmPassword && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={17} color={C.textTertiary} />
                <TextInput
                  style={styles.iconInputText}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t.repeatPassword}
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showConfirm}
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)} style={{ padding: 4 }}>
                  <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={17} color={C.textTertiary} />
                </Pressable>
              </View>
              {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}
            </View>

            {/* Role */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.iWantTo}</Text>
              <View style={styles.roleRow}>
                <Pressable onPress={() => { Haptics.selectionAsync(); setRole("customer"); }} style={[styles.roleBtn, role === "customer" && styles.roleBtnActive]}>
                  <Ionicons name="search-outline" size={17} color={role === "customer" ? "#fff" : C.text} />
                  <Text style={[styles.roleBtnText, role === "customer" && styles.roleBtnTextActive]}>{t.rentThings}</Text>
                </Pressable>
                <Pressable onPress={() => { Haptics.selectionAsync(); setRole("provider"); }} style={[styles.roleBtn, role === "provider" && styles.roleBtnActive]}>
                  <Ionicons name="storefront-outline" size={17} color={role === "provider" ? "#fff" : C.text} />
                  <Text style={[styles.roleBtnText, role === "provider" && styles.roleBtnTextActive]}>{t.listAndEarn}</Text>
                </Pressable>
              </View>
            </View>

            {/* Terms */}
            <Pressable onPress={() => setAgreedToTerms(!agreedToTerms)} style={styles.termsRow}>
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={styles.termsText}>{t.termsText}</Text>
            </Pressable>
            {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}

            {/* Submit */}
            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={({ pressed }) => [styles.signUpBtn, { opacity: pressed || loading ? 0.8 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.signUpBtnText}>{t.signUp}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t.alreadyHaveAccount} </Text>
              <Pressable onPress={() => router.replace("/sign-in")}>
                <Text style={styles.switchLink}>{t.signIn}</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.navy },
  langToggle: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  langToggleText: { color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20 },
  brand: { alignItems: "center", marginBottom: 24, gap: 8 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: "rgba(232,116,42,0.15)",
    borderWidth: 2, borderColor: `${C.tint}40`,
    alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  tagline: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, gap: 14 },
  errorBanner: {
    backgroundColor: "#FEF2F2", borderRadius: 10, borderWidth: 1, borderColor: "#FECACA", padding: 12,
  },
  errorBannerText: { color: C.error, fontSize: 13, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", gap: 12 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  optional: { color: C.textTertiary, fontWeight: "400", fontFamily: "Inter_400Regular" },
  input: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.text,
  },
  inputError: { borderColor: C.error },
  iconInput: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12,
  },
  iconInputText: {
    flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text, paddingVertical: 11,
  },
  dialCode: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  fieldError: { fontSize: 11, color: C.error, fontFamily: "Inter_400Regular" },
  roleRow: { flexDirection: "row", gap: 10 },
  roleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 10, paddingVertical: 11,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.backgroundTertiary,
  },
  roleBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  roleBtnText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, textAlign: "center" },
  roleBtnTextActive: { color: "#fff" },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxChecked: { backgroundColor: C.tint, borderColor: C.tint },
  termsText: { flex: 1, fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  signUpBtn: {
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  signUpBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  switchLink: { fontSize: 13, color: C.tint, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
