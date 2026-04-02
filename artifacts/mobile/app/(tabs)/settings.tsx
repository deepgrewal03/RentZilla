import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth, type ActiveMode } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;
const ORANGE = "#E8742A";

// ─── Reusable components ───────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={ss.sectionHeader}>
      <View style={ss.sectionIconWrap}>
        <Ionicons name={icon as any} size={16} color={ORANGE} />
      </View>
      <Text style={ss.sectionTitle}>{title}</Text>
    </View>
  );
}

function SettingRow({ icon, label, sublabel, value, onPress, chevron = true, color }: {
  icon: string; label: string; sublabel?: string; value?: string;
  onPress?: () => void; chevron?: boolean; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ss.row, { backgroundColor: pressed && onPress ? "#F9FAFB" : "#fff" }]}
    >
      <View style={[ss.rowIcon, { backgroundColor: color ? `${color}18` : C.backgroundTertiary }]}>
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

function ToggleRow({ icon, label, sublabel, value, onChange, color }: {
  icon: string; label: string; sublabel?: string;
  value: boolean; onChange: (v: boolean) => void; color?: string;
}) {
  return (
    <View style={ss.row}>
      <View style={[ss.rowIcon, { backgroundColor: color ? `${color}18` : C.backgroundTertiary }]}>
        <Ionicons name={icon as any} size={19} color={color || C.text} />
      </View>
      <View style={ss.rowContent}>
        <Text style={ss.rowLabel}>{label}</Text>
        {sublabel ? <Text style={ss.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: C.border, true: `${ORANGE}60` }}
        thumbColor={value ? ORANGE : "#f4f3f4"}
      />
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={ss.card}>{children}</View>;
}

function Divider() { return <View style={ss.divider} />; }

// ─── FAQ Accordion ────────────────────────────────────────────────────────

type FAQ = { id: number; q: string; a: string };
function FAQItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => { setOpen((o) => !o); Haptics.selectionAsync(); }}
        style={({ pressed }) => [ss.faqRow, { backgroundColor: pressed ? "#F9FAFB" : "#fff" }]}
      >
        <View style={ss.faqQ}>
          <View style={ss.faqNum}>
            <Text style={ss.faqNumText}>{faq.id}</Text>
          </View>
          <Text style={ss.faqQText} numberOfLines={open ? undefined : 2}>{faq.q}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={C.textTertiary} />
      </Pressable>
      {open && (
        <View style={ss.faqAnswer}>
          <Text style={ss.faqAnswerText}>{faq.a}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Blocked Users Modal ─────────────────────────────────────────────────

type BlockedUser = { id: string; blockedId: string; blockedName: string | null; createdAt: string };
function BlockedUsersModal({ visible, onClose, api }: { visible: boolean; onClose: () => void; api: any }) {
  const [list, setList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) fetchBlocked();
  }, [visible]);

  async function fetchBlocked() {
    setLoading(true);
    try { setList(await api.get<BlockedUser[]>("/safety/blocked")); } catch { }
    setLoading(false);
  }

  async function unblock(id: string) {
    try {
      await api.del(`/safety/blocked/${id}`);
      setList((l) => l.filter((b) => b.id !== id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Could not unblock user"); }
  }

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ss.modalRoot}>
        <View style={ss.modalHeader}>
          <Pressable onPress={onClose} style={ss.modalBack}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <Text style={ss.modalTitle}>Blocked Users</Text>
          <View style={{ width: 36 }} />
        </View>
        {loading ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <View style={ss.emptyState}>
            <Ionicons name="ban-outline" size={48} color={C.textTertiary} />
            <Text style={ss.emptyTitle}>No blocked users</Text>
            <Text style={ss.emptyDesc}>Users you block won't be able to contact you</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {list.map((b) => (
              <View key={b.id} style={ss.blockedRow}>
                <View style={ss.blockedAvatar}>
                  <Text style={ss.blockedAvatarText}>{(b.blockedName || "?")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.blockedName}>{b.blockedName || "Unknown User"}</Text>
                  <Text style={ss.blockedDate}>Blocked {new Date(b.createdAt).toLocaleDateString("en-IN")}</Text>
                </View>
                <Pressable onPress={() => unblock(b.id)} style={ss.unblockBtn}>
                  <Text style={ss.unblockText}>Unblock</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Report User Modal ────────────────────────────────────────────────────

const REPORT_REASONS = [
  { id: "spam",         label: "Spam" },
  { id: "fraud",        label: "Fraud" },
  { id: "abuse",        label: "Abuse/Harassment" },
  { id: "fake_listing", label: "Fake Listing" },
  { id: "other",        label: "Other" },
];

function ReportUserModal({ visible, onClose, api }: { visible: boolean; onClose: () => void; api: any }) {
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!userId.trim()) { Alert.alert("Missing", "Enter the user ID or email to report"); return; }
    if (!reason) { Alert.alert("Missing", "Select a reason for the report"); return; }
    setSubmitting(true);
    try {
      await api.post("/safety/reports", { reportedUserId: userId.trim(), reason, description });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Report Submitted", "Thank you. Our team will review this report within 24 hours.", [
        { text: "OK", onPress: () => { setUserId(""); setReason(""); setDescription(""); onClose(); } },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not submit report");
    } finally { setSubmitting(false); }
  }

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ss.modalRoot}>
        <View style={ss.modalHeader}>
          <Pressable onPress={onClose} style={ss.modalBack}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <Text style={ss.modalTitle}>Report a User</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Text style={ss.formNote}>Reports are reviewed within 24 hours. False reports may result in your account being flagged.</Text>

          <View style={ss.formGroup}>
            <Text style={ss.formLabel}>User ID or Email *</Text>
            <TextInput
              style={ss.formInput} value={userId} onChangeText={setUserId}
              placeholder="Enter user ID or email address"
              placeholderTextColor={C.textTertiary} autoCapitalize="none"
            />
          </View>

          <View style={ss.formGroup}>
            <Text style={ss.formLabel}>Reason *</Text>
            <View style={ss.chipRow}>
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r.id} onPress={() => setReason(r.id)}
                  style={[ss.chip, reason === r.id && ss.chipActive]}
                >
                  <Text style={[ss.chipText, reason === r.id && ss.chipTextActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={ss.formGroup}>
            <Text style={ss.formLabel}>Description (optional)</Text>
            <TextInput
              style={[ss.formInput, { height: 100, textAlignVertical: "top", paddingTop: 10 }]}
              value={description} onChangeText={setDescription} multiline
              placeholder="Describe what happened..."
              placeholderTextColor={C.textTertiary}
            />
          </View>

          <Pressable onPress={submit} disabled={submitting} style={[ss.submitBtn, submitting && { opacity: 0.6 }]}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
              <><Ionicons name="flag" size={16} color="#fff" /><Text style={ss.submitText}>Submit Report</Text></>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Report Issue Modal ───────────────────────────────────────────────────

const ISSUE_CATEGORIES = [
  { id: "payment",  label: "💳 Payment", icon: "card-outline" },
  { id: "booking",  label: "📅 Booking", icon: "calendar-outline" },
  { id: "driver",   label: "🚗 Driver",  icon: "car-outline" },
  { id: "app_bug",  label: "🐛 App Bug", icon: "bug-outline" },
  { id: "other",    label: "📝 Other",   icon: "ellipsis-horizontal-outline" },
];

function ReportIssueModal({ visible, onClose, api }: { visible: boolean; onClose: () => void; api: any }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!category) { Alert.alert("Missing", "Select a category"); return; }
    if (!description.trim() || description.length < 10) { Alert.alert("Missing", "Please describe the issue (at least 10 characters)"); return; }
    setSubmitting(true);
    try {
      await api.post("/safety/issues", { category, description });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCategory("");
      setDescription("");
      onClose();
      Alert.alert("Issue Reported", "We've received your report. Our team will look into it within 24 hours.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not submit issue");
    } finally { setSubmitting(false); }
  }

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ss.modalRoot}>
        <View style={ss.modalHeader}>
          <Pressable onPress={onClose} style={ss.modalBack}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <Text style={ss.modalTitle}>Report an Issue</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={ss.formGroup}>
            <Text style={ss.formLabel}>Category *</Text>
            <View style={ss.issueCatGrid}>
              {ISSUE_CATEGORIES.map((c) => (
                <Pressable
                  key={c.id} onPress={() => setCategory(c.id)}
                  style={[ss.issueCat, category === c.id && ss.issueCatActive]}
                >
                  <Ionicons name={c.icon as any} size={22} color={category === c.id ? "#fff" : C.text} />
                  <Text style={[ss.issueCatText, category === c.id && { color: "#fff" }]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={ss.formGroup}>
            <Text style={ss.formLabel}>Describe the issue *</Text>
            <TextInput
              style={[ss.formInput, { height: 130, textAlignVertical: "top", paddingTop: 10 }]}
              value={description} onChangeText={setDescription} multiline
              placeholder="Tell us what went wrong in detail. Include any booking IDs, ride IDs, or screenshots if possible."
              placeholderTextColor={C.textTertiary}
            />
            <Text style={[ss.formNote, { marginTop: 4 }]}>{description.length} / 500 characters</Text>
          </View>

          <Pressable onPress={submit} disabled={submitting} style={[ss.submitBtn, submitting && { opacity: 0.6 }]}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
              <><Ionicons name="send" size={16} color="#fff" /><Text style={ss.submitText}>Send Report</Text></>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Settings Screen ─────────────────────────────────────────────────

interface NotifPrefs { bookingRequests: boolean; bookingConfirmations: boolean; messages: boolean; paymentUpdates: boolean; promotions: boolean; }
interface PrivacyPrefs { profileVisibility: "public" | "private"; showPhone: boolean; }
interface Prefs { darkMode: "system" | "light" | "dark"; dataSaver: boolean; twoFaEnabled?: boolean; }
type EmergencyContact = { id: string; name: string; phone: string; relation: string | null } | null;

export default function SettingsTab() {
  const { user, logout, updateUser, activeMode, setActiveMode } = useAuth();
  const isBoth = user?.role === "both";
  const isCustomerOnly = user?.role === "customer";
  const api = useApi();
  const { get, patch, del, post, put } = api;
  const { t, language, toggleLanguage } = useLang();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;

  // Settings state
  const [notif, setNotif] = useState<NotifPrefs>({ bookingRequests: true, bookingConfirmations: true, messages: true, paymentUpdates: true, promotions: true });
  const [privacy, setPrivacy] = useState<PrivacyPrefs>({ profileVisibility: "public", showPhone: true });
  const [prefs, setPrefs] = useState<Prefs>({ darkMode: "system", dataSaver: false, twoFaEnabled: false });
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Account editing
  const [editingAccount, setEditingAccount] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [savingAccount, setSavingAccount] = useState(false);

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // 2FA
  const [showOtpPanel, setShowOtpPanel] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingTwoFa, setPendingTwoFa] = useState<boolean | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Emergency contact
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>(null);
  const [loadingEC, setLoadingEC] = useState(true);
  const [editingEC, setEditingEC] = useState(false);
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelation, setEcRelation] = useState("");
  const [savingEC, setSavingEC] = useState(false);

  // Modals
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showReportUserModal, setShowReportUserModal] = useState(false);
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchEmergencyContact();
    fetchFAQs();
  }, []);

  async function fetchSettings() {
    try {
      const data = await get<{ notifications: NotifPrefs; privacy: PrivacyPrefs; preferences: Prefs }>("/settings");
      setNotif(data.notifications);
      setPrivacy(data.privacy);
      setPrefs(data.preferences);
    } catch { } finally { setLoadingSettings(false); }
  }

  async function fetchEmergencyContact() {
    try { setEmergencyContact(await get<EmergencyContact>("/safety/emergency-contact")); }
    catch { } finally { setLoadingEC(false); }
  }

  async function fetchFAQs() {
    try { setFaqs(await get<FAQ[]>("/safety/faqs")); } catch { }
  }

  async function updateNotif(key: keyof NotifPrefs, val: boolean) {
    const next = { ...notif, [key]: val }; setNotif(next);
    try { await patch("/settings/notifications", { [key]: val }); } catch { setNotif(notif); }
  }
  async function updatePrivacy(key: keyof PrivacyPrefs, val: any) {
    const next = { ...privacy, [key]: val }; setPrivacy(next);
    try { await patch("/settings/privacy", { [key]: val }); } catch { setPrivacy(privacy); }
  }
  async function updatePrefs(key: keyof Prefs, val: any) {
    const next = { ...prefs, [key]: val }; setPrefs(next);
    try { await patch("/settings/preferences", { [key]: val }); } catch { setPrefs(prefs); }
  }

  async function saveAccount() {
    setSavingAccount(true);
    try {
      const updated = await patch<{ firstName: string; lastName: string; email: string; name: string }>(
        "/settings/account", { firstName, lastName, email }
      );
      updateUser({ firstName: updated.firstName, lastName: updated.lastName, email: updated.email, name: updated.name });
      setEditingAccount(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to update account"); }
    finally { setSavingAccount(false); }
  }

  async function changePassword() {
    if (!currentPwd || !newPwd || !confirmPwd) { Alert.alert("Error", "All fields are required"); return; }
    if (newPwd !== confirmPwd) { Alert.alert("Error", "New passwords do not match"); return; }
    if (newPwd.length < 6) { Alert.alert("Error", "Min 6 characters"); return; }
    setSavingPwd(true);
    try {
      await patch("/settings/password", { currentPassword: currentPwd, newPassword: newPwd });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setShowPasswordModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Password changed successfully");
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to change password"); }
    finally { setSavingPwd(false); }
  }

  // 2FA flow
  async function toggle2FA(enabled: boolean) {
    setPendingTwoFa(enabled);
    setSendingOtp(true);
    try {
      const res = await post<{ code: string; message: string }>("/safety/2fa/send-otp", {});
      setShowOtpPanel(true);
      // Demo: show OTP since no email service is connected
      Alert.alert("OTP Sent (Demo)", `Your verification code is: ${res.code}\n\nIn production, this would be sent to your email.`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not send OTP");
      setPendingTwoFa(null);
    } finally { setSendingOtp(false); }
  }

  async function verify2FA() {
    if (!otpCode.trim() || otpCode.length !== 6) { Alert.alert("Error", "Enter the 6-digit OTP"); return; }
    setVerifyingOtp(true);
    try {
      await post("/safety/2fa/verify-otp", { code: otpCode, enable: pendingTwoFa });
      const next = { ...prefs, twoFaEnabled: !!pendingTwoFa };
      setPrefs(next);
      setShowOtpPanel(false); setOtpCode(""); setPendingTwoFa(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Two-factor authentication ${pendingTwoFa ? "enabled" : "disabled"} successfully`);
    } catch (e: any) { Alert.alert("Error", e.message || "Invalid OTP"); }
    finally { setVerifyingOtp(false); }
  }

  // Emergency contact
  function startEditEC() {
    setEcName(emergencyContact?.name || "");
    setEcPhone(emergencyContact?.phone || "");
    setEcRelation(emergencyContact?.relation || "");
    setEditingEC(true);
  }

  async function saveEC() {
    if (!ecName.trim() || !ecPhone.trim()) { Alert.alert("Error", "Name and phone are required"); return; }
    setSavingEC(true);
    try {
      const saved = await put<EmergencyContact & { name: string; phone: string; relation: string }>("/safety/emergency-contact", { name: ecName, phone: ecPhone, relation: ecRelation });
      setEmergencyContact(saved);
      setEditingEC(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Could not save"); }
    finally { setSavingEC(false); }
  }

  async function deleteEC() {
    Alert.alert("Remove Contact", "Remove your emergency contact?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await del("/safety/emergency-contact"); setEmergencyContact(null); setEditingEC(false); }
        catch { Alert.alert("Error", "Could not remove contact"); }
      }},
    ]);
  }


  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";

  return (
    <View style={ss.root}>
      <StatusBar style="dark" />

      <View style={[ss.header, { paddingTop: topPad + 8 }]}>
        <Text style={ss.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={ss.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Profile card ── */}
        <View style={ss.profileCard}>
          <View style={ss.avatar}>
            <Text style={ss.avatarLetter}>{displayName[0]?.toUpperCase() || "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.profileName}>{displayName}</Text>
            <Text style={ss.profileEmail}>{user?.email}</Text>
            <View style={ss.roleBadge}>
              <Text style={ss.roleBadgeText}>
                {user?.role === "provider" ? "Provider" : user?.role === "both" ? "Customer & Provider" : "Customer"}
              </Text>
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
                <Pressable onPress={() => setEditingAccount(false)} style={ss.editCancelBtn}><Text style={ss.editCancelText}>Cancel</Text></Pressable>
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

        {/* ── 2. Password & Security ── */}
        <SectionHeader title="Password & Security" icon="shield-checkmark-outline" />
        <Card>
          <SettingRow icon="lock-closed-outline" label="Change Password" sublabel="Update your login password" onPress={() => setShowPasswordModal(true)} />
          <Divider />
          <ToggleRow
            icon="phone-portrait-outline" label="Two-Factor Authentication"
            sublabel={prefs.twoFaEnabled ? "Enabled — OTP required at login" : "Adds extra security to your account"}
            value={!!prefs.twoFaEnabled}
            onChange={(v) => toggle2FA(v)}
            color="#7C3AED"
          />
          {showOtpPanel && (
            <View style={ss.otpPanel}>
              <Text style={ss.otpTitle}>Enter Verification Code</Text>
              <Text style={ss.otpDesc}>A 6-digit OTP has been sent. Check the alert above.</Text>
              <View style={ss.otpRow}>
                <TextInput
                  style={ss.otpInput} value={otpCode} onChangeText={(t) => setOtpCode(t.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad" maxLength={6} placeholder="— — — — — —"
                  placeholderTextColor={C.textTertiary}
                />
                <Pressable onPress={verify2FA} disabled={verifyingOtp} style={ss.otpVerifyBtn}>
                  {verifyingOtp ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.otpVerifyText}>Verify</Text>}
                </Pressable>
              </View>
              <Pressable onPress={() => { setShowOtpPanel(false); setOtpCode(""); setPendingTwoFa(null); }}>
                <Text style={ss.otpCancel}>Cancel</Text>
              </Pressable>
            </View>
          )}
          <Divider />
          <SettingRow icon="time-outline" label="Login Activity" sublabel="You are currently logged in on this device" onPress={() => Alert.alert("Login Activity", "You are currently logged in on this device.")} />
        </Card>

        {showPasswordModal && (
          <View style={ss.pwdCard}>
            <Text style={ss.pwdTitle}>Change Password</Text>
            {[
              { label: "Current Password", val: currentPwd, set: setCurrentPwd, ph: "••••••" },
              { label: "New Password", val: newPwd, set: setNewPwd, ph: "Min 6 characters" },
              { label: "Confirm New Password", val: confirmPwd, set: setConfirmPwd, ph: "Repeat new password" },
            ].map((f) => (
              <View key={f.label} style={ss.editField}>
                <Text style={ss.editLabel}>{f.label}</Text>
                <TextInput style={ss.editInput} value={f.val} onChangeText={f.set} secureTextEntry placeholder={f.ph} placeholderTextColor={C.textTertiary} />
              </View>
            ))}
            <View style={ss.editActions}>
              <Pressable onPress={() => setShowPasswordModal(false)} style={ss.editCancelBtn}><Text style={ss.editCancelText}>Cancel</Text></Pressable>
              <Pressable onPress={changePassword} disabled={savingPwd} style={ss.editSaveBtn}>
                {savingPwd ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.editSaveText}>Update</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── 3. Notifications ── */}
        <SectionHeader title="Notification Preferences" icon="notifications-outline" />
        <Card>
          {loadingSettings ? <ActivityIndicator color={ORANGE} style={{ padding: 20 }} /> : (
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
            icon="globe-outline" label="Public Profile"
            sublabel={privacy.profileVisibility === "public" ? "Anyone can view your profile" : "Only you can see your profile"}
            value={privacy.profileVisibility === "public"}
            onChange={(v) => updatePrivacy("profileVisibility", v ? "public" : "private")}
            color="#3B82F6"
          />
          <Divider />
          <SettingRow icon="ban-outline" label="Blocked Users" sublabel="Manage blocked accounts" onPress={() => setShowBlockedModal(true)} color="#EF4444" />
          <Divider />
          <SettingRow icon="flag-outline" label="Report a User" sublabel="Report abusive or fraudulent behaviour" onPress={() => setShowReportUserModal(true)} color="#F59E0B" />
        </Card>

        {/* ── Role Section ── */}
        {isCustomerOnly && (
          <>
            <SectionHeader title="Grow Your Business" icon="rocket-outline" />
            <Pressable
              onPress={() => router.push("/become-provider")}
              style={({ pressed }) => [ss.upgradeCard, { opacity: pressed ? 0.92 : 1 }]}
            >
              <View style={ss.upgradeLeft}>
                <View style={ss.upgradeIconWrap}>
                  <Ionicons name="car-outline" size={28} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.upgradeTitle}>Become a Provider</Text>
                  <Text style={ss.upgradeDesc}>List your vehicles, equipment, and services. Start earning today.</Text>
                </View>
              </View>
              <View style={ss.upgradeArrow}><Ionicons name="arrow-forward" size={18} color="#fff" /></View>
            </Pressable>
          </>
        )}

        {isBoth && (
          <>
            <SectionHeader title="Active Mode" icon="swap-horizontal-outline" />
            <Card>
              <View style={ss.modeSwitcherCard}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setActiveMode("customer"); router.replace("/(tabs)/"); }}
                  style={[ss.modeOption, activeMode === "customer" && ss.modeOptionActive]}
                >
                  <Ionicons name="person-outline" size={22} color={activeMode === "customer" ? "#fff" : C.text} />
                  <Text style={[ss.modeOptionLabel, activeMode === "customer" && ss.modeOptionLabelActive]}>Customer</Text>
                  <Text style={[ss.modeOptionDesc, activeMode === "customer" && { color: "rgba(255,255,255,0.7)" }]}>Browse & book</Text>
                </Pressable>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setActiveMode("provider"); router.replace("/(tabs)/dashboard"); }}
                  style={[ss.modeOption, activeMode === "provider" && ss.modeOptionActive]}
                >
                  <Ionicons name="car-outline" size={22} color={activeMode === "provider" ? "#fff" : C.text} />
                  <Text style={[ss.modeOptionLabel, activeMode === "provider" && ss.modeOptionLabelActive]}>Provider</Text>
                  <Text style={[ss.modeOptionDesc, activeMode === "provider" && { color: "rgba(255,255,255,0.7)" }]}>Manage & earn</Text>
                </Pressable>
              </View>
            </Card>
          </>
        )}

        {/* ── 5. Language & Region ── */}
        <SectionHeader title="Language & Region" icon="language-outline" />
        <Card>
          <SettingRow icon="language-outline" label="Language" value={language === "en" ? "English" : "ਪੰਜਾਬੀ"} onPress={() => { Haptics.selectionAsync(); toggleLanguage(); }} />
          <Divider />
          <SettingRow icon="cash-outline" label="Currency" value="₹ INR" chevron={false} />
          <Divider />
          <SettingRow icon="location-outline" label="Region" value="Punjab, India" chevron={false} />
        </Card>

        {/* ── 6. App Preferences ── */}
        <SectionHeader title="App Preferences" icon="settings-outline" />
        <Card>
          <SettingRow
            icon="moon-outline" label="Appearance"
            value={prefs.darkMode === "system" ? "System" : prefs.darkMode === "dark" ? "Dark" : "Light"}
            onPress={() => {
              const next = prefs.darkMode === "system" ? "light" : prefs.darkMode === "light" ? "dark" : "system";
              updatePrefs("darkMode", next);
            }}
          />
          <Divider />
          <ToggleRow
            icon="cellular-outline" label="Data Saver"
            sublabel={prefs.dataSaver ? "Reduced image quality · Slower refresh" : "Full quality images and updates"}
            value={!!prefs.dataSaver} onChange={(v) => updatePrefs("dataSaver", v)}
            color="#059669"
          />
        </Card>

        {/* ── 7. Safety ── */}
        <SectionHeader title="Safety & Emergency" icon="shield-outline" />
        <Card>
          {/* Emergency Contact */}
          {loadingEC ? (
            <ActivityIndicator color={ORANGE} style={{ padding: 20 }} />
          ) : editingEC ? (
            <View style={ss.editForm}>
              <Text style={ss.pwdTitle}>Emergency Contact</Text>
              <View style={ss.editField}>
                <Text style={ss.editLabel}>Full Name *</Text>
                <TextInput style={ss.editInput} value={ecName} onChangeText={setEcName} placeholder="e.g. Gurpreet Singh" placeholderTextColor={C.textTertiary} autoCapitalize="words" />
              </View>
              <View style={ss.editField}>
                <Text style={ss.editLabel}>Phone Number *</Text>
                <TextInput style={ss.editInput} value={ecPhone} onChangeText={setEcPhone} placeholder="+91 98765 43210" placeholderTextColor={C.textTertiary} keyboardType="phone-pad" />
              </View>
              <View style={ss.editField}>
                <Text style={ss.editLabel}>Relationship</Text>
                <TextInput style={ss.editInput} value={ecRelation} onChangeText={setEcRelation} placeholder="e.g. Father, Spouse, Friend" placeholderTextColor={C.textTertiary} autoCapitalize="words" />
              </View>
              <View style={ss.editActions}>
                <Pressable onPress={() => setEditingEC(false)} style={ss.editCancelBtn}><Text style={ss.editCancelText}>Cancel</Text></Pressable>
                <Pressable onPress={saveEC} disabled={savingEC} style={ss.editSaveBtn}>
                  {savingEC ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.editSaveText}>Save</Text>}
                </Pressable>
              </View>
              {emergencyContact && (
                <Pressable onPress={deleteEC} style={ss.removeBtn}>
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={ss.removeBtnText}>Remove Contact</Text>
                </Pressable>
              )}
            </View>
          ) : emergencyContact ? (
            <View>
              <SettingRow
                icon="heart-outline" label={emergencyContact.name}
                sublabel={`${emergencyContact.phone}${emergencyContact.relation ? ` · ${emergencyContact.relation}` : ""}`}
                onPress={startEditEC}
                color="#EF4444"
              />
            </View>
          ) : (
            <SettingRow icon="add-circle-outline" label="Add Emergency Contact" sublabel="Add a trusted person for emergencies" onPress={startEditEC} color="#EF4444" />
          )}
          <Divider />
          <SettingRow icon="alert-circle-outline" label="Report an Issue" sublabel="Payment, booking, driver or app problems" onPress={() => setShowReportIssueModal(true)} color="#F59E0B" />
          <Divider />
          <SettingRow icon="ribbon-outline" label="Trust & Verification" sublabel="Complete your profile to get verified" onPress={() => Alert.alert("Verification", "Complete your profile to get verified. Verification badge coming soon.")} color="#059669" />
        </Card>

        {/* ── 8. Help & Support ── */}
        <SectionHeader title="Help & Support" icon="help-circle-outline" />
        <Card>
          <SettingRow icon="document-text-outline" label="FAQ" sublabel={`${faqs.length} answers to common questions`} onPress={() => setShowFAQModal(true)} />
          <Divider />
          <SettingRow icon="mail-outline" label="Contact Support" sublabel="support@rentzilla.in" onPress={() => Alert.alert("Contact Support", "Email us at support@rentzilla.in\nWe respond within 24 hours.")} />
          <Divider />
          <SettingRow icon="document-outline" label="Terms & Conditions" onPress={() => Alert.alert("Terms & Conditions", "By using RentZilla, you agree to our terms of service. Full terms available at rentzilla.in/terms")} />
          <Divider />
          <SettingRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => Alert.alert("Privacy Policy", "We protect your data and never share it without consent. Full policy at rentzilla.in/privacy")} />
        </Card>

        {/* ── 9. Danger Zone ── */}
        <SectionHeader title="Danger Zone" icon="warning-outline" />
        <Card>
          <SettingRow
            icon="log-out-outline" label="Logout" color="#EF4444" chevron={false}
            onPress={() => Alert.alert("Logout", "Are you sure you want to log out?", [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/sign-in"); } },
            ])}
          />
        </Card>

        <View style={[ss.footer, { paddingBottom: botPad + 20 }]}>
          <Text style={ss.footerText}>RentZilla v1.0 · Punjab, India</Text>
          <Text style={ss.footerText}>Made with ❤️ for Punjab</Text>
        </View>
      </ScrollView>

      {/* ── Modals ── */}
      <BlockedUsersModal visible={showBlockedModal} onClose={() => setShowBlockedModal(false)} api={api} />
      <ReportUserModal visible={showReportUserModal} onClose={() => setShowReportUserModal(false)} api={api} />
      <ReportIssueModal visible={showReportIssueModal} onClose={() => setShowReportIssueModal(false)} api={api} />

      {/* FAQ Modal */}
      {showFAQModal && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFAQModal(false)}>
          <View style={ss.modalRoot}>
            <View style={ss.modalHeader}>
              <Pressable onPress={() => setShowFAQModal(false)} style={ss.modalBack}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
              <Text style={ss.modalTitle}>FAQ</Text>
              <View style={{ width: 36 }} />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              <Text style={[ss.formNote, { marginBottom: 12 }]}>Common questions about RentZilla</Text>
              <Card>
                {faqs.map((faq, i) => (
                  <View key={faq.id}>
                    <FAQItem faq={faq} />
                    {i < faqs.length - 1 && <Divider />}
                  </View>
                ))}
              </Card>
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F5F7" },
  header: { paddingHorizontal: 20, paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  scroll: { flex: 1 },

  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: "#0F1F3D", marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 18, padding: 20,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(232,116,42,0.2)", borderWidth: 2, borderColor: `${ORANGE}50`, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  profileName: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  profileEmail: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 2 },
  roleBadge: { alignSelf: "flex-start", backgroundColor: `${ORANGE}30`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  roleBadgeText: { color: ORANGE, fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 },
  sectionIconWrap: { width: 24, height: 24, borderRadius: 6, backgroundColor: `${ORANGE}15`, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.textSecondary, letterSpacing: 0.5, textTransform: "uppercase" },

  card: { backgroundColor: "#fff", marginHorizontal: 16, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium", color: C.text },
  rowSublabel: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  divider: { height: 1, backgroundColor: C.borderLight, marginLeft: 64 },

  editForm: { padding: 16, gap: 12 },
  editRow: { flexDirection: "row", gap: 10 },
  editField: { gap: 6 },
  editLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  editInput: { backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  editActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  editCancelBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  editCancelText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  editSaveBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, backgroundColor: ORANGE, alignItems: "center" },
  editSaveText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#fff" },

  pwdCard: { backgroundColor: "#fff", marginHorizontal: 16, marginTop: 8, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1.5, borderColor: `${ORANGE}30` },
  pwdTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },

  otpPanel: { backgroundColor: "#F5F3FF", margin: 12, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: "#DDD6FE" },
  otpTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#5B21B6" },
  otpDesc: { fontSize: 12, color: "#7C3AED", fontFamily: "Inter_400Regular" },
  otpRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  otpInput: { flex: 1, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5, borderColor: "#DDD6FE", paddingHorizontal: 14, paddingVertical: 10, fontSize: 20, letterSpacing: 6, fontFamily: "Inter_700Bold", color: "#5B21B6", textAlign: "center" },
  otpVerifyBtn: { backgroundColor: "#7C3AED", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  otpVerifyText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  otpCancel: { fontSize: 12, color: "#7C3AED", fontFamily: "Inter_400Regular", textAlign: "center", paddingTop: 2 },

  removeBtn: { flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center", paddingTop: 4 },
  removeBtnText: { fontSize: 13, color: "#EF4444", fontFamily: "Inter_400Regular" },

  upgradeCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, borderRadius: 18, padding: 20, backgroundColor: "#0F1F3D", gap: 14, shadowColor: "#0F1F3D", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  upgradeLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  upgradeIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: "rgba(232,116,42,0.15)", alignItems: "center", justifyContent: "center" },
  upgradeTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  upgradeDesc: { fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 17 },
  upgradeArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },

  modeSwitcherCard: { flexDirection: "row", padding: 6, gap: 6 },
  modeOption: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 12, gap: 4, backgroundColor: C.backgroundTertiary },
  modeOptionActive: { backgroundColor: ORANGE },
  modeOptionLabel: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  modeOptionLabelActive: { color: "#fff" },
  modeOptionDesc: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  footer: { alignItems: "center", gap: 4, paddingTop: 24 },
  footerText: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  // Modals
  modalRoot: { flex: 1, backgroundColor: "#F5F5F7" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border },
  modalBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  emptyDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },

  blockedRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  blockedAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  blockedAvatarText: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#EF4444" },
  blockedName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  blockedDate: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  unblockBtn: { backgroundColor: "#FEE2E2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  unblockText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  formNote: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 17 },
  formGroup: { gap: 8 },
  formLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  formInput: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.backgroundTertiary, borderWidth: 1.5, borderColor: C.border },
  chipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  chipText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  chipTextActive: { color: "#fff" },

  issueCatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  issueCat: { width: "47%", borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: "#fff", padding: 14, alignItems: "center", gap: 6 },
  issueCatActive: { borderColor: ORANGE, backgroundColor: ORANGE },
  issueCatText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },

  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15 },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },

  faqRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  faqQ: { flex: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  faqNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: `${ORANGE}18`, alignItems: "center", justifyContent: "center", marginTop: 1 },
  faqNumText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  faqQText: { flex: 1, fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, lineHeight: 20 },
  faqAnswer: { backgroundColor: "#F9FAFB", paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4, marginTop: -4 },
  faqAnswerText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20, paddingLeft: 32 },
});
