import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button3D from "@/components/Button3D";
import HomeVisual from "@/constants/homeVisualTokens";
import { DrawerTokens as D } from "@/constants/drawerTokens";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { confirmAction } from "@/lib/confirm";

const FARM_BG = require("@/assets/images/home-farm-background.jpg");
const MAX_DRAWER_WIDTH = 320;

// Drawer-only inline translations for entries not in the shared dictionary
const EXTRA = {
  en: { gold: "RentZilla Gold", goldSub: "Get 4% off every booking", settings: "Settings", help: "Help & Support", unread: "unread", close: "Close menu", tagline: "Farm. Rent. Grow.", dashboard: "Dashboard", addListing: "Add Listing", wallet: "Earnings & Wallet" },
  pa: { gold: "ਰੈਂਟਜ਼ਿਲਾ ਗੋਲਡ", goldSub: "ਹਰ ਬੁਕਿੰਗ 'ਤੇ 4% ਛੋਟ", settings: "ਸੈਟਿੰਗਾਂ", help: "ਮਦਦ ਅਤੇ ਸਹਾਇਤਾ", unread: "ਨਾ ਪੜ੍ਹੇ", close: "ਮੀਨੂ ਬੰਦ ਕਰੋ", tagline: "ਖੇਤੀ. ਕਿਰਾਇਆ. ਤਰੱਕੀ.", dashboard: "ਡੈਸ਼ਬੋਰਡ", addListing: "ਲਿਸਟਿੰਗ ਜੋੜੋ", wallet: "ਕਮਾਈ ਅਤੇ ਵਾਲਿਟ" },
} as const;

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Provider-mode menu: dashboard replaces customer Home/Search so provider routes stay reachable.
const PROVIDER_MENU_ITEMS = [
  { icon: "grid-outline", activeIcon: "grid", labelKey: "dashboard", path: "/(tabs)/dashboard", match: ["/dashboard"] },
  { icon: "add-circle-outline", activeIcon: "add-circle", labelKey: "addListing", path: "/add-listing", match: ["/add-listing"] },
  { icon: "calendar-outline", activeIcon: "calendar", labelKey: "myBookings", path: "/(tabs)/bookings", match: ["/bookings"] },
  { icon: "wallet-outline", activeIcon: "wallet", labelKey: "wallet", path: "/(tabs)/wallet", match: ["/wallet"] },
  { icon: "person-outline", activeIcon: "person", labelKey: "myProfile", path: "/(tabs)/profile", match: ["/profile"] },
] as const;

const MENU_ITEMS = [
  { icon: "home-outline", activeIcon: "home", labelKey: "home", path: "/(tabs)", match: ["/", "/index"] },
  { icon: "search-outline", activeIcon: "search", labelKey: "searchEquipment", path: "/(tabs)/search", match: ["/search"] },
  { icon: "calendar-outline", activeIcon: "calendar", labelKey: "myBookings", path: "/(tabs)/bookings", match: ["/bookings"] },
  { icon: "heart-outline", activeIcon: "heart", labelKey: "favourites", path: "/(tabs)/favorites", match: ["/favorites"] },
  { icon: "person-outline", activeIcon: "person", labelKey: "myProfile", path: "/(tabs)/profile", match: ["/profile"] },
] as const;

export function SideDrawer({ visible, onClose }: Props) {
  const { user, logout, activeMode } = useAuth();
  const { t, language, toggleLanguage } = useLang();
  const x = EXTRA[language === "pa" ? "pa" : "en"];
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { width: screenW } = useWindowDimensions();
  const DRAWER_WIDTH = Math.min(MAX_DRAWER_WIDTH, Math.round(screenW * 0.86));
  const slideAnim = useRef(new Animated.Value(-MAX_DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  // `mounted` lags behind `visible` so the close animation can play before unmount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -MAX_DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  function navigate(path: string) {
    Haptics.selectionAsync();
    onClose();
    setTimeout(() => router.push(path as any), 200);
  }

  async function handleLogout() {
    Haptics.selectionAsync();
    onClose();
    setTimeout(() => {
      confirmAction({
        title: t.logoutConfirmTitle,
        message: t.logoutConfirmMsg,
        confirmText: t.logout,
        cancelText: t.cancel,
        destructive: true,
        onConfirm: async () => {
          await logout();
          router.replace("/sign-in");
        },
      });
    }, 300);
  }

  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Guest";
  const inProviderMode = user?.role === "provider" || (user?.role === "both" && activeMode === "provider");
  const roleLabel = inProviderMode ? t.provider : t.customer;
  const items = inProviderMode ? PROVIDER_MENU_ITEMS : MENU_ITEMS;
  const labelFor = (key: string): string => (t as any)[key] ?? (x as any)[key] ?? key;
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = (isWeb ? 34 : insets.bottom) + 16;
  const isActive = (match: readonly string[]) => match.includes(pathname);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      <Animated.View
        style={[styles.drawer, { width: DRAWER_WIDTH, transform: [{ translateX: slideAnim }] }]}
        accessibilityViewIsModal
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
        >
          {/* Branded farmland header containing the user card */}
          <View style={[styles.header, { paddingTop: topPad + 12 }]}>
            <Image source={FARM_BG} contentFit="fill" accessible={false}
              style={{ position: "absolute", top: 30, left: 0, right: 0, height: topPad + 135 }}
            />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.brandRow}>
                  <Ionicons name="leaf" size={16} color={D.white} />
                  <Text style={styles.brand} accessibilityRole="header">RentZilla</Text>
                </View>
                <Text style={styles.tagline}>{x.tagline}</Text>
              </View>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={x.close}
                hitSlop={6}
              >
                <Ionicons name="close" size={22} color={D.text} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => navigate("/(tabs)/profile")}
              style={({ pressed }) => [styles.userCard, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
              accessibilityLabel={`${displayName}, ${roleLabel}. ${t.myProfile}`}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{displayName[0]?.toUpperCase() || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.userRole} numberOfLines={1}>{roleLabel}</Text>
              </View>
              <View style={styles.cardChevron}>
                <Ionicons name="chevron-forward" size={16} color={D.primary} />
              </View>
            </Pressable>
          </View>

          <View style={styles.body}>
          {/* Menu */}
          <View style={styles.menu}>
            {items.map((item) => {
              const active = isActive(item.match);
              return (
                <React.Fragment key={item.labelKey}>
                  <Pressable
                    onPress={() => navigate(item.path)}
                    accessibilityRole="button"
                    accessibilityLabel={labelFor(item.labelKey)}
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.row,
                      active && styles.rowActive,
                      pressed && !active && { backgroundColor: D.tileBg },
                    ]}
                  >
                    {active && <View style={styles.activeBar} />}
                    <View style={[styles.tile, active && { backgroundColor: D.activeTile }]}>
                      <Ionicons
                        name={(active ? item.activeIcon : item.icon) as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color={active ? D.primary : D.text}
                      />
                    </View>
                    <Text style={[styles.label, active && styles.labelActive]}>{labelFor(item.labelKey)}</Text>
                    <View style={[styles.chevron, active && { backgroundColor: D.activeChevronBg }]}>
                      <Ionicons name="chevron-forward" size={14} color={active ? D.primary : D.textSecondary} />
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}

            <View style={styles.divider} />

            {/* Gold membership */}
            <Pressable
              onPress={() => navigate("/gold-membership")}
              accessibilityRole="button"
              accessibilityLabel={`${x.gold}. ${x.goldSub}`}
              style={({ pressed }) => [styles.gold, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.crown}>
                <MaterialCommunityIcons name="crown" size={22} color={D.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.goldTitle} numberOfLines={1}>{x.gold}</Text>
                <Text style={styles.goldSub} numberOfLines={2}>{x.goldSub}</Text>
              </View>
              <View style={styles.sparkles} pointerEvents="none">
                <Ionicons name="sparkles" size={18} color={D.goldSpark} />
              </View>
              <View style={styles.goldChevron}>
                <Ionicons name="chevron-forward" size={14} color={D.goldText} />
              </View>
            </Pressable>

            {/* Refer a Friend (moved from home) */}
            <Pressable onPress={() => navigate("/referral")} style={styles.referBanner} accessibilityRole="button" accessibilityLabel="Refer a Friend, Earn 10% Off">
              <LinearGradient
                colors={["#E93478", "#F14D62", "#FF9141"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.referBannerGrad}
              >
                <View style={styles.referGiftIcon}>
                  <Ionicons name="gift-outline" size={21} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referBannerTitle}>Refer a Friend, Earn 10% Off</Text>
                  <Text style={styles.referBannerSub}>Share your code · 5 friends = reward!</Text>
                </View>
                <View style={styles.referBannerCta}>
                  <Text style={styles.referBannerCtaTxt}>Share</Text>
                  <Ionicons name="chevron-forward" size={12} color={HomeVisual.orange} />
                </View>
              </LinearGradient>
            </Pressable>

            <View style={styles.divider} />

            {/* Language toggle */}
            <Pressable
              onPress={() => { Haptics.selectionAsync(); toggleLanguage(); }}
              accessibilityRole="button"
              accessibilityLabel={language === "en" ? "Switch to Punjabi" : "Switch to English"}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: D.tileBg }]}
            >
              <View style={[styles.tile, { backgroundColor: D.langTile }]}>
                <Ionicons name="globe-outline" size={20} color={D.langIcon} />
              </View>
              <Text style={styles.label}>{language === "en" ? "ਪੰਜਾਬੀ" : "English"}</Text>
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{language.toUpperCase()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={D.textSecondary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Logout */}
            <Pressable
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel={t.logout}
              style={({ pressed }) => [styles.logout, pressed && { backgroundColor: D.logoutPressed }]}
            >
              <View style={[styles.tile, { backgroundColor: "transparent" }]}>
                <Ionicons name="log-out-outline" size={22} color={D.logoutText} />
              </View>
              <Text style={[styles.label, styles.logoutLabel]}>{t.logout}</Text>
              <Ionicons name="chevron-forward" size={16} color={D.logoutText} />
            </Pressable>
          </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: D.backdrop },
  drawer: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    backgroundColor: D.surface,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#3A1A00",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  header: { paddingHorizontal: 14, paddingBottom: 40, overflow: "hidden", backgroundColor: D.primary },
  body: {
    backgroundColor: D.surface, marginTop: -24, borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: D.badge, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: D.white, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700" },
  gold: {
    flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4,
    paddingHorizontal: 12, paddingVertical: 12, minHeight: 64, borderRadius: 18,
    backgroundColor: D.goldBg, borderWidth: 1, borderColor: D.goldBorder,
  },
  crown: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: D.goldCrown,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#B07800", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  goldTitle: { fontSize: 15, fontFamily: "Inter_700Bold", fontWeight: "700", color: D.text },
  goldSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: D.textSecondary, marginTop: 2 },
  sparkles: { alignSelf: "flex-start" },
  goldChevron: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: D.goldChevronBg,
    alignItems: "center", justifyContent: "center",
  },
  referBanner: { marginTop: 8, marginBottom: 4, borderRadius: 18, overflow: "hidden", elevation: 3, shadowColor: "#CE4A58", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.19, shadowRadius: 10 },
  referBannerGrad: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, gap: 9 },
  referGiftIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.17)", alignItems: "center", justifyContent: "center" },
  referBannerTitle: { fontSize: 13, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#fff" },
  referBannerSub: { fontSize: 11, color: "rgba(255,255,255,0.88)", fontFamily: "Inter_400Regular", marginTop: 1 },
  referBannerCta: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#FFF8F5", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  referBannerCtaTxt: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: HomeVisual.orange },
  headerTint: { ...StyleSheet.absoluteFillObject, backgroundColor: D.headerTint },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: {
    fontSize: 26, fontFamily: "Inter_700Bold", fontWeight: "700", color: D.white, letterSpacing: -0.5,
    textShadowColor: "rgba(80,30,0,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  tagline: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: D.white, marginTop: 2, opacity: 0.95,
    textShadowColor: "rgba(80,30,0,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: D.closeBg,
    alignItems: "center", justifyContent: "center",
  },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginTop: 22, padding: 14, minHeight: 72,
    backgroundColor: D.cream, borderRadius: 20, borderWidth: 1, borderColor: D.creamBorder,
    shadowColor: "#B85A10", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 6,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: D.avatarBg,
    borderWidth: 1.5, borderColor: D.creamBorder, alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700", color: D.primary },
  userName: { fontSize: 17, fontFamily: "Inter_700Bold", fontWeight: "700", color: D.text },
  userRole: { fontSize: 13, fontFamily: "Inter_400Regular", color: D.textSecondary, marginTop: 2 },
  cardChevron: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: D.creamBorder,
    backgroundColor: D.white, alignItems: "center", justifyContent: "center",
  },
  menu: { paddingTop: 16, paddingHorizontal: 12 },
  divider: { height: 1, backgroundColor: D.divider, marginVertical: 8, marginHorizontal: 10 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 10, paddingVertical: 6, minHeight: 56, borderRadius: 16, marginVertical: 1,
  },
  rowActive: { backgroundColor: D.activeBg },
  activeBar: {
    position: "absolute", left: -12, top: 10, bottom: 10, width: 4,
    borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: D.primary,
  },
  tile: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: D.tileBg,
    alignItems: "center", justifyContent: "center",
  },
  label: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500", color: D.text },
  labelActive: { fontFamily: "Inter_700Bold", fontWeight: "700" },
  chevron: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: D.chevronBg,
    alignItems: "center", justifyContent: "center",
  },
  langBadge: { backgroundColor: D.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  langBadgeText: { color: D.white, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700" },
  logout: {
    flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4,
    paddingHorizontal: 10, paddingVertical: 4, minHeight: 56, borderRadius: 16, backgroundColor: D.logoutBg,
  },
  logoutLabel: { color: D.logoutText, fontFamily: "Inter_700Bold", fontWeight: "700" },
});
