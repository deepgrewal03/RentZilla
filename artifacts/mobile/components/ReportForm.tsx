import Button3D from "@/components/Button3D";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;
const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "fraud", label: "Fraud or scam" },
  { value: "abuse", label: "Abuse or harassment" },
  { value: "fake_listing", label: "Fake listing" },
  { value: "other", label: "Other" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

interface ReportFormProps {
  visible: boolean;
  onClose: () => void;
  targetType: "listing" | "provider";
  targetId: string;
}

export function ReportForm({ visible, onClose, targetType, targetId }: ReportFormProps) {
  const { user, token, isLoading } = useAuth();
  const { post } = useApi();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<Reason | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function close() {
    if (pending.current) return;
    onClose();
    setReason(null);
    setNotes("");
    setError("");
    setSuccess(false);
  }

  async function submit() {
    if (pending.current || success || !reason) return;
    if (!user || !token) {
      setError("Please sign in to submit a report.");
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError("");
    try {
      await post("/safety/reports", {
        targetType,
        targetId,
        reason,
        ...(notes.trim() ? { description: notes.trim() } : {}),
      });
      setSuccess(true);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      setError(
        status === 409
          ? "You have already reported this item."
          : status === 429
            ? "Too many reports. Please try again later."
            : err instanceof Error ? err.message : "Could not submit report. Please try again.",
      );
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 12 }]}>
          <Pressable onPress={close} disabled={submitting} accessibilityLabel="Close report form" testID="report-close" style={styles.close}>
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Report {targetType === "listing" ? "Listing" : "Provider"}</Text>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {success ? (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={48} color={C.success} />
              <Text style={styles.successTitle}>Report submitted</Text>
              <Text style={styles.hint}>Thank you for helping keep RentZilla safe. Our team will review your report.</Text>
              <Button3D onPress={close} faceStyle={styles.submit} testID="report-done">
                <Text style={styles.submitText}>Done</Text>
              </Button3D>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>Tell us what concerns you. Reports are reviewed by our safety team.</Text>
              {!isLoading && (!user || !token) && (
                <View style={styles.authNotice}>
                  <Ionicons name="lock-closed-outline" size={19} color={C.tint} />
                  <Text style={styles.authText}>Please sign in to send a report.</Text>
                  <Pressable onPress={() => { close(); router.push("/sign-in"); }} testID="report-sign-in">
                    <Text style={styles.signInText}>Sign in</Text>
                  </Pressable>
                </View>
              )}
              <Text style={styles.label}>Reason</Text>
              {REASONS.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => { setReason(item.value); setError(""); }}
                  style={[styles.option, reason === item.value && styles.selected]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: reason === item.value }}
                  testID={`report-reason-${item.value}`}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                  <Ionicons name={reason === item.value ? "radio-button-on" : "radio-button-off"} size={22} color={reason === item.value ? C.tint : C.textTertiary} />
                </Pressable>
              ))}
              <Text style={[styles.label, styles.notesLabel]}>Additional details (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything else we should know?"
                placeholderTextColor={C.textTertiary}
                multiline
                maxLength={2000}
                style={styles.input}
                textAlignVertical="top"
                testID="report-notes"
              />
              <Text style={styles.count}>{notes.length}/2000</Text>
              {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
              <Button3D
                onPress={submit}
                disabled={!reason || submitting || isLoading || !user || !token}
                faceStyle={[styles.submit, (!reason || submitting || isLoading || !user || !token) && styles.disabled]}
                testID="report-submit"
              >
                {submitting ? <ActivityIndicator color={C.card} /> : <Text style={styles.submitText}>Submit Report</Text>}
              </Button3D>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  scroll: { flex: 1 },
  content: { padding: 20 },
  hint: { color: C.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22, marginBottom: 20 },
  authNotice: { flexDirection: "row", gap: 10, padding: 14, backgroundColor: C.card, borderRadius: 12, marginBottom: 18 },
  authText: { flex: 1, color: C.text, fontSize: 14 },
  signInText: { color: C.tint, fontFamily: "Inter_700Bold", fontSize: 14 },
  label: { color: C.text, fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12 },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 15, borderRadius: 12, backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1, marginBottom: 8 },
  selected: { borderColor: C.tint },
  optionText: { color: C.text, fontFamily: "Inter_500Medium", fontSize: 15 },
  notesLabel: { marginTop: 16 },
  input: { backgroundColor: C.card, color: C.text, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 12, minHeight: 110, padding: 14, fontSize: 14 },
  count: { textAlign: "right", color: C.textSecondary, fontSize: 12, marginTop: 6 },
  error: { color: C.error, fontSize: 14, marginTop: 12 },
  submit: { backgroundColor: C.tint, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 22 },
  disabled: { opacity: 0.5 },
  submitText: { color: C.card, fontFamily: "Inter_700Bold", fontSize: 15 },
  success: { alignItems: "center", paddingTop: 70 },
  successTitle: { color: C.text, fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 14, marginBottom: 8 },
});