import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";

const C = Colors.light;
const TINT = "#FF7A18";

const COUNTRIES = [
  { code: "+91",  flag: "🇮🇳", name: "India",           minDigits: 10, maxDigits: 10 },
  { code: "+1",   flag: "🇺🇸", name: "USA / Canada",    minDigits: 10, maxDigits: 10 },
  { code: "+44",  flag: "🇬🇧", name: "United Kingdom",  minDigits: 10, maxDigits: 10 },
  { code: "+61",  flag: "🇦🇺", name: "Australia",       minDigits: 9,  maxDigits: 9  },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand",     minDigits: 8,  maxDigits: 9  },
  { code: "+971", flag: "🇦🇪", name: "UAE",             minDigits: 9,  maxDigits: 9  },
  { code: "+65",  flag: "🇸🇬", name: "Singapore",       minDigits: 8,  maxDigits: 8  },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan",        minDigits: 10, maxDigits: 10 },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh",      minDigits: 10, maxDigits: 10 },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka",       minDigits: 9,  maxDigits: 9  },
  { code: "+977", flag: "🇳🇵", name: "Nepal",           minDigits: 10, maxDigits: 10 },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia",        minDigits: 9,  maxDigits: 10 },
  { code: "+49",  flag: "🇩🇪", name: "Germany",         minDigits: 10, maxDigits: 11 },
  { code: "+33",  flag: "🇫🇷", name: "France",          minDigits: 9,  maxDigits: 9  },
  { code: "+81",  flag: "🇯🇵", name: "Japan",           minDigits: 10, maxDigits: 10 },
  { code: "+86",  flag: "🇨🇳", name: "China",           minDigits: 11, maxDigits: 11 },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia",    minDigits: 9,  maxDigits: 9  },
  { code: "+27",  flag: "🇿🇦", name: "South Africa",    minDigits: 9,  maxDigits: 9  },
];

function formatDob(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function getAge(dob: string): number | null {
  const parts = dob.split("/");
  if (parts.length !== 3 || parts[2].length < 4) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year || year < 1900 || year > new Date().getFullYear()) return null;
  const birthDate = new Date(year, month - 1, day);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export default function SignUpScreen() {
  const { register } = useAuth();
  const { t, language, toggleLanguage } = useLang();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [dob, setDob] = useState("");
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
    if (mobile.trim()) {
      const digits = mobile.replace(/\D/g, "");
      if (digits.length < selectedCountry.minDigits) {
        e.mobile = err(`Enter a valid ${selectedCountry.name} mobile number`, "ਮੋਬਾਈਲ ਨੰਬਰ ਸਹੀ ਨਹੀਂ ਹੈ");
      }
    }
    if (!dob.trim()) {
      e.dob = err("Date of birth is required", "ਜਨਮ ਮਿਤੀ ਲਾਜ਼ਮੀ ਹੈ");
    } else {
      const age = getAge(dob);
      if (age === null) {
        e.dob = err("Enter a valid date (DD/MM/YYYY)", "ਸਹੀ ਮਿਤੀ ਦਾਖਲ ਕਰੋ (DD/MM/YYYY)");
      } else if (age < 18) {
        e.dob = err("You must be at least 18 years old to register", "ਰਜਿਸਟਰ ਕਰਨ ਲਈ ਤੁਹਾਡੀ ਉਮਰ ਘੱਟੋ ਘੱਟ 18 ਸਾਲ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ");
      }
    }
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
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim() ? mobile.replace(/\D/g, "") : "",
        countryCode: selectedCountry.code,
        dob: dob.trim(),
        password,
        role,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      setErrors({ general: err.message || (isPa ? "ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਅਸਫਲ ਰਹੀ" : "Registration failed. Please try again.") });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.includes(countrySearch)
      )
    : COUNTRIES;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Country</Text>
            <Pressable onPress={() => { setShowCountryPicker(false); setCountrySearch(""); }} style={styles.pickerClose}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
          </View>
          <View style={styles.pickerSearch}>
            <Ionicons name="search-outline" size={16} color={C.textTertiary} />
            <TextInput
              style={styles.pickerSearchInput}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country or code..."
              placeholderTextColor={C.textTertiary}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code + item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerItem, selectedCountry.code === item.code && selectedCountry.name === item.name && styles.pickerItemActive]}
                onPress={() => {
                  setSelectedCountry(item);
                  setShowCountryPicker(false);
                  setCountrySearch("");
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.pickerFlag}>{item.flag}</Text>
                <Text style={styles.pickerCountryName}>{item.name}</Text>
                <Text style={styles.pickerCode}>{item.code}</Text>
                {selectedCountry.code === item.code && selectedCountry.name === item.name && (
                  <Ionicons name="checkmark" size={18} color={TINT} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

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
              <Ionicons name="car-outline" size={30} color="#fff" />
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

            {/* Mobile with country code */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.mobileNumber} <Text style={styles.optional}>({t.optional})</Text></Text>
              <View style={[styles.iconInput, errors.mobile && styles.inputError, { paddingHorizontal: 0 }]}>
                <Pressable onPress={() => setShowCountryPicker(true)} style={styles.countryBtn}>
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                  <Ionicons name="chevron-down" size={13} color={C.textTertiary} />
                </Pressable>
                <View style={styles.countryDivider} />
                <TextInput
                  style={[styles.iconInputText, { paddingHorizontal: 10 }]}
                  value={mobile}
                  onChangeText={(v) => setMobile(v.replace(/\D/g, ""))}
                  placeholder={selectedCountry.minDigits === 10 ? "9876543210" : "Enter number"}
                  placeholderTextColor={C.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={selectedCountry.maxDigits}
                />
              </View>
              {errors.mobile ? <Text style={styles.fieldError}>{errors.mobile}</Text> : null}
            </View>

            {/* Date of Birth */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date of Birth *</Text>
              <View style={[styles.iconInput, errors.dob && styles.inputError]}>
                <Ionicons name="calendar-outline" size={17} color={C.textTertiary} />
                <TextInput
                  style={styles.iconInputText}
                  value={dob}
                  onChangeText={(v) => setDob(formatDob(v))}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              {errors.dob
                ? <Text style={[styles.fieldError, errors.dob.includes("18") && styles.fieldErrorWarn]}>{errors.dob}</Text>
                : <Text style={styles.fieldHint}>You must be 18 or older to register</Text>
              }
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

            {/* Global access notice */}
            <View style={styles.noticeCard}>
              <Ionicons name="globe-outline" size={15} color="#1E40AF" style={{ marginTop: 1 }} />
              <Text style={styles.noticeText}>
                You can register from anywhere worldwide. Bookings are currently available for{" "}
                <Text style={{ fontWeight: "700" }}>Punjab region</Text> only.
              </Text>
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
  root: { flex: 1, backgroundColor: "#FF7A18" },
  langToggle: {
    position: "absolute", right: 16, zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  langToggleText: { color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20 },
  brand: { alignItems: "center", marginBottom: 24, gap: 8 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  tagline: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, gap: 14 },
  errorBanner: { backgroundColor: "#FEF2F2", borderRadius: 10, borderWidth: 1, borderColor: "#FECACA", padding: 12 },
  errorBannerText: { color: C.error, fontSize: 13, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", gap: 12 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  optional: { color: C.textTertiary, fontWeight: "400", fontFamily: "Inter_400Regular" },
  input: {
    backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text,
  },
  inputError: { borderColor: C.error },
  iconInput: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12,
  },
  iconInputText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text, paddingVertical: 11 },
  fieldError: { fontSize: 11, color: C.error, fontFamily: "Inter_400Regular" },
  fieldErrorWarn: { color: "#DC2626", fontWeight: "600" },
  fieldHint: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  // Country picker
  countryBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 11 },
  countryFlag: { fontSize: 18 },
  countryCode: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  countryDivider: { width: 1, height: 24, backgroundColor: C.border },

  // Picker modal
  pickerModal: { flex: 1, backgroundColor: "#fff" },
  pickerHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  pickerClose: { padding: 4 },
  pickerSearch: {
    flexDirection: "row", alignItems: "center", gap: 8, margin: 16,
    backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12,
  },
  pickerSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text, paddingVertical: 10 },
  pickerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  pickerItemActive: { backgroundColor: "#FFF5EC" },
  pickerFlag: { fontSize: 24 },
  pickerCountryName: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  pickerCode: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary },

  // Notice
  noticeCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EBF4FF", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  noticeText: { flex: 1, fontSize: 12, color: "#1E40AF", fontFamily: "Inter_400Regular", lineHeight: 17 },

  roleRow: { flexDirection: "row", gap: 10 },
  roleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 10, paddingVertical: 11, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.backgroundTertiary,
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
