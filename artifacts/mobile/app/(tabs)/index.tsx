import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

import { CategoryPill, CATEGORIES } from "@/components/CategoryPill";
import { ListingCard } from "@/components/ListingCard";
import { NotificationBell } from "@/components/NotificationBell";
import { SideDrawer } from "@/components/SideDrawer";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";
import { Listing, Category } from "@/types";

const C = Colors.light;

const FEATURED_SUBCATEGORIES = [
  { id: "tractor", labelEn: "Tractors", labelPa: "ਟਰੈਕਟਰ", icon: "🚜", color: "#22C55E", bg: "#F0FFF4" },
  { id: "harvester", labelEn: "Harvesters", labelPa: "ਕੰਬਾਈਨ", icon: "⚙️", color: "#F59E0B", bg: "#FFFBEB" },
  { id: "plumber", labelEn: "Plumbers", labelPa: "ਪਲੰਬਰ", icon: "🔧", color: "#3B82F6", bg: "#EBF4FF" },
  { id: "sedan", labelEn: "Cars", labelPa: "ਕਾਰ", icon: "🚗", color: "#8B5CF6", bg: "#F5F0FF" },
  { id: "electrician", labelEn: "Electricians", labelPa: "ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ", icon: "⚡", color: "#EF4444", bg: "#FEF2F2" },
  { id: "beauty", labelEn: "Beauty", labelPa: "ਸੁੰਦਰਤਾ", icon: "✂️", color: "#EC4899", bg: "#FFF0F8" },
];

export default function HomeScreen() {
  const { user, activeMode, setActiveMode } = useAuth();
  const isBoth = user?.role === "both";
  const { get } = useApi();
  const { t, language, toggleLanguage } = useLang();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const isPa = language === "pa";

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    fetchListings();
  }, [user, selectedCategory]);

  async function fetchListings() {
    try {
      const path = selectedCategory === "all" ? "/listings" : `/listings?category=${selectedCategory}`;
      const data = await get<Listing[]>(path);
      setListings(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const topPad = isWeb ? 67 : insets.top;
  const firstName = (user?.firstName || user?.name?.split(" ")[0] || "Friend");
  const greeting = isPa ? `${t.greeting}, ${firstName} 🌾` : `${t.greeting}, ${firstName} 🌾`;

  const selectedCat = CATEGORIES.find((c) => c.id === selectedCategory);
  const listingLabel = selectedCategory === "all"
    ? t.allListings
    : (isPa ? selectedCat?.label : selectedCat?.label) ?? t.allListings;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header */}
      <LinearGradient colors={[C.navy, "#1B3260"]} style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerTop}>
          {/* Hamburger */}
          <Pressable onPress={() => setDrawerOpen(true)} style={styles.headerIconBtn}>
            <Ionicons name="menu" size={24} color="#fff" />
          </Pressable>

          {/* Greeting */}
          <View style={styles.headerCenter}>
            <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={12} color={C.tint} />
              <Text style={styles.locationText}>{t.location}</Text>
            </View>
          </View>

          {/* Right: lang toggle + notification bell */}
          <View style={styles.headerRight}>
            <Pressable onPress={toggleLanguage} style={styles.langPill}>
              <Text style={styles.langPillText}>{isPa ? "EN" : "ਪੰਜਾਬੀ"}</Text>
            </Pressable>
            <NotificationBell />
          </View>
        </View>

        {/* Mode switcher for dual-role users */}
        {isBoth && (
          <View style={styles.modeSwitcher}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setActiveMode("customer"); }}
              style={[styles.modeBtn, activeMode === "customer" && styles.modeBtnActive]}
            >
              <Ionicons name="person-outline" size={14} color={activeMode === "customer" ? "#fff" : "rgba(255,255,255,0.6)"} />
              <Text style={[styles.modeBtnText, activeMode === "customer" && styles.modeBtnTextActive]}>Customer</Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setActiveMode("provider"); }}
              style={[styles.modeBtn, activeMode === "provider" && styles.modeBtnActive]}
            >
              <Ionicons name="car-outline" size={14} color={activeMode === "provider" ? "#fff" : "rgba(255,255,255,0.6)"} />
              <Text style={[styles.modeBtnText, activeMode === "provider" && styles.modeBtnTextActive]}>Provider</Text>
            </Pressable>
          </View>
        )}

        {/* Search bar */}
        <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.searchBar}>
          <Ionicons name="search" size={16} color={C.textSecondary} />
          <Text style={styles.searchPlaceholder}>{t.searchPlaceholder}</Text>
          <Ionicons name="options-outline" size={16} color={C.textTertiary} />
        </Pressable>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchListings(); }} tintColor={C.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.browseByCategory}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            {CATEGORIES.map((cat) => (
              <CategoryPill
                key={cat.id}
                category={cat}
                selected={selectedCategory === cat.id}
                onPress={() => setSelectedCategory(cat.id as Category | "all")}
              />
            ))}
          </ScrollView>
        </View>

        {/* Quick access grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.popularInPunjab}</Text>
          <View style={styles.quickGrid}>
            {FEATURED_SUBCATEGORIES.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push({ pathname: "/(tabs)/search", params: { q: item.labelEn } })}
                style={({ pressed }) => [styles.quickItem, { backgroundColor: item.bg, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.quickIcon}>{item.icon}</Text>
                <Text style={[styles.quickLabel, { color: item.color }]}>
                  {isPa ? item.labelPa : item.labelEn}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Listings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{listingLabel}</Text>
            <Text style={styles.listingCount}>{listings.length} {t.found}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator color={C.tint} size="large" /></View>
          ) : listings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={48} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>{isPa ? "ਕੋਈ ਲਿਸਟਿੰਗ ਨਹੀਂ" : "No listings yet"}</Text>
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
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 16, paddingBottom: 20 },
  headerTop: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  greeting: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  locationText: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  langPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  langPillText: { color: "#fff", fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 3,
    alignSelf: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 17,
  },
  modeBtnActive: { backgroundColor: C.tint },
  modeBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.6)" },
  modeBtnTextActive: { color: "#fff" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  section: { paddingTop: 22, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  listingCount: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  catScroll: { gap: 10, paddingRight: 20 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickItem: { borderRadius: 14, padding: 14, alignItems: "center", gap: 6, minWidth: 90, flex: 1 },
  quickIcon: { fontSize: 24 },
  quickLabel: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  listingsGrid: { gap: 14 },
  loadingBox: { height: 200, alignItems: "center", justifyContent: "center" },
  emptyBox: { height: 200, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  fab: {
    position: "absolute", right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
});
