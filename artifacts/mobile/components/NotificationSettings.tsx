import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useNativeNotifications } from "@/context/NotificationContext";
import { openNativeNotificationSettings } from "@/services/NativeNotifications";
import Colors from "@/constants/colors";

const C = Colors.light;
export default function NotificationSettings() {
  const { status, busy, error, refresh, enable } = useNativeNotifications();
  const [showExplanation, setShowExplanation] = useState(true);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const label = status === "allowed" ? "Notifications Allowed" : status === "disabled" ? "Notifications Disabled"
    : status === "not-requested" ? "Permission Not Requested"
    : status === "unsupported" ? "Available in the installed mobile app"
    : error ? "Unable to read device permission" : "Checking device permission…";
  async function openSettings() {
    try { await openNativeNotificationSettings(); }
    catch { Alert.alert("Notification settings", "Could not open device settings. Open Settings on your phone and select RentZilla > Notifications."); }
  }
  return (
    <View style={styles.card} testID="native-notification-settings">
      <Text style={styles.title}>Device Notifications</Text>
      <Text style={styles.status} accessibilityLiveRegion="polite">{label}</Text>
      <Text style={styles.body}>RentZilla notifications are managed through your phone settings.</Text>
      {status === "disabled" && <Text style={styles.body}>Notifications are currently disabled on this device.</Text>}
      {status === "not-requested" && (showExplanation ? <>
        <Text style={styles.title}>Stay updated with RentZilla</Text>
        <Text style={styles.body}>Allow notifications to receive booking updates, messages, payment updates and important account information.</Text>
        <Pressable accessibilityRole="button" testID="enable-native-notifications" disabled={busy} onPress={() => void enable()} style={styles.button}>
          <Text style={styles.buttonText}>{busy ? "Requesting permission…" : "Enable Notifications"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setShowExplanation(false)} style={styles.secondary}>
          <Text style={styles.link}>Not Now</Text>
        </Pressable>
      </> : <Pressable accessibilityRole="button" onPress={() => setShowExplanation(true)} style={styles.secondary}>
        <Text style={styles.link}>Enable Notifications</Text>
      </Pressable>)}
      {status !== "unsupported" && <Pressable accessibilityRole="button" testID="manage-native-notifications" onPress={() => void openSettings()} style={styles.button}>
        <Text style={styles.buttonText}>Manage Notification Settings</Text>
      </Pressable>}
      {error && <>
        <Text style={styles.body} accessibilityLiveRegion="polite">{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.secondary}><Text style={styles.link}>Retry</Text></Pressable>
      </>}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: C.background, borderRadius: 16, marginHorizontal: 16, padding: 16, gap: 10 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  status: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.tint },
  body: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, color: C.textSecondary },
  button: { borderRadius: 12, backgroundColor: C.tint, padding: 13, alignItems: "center" },
  buttonText: { color: C.background, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "center" },
  secondary: { padding: 10, alignItems: "center" },
  link: { color: C.tint, fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
