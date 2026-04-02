import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingCard } from "@/components/ListingCard";
import { ListingCardSkeleton } from "@/components/SkeletonLoader";
import { NotificationBell } from "@/components/NotificationBell";
import { SideDrawer } from "@/components/SideDrawer";
import Colors, { GRADIENT_ORANGE } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";
import { Listing, Category } from "@/types";

const C = Colors.light;

const TABS: { id: Category | "all"; labelEn: string; labelPa: string }[] = [
  { id: "all",       labelEn: "All",       labelPa: "ਸਭ" },
  { id: "equipment", labelEn: "Equipment",  labelPa: "ਮਸ਼ੀਨਰੀ" },
  { id: "services",  labelEn: "Services",   labelPa: "ਸੇਵਾਵਾਂ" },
];

export default function HomeScreen() {
  const { user, activeMode, setActiveMode } = useAuth();
  const isBoth        = user?.role === "both";
  const isPureProvider = user?.role === "provider";
  const { get }       = useApi();
  const { t, language, toggleLanguage } = useLang();
  const insets        = useSafeAreaInsets();
  const isWeb         = Platform.OS === "web";
  const isPa          = language === "pa";

  const [listings, setListings]               = useState<Listing[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [selectedSubcat, setSelectedSubcat]   = useState<string>("");
  const [drawerOpen, setDrawerOpen]           = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inProviderMode = isPureProvider || (isBoth && activeMode === "provider");

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }, []);

  useEffect(() => {
    if (!user) { router.replace("/sign-in"); return; }
    if (inProviderMode) { router.replace("/(tabs)/dashboard"); return; }
    fetchListings();
  }, [user, selectedCategory, selectedSubcat, inProviderMode]);

  async function fetchListings() {
    try {
      let path = "/listings";
      const params: string[] = [];
      if (selectedCategory !== "all") params.push(`category=${selectedCategory}`);
      if (selectedSubcat)             params.push(`subcategory=${encodeURIComponent(selectedSubcat)}`);
      // Exclude provider's own listings from customer feed
      if (user?.id && (user.role === "provider" || user.role === "both")) {
        params.push(`excludeProviderId=${encodeURIComponent(user.id)}`);
      }
      if (params.length) path += "?" + params.join("&");
      const data = await get<Listing[]>(path);
      // Cars are exclusively for ride-booking via the Cars tab — never show them here
      setListings(data.filter((l: Listing) => l.category !== "cars"));
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }

  function pickSubcat(cat: Category, sub: string) {
    Haptics.selectionAsync();
    if (selectedCategory === cat && selectedSubcat === sub) {
      setSelectedSubcat("");
    } else {
      setSelectedCategory(cat);
      setSelectedSubcat(sub);
    }
  }

  function pickCategory(cat: Category | "all") {
    Haptics.selectionAsync();
    setSelectedCategory(cat);
    setSelectedSubcat("");
  }

  const topPad    = isWeb ? 67 : insets.top;
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "Friend";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ─── HEADER: orange gradient with rounded bottom ─── */}
      <LinearGradient
        colors={GRADIENT_ORANGE}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        {/* Top row */}
        <View style={styles.headerTop}>
          <Pressable onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
            <Ionicons name="menu" size={22} color="#fff" />
          </Pressable>

          <View style={styles.headerMid}>
            <Text style={styles.greeting}>
              {isPa ? "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ" : "Hello"}, {firstName} 👋
            </Text>
            <View style={styles.locRow}>
              <Ionicons name="location-sharp" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.locText}>{t.location}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={toggleLanguage} style={styles.langPill}>
              <Text style={styles.langPillText}>{isPa ? "EN" : "ਪੰਜਾਬੀ"}</Text>
            </Pressable>
            <NotificationBell />
          </View>
        </View>

        {/* Dual-role switcher */}
        {isBoth && (
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setActiveMode("customer"); }}
              style={[styles.modeBtn, activeMode === "customer" && styles.modeBtnOn]}
            >
              <Ionicons name="person-outline" size={13} color={activeMode === "customer" ? "#FF7A18" : "rgba(255,255,255,0.8)"} />
              <Text style={[styles.modeTxt, activeMode === "customer" && styles.modeTxtOn]}>Customer</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setActiveMode("provider");
                router.replace("/(tabs)/dashboard");
              }}
              style={[styles.modeBtn, activeMode === "provider" && styles.modeBtnOn]}
            >
              <Ionicons name="briefcase-outline" size={13} color={activeMode === "provider" ? "#FF7A18" : "rgba(255,255,255,0.8)"} />
              <Text style={[styles.modeTxt, activeMode === "provider" && styles.modeTxtOn]}>Provider</Text>
            </Pressable>
          </View>
        )}

        {/* ─── Floating search bar (inside header, visually floats) ─── */}
        <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.searchBar}>
          <Ionicons name="search" size={17} color="#AEAEAE" />
          <Text style={styles.searchHint}>{t.searchPlaceholder}</Text>
          <View style={styles.micBtn}>
            <Ionicons name="mic" size={15} color="#FF7A18" />
          </View>
        </Pressable>
      </LinearGradient>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchListings(); }}
            tintColor="#FF7A18"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Equipment chips ─── */}
        <View style={[styles.sectionHeader, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>{isPa ? "ਮਸ਼ੀਨਰੀ" : "Equipment"}</Text>
          <Pressable onPress={() => pickCategory("equipment")}>
            <Text style={[styles.sectionLink, selectedCategory === "equipment" && !selectedSubcat && styles.sectionLinkActive]}>
              {isPa ? "ਸਭ ਵੇਖੋ" : "See all"}
            </Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {[
            { label: "Tractor",     labelPa: "ਟਰੈਕਟਰ",     icon: "cog-outline",        color: "#33691E", bg: "#F1F8E9" },
            { label: "Harvester",   labelPa: "ਹਾਰਵੈਸਟਰ",   icon: "settings-outline",   color: "#558B2F", bg: "#DCEDC8" },
            { label: "Rotavator",   labelPa: "ਰੋਟਾਵੇਟਰ",   icon: "sync-outline",       color: "#00695C", bg: "#E0F2F1" },
            { label: "Sprayer",     labelPa: "ਸਪ੍ਰੇਅਰ",    icon: "leaf-outline",       color: "#1B5E20", bg: "#E8F5E9" },
            { label: "Plough",      labelPa: "ਹਲ",          icon: "git-branch-outline", color: "#4E342E", bg: "#EFEBE9" },
            { label: "Cultivator",  labelPa: "ਕਲਟੀਵੇਟਰ",   icon: "grid-outline",       color: "#37474F", bg: "#ECEFF1" },
            { label: "JCB",          labelPa: "ਜੇਸੀਬੀ",       icon: "construct-outline",  color: "#E65100", bg: "#FFF3E0" },
            { label: "Excavator",    labelPa: "ਖੁਦਾਈ ਮਸ਼ੀਨ",  icon: "build-outline",      color: "#4E342E", bg: "#EFEBE9" },
            { label: "Poclain",      labelPa: "ਪੋਕਲੇਨ",       icon: "construct-outline",  color: "#BF360C", bg: "#FBE9E7" },
            { label: "Rock Breaker", labelPa: "ਰੌਕ ਬ੍ਰੇਕਰ",   icon: "hammer-outline",     color: "#37474F", bg: "#ECEFF1" },
            { label: "Bulldozer",    labelPa: "ਬੁਲਡੋਜ਼ਰ",     icon: "arrow-forward-circle-outline", color: "#4E342E", bg: "#EFEBE9" },
            { label: "Wheel Loader",  labelPa: "ਵ੍ਹੀਲ ਲੋਡਰ",    icon: "cube-outline",       color: "#1565C0", bg: "#E3F2FD" },
            { label: "Chhota Hathi", labelPa: "ਛੋਟਾ ਹਾਥੀ",    icon: "car-outline",        color: "#6D4C41", bg: "#EFEBE9" },
          ].map((item) => {
            const active = selectedCategory === "equipment" && selectedSubcat === item.label;
            return (
              <Pressable
                key={item.label}
                onPress={() => pickSubcat("equipment", item.label)}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: active ? item.color : item.bg },
                  pressed && { transform: [{ scale: 0.91 }], opacity: 0.82 },
                ]}
              >
                <View style={[styles.chipIcon, { backgroundColor: active ? "rgba(255,255,255,0.25)" : `${item.color}22` }]}>
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={active ? "#fff" : item.color} />
                </View>
                <Text style={[styles.chipLabel, { color: active ? "#fff" : item.color }]} numberOfLines={2}>
                  {isPa ? item.labelPa : item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Services chips ─── */}
        <View style={[styles.sectionHeader, { marginTop: 4 }]}>
          <Text style={styles.sectionTitle}>{isPa ? "ਸੇਵਾਵਾਂ" : "Services"}</Text>
          <Pressable onPress={() => pickCategory("services")}>
            <Text style={[styles.sectionLink, selectedCategory === "services" && !selectedSubcat && styles.sectionLinkActive]}>
              {isPa ? "ਸਭ ਵੇਖੋ" : "See all"}
            </Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {[
            { label: "Plumbing",    labelPa: "ਪਲੰਬਿੰਗ",         icon: "water-outline",       color: "#1565C0", bg: "#E3F2FD" },
            { label: "Electrician", labelPa: "ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ",  icon: "flash-outline",       color: "#F57F17", bg: "#FFFDE7" },
            { label: "Beauty",      labelPa: "ਬਿਊਟੀ",           icon: "flower-outline",      color: "#AD1457", bg: "#FCE4EC" },
            { label: "Carpenter",   labelPa: "ਤਰਖਾਣ",           icon: "hammer-outline",      color: "#4E342E", bg: "#EFEBE9" },
            { label: "Painter",     labelPa: "ਪੇਂਟਰ",           icon: "brush-outline",       color: "#E65100", bg: "#FBE9E7" },
            { label: "AC Repair",   labelPa: "ਏਸੀ ਰਿਪੇਅਰ",     icon: "thermometer-outline", color: "#0277BD", bg: "#E1F5FE" },
          ].map((item) => {
            const active = selectedCategory === "services" && selectedSubcat === item.label;
            return (
              <Pressable
                key={item.label}
                onPress={() => pickSubcat("services", item.label)}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: active ? item.color : item.bg },
                  pressed && { transform: [{ scale: 0.91 }], opacity: 0.82 },
                ]}
              >
                <View style={[styles.chipIcon, { backgroundColor: active ? "rgba(255,255,255,0.25)" : `${item.color}22` }]}>
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={active ? "#fff" : item.color} />
                </View>
                <Text style={[styles.chipLabel, { color: active ? "#fff" : item.color }]} numberOfLines={2}>
                  {isPa ? item.labelPa : item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section label */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isPa ? "ਉਪਲਬਧ ਕਿਰਾਏ" : "Available Rentals"}</Text>
          <Pressable onPress={() => router.push("/(tabs)/search")}>
            <Text style={styles.sectionLink}>{isPa ? "ਸਭ ਵੇਖੋ" : "See all"}</Text>
          </Pressable>
        </View>

        {/* Listings */}
        <View style={styles.listingsWrap}>
          {loading ? (
            <>
              <ListingCardSkeleton delay={0} />
              <ListingCardSkeleton delay={120} />
              <ListingCardSkeleton delay={240} />
            </>
          ) : listings.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="search-outline" size={52} color="#AEAEAE" />
              <Text style={styles.emptyTitle}>{isPa ? "ਕੋਈ ਲਿਸਟਿੰਗ ਨਹੀਂ" : "No listings found"}</Text>
              <Text style={styles.emptyHint}>{isPa ? "ਹੋਰ ਸ਼੍ਰੇਣੀ ਚੁਣੋ" : "Try a different category"}</Text>
            </View>
          ) : (
            listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isCustomer={!inProviderMode && user?.role !== "provider"}
              />
            ))
          )}
        </View>

        <View style={{ height: (isWeb ? 80 : 100) + insets.bottom }} />
      </ScrollView>
      </Animated.View>

      {/* FAB for providers */}
      {(user?.role === "provider" || (user?.role === "both" && activeMode === "provider")) && (
        <Pressable
          onPress={() => router.push("/add-listing")}
          style={[styles.fab, { bottom: (isWeb ? 34 : insets.bottom) + 80 }]}
        >
          <LinearGradient colors={GRADIENT_ORANGE} style={styles.fabGrad}>
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },

  // ── Header ──────────────────────────────────────────────────
  header: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  menuBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerMid: { flex: 1 },
  greeting: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  locText: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  langPill: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  langPillText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Mode switcher
  modeRow: {
    flexDirection: "row", alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 20, padding: 3,
    marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 17 },
  modeBtnOn: { backgroundColor: "#fff" },
  modeTxt: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  modeTxtOn: { color: "#FF7A18" },

  // Search bar (inside header, floats visually)
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 16, paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchHint: { flex: 1, fontSize: 14, color: "#AEAEAE", fontFamily: "Inter_400Regular" },
  micBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#FFF3E9",
    alignItems: "center", justifyContent: "center",
  },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },

  // Feature cards row
  featureRow: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  featureCard: {
    width: 90,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  featureCardActive: {
    shadowOpacity: 0.15,
    elevation: 5,
    transform: [{ scale: 1.04 }],
  },
  featureIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  featureLabel: {
    fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold",
    textAlign: "center",
  },

  // Section header
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C",
  },
  sectionLink: {
    fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#FF7A18",
  },
  sectionLinkActive: {
    textDecorationLine: "underline",
    opacity: 0.75,
  },

  // Subcategory chip rows
  chipRow: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 10,
  },
  chip: {
    width: 84,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    gap: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  chipIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  chipLabel: {
    fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold",
    textAlign: "center", lineHeight: 13,
  },

  // Category tabs
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: "#F5F6FA",
    borderBottomWidth: 1,
    borderBottomColor: "#EAEAEA",
    marginBottom: 16,
  },
  tab: {
    flex: 1, alignItems: "center", paddingVertical: 10, position: "relative",
  },
  tabTxt: {
    fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium",
    color: "#AEAEAE",
  },
  tabTxtActive: {
    color: "#FF7A18", fontWeight: "700", fontFamily: "Inter_700Bold",
  },
  tabUnderline: {
    position: "absolute", bottom: -1, left: "15%", right: "15%",
    height: 3, borderRadius: 2, backgroundColor: "#FF7A18",
  },

  // Listings
  listingsWrap: { paddingHorizontal: 18, gap: 14 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  emptyHint: { fontSize: 13, color: "#AEAEAE", fontFamily: "Inter_400Regular" },

  // FAB
  fab: {
    position: "absolute", right: 20,
    width: 56, height: 56, borderRadius: 28, overflow: "hidden",
    shadowColor: "#FF7A18", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  fabGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
});
