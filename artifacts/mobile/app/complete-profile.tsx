/**
 * Complete Profile Screen
 * Shown to new users who signed in via Google or Apple.
 * Collects: mobile number, DOB, Punjab location, and role intent.
 */
import Button3D from "@/components/Button3D";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth, type UserRole } from "@/context/AuthContext";

const C = Colors.light;
const TINT = "#FF7A18";

const PUNJAB_DISTRICTS = [
  "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib",
  "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar",
  "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga",
  "Pathankot", "Patiala", "Rupnagar (Ropar)", "SAS Nagar (Mohali)",
  "Sangrur", "Shaheed Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran",
];

export default function CompleteProfileScreen() {
  const { completeProfile, user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationModal, setLocationModal] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");

  const filteredDistricts = PUNJAB_DISTRICTS.filter(d =>
    d.toLowerCase().includes(locationSearch.toLowerCase())
  );

  function formatPhone(raw: string): string {
    return raw.replace(/[^\d+]/g, "");
  }

  function validateDob(d: string): boolean {
    if (!d) return true;
    const match = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    const [, day, month, year] = match.map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear() -
      (today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
    return age >= 18;
  }

  function handleDobChange(text: string) {
    const digits = text.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + "/" + digits.slice(4, 8);
    setDob(formatted.slice(0, 10));
  }

  async function handleSubmit() {
    setError("");
    const cleanPhone = formatPhone(phone);
    if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (dob && !validateDob(dob)) {
      setError("You must be 18 or older to use RentZilla");
      return;
    }

    setLoading(true);
    try {
      await completeProfile({
        name: user?.name || undefined,
        phone: cleanPhone,
        dob: dob || undefined,
        location: location || undefined,
        role,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Could not save profile. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="person-add" size={32} color={TINT} />
            </View>
            <Text style={styles.heading}>Complete Your Profile</Text>
            <Text style={styles.subheading}>
              {user?.name ? `Welcome, ${user.name.split(" ")[0]}! ` : ""}
              Just a few more details to get you started.
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Mobile Number */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mobile Number *</Text>
              <View style={styles.inputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={t => setPhone(t.replace(/[^\d]/g, ""))}
                  placeholder="98765 43210"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  editable={!loading}
                />
              </View>
              <Text style={styles.hint}>We'll use this to confirm bookings and send you updates.</Text>
            </View>

            {/* Date of Birth */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date of Birth (optional)</Text>
              <View style={styles.inputRowSimple}>
                <Ionicons name="calendar-outline" size={18} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={dob}
                  onChangeText={handleDobChange}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="numeric"
                  maxLength={10}
                  returnKeyType="next"
                  editable={!loading}
                />
              </View>
              <Text style={styles.hint}>Must be 18+ to rent equipment or services.</Text>
            </View>

            {/* Location */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Punjab District (optional)</Text>
              <Pressable
                onPress={() => setLocationModal(true)}
                style={styles.inputRowSimple}
              >
                <Ionicons name="location-outline" size={18} color={C.textTertiary} style={styles.inputIcon} />
                <Text style={[styles.input, { paddingVertical: 13, color: location ? C.text : C.textTertiary }]}>
                  {location || "Select your district"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={C.textTertiary} />
              </Pressable>
            </View>

            {/* Role */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>I want to...</Text>
              <View style={styles.roleRow}>
                <Pressable
                  style={[styles.roleCard, role === "customer" && styles.roleCardActive]}
                  onPress={() => setRole("customer")}
                >
                  <Ionicons name="search" size={24} color={role === "customer" ? "#fff" : TINT} />
                  <Text style={[styles.roleTitle, role === "customer" && styles.roleTitleActive]}>Browse & Book</Text>
                  <Text style={[styles.roleSub, role === "customer" && styles.roleSubActive]}>Rent equipment &amp; services</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleCard, role === "provider" && styles.roleCardActive]}
                  onPress={() => setRole("provider")}
                >
                  <Ionicons name="briefcase" size={24} color={role === "provider" ? "#fff" : TINT} />
                  <Text style={[styles.roleTitle, role === "provider" && styles.roleTitleActive]}>List & Earn</Text>
                  <Text style={[styles.roleSub, role === "provider" && styles.roleSubActive]}>Offer your equipment</Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#C0392B" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button3D
              onPress={handleSubmit}
              disabled={loading}
              faceStyle={({ pressed }) => [styles.submitBtn, { opacity: pressed || loading ? 0.8 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Complete Profile</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </>
              )}
            </Button3D>

            {/* Skip link */}
            <Pressable
              onPress={async () => {
                await logout();
                router.replace("/sign-in");
              }}
              style={styles.skipRow}
            >
              <Text style={styles.skipText}>Sign in with a different account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <Modal visible={locationModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select District</Text>
              <Pressable onPress={() => { setLocationModal(false); setLocationSearch(""); }} hitSlop={12}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
            </View>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color={C.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={locationSearch}
                onChangeText={setLocationSearch}
                placeholder="Search districts..."
                placeholderTextColor={C.textTertiary}
                autoFocus
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredDistricts.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.districtRow, location === d && styles.districtRowSelected]}
                  onPress={() => {
                    setLocation(d);
                    setLocationModal(false);
                    setLocationSearch("");
                  }}
                >
                  <Text style={[styles.districtText, location === d && styles.districtTextSelected]}>{d}</Text>
                  {location === d && <Ionicons name="checkmark" size={16} color={TINT} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TINT },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  header: { alignItems: "center", marginBottom: 28, gap: 12 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    shadowColor: "#C0390A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
  },
  heading: { fontSize: 26, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  subheading: { fontSize: 14, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 10 },

  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 20 },

  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  hint: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.backgroundTertiary, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, overflow: "hidden",
  },
  inputRowSimple: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.backgroundTertiary, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14,
  },
  countryCode: {
    paddingHorizontal: 14, paddingVertical: 13,
    backgroundColor: "#F0F0F0", borderRightWidth: 1, borderColor: C.border,
  },
  countryCodeText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  phoneInput: {
    flex: 1, fontSize: 15, fontFamily: "Inter_400Regular",
    color: C.text, paddingVertical: 13, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },

  roleRow: { flexDirection: "row", gap: 12 },
  roleCard: {
    flex: 1, alignItems: "center", gap: 6, padding: 16, borderRadius: 16,
    borderWidth: 2, borderColor: C.border, backgroundColor: "#FFF8F4",
  },
  roleCardActive: { backgroundColor: TINT, borderColor: TINT },
  roleTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: TINT, textAlign: "center" },
  roleTitleActive: { color: "#fff" },
  roleSub: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
  roleSubActive: { color: "rgba(255,255,255,0.85)" },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: "#FFF0EE", borderRadius: 12, borderWidth: 1, borderColor: "#F5C6C0" },
  errorText: { flex: 1, fontSize: 13, color: "#C0392B", fontFamily: "Inter_400Regular" },

  submitBtn: {
    backgroundColor: TINT, borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },

  skipRow: { alignItems: "center", paddingVertical: 4 },
  skipText: { fontSize: 13, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  // Location modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingBottom: 32 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, padding: 12, backgroundColor: C.backgroundTertiary, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  districtRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.border },
  districtRowSelected: { backgroundColor: "#FFF5EE" },
  districtText: { fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  districtTextSelected: { fontFamily: "Inter_600SemiBold", color: TINT },
});
