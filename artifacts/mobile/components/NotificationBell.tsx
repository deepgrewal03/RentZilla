import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const { get, put } = useApi();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const isWeb = Platform.OS === "web";

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const data = await get<Notification[]>("/notifications");
      setNotifications(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      await put("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  }

  function openPanel() {
    Haptics.selectionAsync();
    setOpen(true);
    fetchNotifications();
  }

  const topPad = isWeb ? 67 : insets.top;

  return (
    <>
      <Pressable onPress={openPanel} style={styles.bellBtn}>
        <Ionicons name="notifications-outline" size={22} color="#fff" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)} />
        <Animated.View style={[styles.panel, { top: topPad + 56 }]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Pressable onPress={markAllRead}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            )}
          </View>

          <ScrollView style={styles.panelList} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={36} color={C.textTertiary} />
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            ) : (
              notifications.map((n) => (
                <View key={n.id} style={[styles.notifItem, !n.isRead && styles.notifUnread]}>
                  <View style={[styles.notifDot, n.isRead && styles.notifDotRead]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifMsg}>{n.message}</Text>
                    <Text style={styles.notifTime}>{timeAgo(n.createdAt)}</Text>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 16 }} />
          </ScrollView>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute", top: 2, right: 2,
    backgroundColor: C.error,
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.navy,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700", fontFamily: "Inter_700Bold" },
  modalOverlay: { ...StyleSheet.absoluteFillObject },
  panel: {
    position: "absolute",
    right: 12,
    width: 320,
    maxHeight: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  panelTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  markAllText: { fontSize: 12, color: C.tint, fontFamily: "Inter_500Medium" },
  panelList: { flex: 1 },
  emptyBox: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { fontSize: 14, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  notifItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  notifUnread: { backgroundColor: `${C.tint}06` },
  notifDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.tint, marginTop: 5,
  },
  notifDotRead: { backgroundColor: C.borderLight },
  notifTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  notifMsg: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  notifTime: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular", marginTop: 4 },
});
