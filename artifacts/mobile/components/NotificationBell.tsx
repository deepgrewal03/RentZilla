import Button3D from "@/components/Button3D";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;
const ORANGE = "#FF7A18";
const POLL_INTERVAL_MS = 30_000;

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string, isPa: boolean) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isPa) {
    if (diff < 60) return "ਹੁਣੇ";
    if (diff < 3600) return `${Math.floor(diff / 60)} ਮਿੰਟ ਪਹਿਲਾਂ`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ਘੰਟੇ ਪਹਿਲਾਂ`;
    return `${Math.floor(diff / 86400)} ਦਿਨ ਪਹਿਲਾਂ`;
  }
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fullDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

const CODE_REGEX = /\b([A-Z0-9]{4,20})\b/g;

function extractCodes(message: string): string[] {
  const codes: string[] = [];
  let match: RegExpExecArray | null;
  CODE_REGEX.lastIndex = 0;
  while ((match = CODE_REGEX.exec(message)) !== null) {
    if (!/^\d+$/.test(match[1])) codes.push(match[1]);
  }
  return [...new Set(codes)];
}

function notifIcon(title: string): { name: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  const t = title.toLowerCase();
  if (t.includes("confirm") || t.includes("approved")) return { name: "checkmark-circle", color: "#059669", bg: "#D1FAE5" };
  if (t.includes("cancel") || t.includes("reject")) return { name: "close-circle", color: "#DC2626", bg: "#FEE2E2" };
  if (t.includes("promo") || t.includes("offer") || t.includes("discount") || t.includes("code")) return { name: "pricetag", color: ORANGE, bg: "#FFF3E9" };
  if (t.includes("message") || t.includes("chat")) return { name: "chatbubble-ellipses", color: "#3B82F6", bg: "#EFF6FF" };
  if (t.includes("book")) return { name: "calendar", color: "#7C3AED", bg: "#EDE9FE" };
  if (t.includes("payment") || t.includes("paid")) return { name: "cash", color: "#059669", bg: "#D1FAE5" };
  if (t.includes("document") || t.includes("verif")) return { name: "shield-checkmark", color: "#2563EB", bg: "#DBEAFE" };
  return { name: "notifications", color: ORANGE, bg: "#FFF3E9" };
}

const SPRING = { useNativeDriver: false, tension: 340, friction: 12 };

type ViewState = "none" | "list" | "detail";

export function NotificationBell() {
  const { get, put } = useApi();
  const { user } = useAuth();
  const { t, language } = useLang();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showNotifications } = useLocalSearchParams<{ showNotifications?: string }>();
  const isWeb = Platform.OS === "web";

  const [view, setView]                     = useState<ViewState>("none");
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [selected, setSelected]             = useState<Notification | null>(null);
  const [copied, setCopied]                 = useState<string | null>(null);
  useEffect(() => {
    if (showNotifications === "1" && user) {
      setView("list");
      void fetchNotifications();
      router.setParams({ showNotifications: undefined });
    }
  }, [showNotifications, user?.id]);

  const bellScale    = useRef(new Animated.Value(1)).current;
  const glowOpacity  = useRef(new Animated.Value(0)).current;
  const glowScale    = useRef(new Animated.Value(0.9)).current;
  const badgeScale   = useRef(new Animated.Value(1)).current;
  const detailSlide  = useRef(new Animated.Value(40)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;
  const glowLoop     = useRef<Animated.CompositeAnimation | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const topPad      = isWeb ? 67 : insets.top;
  const isPa        = language === "pa";

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (glowLoop.current) {
      glowLoop.current.stop();
      glowLoop.current = null;
    }

    if (unreadCount > 0) {
      // Pulse glow ring
      glowOpacity.setValue(0);
      glowScale.setValue(0.88);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowOpacity, { toValue: 0.7, duration: 700, useNativeDriver: false }),
            Animated.timing(glowScale,   { toValue: 1.28, duration: 700, useNativeDriver: false }),
          ]),
          Animated.parallel([
            Animated.timing(glowOpacity, { toValue: 0, duration: 900, useNativeDriver: false }),
            Animated.timing(glowScale,   { toValue: 0.88, duration: 900, useNativeDriver: false }),
          ]),
          Animated.delay(1200),
        ])
      );
      glowLoop.current = loop;
      loop.start();

      // Badge pop
      Animated.sequence([
        Animated.spring(badgeScale, { toValue: 1.4, useNativeDriver: false, tension: 400, friction: 6 }),
        Animated.spring(badgeScale, { toValue: 1,   useNativeDriver: false, tension: 300, friction: 8 }),
      ]).start();
    } else {
      glowOpacity.setValue(0);
    }
  }, [unreadCount]);

  async function fetchNotifications() {
    if (!user) return;

    try {
      const data = await get<Notification[]>("/notifications");
      setNotifications(data);
    } catch {
      /* ignore — user may not be authenticated yet */
    }
  }

  async function markAllRead() {
    try {
      await put("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  }

  async function markOneRead(id: string) {
    try {
      await put(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {}
  }

  function openPanel() {
    if (!user) return;

    Haptics.selectionAsync();
    Animated.sequence([
      Animated.spring(bellScale, { toValue: 0.82, ...SPRING, tension: 420 }),
      Animated.spring(bellScale, { toValue: 1.12, ...SPRING, tension: 260, friction: 7 }),
      Animated.spring(bellScale, { toValue: 1, ...SPRING }),
    ]).start();
    fetchNotifications();
    setView("list");
  }

  function openDetail(n: Notification) {
    Haptics.selectionAsync();
    setSelected(n);
    setCopied(null);
    detailSlide.setValue(40);
    detailOpacity.setValue(0);
    setView("detail");
    Animated.parallel([
      Animated.spring(detailSlide, { toValue: 0, ...SPRING, tension: 280, friction: 20 }),
      Animated.timing(detailOpacity, { toValue: 1, duration: 180, useNativeDriver: false }),
    ]).start();
  }

  async function closeDetail() {
    if (!selected) return;
    Animated.parallel([
      Animated.timing(detailSlide, { toValue: 30, duration: 160, useNativeDriver: false }),
      Animated.timing(detailOpacity, { toValue: 0, duration: 160, useNativeDriver: false }),
    ]).start(async () => {
      if (selected && !selected.isRead) {
        await markOneRead(selected.id);
      }
      setSelected(null);
      setView("list");
    });
  }

  function closeAll() {
    setView("none");
    setSelected(null);
  }

  function openNotifSettings() {
    closeAll();
    setTimeout(() => router.push("/(tabs)/settings"), 120);
  }

  async function copyText(text: string, label: string) {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <>
      {/* ── Bell button with glow ring ── */}
      <Button3D
        onPress={openPanel}
        color="rgba(255,255,255,0.2)"
        edgeColor="#C65F16"
        radius={22}
        depth={3}
        clipFace={false}
        style={styles.bell3DOuter}
        faceStyle={styles.bellOuter}
        accessibilityLabel="Notifications"
      >
        {/* Glow ring pulse */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        <Animated.View style={[styles.bellBtn, unreadCount > 0 && styles.bellBtnActive, { transform: [{ scale: bellScale }] }]}>
          <Ionicons
            name={unreadCount > 0 ? "notifications" : "notifications-outline"}
            size={22}
            color="#fff"
          />
          {unreadCount > 0 && (
            <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </Animated.View>
          )}
        </Animated.View>
      </Button3D>

      {/* ── Single Modal — switches between list and detail views ── */}
      <Modal
        visible={view !== "none"}
        transparent
        animationType="none"
        onRequestClose={view === "detail" ? closeDetail : closeAll}
      >
        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <>
            <Pressable style={styles.modalOverlay} onPress={closeAll} />
            <Animated.View style={[styles.panel, { top: topPad + 56 }]}>
              <View style={styles.panelHeader}>
                <View style={styles.panelTitleRow}>
                  <Ionicons name="notifications" size={16} color={ORANGE} />
                  <Text style={styles.panelTitle}>{t.notifications}</Text>
                  {unreadCount > 0 && (
                    <View style={styles.unreadPill}>
                      <Text style={styles.unreadPillText}>{unreadCount} new</Text>
                    </View>
                  )}
                </View>
                {unreadCount > 0 && (
                  <Pressable onPress={markAllRead}>
                    <Text style={styles.markAllText}>{t.markAllRead}</Text>
                  </Pressable>
                )}
              </View>

              <ScrollView style={styles.panelList} showsVerticalScrollIndicator={false}>
                {notifications.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="notifications-off-outline" size={36} color={C.textTertiary} />
                    <Text style={styles.emptyText}>{t.noNotifications}</Text>
                  </View>
                ) : (
                  notifications.map((n) => {
                    const icon = notifIcon(n.title);
                    return (
                      <Pressable
                        key={n.id}
                        style={({ pressed }) => [
                          styles.notifItem,
                          !n.isRead && styles.notifUnread,
                          pressed && styles.notifPressed,
                        ]}
                        onPress={() => openDetail(n)}
                      >
                        <View style={[styles.notifIconWrap, { backgroundColor: icon.bg }]}>
                          <Ionicons name={icon.name} size={16} color={icon.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.notifTitleRow}>
                            <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                            {!n.isRead && <View style={styles.unreadDot} />}
                          </View>
                          <Text style={styles.notifMsg} numberOfLines={2}>{n.message}</Text>
                          <Text style={styles.notifTime}>{timeAgo(n.createdAt, isPa)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
                      </Pressable>
                    );
                  })
                )}
                <View style={{ height: 8 }} />
              </ScrollView>

              {/* ── Quick Settings Footer ── */}
              <Pressable
                style={({ pressed }) => [styles.settingsFooter, pressed && styles.settingsFooterPressed]}
                onPress={openNotifSettings}
              >
                <Ionicons name="settings-outline" size={14} color={ORANGE} />
                <Text style={styles.settingsFooterText}>Notification Settings</Text>
                <Ionicons name="chevron-forward" size={13} color={ORANGE} />
              </Pressable>
            </Animated.View>
          </>
        )}

        {/* ── DETAIL VIEW ── */}
        {view === "detail" && selected && (
          <>
            <Pressable style={styles.detailOverlay} onPress={closeDetail} />
            <View style={styles.detailCenterWrap} pointerEvents="box-none">
              <Animated.View
                style={[
                  styles.detailCard,
                  {
                    opacity: detailOpacity,
                    transform: [{ translateY: detailSlide }],
                  },
                ]}
              >
                {/* Icon */}
                {(() => {
                  const icon = notifIcon(selected.title);
                  return (
                    <View style={[styles.detailIconCircle, { backgroundColor: icon.bg }]}>
                      <Ionicons name={icon.name} size={32} color={icon.color} />
                    </View>
                  );
                })()}

                {/* Header */}
                <Text style={styles.detailTitle}>{selected.title}</Text>
                <Text style={styles.detailDate}>{fullDate(selected.createdAt)}</Text>

                {/* Message */}
                <View style={styles.detailMsgBox}>
                  <Text style={styles.detailMsg}>{selected.message}</Text>
                </View>

                {/* Detected promo codes */}
                {extractCodes(selected.message).map((code) => (
                  <Pressable
                    key={code}
                    style={styles.codeChip}
                    onPress={() => copyText(code, code)}
                  >
                    <View style={styles.codeChipLeft}>
                      <Ionicons name="pricetag" size={14} color={ORANGE} />
                      <Text style={styles.codeChipCode}>{code}</Text>
                    </View>
                    <View style={styles.codeChipCopy}>
                      <Ionicons
                        name={copied === code ? "checkmark" : "copy-outline"}
                        size={14}
                        color={copied === code ? "#059669" : ORANGE}
                      />
                      <Text style={[styles.codeChipCopyText, copied === code && { color: "#059669" }]}>
                        {copied === code ? "Copied!" : "Tap to copy"}
                      </Text>
                    </View>
                  </Pressable>
                ))}

                {/* Copy full message */}
                <Pressable
                  style={styles.copyMsgBtn}
                  onPress={() => copyText(selected.message, "__msg")}
                >
                  <Ionicons
                    name={copied === "__msg" ? "checkmark-circle" : "copy-outline"}
                    size={16}
                    color={copied === "__msg" ? "#059669" : C.textSecondary}
                  />
                  <Text style={[styles.copyMsgText, copied === "__msg" && { color: "#059669" }]}>
                    {copied === "__msg" ? "Copied to clipboard!" : "Copy message"}
                  </Text>
                </Pressable>

                {/* Close */}
                <Pressable style={styles.closeBtn} onPress={closeDetail}>
                  <Text style={styles.closeBtnText}>
                    {selected.isRead ? "Close" : "Mark as Read & Close"}
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          </>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bell3DOuter: { width: 44 },
  bellOuter: {
    width: 44, height: 44,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  glowRing: {
    position: "absolute",
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: ORANGE,
    opacity: 0,
  },
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  bellBtnActive: {
    backgroundColor: `${ORANGE}30`,
    borderWidth: 1.5,
    borderColor: `${ORANGE}70`,
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
    position: "absolute", right: 12, width: 320, maxHeight: 460,
    backgroundColor: "#fff", borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 20, overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
    backgroundColor: "#FAFAFA",
  },
  panelTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  panelTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  unreadPill: {
    backgroundColor: `${ORANGE}18`, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  unreadPillText: { fontSize: 10, color: ORANGE, fontWeight: "700", fontFamily: "Inter_700Bold" },
  markAllText: { fontSize: 12, color: C.tint, fontFamily: "Inter_500Medium" },
  panelList: { flex: 1, maxHeight: 340 },
  emptyBox: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { fontSize: 14, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  notifItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  notifUnread: { backgroundColor: `${ORANGE}08` },
  notifPressed: { backgroundColor: `${ORANGE}14` },
  notifIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  notifTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  notifTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ORANGE, flexShrink: 0 },
  notifMsg: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 17 },
  notifTime: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular", marginTop: 3 },

  /* ── Quick Settings Footer ── */
  settingsFooter: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.borderLight,
    backgroundColor: `${ORANGE}06`,
  },
  settingsFooterPressed: { backgroundColor: `${ORANGE}14` },
  settingsFooterText: {
    flex: 1, fontSize: 13, color: ORANGE,
    fontFamily: "Inter_600SemiBold",
  },

  /* ── Detail popup ── */
  detailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  detailCenterWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 24,
  },
  detailCard: {
    width: "100%", maxWidth: 360,
    backgroundColor: "#fff", borderRadius: 20,
    padding: 24, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22, shadowRadius: 32, elevation: 30,
  },
  detailIconCircle: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  detailTitle: {
    fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold",
    color: C.text, textAlign: "center", marginBottom: 4,
  },
  detailDate: {
    fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  detailMsgBox: {
    width: "100%", backgroundColor: "#F8F9FA", borderRadius: 12,
    padding: 14, marginBottom: 14,
  },
  detailMsg: {
    fontSize: 14, color: C.text, fontFamily: "Inter_400Regular",
    lineHeight: 22, textAlign: "center",
  },

  codeChip: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF3E9", borderRadius: 10,
    borderWidth: 1.5, borderColor: `${ORANGE}30`,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 8,
  },
  codeChipLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  codeChipCode: {
    fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold",
    color: ORANGE, letterSpacing: 2,
  },
  codeChipCopy: { flexDirection: "row", alignItems: "center", gap: 4 },
  codeChipCopyText: { fontSize: 12, color: ORANGE, fontFamily: "Inter_500Medium" },

  copyMsgBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8, marginBottom: 16,
  },
  copyMsgText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  closeBtn: {
    width: "100%", backgroundColor: ORANGE,
    borderRadius: 12, paddingVertical: 14,
    alignItems: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
