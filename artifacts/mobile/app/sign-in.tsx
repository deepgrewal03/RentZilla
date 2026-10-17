import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Button3D from "@/components/Button3D";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import { useLang } from "@/context/LanguageContext";

const C = Colors.light;
const TINT = "#FF7A18";

// Safely load the native Google Sign-In module.
// On older builds where the native binary wasn't compiled with this module,
// the require throws — we catch it and fall back gracefully.
let _GoogleSignin: any = null;
let _isErrorWithCode: ((e: unknown) => boolean) = () => false;
let _statusCodes: any = {};
let googleNativeAvailable = false;

try {
  const gsModule = require("@react-native-google-signin/google-signin");
  _GoogleSignin = gsModule.GoogleSignin;
  _isErrorWithCode = gsModule.isErrorWithCode;
  _statusCodes = gsModule.statusCodes;

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  // On iOS, iosClientId is required — skip Google Sign-In if not configured.
  // On Android, webClientId is required — without it (or with a keystore
  // SHA-1 mismatch) signIn() always throws DEVELOPER_ERROR, so the button
  // would be a dead UI element (Play Store "Broken Functionality" violation).
  if (
    // The native Google Sign-In module has no web implementation — the button
    // would render but always fail in a browser, so hide it on web.
    Platform.OS === "web" ||
    (Platform.OS === "ios" && !iosClientId) ||
    (Platform.OS === "android" && !webClientId)
  ) {
    googleNativeAvailable = false;
  } else {
    _GoogleSignin.configure({
      ...(iosClientId ? { iosClientId } : {}),
      ...(webClientId ? { webClientId } : {}),
      offlineAccess: false,
    });
    googleNativeAvailable = true;
  }
} catch {
  googleNativeAvailable = false;
}

export default function SignInScreen() {
  const { loginWithEmail, loginWithGoogle, loginWithApple } = useAuth();
  const { t, language, toggleLanguage } = useLang();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    if (googleLoading) return;
    setError("");

    if (!googleNativeAvailable) {
      setError("Google Sign-In requires the latest app build. Please update and try again.");
      return;
    }

    setGoogleLoading(true);
    try {
      if (Platform.OS === "android") {
        await _GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await _GoogleSignin.signIn();
      if (response.type === "success") {
        const idToken = response.data?.idToken;
        if (!idToken) throw new Error("Google sign-in failed. No token received.");
        const result = await loginWithGoogle(idToken);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!result.profileComplete) {
          router.replace("/complete-profile");
        } else {
          router.replace("/(tabs)");
        }
      }
      // type === 'cancelled' — user dismissed, no error needed
    } catch (e: any) {
      if (_isErrorWithCode(e)) {
        if (e.code === _statusCodes.SIGN_IN_CANCELLED) {
          // dismissed — silent
        } else if (e.code === _statusCodes.IN_PROGRESS) {
          // already in progress — silent
        } else {
          // Log only the SDK's status code, never tokens or account details.
          const code = String(e.code);
          const safeCode = /^[A-Z0-9_-]{1,64}$/i.test(code) ? code : "UNKNOWN";
          console.warn(`[GoogleSignIn] ${Platform.OS} SDK error: ${safeCode}`);
          const configurationError = code === "10" || code === "DEVELOPER_ERROR";
          const servicesError = e.code === _statusCodes.PLAY_SERVICES_NOT_AVAILABLE;
          const friendly = configurationError
            ? (language === "pa"
              ? "ਇਸ ਐਪ ਲਈ Google ਸਾਈਨ-ਇਨ ਦੀ ਸੈਟਿੰਗ ਠੀਕ ਨਹੀਂ ਹੈ (ਕੋਡ 10)। ਕਿਰਪਾ ਕਰਕੇ ਸਹਾਇਤਾ ਨਾਲ ਸੰਪਰਕ ਕਰੋ ਜਾਂ ਈਮੇਲ ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ।"
              : "Google sign-in is not configured correctly for this app (code 10). Please contact support or sign in with email.")
            : servicesError
              ? (language === "pa"
                ? "ਕਿਰਪਾ ਕਰਕੇ Google Play services ਅੱਪਡੇਟ ਜਾਂ ਚਾਲੂ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
                : "Please update or enable Google Play services, then try again.")
              : `${language === "pa"
                ? "Google ਸਾਈਨ-ਇਨ ਅਸਫਲ ਰਿਹਾ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਈਮੇਲ ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ।"
                : "Google sign-in failed. Please try again or sign in with email."} (${safeCode})`;
          setError(friendly);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        setError(
          language === "pa"
            ? "Google ਸਾਈਨ-ਇਨ ਅਸਫਲ ਰਿਹਾ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
            : "Google sign-in failed. Please try again.",
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (appleLoading) return;
    setError("");
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple sign-in failed. No identity token.");
      }

      const result = await loginWithApple(
        credential.identityToken,
        credential.user,
        credential.fullName,
        credential.email,
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!result.profileComplete) {
        router.replace("/complete-profile");
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") {
        // User cancelled — no error message needed
      } else {
        setError(e.message || "Apple sign-in unavailable. Please try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleLogin() {
    setError("");
    if (!email.trim()) { setError(language === "pa" ? "ਕਿਰਪਾ ਕਰਕੇ ਈਮੇਲ ਦਾਖਲ ਕਰੋ" : "Please enter your email"); return; }
    if (!password) { setError(language === "pa" ? "ਕਿਰਪਾ ਕਰਕੇ ਪਾਸਵਰਡ ਦਾਖਲ ਕਰੋ" : "Please enter your password"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(language === "pa" ? "ਸਹੀ ਈਮੇਲ ਪਤਾ ਦਾਖਲ ਕਰੋ" : "Please enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email.trim().toLowerCase(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || (language === "pa" ? "ਸਾਈਨ ਇਨ ਅਸਫਲ ਰਿਹਾ" : "Sign in failed. Please try again."));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const anyLoading = loading || googleLoading || appleLoading;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Language toggle */}
      <Button3D onPress={toggleLanguage} faceStyle={[styles.langToggle, { top: topPad + 12 }]}>
        <Text style={styles.langToggleText}>{language === "en" ? "ਪੰਜਾਬੀ" : "EN"}</Text>
      </Button3D>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 56 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <View style={styles.logoHalo} />
              <View style={styles.logoBadge}>
                <LinearGradient
                  colors={["#FF7A18", "#FF9F43"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.logoAccentBar}
                />
                <View style={styles.logoLetters}>
                  <Text style={[styles.logoLetter, { transform: [{ scaleX: -1 }] }]}>R</Text>
                  <Text style={[styles.logoLetter, { transform: [{ scaleX: -1 }] }]}>Z</Text>
                </View>
                <View style={styles.logoDots}>
                  {[0, 1, 2].map(i => <View key={i} style={styles.logoDot} />)}
                </View>
              </View>
            </View>
            <Text style={styles.appName}>{t.appName}</Text>
            <Text style={styles.tagline}>ਤੁਹਾਡੀ ਆਪਣੀ ਐਪ</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.welcomeBack}</Text>
            <Text style={styles.cardSubtitle}>{t.signInToContinue}</Text>

            {/* ── Social Login (hidden entirely when nothing can render) ── */}
            {(googleNativeAvailable || Platform.OS === "ios") && (
            <>
            <View style={styles.socialGroup}>
              {/* Google — only rendered when the native module is present AND
                  properly configured; otherwise the button can never succeed */}
              {googleNativeAvailable && (
              <Button3D
                onPress={handleGoogleSignIn}
                disabled={anyLoading}
                faceStyle={({ pressed }) => [
                  styles.socialBtn,
                  styles.googleBtn,
                  { opacity: pressed || anyLoading ? 0.7 : 1 },
                ]}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#444" />
                ) : (
                  <>
                    <GoogleIcon />
                    <Text style={styles.googleBtnText}>
                      {language === "pa" ? "Google ਨਾਲ ਜਾਰੀ ਰੱਖੋ" : "Continue with Google"}
                    </Text>
                  </>
                )}
              </Button3D>
              )}

              {/* Apple — iOS only */}
              {Platform.OS === "ios" && (
                <Button3D
                  onPress={handleAppleSignIn}
                  disabled={anyLoading}
                  faceStyle={({ pressed }) => [
                    styles.socialBtn,
                    styles.appleBtn,
                    { opacity: pressed || anyLoading ? 0.7 : 1 },
                  ]}
                >
                  {appleLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color="#fff" />
                      <Text style={styles.appleBtnText}>
                        {language === "pa" ? "Apple ਨਾਲ ਜਾਰੀ ਰੱਖੋ" : "Continue with Apple"}
                      </Text>
                    </>
                  )}
                </Button3D>
              )}
            </View>

            {/* ── Divider ──────────────────────────────────────────────── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                {language === "pa" ? "ਜਾਂ ਈਮੇਲ ਨਾਲ" : "or continue with email"}
              </Text>
              <View style={styles.dividerLine} />
            </View>
            </>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.emailAddress}</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t.emailPlaceholder}
                  placeholderTextColor={C.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!anyLoading}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.password}</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.passwordPlaceholder}
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!anyLoading}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.textTertiary} />
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Forgot password */}
            <Pressable onPress={() => router.push("/forgot-password")} style={styles.forgotRow}>
              <Text style={styles.forgotText}>
                {language === "pa" ? "ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ?" : "Forgot Password?"}
              </Text>
            </Pressable>

            <Button3D
              onPress={handleLogin}
              disabled={anyLoading}
              color="#FF7A18"
              edgeColor="#D16412"
              radius={14}
              depth={4}
              faceStyle={styles.loginBtn}
              accessibilityLabel={t.signIn}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.loginBtnText}>{t.signIn}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </Button3D>

            {/* Sign up link */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t.noAccount} </Text>
              <Pressable onPress={() => router.replace("/sign-up")}>
                <Text style={styles.switchLink}>{t.signUp}</Text>
              </Pressable>
            </View>

            {/* Privacy Policy */}
            <View style={styles.policyRow}>
              <Text style={styles.policyText}>
                {language === "pa" ? "ਜਾਰੀ ਰੱਖ ਕੇ ਤੁਸੀਂ ਸਾਡੀ " : "By continuing you agree to our "}
              </Text>
              <Pressable onPress={() => Linking.openURL("https://rent-organizer.replit.app/privacy")}>
                <Text style={styles.policyLink}>
                  {language === "pa" ? "ਪ੍ਰਾਈਵੇਸੀ ਨੀਤੀ" : "Privacy Policy"}
                </Text>
              </Pressable>
              <Text style={styles.policyText}>{language === "pa" ? " ਨਾਲ ਸਹਿਮਤ ਹੋ" : " & "}</Text>
              <Pressable onPress={() => Linking.openURL("https://rent-organizer.replit.app/terms")}>
                <Text style={styles.policyLink}>
                  {language === "pa" ? "" : "Terms"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Official Google "G" logo in SVG colours */
function GoogleIcon() {
  return (
    <View style={styles.googleIcon}>
      <View style={[styles.googleDot, { backgroundColor: "#4285F4", width: 8, height: 8 }]} />
      <View style={[styles.googleDot, { backgroundColor: "#34A853", width: 5, height: 8, marginLeft: -2 }]} />
      <View style={[styles.googleDot, { backgroundColor: "#FBBC05", width: 8, height: 5, marginTop: 3, marginLeft: -5 }]} />
      <View style={[styles.googleDot, { backgroundColor: "#EA4335", width: 6, height: 6, marginLeft: -3, marginTop: -3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TINT },
  langToggle: {
    position: "absolute", right: 16, zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  langToggleText: { color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20, paddingBottom: 80 },
  brand: { alignItems: "center", marginBottom: 32, gap: 10 },
  logoWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoHalo: {
    position: "absolute", width: 120, height: 120, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)",
  },
  logoBadge: {
    width: 96, height: 96, borderRadius: 26, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowColor: "#C0390A", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 18, elevation: 16,
  },
  logoAccentBar: {
    position: "absolute", top: 0, left: 0, right: 0, height: 5,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  logoLetters: { flexDirection: "row", alignItems: "center", gap: 1, marginTop: 4 },
  logoLetter: {
    fontSize: 36, fontWeight: "800", fontFamily: "Inter_700Bold",
    color: TINT, letterSpacing: -2,
  },
  logoDots: { flexDirection: "row", gap: 4, marginTop: 6 },
  logoDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#FF9F43", opacity: 0.7 },
  appName: { fontSize: 34, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.5 },
  tagline: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#0F1F3D", textAlign: "center" },

  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 16 },
  cardTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  cardSubtitle: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: -8 },

  // Social buttons
  socialGroup: { gap: 10 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 14, borderRadius: 14, minHeight: 50,
  },
  googleBtn: {
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E0E0E0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  googleBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#3C3C3C" },
  appleBtn: { backgroundColor: "#000" },
  appleBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#fff" },
  googleIcon: { width: 20, height: 20, flexDirection: "row", flexWrap: "wrap", gap: 0 },
  googleDot: { borderRadius: 2 },

  // Divider
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E8E8E8" },
  dividerText: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.backgroundTertiary, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1, fontSize: 15, fontFamily: "Inter_400Regular",
    color: C.text, paddingVertical: 13,
  },
  eyeBtn: { padding: 4 },
  errorText: { fontSize: 13, color: C.error, fontFamily: "Inter_400Regular", textAlign: "center" },
  loginBtn: {
    backgroundColor: TINT, borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  forgotRow: { alignItems: "flex-end", marginTop: -4 },
  forgotText: { fontSize: 13, color: TINT, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  switchLink: { fontSize: 14, color: TINT, fontWeight: "700", fontFamily: "Inter_700Bold" },
  policyRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 8, gap: 2 },
  policyText: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  policyLink: { fontSize: 11, color: TINT, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
});
