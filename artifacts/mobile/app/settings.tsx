import Button3D from "@/components/Button3D";
import NotificationSettings from "@/components/NotificationSettings";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Linking } from "react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { DrawerTokens as D } from "@/constants/drawerTokens";
import { SettingsHero, SettingsPalette, accentFor } from "@/components/SettingsTheme";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";
import { confirmAction } from "@/lib/confirm";

const C = Colors.light;
const SP = SettingsPalette;

/* ── Reusable sub-components ── */

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  const a = accentFor(icon);
  return (
    <View style={ss.sectionHeader}>
      <View style={[ss.sectionIconWrap, { backgroundColor: a.fg }]}>
        <Ionicons name={icon as any} size={15} color="#FFFFFF" />
      </View>
      <Text style={ss.sectionTitle}>{title}</Text>
      <View style={[ss.sectionRule, { backgroundColor: a.bg }]} />
    </View>
  );
}

function SettingRow({ icon, label, sublabel, value, onPress, chevron = true, color }: {
  icon: string; label: string; sublabel?: string; value?: string;
  onPress?: () => void; chevron?: boolean; color?: string;
}) {
  const a = accentFor(icon, color);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      style={({ pressed }) => [ss.row, { backgroundColor: pressed && onPress ? SP.pressed : "transparent" }]}
    >
      <View style={[ss.rowIcon, { backgroundColor: a.bg }]}>
        <Ionicons name={icon as any} size={20} color={a.fg} />
      </View>
      <View style={ss.rowContent}>
        <Text style={[ss.rowLabel, color ? { color, fontFamily: "Inter_700Bold" } : {}]}>{label}</Text>
        {sublabel ? <Text style={ss.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {value ? <View style={[ss.valuePill, { backgroundColor: a.bg }]}><Text style={[ss.rowValue, { color: a.fg }]}>{value}</Text></View> : null}
      {chevron && onPress ? (
        <View style={ss.chevronPill}><Ionicons name="chevron-forward" size={14} color={color || SP.textSecondary} /></View>
      ) : null}
    </Pressable>
  );
}

function ToggleRow({ icon, label, sublabel, value, onChange, color }: {
  icon: string; label: string; sublabel?: string;
  value: boolean; onChange: (v: boolean) => void; color?: string;
}) {
  const a = accentFor(icon, color);
  return (
    <View style={ss.row}>
      <View style={[ss.rowIcon, { backgroundColor: a.bg }]}>
        <Ionicons name={icon as any} size={20} color={a.fg} />
      </View>
      <View style={ss.rowContent}>
        <Text style={ss.rowLabel}>{label}</Text>
        {sublabel ? <Text style={ss.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        accessibilityLabel={label}
        onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: SP.cardBorder, true: `${SP.primary}70` }}
        thumbColor={value ? SP.primary : "#FFFDF9"}
      />
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={ss.card}>{children}</View>;
}

function Divider() { return <View style={ss.divider} />; }

/* ── Main Screen ── */


interface PrivacyPrefs {
  profileVisibility: "public" | "private";
  showPhone: boolean;
}

interface Prefs {
  darkMode: "system" | "light" | "dark";
  dataSaver: boolean;
}

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const { get, patch, del } = useApi();
  const { t, language, toggleLanguage } = useLang();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;

  // Settings state
  const [privacy, setPrivacy] = useState<PrivacyPrefs>({ profileVisibility: "public", showPhone: true });
  const [prefs, setPrefs] = useState<Prefs>({ darkMode: "system", dataSaver: false });
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Delete account state
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0); // 0=hidden, 1=reason, 2=confirm
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Account edit state
  const [editingAccount, setEditingAccount] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [savingAccount, setSavingAccount] = useState(false);

  // Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const data = await get<{ privacy: PrivacyPrefs; preferences: Prefs }>("/settings");
      setPrivacy(data.privacy);
      setPrefs(data.preferences);
    } catch { /* use defaults */ }
    finally { setLoadingSettings(false); }
  }


  async function updatePrivacy(key: keyof PrivacyPrefs, val: any) {
    const next = { ...privacy, [key]: val };
    setPrivacy(next);
    try { await patch("/settings/privacy", { [key]: val }); } catch { setPrivacy(privacy); }
  }

  async function updatePrefs(key: keyof Prefs, val: any) {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    try { await patch("/settings/preferences", { [key]: val }); } catch { setPrefs(prefs); }
  }

  async function saveAccount() {
    setSavingAccount(true);
    try {
      const updated = await patch<{ firstName: string; lastName: string; email: string; name: string }>(
        "/settings/account",
        { firstName, lastName }
      );
      updateUser({ firstName: updated.firstName, lastName: updated.lastName, email: updated.email, name: updated.name });
      setEditingAccount(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update account");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setSavingAccount(false); }
  }

  async function handleDeleteAccount() {
    if (!deleteReason.trim()) {
      Alert.alert("Please select a reason", "Tell us why you want to delete your account.");
      return;
    }
    setIsDeleting(true);
    try {
      await del("/users/me", { reason: deleteReason });
      setDeleteStep(0);
      await logout();
      router.replace("/sign-in");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function changePassword() {
    if (!currentPwd || !newPwd || !confirmPwd) { Alert.alert("Error", "All fields are required"); return; }
    if (newPwd !== confirmPwd) { Alert.alert("Error", "New passwords do not match"); return; }
    if (newPwd.length < 6) { Alert.alert("Error", "New password must be at least 6 characters"); return; }
    setSavingPwd(true);
    try {
      await patch("/settings/password", { currentPassword: currentPwd, newPassword: newPwd });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setShowPasswordModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Password changed successfully");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to change password");
    } finally { setSavingPwd(false); }
  }


  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";

  return (
    <View style={ss.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <SettingsHero topPad={topPad} title="Settings" subtitle="Account, safety & app preferences" onBack={() => router.back()} />

      <ScrollView
        style={ss.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 120 }}
      >

        {/* ── Profile card ── */}
        <View style={ss.profileCard}>
          <View style={ss.avatar}>
            <Text style={ss.avatarLetter}>{displayName[0]?.toUpperCase() || "?"}</Text>
          </View>
          <View>
            <Text style={ss.profileName}>{displayName}</Text>
            <Text style={ss.profileEmail}>{user?.email || user?.phone}</Text>
            <View style={ss.roleBadge}>
              <Text style={ss.roleBadgeText}>{user?.role === "provider" ? "Provider" : "Customer"}</Text>
            </View>
          </View>
        </View>

        {/* ── 1. Account Settings ── */}
        <SectionHeader title="Account Settings" icon="person-outline" />
        <Card>
          {editingAccount ? (
            <View style={ss.editForm}>
              <View style={ss.editRow}>
                <View style={[ss.editField, { flex: 1 }]}>
                  <Text style={ss.editLabel}>First Name</Text>
                  <TextInput style={ss.editInput} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={C.textTertiary} autoCapitalize="words" />
                </View>
                <View style={[ss.editField, { flex: 1 }]}>
                  <Text style={ss.editLabel}>Last Name</Text>
                  <TextInput style={ss.editInput} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={C.textTertiary} autoCapitalize="words" />
                </View>
              </View>
              <View style={ss.editField}>
                <Text style={ss.editLabel}>Email</Text>
                <Text style={ss.editLabel} selectable>{user?.email || "Not set"}</Text>
              </View>
              <View style={ss.editActions}>
                <Button3D onPress={() => setEditingAccount(false)} faceStyle={ss.editCancelBtn}>
                  <Text style={ss.editCancelText}>Cancel</Text>
                </Button3D>
                <Button3D onPress={saveAccount} disabled={savingAccount} faceStyle={ss.editSaveBtn}>
                  {savingAccount ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.editSaveText}>Save</Text>}
                </Button3D>
              </View>
            </View>
          ) : (
            <>
              <SettingRow icon="create-outline" label="Edit Name" sublabel={displayName} onPress={() => { setFirstName(user?.firstName || ""); setLastName(user?.lastName || ""); setEditingAccount(true); }} />
              <Divider />
              <SettingRow icon="mail-outline" label="Email" sublabel={user?.email || "Not set"} chevron={false} />
            </>
          )}
        </Card>

        {/* ── 2. Security ── */}
        <SectionHeader title="Password & Security" icon="shield-checkmark-outline" />
        <Card>
          <SettingRow icon="lock-closed-outline" label="Change Password" sublabel="Update your password" onPress={() => setShowPasswordModal(true)} />
        </Card>

        {showPasswordModal && (
          <View style={ss.pwdCard}>
            <Text style={ss.pwdTitle}>Change Password</Text>
            <View style={ss.editField}>
              <Text style={ss.editLabel}>Current Password</Text>
              <TextInput style={ss.editInput} value={currentPwd} onChangeText={setCurrentPwd} secureTextEntry placeholder="••••••" placeholderTextColor={C.textTertiary} />
            </View>
            <View style={ss.editField}>
              <Text style={ss.editLabel}>New Password</Text>
              <TextInput style={ss.editInput} value={newPwd} onChangeText={setNewPwd} secureTextEntry placeholder="Min 6 characters" placeholderTextColor={C.textTertiary} />
            </View>
            <View style={ss.editField}>
              <Text style={ss.editLabel}>Confirm New Password</Text>
              <TextInput style={ss.editInput} value={confirmPwd} onChangeText={setConfirmPwd} secureTextEntry placeholder="Repeat new password" placeholderTextColor={C.textTertiary} />
            </View>
            <View style={ss.editActions}>
              <Button3D onPress={() => setShowPasswordModal(false)} faceStyle={ss.editCancelBtn}>
                <Text style={ss.editCancelText}>Cancel</Text>
              </Button3D>
              <Button3D onPress={changePassword} disabled={savingPwd} faceStyle={ss.editSaveBtn}>
                {savingPwd ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.editSaveText}>Update</Text>}
              </Button3D>
            </View>
          </View>
        )}

        {/* ── 3. Notifications ── */}
        <SectionHeader title="Notifications" icon="notifications-outline" />
        <NotificationSettings />

        {/* ── 4. Privacy ── */}
        <SectionHeader title="Privacy & Visibility" icon="eye-outline" />
        <Card>
          <ToggleRow
            icon="globe-outline"
            label="Public Profile"
            sublabel={privacy.profileVisibility === "public" ? "Anyone can view your profile" : "Only you can see your profile"}
            value={privacy.profileVisibility === "public"}
            onChange={(v) => updatePrivacy("profileVisibility", v ? "public" : "private")}
            color="#3B82F6"
          />
          <Divider />
          <ToggleRow
            icon="call-outline"
            label="Show Phone Number"
            sublabel="Display your number on listings"
            value={privacy.showPhone}
            onChange={(v) => updatePrivacy("showPhone", v)}
          />
          <Divider />
          <SettingRow icon="ban-outline" label="Blocked Users" sublabel="Manage blocked accounts" onPress={() => router.push("/(tabs)/settings" as any)} />
          <Divider />
          <SettingRow icon="flag-outline" label="Report a User" sublabel="Report abusive behaviour" onPress={() => router.push("/(tabs)/settings" as any)} />
        </Card>

        {/* ── 5. Language & Region ── */}
        <SectionHeader title="Language & Region" icon="language-outline" />
        <Card>
          <SettingRow
            icon="language-outline"
            label="Language"
            value={language === "en" ? "English" : "ਪੰਜਾਬੀ"}
            onPress={() => { Haptics.selectionAsync(); toggleLanguage(); }}
          />
          <Divider />
          <SettingRow icon="location-outline" label="Region" value="Punjab, India" chevron={false} />
        </Card>

        {/* ── 6. App Preferences ── */}
        <SectionHeader title="App Preferences" icon="settings-outline" />
        <Card>
          <SettingRow
            icon="moon-outline"
            label="Appearance"
            value={prefs.darkMode === "system" ? "System" : prefs.darkMode === "dark" ? "Dark" : "Light"}
            onPress={() => {
              const next = prefs.darkMode === "system" ? "light" : prefs.darkMode === "light" ? "dark" : "system";
              updatePrefs("darkMode", next);
            }}
          />
        </Card>

        {/* ── 7. Safety ── */}
        <SectionHeader title="Safety & Emergency" icon="shield-outline" />
        <Card>
          <SettingRow icon="call-outline" label="Emergency Contact" sublabel="Add a trusted contact" onPress={() => router.push("/(tabs)/settings" as any)} />
          <Divider />
          <SettingRow icon="alert-circle-outline" label="Report an Issue" sublabel="Something not right?" onPress={() => router.push("/(tabs)/settings" as any)} />
          <Divider />
          <SettingRow icon="ribbon-outline" label="Trust & Verification" sublabel="Your verification status" onPress={() => router.push("/trust-verification" as any)} />
        </Card>

        {/* ── 8. Help & Support ── */}
        <SectionHeader title="Help & Support" icon="help-circle-outline" />
        <Card>
          <SettingRow icon="document-text-outline" label="FAQ" sublabel="Frequently asked questions" onPress={() => router.push("/(tabs)/settings" as any)} />
          <Divider />
          <SettingRow icon="mail-outline" label="Contact Support" sublabel="Tap to send a request" onPress={() => router.push("/(tabs)/settings" as any)} />
          <Divider />
          <SettingRow icon="document-outline" label="Terms & Conditions" onPress={() => Linking.openURL("https://rent-organizer.replit.app/terms").catch(() => router.push("/(tabs)/settings" as any))} />
          <Divider />
          <SettingRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => Linking.openURL("https://rent-organizer.replit.app/privacy").catch(() => router.push("/(tabs)/settings" as any))} />
        </Card>

        {/* ── 9. Danger Zone ── */}
        <SectionHeader title="Danger Zone" icon="warning-outline" />
        <Card>
          <Pressable
            onPress={() => { setDeleteReason(""); setDeleteStep(1); }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 16,
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={ss.deleteAccountIcon}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.deleteAccountLabel}>Delete Account</Text>
              <Text style={ss.deleteAccountSub}>Permanently removes all your data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#DC2626" />
          </Pressable>
          <Divider />
          <SettingRow
            icon="log-out-outline"
            label="Logout"
            color={C.error}
            chevron={false}
            onPress={() =>
              confirmAction({
                title: "Logout",
                message: "Are you sure?",
                confirmText: "Logout",
                destructive: true,
                onConfirm: async () => { await logout(); router.replace("/sign-in"); },
              })
            }
          />
        </Card>

        <View style={[ss.footer, { paddingBottom: botPad + 20 }]}>
          <Text style={ss.footerText}>RentZilla v1.0 · Punjab, India</Text>
          <Text style={ss.footerText}>Made with ❤️ for Punjab</Text>
        </View>
      </ScrollView>

      {/* ── Delete Account Modal — outside ScrollView ── */}
      <Modal visible={deleteStep > 0} transparent animationType="slide" onRequestClose={() => setDeleteStep(0)}>
        <View style={ss.modalOverlay}>
          <View style={ss.modalSheet}>
            {deleteStep === 1 ? (
              <>
                <View style={ss.modalHeader}>
                  <View style={ss.modalIconWrap}>
                    <Ionicons name="trash-outline" size={28} color="#DC2626" />
                  </View>
                  <Text style={ss.modalTitle}>Delete Account</Text>
                  <Text style={ss.modalSub}>Please tell us why you're leaving</Text>
                </View>

                {[
                  "I no longer need this app",
                  "I have privacy concerns",
                  "I found a better alternative",
                  "The app has technical issues",
                  "Too many notifications",
                  "Other reason",
                ].map((reason) => (
                  <Pressable
                    key={reason}
                    onPress={() => setDeleteReason(reason)}
                    style={[ss.reasonRow, deleteReason === reason && ss.reasonRowSelected]}
                  >
                    <View style={[ss.radioCircle, deleteReason === reason && ss.radioCircleFilled]}>
                      {deleteReason === reason && <View style={ss.radioDot} />}
                    </View>
                    <Text style={[ss.reasonText, deleteReason === reason && ss.reasonTextSelected]}>{reason}</Text>
                  </Pressable>
                ))}

                <View style={ss.modalBtns}>
                  <Button3D onPress={() => setDeleteStep(0)} faceStyle={ss.modalCancelBtn}>
                    <Text style={ss.modalCancelTxt}>Cancel</Text>
                  </Button3D>
                  <Button3D
                    onPress={() => { if (!deleteReason) { Alert.alert("Select a reason", "Please choose one."); return; } setDeleteStep(2); }}
                    faceStyle={[ss.modalNextBtn, !deleteReason && { opacity: 0.4 }]}
                  >
                    <Text style={ss.modalNextTxt}>Continue →</Text>
                  </Button3D>
                </View>
              </>
            ) : (
              <>
                <View style={ss.modalHeader}>
                  <View style={[ss.modalIconWrap, { backgroundColor: "#FEE2E2" }]}>
                    <Ionicons name="warning-outline" size={28} color="#DC2626" />
                  </View>
                  <Text style={ss.modalTitle}>Are you absolutely sure?</Text>
                  <Text style={ss.modalSub}>This cannot be undone. Your account, wallet, bookings, listings and all data will be permanently erased.</Text>
                </View>

                <View style={ss.confirmBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#DC2626" />
                  <Text style={ss.confirmBoxTxt}>
                    Reason: <Text style={{ fontWeight: "700" }}>{deleteReason}</Text>
                  </Text>
                </View>

                <Button3D
                  onPress={handleDeleteAccount}
                  disabled={isDeleting}
                  faceStyle={[ss.deleteBtn, isDeleting && { opacity: 0.6 }]}
                >
                  {isDeleting
                    ? <ActivityIndicator color="#fff" />
                    : <><Ionicons name="trash" size={18} color="#fff" /><Text style={ss.deleteBtnTxt}>Yes, Delete My Account</Text></>
                  }
                </Button3D>

                <Pressable onPress={() => setDeleteStep(1)} style={ss.modalBackBtn}>
                  <Text style={ss.modalBackTxt}>← Go back</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: SP.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  scroll: { flex: 1, marginTop: -26, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: SP.page },

  // Delete account modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalHeader: { alignItems: "center", marginBottom: 20 },
  modalIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#111827", fontFamily: "Inter_700Bold", textAlign: "center" },
  modalSub: { fontSize: 14, color: "#6B7280", marginTop: 6, textAlign: "center", lineHeight: 20 },
  reasonRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: "transparent" },
  reasonRowSelected: { backgroundColor: "#FEF2F2", borderColor: "#DC2626" },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center", marginRight: 12 },
  radioCircleFilled: { borderColor: "#DC2626" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#DC2626" },
  reasonText: { fontSize: 14, color: "#374151", flex: 1 },
  reasonTextSelected: { color: "#DC2626", fontWeight: "600" },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  modalCancelTxt: { fontSize: 15, fontWeight: "600", color: "#374151" },
  modalNextBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#374151", alignItems: "center" },
  modalNextTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  confirmBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, gap: 8, marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" },
  confirmBoxTxt: { fontSize: 13, color: "#DC2626", flex: 1, lineHeight: 18 },
  deleteBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  deleteBtnTxt: { fontSize: 16, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  modalBackBtn: { alignItems: "center", paddingVertical: 10 },
  modalBackTxt: { fontSize: 14, color: "#6B7280", fontWeight: "600" },

  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: D.cream, marginHorizontal: 16, marginTop: 18, marginBottom: 4, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: D.creamBorder, shadowColor: "#B85A10", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 6 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: D.avatarBg, borderWidth: 2, borderColor: D.creamBorder, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", color: SP.primary },
  profileName: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: SP.text },
  profileEmail: { fontSize: 13, color: SP.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  roleBadge: { alignSelf: "flex-start", backgroundColor: SP.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  roleBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  sectionIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionRule: { flex: 1, height: 3, borderRadius: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: SP.text, letterSpacing: 0.4, textTransform: "uppercase" },

  card: { backgroundColor: SP.card, marginHorizontal: 16, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: SP.cardBorder, paddingVertical: 4, shadowColor: "#B85A10", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },

  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, minHeight: 60, gap: 14 },
  rowIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  valuePill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chevronPill: { width: 26, height: 26, borderRadius: 13, backgroundColor: SP.chevronBg, alignItems: "center", justifyContent: "center" },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: SP.text },
  rowSublabel: { fontSize: 12, color: SP.textSecondary, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: SP.primary },

  divider: { height: 1, backgroundColor: SP.divider, marginLeft: 72, marginRight: 14 },

  editForm: { padding: 16, gap: 12 },
  editRow: { flexDirection: "row", gap: 10 },
  editField: { gap: 6 },
  editLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  editInput: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  editActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  editCancelBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 11,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: "center",
  },
  editCancelText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  editSaveBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 11,
    backgroundColor: C.tint, alignItems: "center",
  },
  editSaveText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#fff" },

  pwdCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: `${C.tint}30`,
  },
  pwdTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },

  footer: { alignItems: "center", gap: 4, paddingTop: 24 },
  footerText: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  deleteAccountIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAccountLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
  deleteAccountSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 1 },
});
