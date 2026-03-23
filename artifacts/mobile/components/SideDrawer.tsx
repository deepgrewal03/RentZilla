import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";

const C = Colors.light;
const DRAWER_WIDTH = 300;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SideDrawer({ visible, onClose }: Props) {
  const { user, logout } = useAuth();
  const { t, language, toggleLanguage } = useLang();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const MENU_ITEMS = [
    { icon: "home-outline", labelKey: "home", path: "/(tabs)" },
    { icon: "search-outline", labelKey: "searchEquipment", path: "/(tabs)/search" },
    { icon: "calendar-outline", labelKey: "myBookings", path: "/(tabs)/bookings" },
    { icon: "heart-outline", labelKey: "favourites", path: "/(tabs)/favorites" },
    { icon: "chatbubble-outline", labelKey: "messages", path: "/(tabs)/messages" },
    { icon: "person-outline", labelKey: "myProfile", path: "/(tabs)/profile", dividerBefore: true },
  ] as const;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function navigate(path: string) {
    Haptics.selectionAsync();
    onClose();
    setTimeout(() => router.push(path as any), 200);
  }

  async function handleLogout() {
    Haptics.selectionAsync();
    onClose();
    setTimeout(() => {
      Alert.alert(t.logoutConfirmTitle, t.logoutConfirmMsg, [
        { text: t.cancel, style: "cancel" },
        {
          text: t.logout,
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/sign-in");
          },
        },
      ]);
    }, 300);
  }

  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Guest";
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          { paddingTop: topPad, width: DRAWER_WIDTH, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.drawerHeader}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <View style={styles.userInfo}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{displayName[0]?.toUpperCase() || "?"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.userRole} numberOfLines={1}>
                {user?.role === "provider" ? t.provider : t.customer}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {MENU_ITEMS.map((item) => (
            <React.Fragment key={item.labelKey}>
              {item.dividerBefore && <View style={styles.menuDivider} />}
              <Pressable
                onPress={() => navigate(item.path)}
                style={({ pressed }) => [styles.menuItem, { backgroundColor: pressed ? C.backgroundTertiary : "transparent" }]}
              >
                <View style={styles.menuIconWrap}>
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color={C.text} />
                </View>
                <Text style={styles.menuLabel}>{t[item.labelKey]}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Footer: language toggle + logout */}
        <View style={[styles.drawerFooter, { paddingBottom: (isWeb ? 34 : insets.bottom) + 16 }]}>
          <View style={styles.menuDivider} />

          {/* Language toggle */}
          <Pressable
            onPress={() => { Haptics.selectionAsync(); toggleLanguage(); }}
            style={({ pressed }) => [styles.menuItem, { backgroundColor: pressed ? C.backgroundTertiary : "transparent" }]}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: `${C.tint}15` }]}>
              <Text style={{ fontSize: 16 }}>🌐</Text>
            </View>
            <Text style={styles.menuLabel}>{language === "en" ? "ਪੰਜਾਬੀ" : "English"}</Text>
            <View style={styles.langBadge}>
              <Text style={styles.langBadgeText}>{language.toUpperCase()}</Text>
            </View>
          </Pressable>

          <View style={styles.menuDivider} />

          {/* Logout */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.menuItem, { backgroundColor: pressed ? "#FEF2F2" : "transparent" }]}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: "#FEF2F215" }]}>
              <Ionicons name="log-out-outline" size={20} color={C.error} />
            </View>
            <Text style={[styles.menuLabel, { color: C.error }]}>{t.logout}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,31,61,0.5)",
  },
  drawer: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  closeBtn: {
    alignSelf: "flex-end",
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${C.tint}20`,
    borderWidth: 2, borderColor: `${C.tint}30`,
    alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  userName: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  userRole: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  menu: { flex: 1, paddingTop: 8, paddingHorizontal: 8 },
  menuDivider: { height: 1, backgroundColor: C.borderLight, marginVertical: 8, marginHorizontal: 8 },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium", color: C.text },
  langBadge: {
    backgroundColor: C.tint, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  langBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },
  drawerFooter: { paddingHorizontal: 8 },
});
