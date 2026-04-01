import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;

/* ── Reusable sub-components ── */

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={ss.sectionHeader}>
      <View style={ss.sectionIconWrap}>
        <Ionicons name={icon as any} size={16} color={C.tint} />
      </View>
      <Text style={ss.sectionTitle}>{title}</Text>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  value,
  onPress,
  chevron = true,
  color,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ss.row, { backgroundColor: pressed && onPress ? "#F9FAFB" : "#fff" }]}
    >
      <View style={[ss.rowIcon, { backgroundColor: color ? `${color}15` : C.backgroundTertiary }]}>
        <Ionicons name={icon as any} size={19} color={color || C.text} />
      </View>
      <View style={ss.rowContent}>
        <Text style={[ss.rowLabel, color ? { color } : {}]}>{label}</Text>
        {sublabel ? <Text style={ss.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {value ? <Text style={ss.rowValue}>{value}</Text> : null}
      {chevron && onPress ? <Ionicons name="chevron-forward" size={16} color={C.textTertiary} /> : null}
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  sublabel,
  value,
  onChange,
  color,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}) {
  return (
    <View style={ss.row}>
      <View style={[ss.rowIcon, { backgroundColor: color ? `${color}15` : C.backgroundTertiary }]}>
        <Ionicons name={icon as any} size={19} color={color || C.text} />
      </View>
      <View style={ss.rowContent}>
        <Text style={ss.rowLabel}>{label}</Text>
        {sublabel ? <Text style={ss.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: C.border, true: `${C.tint}60` }}
        thumbColor={value ? C.tint : "#f4f3f4"}
      />
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={ss.card}>{children}</View>;
}

function Divider() {
  return <View style={ss.divider} />;
}

/* ── Main Screen ── */

interface NotifPrefs {
  bookingRequests: boolean;
  bookingConfirmations: boolean;
  messages: boolean;
  paymentUpdates: boolean;
  promotions: boolean;
}

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
  const [notif, setNotif] = useState<NotifPrefs>({
    bookingRequests: true,
    bookingConfirmations: true,
    messages: true,
    paymentUpdates: true,
    promotions: true,
  });
  const [privacy, setPrivacy] = useState<PrivacyPrefs>({ profileVisibility: "public", showPhone: true });
  const [prefs, setPrefs] = useState<Prefs>({ darkMode: "system", dataSaver: false });
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Account edit state
  const [editingAccount, setEditingAccount] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.email || "");
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
      const data = await get<{ notifications: NotifPrefs; privacy: PrivacyPrefs; preferences: Prefs }>("/settings");
      setNotif(data.notifications);
      setPrivacy(data.privacy);
      setPrefs(data.preferences);
    } catch { /* use defaults */ }
    finally { setLoadingSettings(false); }
  }

  async function updateNotif(key: keyof NotifPrefs, val: boolean) {
    const next = { ...notif, [key]: val };
    setNotif(next);
    try { await patch("/settings/notifications", { [key]: val }); } catch { setNotif(notif); }
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
        { firstName, lastName, email }
      );
      updateUser({ firstName: updated.firstName, lastName: updated.lastName, email: updated.email, name: updated.name });
      setEditingAccount(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update account");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setSavingAccount(false); }
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
      <View style={[ss.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={ss.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={ss.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={ss.scroll} showsVerticalScrollIndicator={false}>

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
                <TextInput style={ss.editInput} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.textTertiary} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={ss.editActions}>
                <Pressable onPress={() => setEditingAccount(false)} style={ss.editCancelBtn}>
                  <Text style={ss.editCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveAccount} disabled={savingAccount} style={ss.editSaveBtn}>
                  {savingAccount ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.editSaveText}>Save</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <SettingRow icon="create-outline" label="Edit Profile" sublabel={displayName} onPress={() => { setFirstName(user?.firstName || ""); setLastName(user?.lastName || ""); setEmail(user?.email || ""); setEditingAccount(true); }} />
              <Divider />
              <SettingRow icon="mail-outline" label="Email" sublabel={user?.email || "Not set"} onPress={() => { setFirstName(user?.firstName || ""); setLastName(user?.lastName || ""); setEmail(user?.email || ""); setEditingAccount(true); }} />
            </>
          )}
        </Card>

        {/* ── 2. Security ── */}
        <SectionHeader title="Password & Security" icon="shield-checkmark-outline" />
        <Card>
          <SettingRow icon="lock-closed-outline" label="Change Password" sublabel="Update your password" onPress={() => setShowPasswordModal(true)} />
          <Divider />
          <SettingRow icon="phone-portrait-outline" label="Two-Factor Authentication" sublabel="Coming soon" chevron={false} color={C.textTertiary} />
          <Divider />
          <SettingRow icon="time-outline" label="Login Activity" sublabel="View recent sign-ins" onPress={() => Alert.alert("Login Activity", "You are currently logged in on this device.")} />
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
              <Pressable onPress={() => setShowPasswordModal(false)} style={ss.editCancelBtn}>
                <Text style={ss.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={changePassword} disabled={savingPwd} style={ss.editSaveBtn}>
                {savingPwd ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.editSaveText}>Update</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── 3. Notifications ── */}
        <SectionHeader title="Notification Preferences" icon="notifications-outline" />
        <Card>
          {loadingSettings ? <ActivityIndicator color={C.tint} style={{ padding: 20 }} /> : (
            <>
              <ToggleRow icon="calendar-outline" label="Booking Requests" sublabel="New bookings for your listings" value={notif.bookingRequests} onChange={(v) => updateNotif("bookingRequests", v)} color="#3B82F6" />
              <Divider />
              <ToggleRow icon="checkmark-circle-outline" label="Booking Confirmations" sublabel="When a booking is confirmed" value={notif.bookingConfirmations} onChange={(v) => updateNotif("bookingConfirmations", v)} color="#22C55E" />
              <Divider />
              <ToggleRow icon="chatbubble-outline" label="Messages" sublabel="Chat messages from others" value={notif.messages} onChange={(v) => updateNotif("messages", v)} color="#8B5CF6" />
              <Divider />
              <ToggleRow icon="card-outline" label="Payment Updates" sublabel="Payment received or due" value={notif.paymentUpdates} onChange={(v) => updateNotif("paymentUpdates", v)} color="#F59E0B" />
              <Divider />
              <ToggleRow icon="pricetag-outline" label="Promotions & Offers" sublabel="Deals and special offers" value={notif.promotions} onChange={(v) => updateNotif("promotions", v)} color="#EC4899" />
            </>
          )}
        </Card>

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
          <SettingRow icon="ban-outline" label="Blocked Users" sublabel="Manage blocked accounts" onPress={() => Alert.alert("Blocked Users", "No users blocked.")} />
          <Divider />
          <SettingRow icon="flag-outline" label="Report a User" sublabel="Report abusive behaviour" onPress={() => Alert.alert("Report", "Send an email to support@rentzilla.in to report a user.")} />
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
          <SettingRow icon="cash-outline" label="Currency" value="₹ INR" chevron={false} />
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
          <Divider />
          <ToggleRow
            icon="cellular-outline"
            label="Data Saver"
            sublabel="Reduce image quality to save data"
            value={prefs.dataSaver}
            onChange={(v) => updatePrefs("dataSaver", v)}
          />
        </Card>

        {/* ── 7. Safety ── */}
        <SectionHeader title="Safety" icon="shield-outline" />
        <Card>
          <SettingRow icon="call-outline" label="Emergency Contact" sublabel="Add a trusted contact" onPress={() => Alert.alert("Emergency Contact", "Feature coming soon")} />
          <Divider />
          <SettingRow icon="alert-circle-outline" label="Report an Issue" sublabel="Something not right?" onPress={() => Alert.alert("Report Issue", "Email us at support@rentzilla.in")} />
          <Divider />
          <SettingRow icon="ribbon-outline" label="Trust & Verification" sublabel="Your verification status" onPress={() => Alert.alert("Verification", "Your account is not yet verified. Complete your profile to get verified.")} />
        </Card>

        {/* ── 8. Help & Support ── */}
        <SectionHeader title="Help & Support" icon="help-circle-outline" />
        <Card>
          <SettingRow icon="document-text-outline" label="FAQ" sublabel="Frequently asked questions" onPress={() => Alert.alert("FAQ", "Visit rentzilla.in/faq for answers.")} />
          <Divider />
          <SettingRow icon="mail-outline" label="Contact Support" sublabel="support@rentzilla.in" onPress={() => Alert.alert("Support", "Email us at support@rentzilla.in")} />
          <Divider />
          <SettingRow icon="document-outline" label="Terms & Conditions" onPress={() => Alert.alert("Terms", "Visit rentzilla.in/terms")} />
          <Divider />
          <SettingRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => Alert.alert("Privacy", "Visit rentzilla.in/privacy")} />
        </Card>

        {/* ── 9. Danger Zone ── */}
        <SectionHeader title="Danger Zone" icon="warning-outline" />
        <Card>
          <SettingRow
            icon="log-out-outline"
            label="Logout"
            color={C.error}
            chevron={false}
            onPress={() =>
              Alert.alert("Logout", "Are you sure?", [
                { text: "Cancel", style: "cancel" },
                { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/sign-in"); } },
              ])
            }
          />
        </Card>

        <View style={[ss.footer, { paddingBottom: botPad + 20 }]}>
          <Text style={ss.footerText}>RentZilla v1.0 · Punjab, India</Text>
          <Text style={ss.footerText}>Made with ❤️ for Punjab</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F5F7" },
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
  scroll: { flex: 1 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: C.navy,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 18,
    padding: 20,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(232,116,42,0.2)",
    borderWidth: 2, borderColor: `${C.tint}50`,
    alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  profileName: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  profileEmail: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 2 },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: `${C.tint}30`,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6,
  },
  roleBadgeText: { color: C.tint, fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 8,
  },
  sectionIconWrap: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: `${C.tint}15`,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium", color: C.text },
  rowSublabel: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  divider: { height: 1, backgroundColor: C.borderLight, marginLeft: 64 },

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
});
