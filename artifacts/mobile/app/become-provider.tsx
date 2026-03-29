import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
const TINT = "#FF7A18";

type Step = "intro" | "otp" | "role" | "form" | "success";
type ProviderType = "cars" | "equipment" | "services";

const CAR_TYPES     = ["Sedan", "SUV", "Hatchback", "Station Wagon"];
const EQUIP_TYPES   = ["Tractor", "Harvester", "Rotavator", "Sprayer", "Plough", "Cultivator"];
const SERVICE_TYPES = ["Plumber", "Electrician", "Beauty", "Carpenter", "Painter", "AC Repair"];

const ROLES: { id: ProviderType; label: string; icon: string; desc: string; color: string; bg: string }[] = [
  { id: "cars",      label: "Car Driver",          icon: "car-sport-outline",   desc: "Drive customers & earn per trip",           color: "#0F1F3D", bg: "#E8ECF4" },
  { id: "equipment", label: "Equipment Provider",   icon: "construct-outline",    desc: "Rent tractors, harvesters & farm machinery", color: "#2E7D32", bg: "#E8F5E9" },
  { id: "services",  label: "Service Provider",     icon: "hammer-outline",       desc: "Offer skilled services to customers",       color: "#E65100", bg: "#FBE9E7" },
];

const STEP_LABELS = ["Intro", "Verify", "Role", "Details", "Done"];

function StepBar({ step }: { step: Step }) {
  const idx = ["intro", "otp", "role", "form", "success"].indexOf(step);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(progress, { toValue: idx / 4, useNativeDriver: false, tension: 80, friction: 12 }).start();
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
              {i < 4 && <View style={[ss.dotLine, done && ss.dotLineDone]} />}
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

export default function BecomeProviderScreen() {
  const { refreshUser, setActiveMode } = useAuth();
  const { post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;

  const [step, setStep]   = useState<Step>("intro");

  // OTP
  const [sending, setSending]     = useState(false);
  const [devOtp, setDevOtp]       = useState<string | null>(null);
  const [otp, setOtp]             = useState("");
  const [otpTimer, setOtpTimer]   = useState(0);
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef<any>(null);

  // Role selection
  const [providerType, setProviderType] = useState<ProviderType | null>(null);
  const [subtype, setSubtype]           = useState("");

  // Car form
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehicleMake, setVehicleMake]     = useState("");
  const [vehicleModel, setVehicleModel]   = useState("");
  const [vehicleYear, setVehicleYear]     = useState("");
  const [vehicleColor, setVehicleColor]   = useState("");

  // Equipment form
  const [eqMake, setEqMake]   = useState("");
  const [eqModel, setEqModel] = useState("");
  const [eqYear, setEqYear]   = useState("");
  const [eqLicense, setEqLicense] = useState("");

  // Service form
  const [fullName, setFullName]     = useState("");
  const [area, setArea]             = useState("");
  const [address, setAddress]       = useState("");
  const [aadhaar, setAadhaar]       = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [createdListingTitle, setCreatedListingTitle] = useState("");

  function startTimer() {
    setOtpTimer(60);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
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
      setStep("role");
    } catch (e: any) {
      Alert.alert("Incorrect OTP", e.message || "Please try again");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setVerifying(false); }
  }

  function selectRole(r: ProviderType) {
    Haptics.selectionAsync();
    setProviderType(r);
    setSubtype("");
  }

  function proceedToForm() {
    if (!providerType) { Alert.alert("Required", "Please select a provider type"); return; }
    if (!subtype)      { Alert.alert("Required", "Please select a specific type"); return; }
    setStep("form");
  }

  async function submitForm() {
    if (providerType === "cars") {
      if (!licenseNumber.trim()) { Alert.alert("Required", "License number is required"); return; }
      if (!vehicleMake.trim())   { Alert.alert("Required", "Vehicle make is required"); return; }
      if (!vehicleModel.trim())  { Alert.alert("Required", "Vehicle model is required"); return; }
    } else if (providerType === "equipment") {
      if (!eqMake.trim())    { Alert.alert("Required", "Make is required"); return; }
      if (!eqModel.trim())   { Alert.alert("Required", "Model is required"); return; }
    } else if (providerType === "services") {
      if (!fullName.trim()) { Alert.alert("Required", "Full name is required"); return; }
      if (!area.trim())     { Alert.alert("Required", "Area is required"); return; }
      if (!address.trim())  { Alert.alert("Required", "Address is required"); return; }
      const digits = aadhaar.replace(/\D/g, "");
      if (digits.length !== 12) { Alert.alert("Invalid", "Aadhaar must be exactly 12 digits"); return; }
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        targetRole: "provider",
        providerType: providerType!,
        subtype,
      };
      if (providerType === "cars") {
        Object.assign(payload, { licenseNumber, vehicleType: subtype, vehicleMake, vehicleModel, vehicleYear, vehicleColor });
      } else if (providerType === "equipment") {
        Object.assign(payload, { equipmentName: subtype, licenseNumber: eqLicense, vehicleMake: eqMake, vehicleModel: eqModel, vehicleYear: eqYear });
      } else if (providerType === "services") {
        Object.assign(payload, { fullName, area, address, aadhaarNumber: aadhaar.replace(/\D/g, "") });
      }
      const result = await post<{ listingTitle?: string }>("/roles/upgrade", payload);
      if (result.listingTitle) setCreatedListingTitle(result.listingTitle);
      await refreshUser();
      await setActiveMode("provider");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("success");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Submission failed. Please try again.");
    } finally { setSubmitting(false); }
  }

  const subtypes = providerType === "cars" ? CAR_TYPES : providerType === "equipment" ? EQUIP_TYPES : SERVICE_TYPES;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={() => {
            if (step === "intro") router.back();
            else if (step === "otp")  setStep("intro");
            else if (step === "role") setStep("otp");
            else if (step === "form") setStep("role");
            else router.replace("/(tabs)");
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Become a Provider</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepBar step={step} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Step 1: Intro ── */}
        {step === "intro" && (
          <View style={styles.section}>
            <View style={styles.iconCircle}>
              <Ionicons name="storefront-outline" size={48} color={TINT} />
            </View>
            <Text style={styles.stepTitle}>Become a Provider</Text>
            <Text style={styles.stepSubtitle}>
              Offer your cars, machinery, or skills to customers across Punjab and start earning today.
            </Text>

            <View style={styles.benefitsCard}>
              {[
                { icon: "💰", title: "Earn Income",       desc: "Set your own prices and earn from idle assets" },
                { icon: "📅", title: "Flexible Schedule", desc: "Accept or decline bookings on your terms" },
                { icon: "🔒", title: "Secure Payments",   desc: "Get paid directly to your account" },
                { icon: "⭐", title: "Build Reputation",  desc: "Grow your rating with positive reviews" },
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

            <Text style={styles.noteText}>We'll send a verification code to confirm your identity.</Text>

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

            <Pressable onPress={verifyOtp} disabled={verifying || otp.length !== 6} style={[styles.primaryBtn, otp.length !== 6 && styles.btnDisabled]}>
              {verifying ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Verify Code</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={otpTimer > 0 ? undefined : sendOtp} disabled={otpTimer > 0 || sending} style={styles.resendBtn}>
              <Text style={[styles.resendText, otpTimer > 0 && { color: C.textTertiary }]}>
                {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Resend code"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 3: Role Selection ── */}
        {step === "role" && (
          <View style={styles.section}>
            <Text style={styles.stepTitle}>What will you offer?</Text>
            <Text style={styles.stepSubtitle}>Select the type of provider you want to become.</Text>

            <View style={styles.roleGrid}>
              {ROLES.map((r) => {
                const selected = providerType === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => selectRole(r.id)}
                    style={[styles.roleCard, selected && { borderColor: r.color, backgroundColor: r.bg }]}
                  >
                    <View style={[styles.roleIconCircle, { backgroundColor: selected ? r.color : `${r.color}18` }]}>
                      <Ionicons name={r.icon as any} size={28} color={selected ? "#fff" : r.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleLabel, { color: r.color }]}>{r.label}</Text>
                      <Text style={styles.roleDesc}>{r.desc}</Text>
                    </View>
                    {selected && (
                      <View style={[styles.selectedBadge, { backgroundColor: r.color }]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Subtype selection */}
            {providerType && (
              <View style={styles.subtypeSection}>
                <Text style={styles.subtypeTitle}>
                  {providerType === "cars"      ? "Select Vehicle Type" :
                   providerType === "equipment" ? "Select Equipment Type" :
                                                  "Select Service Type"}
                </Text>
                <View style={styles.subtypeGrid}>
                  {subtypes.map((s) => {
                    const sel = subtype === s;
                    const roleColor = ROLES.find((r) => r.id === providerType)!.color;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => { Haptics.selectionAsync(); setSubtype(s); }}
                        style={[styles.subtypeChip, sel && { borderColor: roleColor, backgroundColor: `${roleColor}12` }]}
                      >
                        <Text style={[styles.subtypeText, sel && { color: roleColor, fontWeight: "700" }]}>{s}</Text>
                        {sel && <Ionicons name="checkmark-circle" size={14} color={roleColor} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <Pressable
              onPress={proceedToForm}
              disabled={!providerType || !subtype}
              style={[styles.primaryBtn, (!providerType || !subtype) && styles.btnDisabled]}
            >
              <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 4: Dynamic Form ── */}
        {step === "form" && providerType && (
          <View style={styles.section}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-text-outline" size={48} color={TINT} />
            </View>
            <Text style={styles.stepTitle}>
              {providerType === "cars"      ? "Car Driver Details" :
               providerType === "equipment" ? "Equipment Details" :
                                              "Service Provider Details"}
            </Text>
            <Text style={styles.stepSubtitle}>
              Fill in your details to complete registration as a <Text style={{ color: TINT, fontWeight: "700" }}>{subtype}</Text> provider.
            </Text>

            <View style={styles.formCard}>
              {/* ─── Cars Form ─── */}
              {providerType === "cars" && (
                <>
                  <Text style={styles.formSection}>Driver Information</Text>
                  <Field label="License Number *" value={licenseNumber} onChange={setLicenseNumber} placeholder="e.g. PB-1234-567890" autoCapitalize="characters" />

                  <Text style={[styles.formSection, { marginTop: 16 }]}>Vehicle Details</Text>
                  <View style={styles.selectedTypeTag}>
                    <Ionicons name="car-sport-outline" size={16} color={TINT} />
                    <Text style={styles.selectedTypeText}>Vehicle Type: <Text style={{ fontWeight: "700", color: TINT }}>{subtype}</Text></Text>
                  </View>
                  <View style={styles.row2}>
                    <Field label="Make *"  value={vehicleMake}  onChange={setVehicleMake}  placeholder="e.g. Maruti" flex />
                    <Field label="Model *" value={vehicleModel} onChange={setVehicleModel} placeholder="e.g. Swift" flex />
                  </View>
                  <View style={styles.row2}>
                    <Field label="Year"  value={vehicleYear}  onChange={setVehicleYear}  placeholder="2020" keyboardType="number-pad" maxLength={4} flex />
                    <Field label="Color" value={vehicleColor} onChange={setVehicleColor} placeholder="White" flex />
                  </View>
                </>
              )}

              {/* ─── Equipment Form ─── */}
              {providerType === "equipment" && (
                <>
                  <Text style={styles.formSection}>Equipment Information</Text>
                  <View style={styles.selectedTypeTag}>
                    <Ionicons name="construct-outline" size={16} color="#2E7D32" />
                    <Text style={styles.selectedTypeText}>Equipment: <Text style={{ fontWeight: "700", color: "#2E7D32" }}>{subtype}</Text></Text>
                  </View>
                  <Field label="License Number (optional)" value={eqLicense} onChange={setEqLicense} placeholder="e.g. PB-1234-567890" autoCapitalize="characters" />
                  <View style={styles.row2}>
                    <Field label="Make *"  value={eqMake}  onChange={setEqMake}  placeholder="e.g. Mahindra" flex />
                    <Field label="Model *" value={eqModel} onChange={setEqModel} placeholder="e.g. 575 DI" flex />
                  </View>
                  <Field label="Year" value={eqYear} onChange={setEqYear} placeholder="e.g. 2019" keyboardType="number-pad" maxLength={4} />
                </>
              )}

              {/* ─── Services Form ─── */}
              {providerType === "services" && (
                <>
                  <Text style={styles.formSection}>Personal Information</Text>
                  <View style={styles.selectedTypeTag}>
                    <Ionicons name="hammer-outline" size={16} color="#E65100" />
                    <Text style={styles.selectedTypeText}>Service: <Text style={{ fontWeight: "700", color: "#E65100" }}>{subtype}</Text></Text>
                  </View>
                  <Field label="Full Name *" value={fullName} onChange={setFullName} placeholder="e.g. Gurpreet Singh" />
                  <Field label="Area / City *" value={area} onChange={setArea} placeholder="e.g. Ludhiana, Amritsar" />
                  <Field label="Address *" value={address} onChange={setAddress} placeholder="Street, Colony, City" multiline />
                  <Field
                    label="Aadhaar Card Number *"
                    value={aadhaar}
                    onChange={(t) => setAadhaar(t.replace(/\D/g, "").slice(0, 12))}
                    placeholder="12-digit number"
                    keyboardType="number-pad"
                    maxLength={12}
                  />
                  <Text style={styles.hintText}>Aadhaar is used only for identity verification and is never shared publicly.</Text>
                </>
              )}
            </View>

            <View style={styles.approvalNote}>
              <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
              <Text style={styles.approvalText}>Your application will be reviewed within 24 hours. We'll notify you once approved.</Text>
            </View>

            <Pressable onPress={submitForm} disabled={submitting} style={styles.primaryBtn}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Submit Application</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* ── Step 5: Success ── */}
        {step === "success" && (
          <View style={[styles.section, { alignItems: "center" }]}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark-circle" size={88} color="#22C55E" />
            </View>
            <Text style={styles.successTitle}>You're Live! 🎉</Text>
            <Text style={styles.stepSubtitle}>
              You're now registered as a <Text style={{ color: TINT, fontWeight: "700" }}>{subtype} {providerType === "services" ? "Provider" : providerType === "equipment" ? "Provider" : "Driver"}</Text>.{"\n"}
              We'll review your documents within 24 hours.
            </Text>

            {!!createdListingTitle && (
              <View style={styles.listingCreatedCard}>
                <Ionicons name="storefront-outline" size={20} color={TINT} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listingCreatedLabel}>Your first listing was created:</Text>
                  <Text style={styles.listingCreatedTitle}>{createdListingTitle}</Text>
                </View>
              </View>
            )}

            <View style={styles.nextStepCard}>
              <Text style={styles.nextStepTitle}>What's next?</Text>
              {[
                "View and edit your listing on the Dashboard",
                "Add photos to attract more customers",
                "Set your availability and pricing",
                "Start accepting bookings!",
              ].map((s, i) => (
                <View key={i} style={styles.nextStepRow}>
                  <View style={styles.nextStepNum}><Text style={styles.nextStepNumText}>{i + 1}</Text></View>
                  <Text style={styles.nextStepText}>{s}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => router.replace("/(tabs)/dashboard")} style={styles.primaryBtn}>
              <Ionicons name="grid-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Go to My Dashboard</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: botPad + 24 }} />
      </ScrollView>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, flex, multiline,
  keyboardType, autoCapitalize, maxLength,
}: {
  label: string; value: string; onChange: (t: string) => void; placeholder?: string;
  flex?: boolean; multiline?: boolean; keyboardType?: any; autoCapitalize?: any; maxLength?: number;
}) {
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "none"}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  section: { gap: 16 },

  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${TINT}15`, alignSelf: "center",
    alignItems: "center", justifyContent: "center",
  },
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
    gap: 10, backgroundColor: TINT, borderRadius: 14, paddingVertical: 16,
    shadowColor: TINT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },

  devBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  devText: { fontSize: 13, color: "#92400E", fontFamily: "Inter_400Regular" },
  devCode: { fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 2 },

  otpInput: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 2, borderColor: TINT,
    paddingHorizontal: 24, paddingVertical: 18,
    fontSize: 32, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text,
    letterSpacing: 10, textAlign: "center",
  },
  resendBtn: { alignItems: "center" },
  resendText: { fontSize: 14, color: TINT, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Role grid
  roleGrid: { gap: 12 },
  roleCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: C.border,
    flexDirection: "row", alignItems: "center", gap: 14, position: "relative",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  roleIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  roleLabel: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  roleDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2, flex: 1, flexWrap: "wrap" },
  selectedBadge: { position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },

  // Subtype
  subtypeSection: { gap: 10 },
  subtypeTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  subtypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subtypeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: "#fff",
  },
  subtypeText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },

  // Form
  formCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 0,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  formSection: { fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.textSecondary, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },
  selectedTypeTag: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: `${TINT}0D`, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
  },
  selectedTypeText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 6 },
  input: {
    backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.text,
  },
  row2: { flexDirection: "row", gap: 10 },
  hintText: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: -8, marginBottom: 6 },

  approvalNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#EBF4FF", borderRadius: 12, padding: 14,
  },
  approvalText: { flex: 1, fontSize: 13, color: "#1E40AF", fontFamily: "Inter_400Regular", lineHeight: 18 },

  successCircle: { alignSelf: "center", marginBottom: 8 },
  successTitle: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  listingCreatedCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5EC",
    borderWidth: 1.5, borderColor: TINT, borderRadius: 12,
    padding: 14, marginTop: 16, alignSelf: "stretch",
  },
  listingCreatedLabel: { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular", marginBottom: 2 },
  listingCreatedTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  nextStepCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 14, width: "100%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  nextStepTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  nextStepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nextStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: `${TINT}15`, alignItems: "center", justifyContent: "center" },
  nextStepNumText: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: TINT },
  nextStepText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
});
