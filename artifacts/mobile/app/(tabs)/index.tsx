import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { NotificationBell } from "@/components/NotificationBell";
import { SideDrawer } from "@/components/SideDrawer";
import Colors, { GRADIENT_ORANGE } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";
import { Listing, Category } from "@/types";

const C = Colors.light;
const ORANGE = "#FF7A18";

// ─── Main category cards ──────────────────────────────────────────────────

const MAIN_CATEGORIES = [
  {
    id: "cars",
    labelEn: "Car Rentals",
    labelPa: "ਕਾਰ ਕਿਰਾਇਆ",
    descEn: "Sedans, SUVs & more",
    descPa: "ਕਾਰ, SUV ਅਤੇ ਹੋਰ",
    emoji: "🚗",
    gradient: ["#FF7A18", "#FF9A3C"] as [string, string],
    textColor: "#fff",
  },
  {
    id: "equipment",
    labelEn: "Farm Equipment",
    labelPa: "ਖੇਤੀ ਮਸ਼ੀਨਰੀ",
    descEn: "Tractors, harvesters & more",
    descPa: "ਟਰੈਕਟਰ, ਹਾਰਵੈਸਟਰ ਅਤੇ ਹੋਰ",
    emoji: "🚜",
    gradient: ["#2E7D32", "#4CAF50"] as [string, string],
    textColor: "#fff",
  },
  {
    id: "services",
    labelEn: "Services",
    labelPa: "ਸੇਵਾਵਾਂ",
    descEn: "Plumbers, electricians & more",
    descPa: "ਪਲੰਬਰ, ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ ਅਤੇ ਹੋਰ",
    emoji: "🛠",
    gradient: ["#0284C7", "#4FC3F7"] as [string, string],
    textColor: "#fff",
  },
];

// ─── Quick subcategory pills ──────────────────────────────────────────────

const QUICK_PICKS = [
  { id: "tractor",     labelEn: "Tractors",     labelPa: "ਟਰੈਕਟਰ",        emoji: "🚜", color: "#2E7D32", bg: "#E8F5E9" },
  { id: "sedan",       labelEn: "Cars",          labelPa: "ਕਾਰ",            emoji: "🚗", color: "#E06010", bg: "#FFF3E0" },
  { id: "plumber",     labelEn: "Plumbers",      labelPa: "ਪਲੰਬਰ",         emoji: "🔧", color: "#0284C7", bg: "#E0F7FA" },
  { id: "harvester",   labelEn: "Harvesters",    labelPa: "ਕੰਬਾਈਨ",        emoji: "⚙️", color: "#7B3F00", bg: "#FFF8E1" },
  { id: "electrician", labelEn: "Electricians",  labelPa: "ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ", emoji: "⚡", color: "#9C27B0", bg: "#F3E5F5" },
  { id: "beauty",      labelEn: "Beauty",        labelPa: "ਸੁੰਦਰਤਾ",       emoji: "✂️", color: "#D81B60", bg: "#FCE4EC" },
];

// ─── Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, activeMode, setActiveMode } = useAuth();
  const isBoth   = user?.role === "both";
  const isPureProvider = user?.role === "provider";
  const { get }  = useApi();
  const { t, language, toggleLanguage } = useLang();
  const insets   = useSafeAreaInsets();
  const isWeb    = Platform.OS === "web";
  const isPa     = language === "pa";

  const [listings, setListings]           = useState<Listing[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [drawerOpen, setDrawerOpen]       = useState(false);

  const inProviderMode = isPureProvider || (isBoth && activeMode === "provider");

  useEffect(() => {
    if (!user) { router.replace("/sign-in"); return; }
    if (inProviderMode) { router.replace("/(tabs)/dashboard"); return; }
    fetchListings();
  }, [user, selectedCategory, inProviderMode]);

  async function fetchListings() {
    try {
      const path = selectedCategory === "all" ? "/listings" : `/listings?category=${selectedCategory}`;
      setListings(await get<Listing[]>(path));
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }

  const topPad = isWeb ? 67 : insets.top;
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "Friend";
  const greetHour = new Date().getHours();
  const greetWord = isPa
    ? "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ"
    : greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ──── ORANGE GRADIENT HEADER ──── */}
      <LinearGradient
        colors={GRADIENT_ORANGE}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        {/* Decorative circles */}
        <View style={styles.decCircle1} />
        <View style={styles.decCircle2} />

        {/* Top row */}
        <View style={styles.headerTop}>
          <Pressable onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
            <Ionicons name="menu" size={22} color="#fff" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>{greetWord}, {firstName} 👋</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.locationText}>{t.location}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Pressable onPress={() => { Haptics.selectionAsync(); toggleLanguage(); }} style={styles.langPill}>
              <Text style={styles.langText}>{isPa ? "EN" : "ਪੰਜਾਬੀ"}</Text>
            </Pressable>
            <NotificationBell />
          </View>
        </View>

        {/* Dual-role mode switcher */}
        {isBoth && (
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setActiveMode("customer"); }}
              style={[styles.modeBtn, activeMode === "customer" && styles.modeBtnActive]}
            >
              <Ionicons name="person-outline" size={13} color={activeMode === "customer" ? ORANGE : "rgba(255,255,255,0.8)"} />
              <Text style={[styles.modeBtnText, activeMode === "customer" && styles.modeBtnTextActive]}>Customer</Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setActiveMode("provider"); router.replace("/(tabs)/dashboard"); }}
              style={[styles.modeBtn, activeMode === "provider" && styles.modeBtnActive]}
            >
              <Ionicons name="briefcase-outline" size={13} color={activeMode === "provider" ? ORANGE : "rgba(255,255,255,0.8)"} />
              <Text style={[styles.modeBtnText, activeMode === "provider" && styles.modeBtnTextActive]}>Provider</Text>
            </Pressable>
          </View>
        )}

        {/* Search bar */}
        <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.searchBar}>
          <View style={styles.searchIcon}>
            <Ionicons name="search" size={16} color={ORANGE} />
          </View>
          <Text style={styles.searchPlaceholder}>{t.searchPlaceholder}</Text>
          <View style={styles.filterBtn}>
            <Ionicons name="options-outline" size={15} color={ORANGE} />
          </View>
        </Pressable>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchListings(); }} tintColor={ORANGE} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ──── CATEGORY CARDS ──── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{isPa ? "ਸ਼੍ਰੇਣੀਆਂ" : "Browse Categories"}</Text>
          </View>
          <View style={styles.catGrid}>
            {MAIN_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategory(cat.id as Category | "all");
                }}
                style={({ pressed }) => [styles.catCard, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              >
                <LinearGradient colors={cat.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.catCardGrad}>
                  {/* Glow circle */}
                  <View style={styles.catGlow} />
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catLabel, { color: cat.textColor }]}>
                    {isPa ? cat.labelPa : cat.labelEn}
                  </Text>
                  <Text style={[styles.catDesc, { color: "rgba(255,255,255,0.75)" }]} numberOfLines={2}>
                    {isPa ? cat.descPa : cat.descEn}
                  </Text>
                  <View style={styles.catArrow}>
                    <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.9)" />
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ──── QUICK PICKS ──── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{isPa ? "ਪੰਜਾਬ ਵਿੱਚ ਪ੍ਰਸਿੱਧ" : "Popular in Punjab"}</Text>
            <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>{isPa ? "ਸਭ ਵੇਖੋ" : "See all"}</Text>
              <Ionicons name="chevron-forward" size={13} color={ORANGE} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
            {QUICK_PICKS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({ pathname: "/(tabs)/search", params: { q: item.labelEn } });
                }}
                style={({ pressed }) => [styles.quickPill, { backgroundColor: item.bg, borderColor: `${item.color}30`, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.quickEmoji}>{item.emoji}</Text>
                <Text style={[styles.quickLabel, { color: item.color }]}>
                  {isPa ? item.labelPa : item.labelEn}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ──── LISTINGS ──── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {selectedCategory === "all"
                  ? (isPa ? "ਸਾਰੀਆਂ ਲਿਸਟਿੰਗ" : "All Listings")
                  : MAIN_CATEGORIES.find((c) => c.id === selectedCategory)?.[isPa ? "labelPa" : "labelEn"] ?? "Listings"}
              </Text>
              {!loading && (
                <Text style={styles.listingCount}>{listings.length} {isPa ? "ਮਿਲੇ" : "available"}</Text>
              )}
            </View>
            {selectedCategory !== "all" && (
              <Pressable
                onPress={() => setSelectedCategory("all")}
                style={styles.clearFilter}
              >
                <Ionicons name="close-circle" size={15} color={C.textTertiary} />
                <Text style={styles.clearFilterText}>{isPa ? "ਸਾਫ਼ ਕਰੋ" : "Clear"}</Text>
              </Pressable>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={ORANGE} size="large" />
              <Text style={styles.loadingText}>{isPa ? "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ..." : "Loading listings..."}</Text>
            </View>
          ) : listings.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="search-outline" size={36} color={ORANGE} />
              </View>
              <Text style={styles.emptyTitle}>{isPa ? "ਕੋਈ ਲਿਸਟਿੰਗ ਨਹੀਂ" : "No listings found"}</Text>
              <Text style={styles.emptyDesc}>{isPa ? "ਬਾਅਦ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ" : "Try a different category or search"}</Text>
            </View>
          ) : (
            <View style={styles.listingsGrid}>
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>

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
  root: { flex: 1, backgroundColor: C.background },

  // ── Header ──────────────────────────────────────────────
  header: { paddingHorizontal: 18, paddingBottom: 22, overflow: "hidden", position: "relative" },
  decCircle1: {
    position: "absolute", top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  decCircle2: {
    position: "absolute", bottom: -30, right: 60,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  headerTop: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  greeting: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.3 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  locationText: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  langPill: {
    backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  langText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Mode switcher
  modeRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 20, padding: 3,
    alignSelf: "center", marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 17 },
  modeBtnActive: { backgroundColor: "#fff" },
  modeBtnText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  modeBtnTextActive: { color: ORANGE },

  // Search bar
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 16,
    paddingHorizontal: 4, paddingVertical: 4,
    shadowColor: "rgba(0,0,0,0.15)", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 6,
  },
  searchIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: `${ORANGE}15`,
    alignItems: "center", justifyContent: "center",
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  filterBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: `${ORANGE}12`,
    alignItems: "center", justifyContent: "center",
  },

  // ── Scroll content ────────────────────────────────────────
  scroll: { flex: 1 },
  section: { paddingHorizontal: 18, paddingTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, letterSpacing: -0.3 },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 2 },
  seeAllText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: ORANGE },
  listingCount: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular", marginTop: 2 },
  clearFilter: { flexDirection: "row", alignItems: "center", gap: 4 },
  clearFilterText: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  // ── Category grid (3 cards) ────────────────────────────────
  catGrid: { gap: 12 },
  catCard: { borderRadius: 18, overflow: "hidden" },
  catCardGrad: { padding: 20, minHeight: 120, justifyContent: "space-between", overflow: "hidden", position: "relative" },
  catGlow: {
    position: "absolute", right: -20, top: -20,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  catEmoji: { fontSize: 36 },
  catLabel: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", marginTop: 6 },
  catDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 17 },
  catArrow: {
    alignSelf: "flex-start", marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    flexDirection: "row", alignItems: "center", gap: 4,
  },

  // ── Quick picks ───────────────────────────────────────────
  quickScroll: { paddingRight: 18, gap: 10 },
  quickPill: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderRadius: 50, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  quickEmoji: { fontSize: 16 },
  quickLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // ── Listings ──────────────────────────────────────────────
  listingsGrid: { gap: 14 },
  loadingBox: { height: 180, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  emptyBox: { height: 220, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyIconWrap: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: `${ORANGE}12`, alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  emptyDesc: { fontSize: 13, color: C.textTertiary, fontFamily: "Inter_400Regular", textAlign: "center" },

  // ── FAB ───────────────────────────────────────────────────
  fab: {
    position: "absolute", right: 20,
    width: 56, height: 56, borderRadius: 28, overflow: "hidden",
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  fabGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
});
