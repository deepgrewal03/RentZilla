import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { Image } from "expo-image";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  open:          { label: "Open",         color: "#DC2626", bg: "#FEE2E2", icon: "warning" },
  under_review:  { label: "Under Review", color: "#D97706", bg: "#FEF3C7", icon: "time" },
  resolved:      { label: "Resolved",     color: "#059669", bg: "#D1FAE5", icon: "checkmark-circle" },
};

const REASON_OPTIONS = [
  "Item not as described",
  "Item damaged or not working",
  "Provider did not show up",
  "Unauthorized charges",
  "Unsafe conditions",
  "Booking not fulfilled",
  "Other",
];

interface DisputeMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_role: "customer" | "provider" | "admin";
  content: string;
  sender_name?: string;
  sender_photo?: string;
  created_at: string;
}

interface DisputeBooking {
  id: string;
  dispute_status: string;
  dispute_reason: string;
  dispute_opened_at?: string;
  dispute_resolution?: string;
  dispute_resolved_at?: string;
  listing_title?: string;
  listing_images?: string[];
  customer_name?: string;
  provider_name?: string;
  customer_id: string;
  provider_id: string;
  total_amount?: number;
  refund_amount?: number;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function RolePill({ role }: { role: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    customer: { label: "Customer", color: "#2563EB", bg: "#DBEAFE" },
    provider: { label: "Provider", color: "#7C3AED", bg: "#EDE9FE" },
    admin:    { label: "Admin",    color: "#D97706", bg: "#FEF3C7" },
  };
  const m = map[role] ?? map.customer;
  return (
    <View style={[styles.rolePill, { backgroundColor: m.bg }]}>
      <Text style={[styles.rolePillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

// ── Open Dispute Flow ────────────────────────────────────────────────────────
function OpenDisputeForm({ bookingId, onSuccess }: { bookingId: string; onSuccess: () => void }) {
  const { post } = useApi();
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!reason) return Alert.alert("Select a reason", "Please choose a reason for the dispute.");
    if (!message.trim() || message.trim().length < 10) return Alert.alert("Add details", "Please describe the issue in at least 10 characters.");
    setSubmitting(true);
    try {
      await post(`/disputes/${bookingId}/open`, { reason, message });
      Alert.alert("Dispute Opened", "Your dispute has been filed. The provider and our team have been notified and will respond within 48 hours.", [
        { text: "OK", onPress: onSuccess }
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to open dispute");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
      {/* Progress */}
      <View style={styles.progress}>
        <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]}>
          <Text style={[styles.progressStepText, step >= 1 && styles.progressStepTextActive]}>1</Text>
        </View>
        <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
        <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]}>
          <Text style={[styles.progressStepText, step >= 2 && styles.progressStepTextActive]}>2</Text>
        </View>
      </View>

      {step === 1 ? (
        <>
          <Text style={styles.formTitle}>What's the issue?</Text>
          <Text style={styles.formSub}>Select the reason that best describes your problem</Text>
          <View style={styles.reasonList}>
            {REASON_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[styles.reasonOption, reason === opt && styles.reasonOptionSelected]}
                onPress={() => setReason(opt)}
              >
                <View style={[styles.reasonDot, reason === opt && styles.reasonDotSelected]} />
                <Text style={[styles.reasonText, reason === opt && styles.reasonTextSelected]}>{opt}</Text>
                {reason === opt && <Ionicons name="checkmark-circle" size={18} color={C.tint} />}
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.nextBtn, !reason && { opacity: 0.4 }]}
            onPress={() => reason && setStep(2)}
            disabled={!reason}
          >
            <Text style={styles.nextBtnText}>Next: Describe Issue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </>
      ) : (
        <>
          <Pressable onPress={() => setStep(1)} style={styles.backLink}>
            <Ionicons name="arrow-back" size={16} color={C.tint} />
            <Text style={styles.backLinkText}>Change reason</Text>
          </Pressable>
          <View style={styles.selectedReasonTag}>
            <Ionicons name="alert-circle" size={14} color="#D97706" />
            <Text style={styles.selectedReasonTagText}>{reason}</Text>
          </View>
          <Text style={styles.formTitle}>Describe the issue</Text>
          <Text style={styles.formSub}>Provide specific details to help us resolve this quickly. Include dates, amounts, or any evidence you have.</Text>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe exactly what went wrong, when it happened, and what resolution you expect..."
            placeholderTextColor={C.textTertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{message.length}/1000 characters</Text>
          <View style={styles.noteBox}>
            <Ionicons name="information-circle-outline" size={16} color="#2563EB" />
            <Text style={styles.noteText}>Our team reviews disputes within 48 hours. Both parties can add messages to the thread.</Text>
          </View>
          <Pressable style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>File Dispute</Text>
              </>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, currentUserId }: { msg: DisputeMessage; currentUserId: string }) {
  const isMine = msg.sender_id === currentUserId;
  const isAdmin = msg.sender_role === "admin";

  if (isAdmin) {
    return (
      <View style={styles.adminBubbleWrap}>
        <View style={styles.adminBubble}>
          <View style={styles.adminBubbleHeader}>
            <Ionicons name="shield-checkmark" size={14} color="#D97706" />
            <Text style={styles.adminBubbleName}>RentZilla Admin</Text>
            <Text style={styles.bubbleTime}>{timeAgo(msg.created_at)}</Text>
          </View>
          <Text style={styles.adminBubbleContent}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrap, isMine && styles.bubbleWrapMine]}>
      {!isMine && (
        <View style={styles.bubbleAvatar}>
          {msg.sender_photo ? (
            <Image source={{ uri: msg.sender_photo }} style={styles.bubbleAvatarImg} contentFit="cover" />
          ) : (
            <View style={styles.bubbleAvatarPlaceholder}>
              <Text style={styles.bubbleAvatarInitial}>{(msg.sender_name ?? "?")[0]?.toUpperCase()}</Text>
            </View>
          )}
        </View>
      )}
      <View style={[styles.bubble, isMine && styles.bubbleMine]}>
        {!isMine && (
          <View style={styles.bubbleTop}>
            <Text style={styles.bubbleSender}>{msg.sender_name ?? "User"}</Text>
            <RolePill role={msg.sender_role} />
          </View>
        )}
        <Text style={[styles.bubbleContent, isMine && styles.bubbleContentMine]}>{msg.content}</Text>
        <Text style={[styles.bubbleTime, isMine && { color: "rgba(255,255,255,0.7)", textAlign: "right" }]}>{timeAgo(msg.created_at)}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DisputeScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user } = useAuth();
  const { get, post } = useApi();
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<DisputeBooking | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [showOpenForm, setShowOpenForm] = useState(false);

  async function load() {
    if (!bookingId) return;
    try {
      const data = await get(`/disputes/${bookingId}`);
      setBooking(data.booking);
      setMessages(data.messages ?? []);
      if (!data.booking?.dispute_status) setShowOpenForm(true);
    } catch {
      // No dispute yet — show open form
      setShowOpenForm(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [bookingId]);

  async function sendMessage() {
    const content = newMsg.trim();
    if (!content || content.length < 2) return;
    setSending(true);
    try {
      await post(`/disputes/${bookingId}/message`, { content });
      setNewMsg("");
      await load();
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  const disputeStatus = booking?.dispute_status;
  const meta = STATUS_META[disputeStatus ?? ""] ?? STATUS_META.open;
  const canMessage = disputeStatus === "open" || disputeStatus === "under_review";

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={C.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={["#FF7A18", "#FF9F43"]} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.headerTitle}>Dispute</Text>
          {booking && (
            <Text style={styles.headerSub} numberOfLines={1}>
              {booking.listing_title ?? `Booking #${bookingId?.slice(-8).toUpperCase()}`}
            </Text>
          )}
        </View>
        {disputeStatus && (
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={12} color={meta.color} />
            <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        )}
      </LinearGradient>

      {/* No dispute yet → show open form */}
      {showOpenForm && !disputeStatus ? (
        <OpenDisputeForm
          bookingId={bookingId!}
          onSuccess={() => { setShowOpenForm(false); load(); }}
        />
      ) : (
        <>
          {/* Dispute info strip */}
          {booking?.dispute_reason && (
            <View style={styles.reasonStrip}>
              <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
              <Text style={styles.reasonStripText} numberOfLines={2}>
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>Reason: </Text>
                {booking.dispute_reason}
              </Text>
            </View>
          )}

          {/* Resolved banner */}
          {disputeStatus === "resolved" && booking?.dispute_resolution && (
            <View style={styles.resolvedBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.resolvedTitle}>Dispute Resolved</Text>
                <Text style={styles.resolvedSub}>{booking.dispute_resolution}</Text>
                {booking.refund_amount && Number(booking.refund_amount) > 0 && (
                  <Text style={styles.resolvedRefund}>₹{Number(booking.refund_amount).toFixed(2)} refunded to wallet</Text>
                )}
              </View>
            </View>
          )}

          {/* Messages */}
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyMsgs}>
                <Ionicons name="chatbubbles-outline" size={40} color={C.textTertiary} />
                <Text style={styles.emptyMsgsText}>No messages yet{"\n"}Be the first to add a message</Text>
              </View>
            }
            renderItem={({ item }) => (
              <MessageBubble msg={item} currentUserId={user?.id ?? ""} />
            )}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          />

          {/* Message input */}
          {canMessage ? (
            <View style={[styles.inputWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TextInput
                style={styles.input}
                value={newMsg}
                onChangeText={setNewMsg}
                placeholder="Add to the dispute thread..."
                placeholderTextColor={C.textTertiary}
                multiline
                maxLength={500}
                returnKeyType="default"
              />
              <Pressable
                style={[styles.sendBtn, (!newMsg.trim() || sending) && { opacity: 0.4 }]}
                onPress={sendMessage}
                disabled={!newMsg.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          ) : (
            <View style={[styles.closedBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Ionicons name={meta.icon as any} size={16} color={meta.color} />
              <Text style={[styles.closedBarText, { color: meta.color }]}>
                {disputeStatus === "resolved" ? "This dispute has been resolved" : "Dispute thread closed"}
              </Text>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 17 },
  headerSub: { color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Open form styles
  progress: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  progressStep: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.borderLight, alignItems: "center", justifyContent: "center",
  },
  progressStepActive: { backgroundColor: C.tint },
  progressStepText: { fontSize: 12, fontFamily: "Inter_700Bold", color: C.textSecondary },
  progressStepTextActive: { color: "#fff" },
  progressLine: { flex: 1, height: 2, backgroundColor: C.borderLight, marginHorizontal: 8 },
  progressLineActive: { backgroundColor: C.tint },
  formTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginBottom: 6 },
  formSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  reasonList: { gap: 10, marginBottom: 24 },
  reasonOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1, borderColor: C.borderLight,
  },
  reasonOptionSelected: { borderColor: C.tint, backgroundColor: "#FFF7F0" },
  reasonDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: C.borderLight },
  reasonDotSelected: { borderColor: C.tint, backgroundColor: C.tint },
  reasonText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text },
  reasonTextSelected: { fontFamily: "Inter_600SemiBold", color: C.tint },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 15,
  },
  nextBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  backLinkText: { color: C.tint, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  selectedReasonTag: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF3C7", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, alignSelf: "flex-start", marginBottom: 16,
  },
  selectedReasonTagText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#92400E" },
  messageInput: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: C.borderLight,
    padding: 14, minHeight: 120, fontFamily: "Inter_400Regular", fontSize: 14,
    color: C.text, marginBottom: 8,
  },
  charCount: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, textAlign: "right", marginBottom: 16 },
  noteBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 12, padding: 12, marginBottom: 20,
  },
  noteText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: "#1D4ED8", lineHeight: 18 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 15,
  },
  submitBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  // Thread styles
  reasonStrip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF3C7", paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#FDE68A",
  },
  reasonStripText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#92400E" },
  resolvedBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#D1FAE5", borderBottomWidth: 1, borderBottomColor: "#6EE7B7",
    padding: 14, paddingHorizontal: 16,
  },
  resolvedTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#065F46" },
  resolvedSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#047857", marginTop: 2 },
  resolvedRefund: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#059669", marginTop: 4 },
  emptyMsgs: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyMsgsText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textTertiary, textAlign: "center", lineHeight: 22 },

  // Message bubbles
  bubbleWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 12 },
  bubbleWrapMine: { flexDirection: "row-reverse" },
  bubbleAvatar: { width: 32, height: 32 },
  bubbleAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  bubbleAvatarPlaceholder: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },
  bubbleAvatarInitial: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  bubble: {
    flex: 1, maxWidth: "80%",
    backgroundColor: "#fff", borderRadius: 16, borderBottomLeftRadius: 4,
    padding: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  bubbleMine: {
    backgroundColor: C.tint, borderRadius: 16, borderBottomRightRadius: 4,
  },
  bubbleTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  bubbleSender: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary },
  bubbleContent: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleContentMine: { color: "#fff" },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: C.textTertiary, marginTop: 4 },
  rolePill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
  },
  rolePillText: { fontSize: 9, fontFamily: "Inter_700Bold" },

  // Admin bubble
  adminBubbleWrap: { alignItems: "center", marginBottom: 14 },
  adminBubble: {
    backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A",
    borderRadius: 12, padding: 12, maxWidth: "88%",
  },
  adminBubbleHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  adminBubbleName: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 12, color: "#D97706" },
  adminBubbleContent: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#92400E", lineHeight: 20 },

  // Input
  inputWrap: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.borderLight,
  },
  input: {
    flex: 1, backgroundColor: C.background, borderRadius: 20, borderWidth: 1,
    borderColor: C.borderLight, paddingHorizontal: 16, paddingVertical: 10,
    fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },
  closedBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, paddingTop: 12,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.borderLight,
  },
  closedBarText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
