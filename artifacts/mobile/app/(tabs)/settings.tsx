import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth, type ActiveMode } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useSound } from "@/context/SoundContext";
import NotificationSettings from "@/components/NotificationSettings";
import type { SoundKey } from "@/services/AudioService";
import { useApi } from "@/hooks/useApi";
import { confirmAction } from "@/lib/confirm";

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
    try { setList(await api.get("/safety/blocked") as BlockedUser[]); } catch { }
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

interface PrivacyPrefs { profileVisibility: "public" | "private"; showPhone: boolean; }
interface Prefs { darkMode: "system" | "light" | "dark"; dataSaver: boolean; twoFaEnabled?: boolean; }
type EmergencyContact = { id: string; name: string; phone: string; relation: string | null } | null;

export default function SettingsTab() {
  const { user, logout, updateUser, activeMode, setActiveMode } = useAuth();
  const isBoth = user?.role === "both";
  const isCustomerOnly = user?.role === "customer";
  const isProviderOnly = user?.role === "provider";
  const api = useApi();
  const { get, patch, del, post, put } = api;
  const { t, language, toggleLanguage } = useLang();
  const { settings: snd, toggle: toggleSnd, testSound } = useSound();
  const insets = useSafeAreaInsets();
  // Deep-link support: /(tabs)/settings?section=help scrolls to Help & Support
  const { section } = useLocalSearchParams<{ section?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const [helpY, setHelpY] = useState<number | null>(null);
  useEffect(() => {
    if (section !== "help" || helpY === null) return;
    const frame = requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTo({ y: Math.max(0, helpY - 12), animated: true });
      router.setParams({ section: undefined });
    });
    return () => cancelAnimationFrame(frame);
  }, [section, helpY]);
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : insets.bottom;

  // Settings state
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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  // Delete Account
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Contact Support
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportCategory, setSupportCategory] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const emailRef = React.useRef<any>(null);
  const subjectRef = React.useRef<any>(null);
  const messageRef = React.useRef<any>(null);

  // Pre-fill user details when modal opens
  React.useEffect(() => {
    if (showSupportModal) {
      setSupportName(`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "");
      setSupportEmail(user?.email || "");
    }
  }, [showSupportModal]);

  useEffect(() => {
    fetchSettings();
    fetchEmergencyContact();
    fetchFAQs();
  }, []);

  async function fetchSettings() {
    try {
      const data = await get<{ privacy: PrivacyPrefs; preferences: Prefs }>("/settings");
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

  function resetSupportForm() {
    setSupportName("");
    setSupportEmail("");
    setSupportCategory("");
    setSupportSubject("");
    setSupportMessage("");
  }

  async function submitSupportTicket() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!supportName.trim()) {
      Alert.alert("Name required", "Please enter your name."); return;
    }
    if (!emailRegex.test(supportEmail.trim())) {
      Alert.alert("Valid email required", "Please enter a valid email address so we can reply to you."); return;
    }
    const subject = supportSubject.trim() || supportCategory;
    if (!subject) {
      Alert.alert("Subject required", "Please select a category or enter a subject."); return;
    }
    if (!supportMessage.trim() || supportMessage.length < 10) {
      Alert.alert("Describe your issue", "Please write at least 10 characters describing your problem."); return;
    }

    setSubmittingSupport(true);
    try {
      const result = await post<{ ok: boolean; id: string; emailSent: boolean }>("/support-ticket", {
        name: supportName.trim(),
        contact: supportEmail.trim(),
        issue_type: supportCategory || "General",
        subject,
        message: supportMessage.trim(),
        platform: Platform.OS,
        app_version: "1.0",
        user_id: (user as any)?.id ?? null,
      });

      resetSupportForm();
      setShowSupportModal(false);

      if (result?.emailSent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Request Sent Successfully",
          "Your support request has been received and a confirmation email was sent. Our team will get back to you within 24 hours.",
          [{ text: "OK", style: "default" }]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          "Request Saved",
          "Your request has been logged. The confirmation email could not be delivered — our team will still review your ticket. For urgent help email info.rentzilla@gmail.com directly.",
          [{ text: "OK", style: "default" }]
        );
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = e?.message?.includes("rate limit")
        ? "You've sent too many requests. Please wait 10 minutes before trying again."
        : "Something went wrong. Please try again or email info.rentzilla@gmail.com directly.";
      Alert.alert("Could Not Send Request", msg, [{ text: "OK", style: "destructive" }]);
    } finally {
      setSubmittingSupport(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteReason.trim()) {
      Alert.alert("Select a reason", "Please choose why you want to delete your account.");
      return;
    }
    setIsDeleting(true);
    try {
      await del("/users/me", { reason: deleteReason });
      setDeleteStep(0);
      await logout();
      router.replace("/sign-in");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
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
      await post<{ message: string }>("/safety/2fa/send-otp", {});
      setShowOtpPanel(true);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not send OTP. Please try again.");
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

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView ref={scrollRef} style={ss.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
              <Text style={ss.otpDesc}>A 6-digit code has been sent to your email address. Check your inbox.</Text>
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
        <SectionHeader title="Notifications" icon="notifications-outline" />
        <NotificationSettings />

        {/* ── 4. Sounds & Notifications ── */}
        <SectionHeader title="In-App Sounds" icon="musical-notes-outline" />
        <Card>
          <ToggleRow icon="volume-high-outline" label="Master Sound" sublabel="Enable all in-app sounds" value={snd.master} onChange={() => toggleSnd("master")} color="#FF7A18" />
          <Divider />
          <ToggleRow icon="phone-portrait-outline" label="Vibration" sublabel="Haptic feedback for interactions" value={snd.vibration} onChange={() => toggleSnd("vibration")} color="#8B5CF6" />
          <Divider />
          <ToggleRow icon="sunny-outline" label="Startup Sound" sublabel="Play chime when app opens" value={snd.startup} onChange={() => toggleSnd("startup")} color="#F59E0B" />
          <Divider />
          <ToggleRow icon="calendar-outline" label="Booking Sounds" sublabel="Confirmation and alert tones" value={snd.booking} onChange={() => toggleSnd("booking")} color="#22C55E" />
          <Divider />
          <ToggleRow icon="wallet-outline" label="Wallet & Payment Sounds" sublabel="Credit, payout, and payment tones" value={snd.wallet} onChange={() => toggleSnd("wallet")} color="#0EA5E9" />
          <Divider />
          <ToggleRow icon="call-outline" label="Incoming Booking Ringtone" sublabel="Louder ring for new booking requests" value={snd.ringtone} onChange={() => toggleSnd("ringtone")} color="#EF4444" />
          <Divider />
          <View style={ss.soundTestRow}>
            <Text style={ss.soundTestLabel}>Test Sounds</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {([
                { key: "bookingSuccess",  label: "Booking", icon: "checkmark-circle-outline" },
                { key: "walletCredit",    label: "Credit",  icon: "wallet-outline" },
                { key: "payoutSuccess",   label: "Payout",  icon: "cash-outline" },
                { key: "providerAlert",   label: "Alert",   icon: "warning-outline" },
                { key: "ringtone",        label: "Ring",    icon: "call-outline" },
              ] as { key: SoundKey; label: string; icon: string }[]).map(({ key, label, icon }) => (
                <Pressable
                  key={key}
                  onPress={() => { Haptics.selectionAsync(); testSound(key); }}
                  style={ss.testBtn}
                >
                  <Ionicons name={icon as any} size={14} color={ORANGE} />
                  <Text style={ss.testBtnText}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Card>

        {/* ── 5. Privacy ── */}
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

        {isProviderOnly && (
          <>
            <SectionHeader title="Expand Your Access" icon="person-add-outline" />
            <Pressable
              onPress={() => router.push("/become-customer")}
              style={({ pressed }) => [ss.upgradeCard, ss.customerCard, { opacity: pressed ? 0.92 : 1 }]}
            >
              <View style={ss.upgradeLeft}>
                <View style={[ss.upgradeIconWrap, ss.customerIconWrap]}>
                  <Ionicons name="person-circle-outline" size={28} color="#0F1F3D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ss.upgradeTitle, { color: "#0F1F3D" }]}>Become a Customer</Text>
                  <Text style={[ss.upgradeDesc, { color: "rgba(15,31,61,0.55)" }]}>Browse and book from other providers. Use both sides of RentZilla.</Text>
                </View>
              </View>
              <View style={[ss.upgradeArrow, { backgroundColor: "#0F1F3D" }]}>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            </Pressable>
          </>
        )}

        {isBoth && (
          <>
            <SectionHeader title="Active Mode" icon="swap-horizontal-outline" />
            <Card>
              <View style={ss.modeSwitcherCard}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setActiveMode("customer"); router.replace("/"); }}
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
          <SettingRow icon="ribbon-outline" label="Trust & Verification" sublabel="Complete your profile to get verified" onPress={() => router.push("/trust-verification" as any)} color="#059669" />
        </Card>

        {/* ── 8. Help & Support ── */}
        <View onLayout={(e) => setHelpY(e.nativeEvent.layout.y)} />
        <SectionHeader title="Help & Support" icon="help-circle-outline" />
        <Card>
          <SettingRow icon="document-text-outline" label="FAQ" sublabel={`${faqs.length} answers to common questions`} onPress={() => setShowFAQModal(true)} />
          <Divider />
          <SettingRow icon="mail-outline" label="Contact Support" onPress={() => setShowSupportModal(true)} />
          <Divider />
          <SettingRow icon="document-outline" label="Terms & Conditions" onPress={() => setShowTermsModal(true)} />
          <Divider />
          <SettingRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => setShowPrivacyModal(true)} />
        </Card>

        {/* ── 9. Danger Zone ── */}
        <SectionHeader title="Danger Zone" icon="warning-outline" />
        <Card>
          <Pressable
            onPress={() => { setDeleteReason(""); setDeleteStep(1); }}
            style={({ pressed }) => [ss.delRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={ss.delIcon}>
              <Ionicons name="trash-outline" size={19} color="#DC2626" />
            </View>
            <View style={ss.delContent}>
              <Text style={ss.delLabel}>Delete Account</Text>
              <Text style={ss.delSub}>Permanently removes all your data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#DC2626" />
          </Pressable>
          <Divider />
          <SettingRow
            icon="log-out-outline" label="Logout" color="#EF4444" chevron={false}
            onPress={() => confirmAction({
              title: "Logout",
              message: "Are you sure you want to log out?",
              confirmText: "Logout",
              destructive: true,
              onConfirm: async () => { await logout(); router.replace("/sign-in"); },
            })}
          />
        </Card>

        <View style={[ss.footer, { paddingBottom: botPad + 20 }]}>
          <Text style={ss.footerText}>RentZilla v1.0 · Punjab, India</Text>
          <Text style={ss.footerText}>Made with ❤️ for Punjab</Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Contact Support Modal ── */}
      <Modal visible={showSupportModal} transparent animationType="slide" onRequestClose={() => { resetSupportForm(); setShowSupportModal(false); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={ss.delOverlay}>
            <View style={[ss.delSheet, { maxHeight: "94%", paddingBottom: 0 }]}>

              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name="mail-outline" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ss.delModalTitle, { fontSize: 17, marginBottom: 1 }]}>Contact Support</Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>We respond within 24 hours</Text>
                </View>
                <Pressable onPress={() => { resetSupportForm(); setShowSupportModal(false); }} hitSlop={12}>
                  <Ionicons name="close" size={22} color="#6B7280" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>

                {/* Name */}
                <Text style={ss.supportSectionLabel}>Your Name *</Text>
                <TextInput
                  style={ss.supportFieldInput}
                  value={supportName}
                  onChangeText={setSupportName}
                  placeholder="Full name"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  blurOnSubmit={false}
                />

                {/* Email */}
                <Text style={[ss.supportSectionLabel, { marginTop: 12 }]}>Email Address *</Text>
                <TextInput
                  ref={emailRef}
                  style={ss.supportFieldInput}
                  value={supportEmail}
                  onChangeText={setSupportEmail}
                  placeholder="your@email.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => subjectRef.current?.focus()}
                  blurOnSubmit={false}
                />

                {/* Category chips → auto-fills subject */}
                <Text style={[ss.supportSectionLabel, { marginTop: 12 }]}>Issue Category</Text>
                <View style={ss.supportChipGrid}>
                  {["Booking Issue", "Payment Refund", "Provider Verification", "Listing Problem", "Technical Bug", "Safety Report", "Other"].map(cat => (
                    <Pressable
                      key={cat}
                      onPress={() => { setSupportCategory(cat); setSupportSubject(cat); Haptics.selectionAsync(); }}
                      style={[ss.supportChip, supportCategory === cat && ss.supportChipActive]}
                    >
                      <Text style={[ss.supportChipText, supportCategory === cat && { color: "#fff" }]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Subject */}
                <Text style={[ss.supportSectionLabel, { marginTop: 12 }]}>Subject *</Text>
                <TextInput
                  ref={subjectRef}
                  style={ss.supportFieldInput}
                  value={supportSubject}
                  onChangeText={setSupportSubject}
                  placeholder="Brief summary of your issue"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="next"
                  onSubmitEditing={() => messageRef.current?.focus()}
                  blurOnSubmit={false}
                />

                {/* Message */}
                <Text style={[ss.supportSectionLabel, { marginTop: 12 }]}>Message *</Text>
                <TextInput
                  ref={messageRef}
                  style={[ss.supportInput, { minHeight: 100 }]}
                  value={supportMessage}
                  onChangeText={v => setSupportMessage(v.slice(0, 500))}
                  multiline
                  placeholder="Describe your issue in detail. Include booking IDs or any relevant info..."
                  placeholderTextColor="#9CA3AF"
                  textAlignVertical="top"
                  returnKeyType="done"
                />
                <Text style={ss.supportCharCount}>{supportMessage.length} / 500</Text>

                {/* Buttons */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Pressable onPress={() => { resetSupportForm(); setShowSupportModal(false); }} style={ss.delCancelBtn}>
                    <Text style={ss.delCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitSupportTicket}
                    disabled={submittingSupport}
                    style={[ss.delNextBtn, { backgroundColor: "#3B82F6", flex: 1.5 }, submittingSupport && { opacity: 0.6 }]}
                  >
                    {submittingSupport
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <>
                          <Ionicons name="send" size={14} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={ss.delNextText}>Send Request</Text>
                        </>
                    }
                  </Pressable>
                </View>
              </ScrollView>

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete Account Modal ── */}
      <Modal visible={deleteStep > 0} transparent animationType="slide" onRequestClose={() => setDeleteStep(0)}>
        <View style={ss.delOverlay}>
          <View style={ss.delSheet}>
            {deleteStep === 1 ? (
              <>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View style={ss.delModalIcon}>
                    <Ionicons name="trash-outline" size={28} color="#DC2626" />
                  </View>
                  <Text style={ss.delModalTitle}>Delete Account</Text>
                  <Text style={ss.delModalSub}>Please tell us why you're leaving</Text>
                </View>
                {["I no longer need this app", "I have privacy concerns", "I found a better alternative", "The app has technical issues", "Too many notifications", "Other reason"].map((reason) => (
                  <Pressable
                    key={reason}
                    onPress={() => setDeleteReason(reason)}
                    style={[ss.delReasonRow, deleteReason === reason && ss.delReasonSelected]}
                  >
                    <View style={[ss.delRadio, deleteReason === reason && ss.delRadioFilled]}>
                      {deleteReason === reason && <View style={ss.delRadioDot} />}
                    </View>
                    <Text style={[ss.delReasonText, deleteReason === reason && { color: "#DC2626", fontFamily: "Inter_600SemiBold" }]}>{reason}</Text>
                  </Pressable>
                ))}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Pressable onPress={() => setDeleteStep(0)} style={ss.delCancelBtn}>
                    <Text style={ss.delCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { if (!deleteReason) { Alert.alert("Select a reason", "Please choose one."); return; } setDeleteStep(2); }}
                    style={[ss.delNextBtn, !deleteReason && { opacity: 0.4 }]}
                  >
                    <Text style={ss.delNextText}>Next →</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View style={[ss.delModalIcon, { backgroundColor: "#FEE2E2" }]}>
                    <Ionicons name="warning-outline" size={28} color="#DC2626" />
                  </View>
                  <Text style={ss.delModalTitle}>Are you sure?</Text>
                  <Text style={ss.delModalSub}>This will permanently delete your account, all bookings, messages, and data. This cannot be undone.</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <Pressable onPress={() => setDeleteStep(1)} style={ss.delCancelBtn}>
                    <Text style={ss.delCancelText}>← Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDeleteAccount}
                    disabled={isDeleting}
                    style={[ss.delConfirmBtn, isDeleting && { opacity: 0.6 }]}
                  >
                    {isDeleting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={ss.delConfirmText}>Delete Forever</Text>
                    }
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPrivacyModal(false)}>
          <View style={ss.modalRoot}>
            <View style={ss.modalHeader}>
              <Pressable onPress={() => setShowPrivacyModal(false)} style={ss.modalBack}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
              <Text style={ss.modalTitle}>Privacy Policy</Text>
              <View style={{ width: 36 }} />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 18, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 }}>FULL PRIVACY POLICY</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FF7A18", marginBottom: 4 }}>Refund & Cancellation Policy — RentZilla</Text>
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 20 }}>Applies to: Mobile App · Website · Provider Dashboard · Wallet · KYC · All Global Users</Text>
              {[
                { num: "1", title: "Scope", body: "This Policy applies to the RentZilla mobile app, website, provider dashboard, wallet, payouts, customer support, marketing communication, KYC systems, and all global users including India." },
                { num: "2", title: "Information We Collect", body: "We collect account data, phone, email, profile photo, addresses, GST/PAN details, booking details, location, payment references, wallet history, device identifiers, crash logs, KYC records, bank details, and dispute evidence." },
                { num: "3", title: "Why We Use Data", body: "We use personal data for account creation, booking execution, fraud prevention, customer support, escrow, payouts, tax compliance, analytics, legal investigations, service quality, and misuse prevention." },
                { num: "4", title: "Consent", body: "By using RentZilla, users provide informed consent for account creation, OTP verification, location access, booking communication, and optional marketing notifications. Consent may be withdrawn by deleting the account or contacting support." },
                { num: "5", title: "Data Sharing", body: "We may share limited data with payment gateways, KYC vendors, cloud hosting providers, SMS/OTP vendors, insurance partners, analytics services, government authorities, law enforcement, and counterparties involved in a booking. We do not sell personal data." },
                { num: "6", title: "Cross-Border Transfers", body: "Because RentZilla may serve international users, data may be processed in India, Singapore, UAE, EU regions, and other secure global cloud zones using encryption, processor agreements, and access controls." },
                { num: "7", title: "Retention & Deletion", body: "Booking records may be retained for up to 7 years, tax invoices as required by law, and dispute evidence until final closure. Users may request access, correction, deletion, or consent withdrawal subject to legal obligations." },
                { num: "8", title: "Security Measures", body: "We use encryption in transit, secure storage, tokenized payments, OTP verification, role-based admin access, audit logs, fraud monitoring, and secure image uploads." },
                { num: "9", title: "Customer Cancellation", body: "100% refund before provider acceptance. After acceptance, platform fees or reserved-time charges may apply. Same-day cancellations may attract 20–50% deduction depending on category." },
                { num: "10", title: "Provider Cancellation", body: "If a provider cancels, the customer receives a full refund and may get priority rebooking. Providers may face penalties, ranking reduction, payout holds, or temporary suspension." },
                { num: "11", title: "Security Deposit & Damage", body: "For rentals, escrow deposits may be held and deductions may apply for damages, extra usage, fuel shortage, cleaning, or missing accessories after inspection." },
                { num: "12", title: "Refund Timelines", body: "Wallet refunds: instant to 24 hrs.\nUPI: 1–3 business days.\nCards: 5–10 business days.\nBank transfers: 3–7 business days." },
                { num: "13", title: "Non-Refundable Cases", body: "No refunds for fraud, fake bookings, illegal use, duplicate claims, force majeure losses, or user-caused cancellation after service start." },
              ].map((section) => (
                <View key={section.num} style={{ marginBottom: 16, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: "#6366F1" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#6366F1", marginBottom: 4 }}>
                    {section.num}. {section.title}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 20 }}>
                    {section.body}
                  </Text>
                </View>
              ))}
              <Text style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8 }}>
                Last updated: April 2026 · rentzilla.in/privacy
              </Text>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTermsModal(false)}>
          <View style={ss.modalRoot}>
            <View style={ss.modalHeader}>
              <Pressable onPress={() => setShowTermsModal(false)} style={ss.modalBack}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
              <Text style={ss.modalTitle}>Terms & Conditions</Text>
              <View style={{ width: 36 }} />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 18, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 }}>TERMS AND CONDITIONS</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FF7A18", marginBottom: 20 }}>RentZilla — Detailed Version</Text>
              {[
                { num: "1", title: "Acceptance of Terms", body: "By accessing or using Rentzilla, you agree to be legally bound by these Terms. If you do not agree, you must not use the platform." },
                { num: "2", title: "Nature of Platform", body: "Rentzilla is a technology intermediary facilitating connections between Customers and independent Service Providers.\n\n• Rentzilla does not employ providers\n• Rentzilla does not guarantee services\n• All contracts are between Customer and Provider" },
                { num: "3", title: "Eligibility", body: "Users must be at least 18 years old and capable of entering legally binding agreements under Indian law." },
                { num: "4", title: "Account Responsibility", body: "• Maintain confidentiality of login credentials\n• Provide accurate and updated information\n• Responsible for all activities under your account" },
                { num: "5", title: "Service Disclaimer", body: "All services are provided by independent providers. Rentzilla disclaims any responsibility for quality, legality, or safety of services." },
                { num: "6", title: "Payments & Fees", body: "• Payments processed via third-party gateways\n• Rentzilla may charge commissions and service fees\n• Refunds subject to provider terms" },
                { num: "7", title: "Strict No Liability Clause", body: "Rentzilla shall not be held liable under any circumstances for:\n\n• Disputes between Customer and Provider\n• Injury, death, or damages\n• Loss of property or money\n• Fraud, negligence, or misconduct by users\n\nAll disputes must be resolved directly between Customer and Provider." },
                { num: "8", title: "User Conduct (Strict)", body: "• No illegal activities\n• No harassment or abuse\n• No false or misleading listings\n• Compliance with all applicable Indian laws" },
                { num: "9", title: "Provider Obligations", body: "• Maintain valid licenses and permits\n• Ensure safety standards\n• Provide accurate service details\n• Comply with tax and legal requirements" },
                { num: "10", title: "Confidentiality (Strict Clause)", body: "Users must not disclose, misuse, or exploit any personal, business, or platform data. Violation may result in legal action under Indian law." },
                { num: "11", title: "Data Protection", body: "Complies with Information Technology Act, 2000 and applicable rules. Reasonable security measures are implemented." },
                { num: "12", title: "Limitation of Liability", body: "To the fullest extent permitted by Indian law, Rentzilla shall not be liable for indirect, incidental, or consequential damages." },
                { num: "13", title: "Indemnification (Strict)", body: "Users agree to indemnify and hold Rentzilla harmless from all claims, damages, liabilities, and legal costs arising from misuse or violations." },
                { num: "14", title: "Termination Rights", body: "Rentzilla reserves the right to suspend or terminate any account without prior notice for violation of these Terms." },
                { num: "15", title: "Force Majeure", body: "Rentzilla is not liable for failure due to events beyond control including natural disasters, government restrictions, or technical failures." },
                { num: "16", title: "Governing Law", body: "These Terms shall be governed by the laws of India. Jurisdiction shall lie exclusively in courts of Punjab, India." },
                { num: "17", title: "Amendments", body: "Rentzilla reserves the right to modify these Terms at any time without prior notice." },
              ].map((section) => (
                <View key={section.num} style={{ marginBottom: 20, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: "#FF7A18" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#FF7A18", marginBottom: 4 }}>
                    {section.num}. {section.title}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 20 }}>
                    {section.body}
                  </Text>
                </View>
              ))}
              <Text style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8 }}>
                Last updated: April 2026 · rentzilla.in/terms
              </Text>
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

  soundTestRow: { paddingHorizontal: 16, paddingVertical: 12 },
  soundTestLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  testBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: `${ORANGE}12`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, borderWidth: 1, borderColor: `${ORANGE}25` },
  testBtnText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: ORANGE },
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
  customerCard: { backgroundColor: "#EEF1F8", shadowColor: "#0F1F3D" },
  customerIconWrap: { backgroundColor: "rgba(15,31,61,0.10)" },

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

  // Contact Support
  supportSectionLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  supportFieldInput: { backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  supportChipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  supportChip: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  supportChipActive: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  supportChipText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#374151" },
  supportInput: { backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB", padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 100, textAlignVertical: "top" },
  supportCharCount: { fontSize: 11, color: "#9CA3AF", textAlign: "right", marginTop: 4, fontFamily: "Inter_400Regular" },

  // Delete Account row
  delRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  delIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  delContent: { flex: 1 },
  delLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
  delSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 1 },

  // Delete Account modal
  delOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  delSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  delModalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  delModalTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  delModalSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 20 },
  delReasonRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, marginBottom: 8, backgroundColor: "#fff" },
  delReasonSelected: { borderColor: "#DC2626", backgroundColor: "#FFF5F5" },
  delReasonText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  delRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  delRadioFilled: { borderColor: "#DC2626" },
  delRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#DC2626" },
  delCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  delCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  delNextBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#DC2626", alignItems: "center" },
  delNextText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  delConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#DC2626", alignItems: "center" },
  delConfirmText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
