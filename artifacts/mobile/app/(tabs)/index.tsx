import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
const TINT = "#FF7A18";
const SCREEN_W = Dimensions.get("window").width;

// ─── Data ────────────────────────────────────────────────────────────────────

const EQUIPMENT_ITEMS = [
  { label: "Tractor",    labelPa: "ਟਰੈਕਟਰ",   icon: "cog-outline",       color: "#33691E", bg: "#F1F8E9" },
  { label: "Harvester",  labelPa: "ਹਾਰਵੈਸਟਰ", icon: "settings-outline",  color: "#558B2F", bg: "#DCEDC8" },
  { label: "Rotavator",  labelPa: "ਰੋਟਾਵੇਟਰ", icon: "sync-outline",      color: "#00695C", bg: "#E0F2F1" },
  { label: "Sprayer",    labelPa: "ਸਪ੍ਰੇਅਰ",  icon: "leaf-outline",      color: "#1B5E20", bg: "#E8F5E9" },
  { label: "Plough",     labelPa: "ਹਲ",        icon: "git-branch-outline", color: "#4E342E", bg: "#EFEBE9" },
  { label: "Cultivator", labelPa: "ਕਲਟੀਵੇਟਰ", icon: "grid-outline",      color: "#37474F", bg: "#ECEFF1" },
];

const SERVICE_ITEMS = [
  { label: "Plumber",     labelPa: "ਪਲੰਬਰ",         icon: "water-outline",       color: "#1565C0", bg: "#E3F2FD" },
  { label: "Electrician", labelPa: "ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ", icon: "flash-outline",       color: "#F57F17", bg: "#FFFDE7" },
  { label: "Beauty",      labelPa: "ਬਿਊਟੀ",          icon: "flower-outline",      color: "#AD1457", bg: "#FCE4EC" },
  { label: "Carpenter",   labelPa: "ਤਰਖਾਣ",          icon: "hammer-outline",      color: "#4E342E", bg: "#EFEBE9" },
  { label: "Painter",     labelPa: "ਪੇਂਟਰ",          icon: "brush-outline",       color: "#E65100", bg: "#FBE9E7" },
  { label: "AC Repair",   labelPa: "ਏਸੀ ਰਿਪੇਅਰ",    icon: "thermometer-outline", color: "#0277BD", bg: "#E1F5FE" },
];

// Card dimensions
const CARD_W = 120;
const CARD_H = 144;
const CARD_GAP = 12;
const SNAP_INTERVAL = CARD_W + CARD_GAP;

// ─── Sub-components ──────────────────────────────────────────────────────────

type CardItem = {
  label: string; labelPa: string;
  icon: string; color: string; bg: string;
};

function CategoryCard({
  item, active, onPress,
}: {
  item: CardItem; active: boolean; onPress: () => void;
}) {
  const bg      = active ? item.color : item.bg;
  const iconBg  = active ? "rgba(255,255,255,0.22)" : `${item.color}22`;
  const iconClr = active ? "#fff" : item.color;
  const txtClr  = active ? "#fff" : item.color;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.catCard,
        { backgroundColor: bg },
        pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
      ]}
    >
      <View style={[styles.catIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={item.icon as any} size={26} color={iconClr} />
      </View>
      <Text style={[styles.catLabel, { color: txtClr }]} numberOfLines={2}>
        {item.label}
      </Text>
      {active && (
        <View style={styles.catActiveDot} />
      )}
    </Pressable>
  );
}

function SectionHeader({
  title, onSeeAll, seeAllActive,
}: {
  title: string; onSeeAll: () => void; seeAllActive?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onSeeAll}>
        <Text style={[styles.seeAll, seeAllActive && styles.seeAllActive]}>
          See all
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, activeMode, setActiveMode } = useAuth();
  const isBoth         = user?.role === "both";
  const isPureProvider = user?.role === "provider";
  const { get }        = useApi();
  const { t, language, toggleLanguage } = useLang();
  const insets         = useSafeAreaInsets();
  const isWeb          = Platform.OS === "web";
  const isPa           = language === "pa";

  const [listings, setListings]                 = useState<Listing[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [selectedSubcat, setSelectedSubcat]     = useState<string>("");
  const [drawerOpen, setDrawerOpen]             = useState(false);

  const inProviderMode = isPureProvider || (isBoth && activeMode === "provider");

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
      if (params.length)              path += "?" + params.join("&");
      setListings(await get<Listing[]>(path));
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }

  function pickSubcat(cat: Category, sub: string) {
    Haptics.selectionAsync();
    if (selectedCategory === cat && selectedSubcat === sub) {
      setSelectedSubcat("");
      setSelectedCategory("all");
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

  const renderEquipCard = useCallback(({ item }: { item: CardItem }) => (
    <CategoryCard
      item={item}
      active={selectedCategory === "equipment" && selectedSubcat === item.label}
      onPress={() => pickSubcat("equipment", item.label)}
    />
  ), [selectedCategory, selectedSubcat]);

  const renderServiceCard = useCallback(({ item }: { item: CardItem }) => (
    <CategoryCard
      item={item}
      active={selectedCategory === "services" && selectedSubcat === item.label}
      onPress={() => pickSubcat("services", item.label)}
    />
  ), [selectedCategory, selectedSubcat]);

  const topPad    = isWeb ? 67 : insets.top;
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "Friend";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ─── HEADER ───────────────────────────────────────────── */}
      <LinearGradient
        colors={GRADIENT_ORANGE}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
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
              <Ionicons name="person-outline" size={13} color={activeMode === "customer" ? TINT : "rgba(255,255,255,0.8)"} />
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
              <Ionicons name="briefcase-outline" size={13} color={activeMode === "provider" ? TINT : "rgba(255,255,255,0.8)"} />
              <Text style={[styles.modeTxt, activeMode === "provider" && styles.modeTxtOn]}>Provider</Text>
            </Pressable>
          </View>
        )}

        {/* Search bar */}
        <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.searchBar}>
          <Ionicons name="search" size={17} color="#AEAEAE" />
          <Text style={styles.searchHint}>{t.searchPlaceholder}</Text>
          <View style={styles.micBtn}>
            <Ionicons name="mic" size={15} color={TINT} />
          </View>
        </Pressable>
      </LinearGradient>

      {/* ─── SCROLL BODY ──────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchListings(); }}
            tintColor={TINT}
          />
        }
      >

        {/* ── Equipment Rentals ─────────────────────────────── */}
        <SectionHeader
          title={isPa ? "ਮਸ਼ੀਨਰੀ ਕਿਰਾਏ" : "Equipment Rentals"}
          onSeeAll={() => pickCategory("equipment")}
          seeAllActive={selectedCategory === "equipment" && !selectedSubcat}
        />
        <FlatList
          data={EQUIPMENT_ITEMS}
          keyExtractor={(item) => item.label}
          renderItem={renderEquipCard}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.flatListContent}
          ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        />

        {/* ── Popular Services ──────────────────────────────── */}
        <SectionHeader
          title={isPa ? "ਪ੍ਰਸਿੱਧ ਸੇਵਾਵਾਂ" : "Popular Services"}
          onSeeAll={() => pickCategory("services")}
          seeAllActive={selectedCategory === "services" && !selectedSubcat}
        />
        <FlatList
          data={SERVICE_ITEMS}
          keyExtractor={(item) => item.label}
          renderItem={renderServiceCard}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.flatListContent}
          ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        />

        {/* ── Available Rentals ─────────────────────────────── */}
        <SectionHeader
          title={
            selectedSubcat
              ? selectedSubcat
              : selectedCategory !== "all"
              ? selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)
              : isPa ? "ਉਪਲਬਧ ਕਿਰਾਏ" : "Available Rentals"
          }
          onSeeAll={() => router.push("/(tabs)/search")}
        />

        {/* Active filter pill */}
        {(selectedSubcat || selectedCategory !== "all") && (
          <View style={styles.filterPillRow}>
            <View style={styles.filterPill}>
              <Ionicons name="funnel" size={12} color={TINT} />
              <Text style={styles.filterPillText}>
                {selectedSubcat || selectedCategory}
              </Text>
              <Pressable onPress={() => { setSelectedCategory("all"); setSelectedSubcat(""); }}>
                <Ionicons name="close-circle" size={16} color={TINT} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Listings grid */}
        <View style={styles.listingsWrap}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={TINT} size="large" />
            </View>
          ) : listings.length === 0 ? (
            <View style={styles.center}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="search-outline" size={40} color={TINT} />
              </View>
              <Text style={styles.emptyTitle}>
                {isPa ? "ਕੋਈ ਲਿਸਟਿੰਗ ਨਹੀਂ" : "No listings found"}
              </Text>
              <Text style={styles.emptyHint}>
                {isPa ? "ਹੋਰ ਸ਼੍ਰੇਣੀ ਚੁਣੋ" : "Try a different category"}
              </Text>
            </View>
          ) : (
            listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },

  // Header
  header: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
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
  modeTxtOn: { color: TINT },

  // Search bar
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 28,
    paddingHorizontal: 16, paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  searchHint: { flex: 1, fontSize: 14, color: "#AEAEAE", fontFamily: "Inter_400Regular" },
  micBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#FFF3E9",
    alignItems: "center", justifyContent: "center",
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20 },

  // Section header
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C",
  },
  seeAll: {
    fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: TINT,
  },
  seeAllActive: { textDecorationLine: "underline", opacity: 0.75 },

  // FlatList
  flatListContent: {
    paddingHorizontal: 18,
    paddingBottom: 22,
  },

  // Category card
  catCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 16,
    gap: 10,
    // shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  catIconWrap: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: "center", justifyContent: "center",
  },
  catLabel: {
    fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold",
    textAlign: "center", lineHeight: 16,
  },
  catActiveDot: {
    position: "absolute",
    top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.6)",
  },

  // Filter pill
  filterPillRow: { paddingHorizontal: 18, marginBottom: 12 },
  filterPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    backgroundColor: `${TINT}14`,
    borderRadius: 20, borderWidth: 1, borderColor: `${TINT}40`,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  filterPillText: {
    fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: TINT,
  },

  // Listings
  listingsWrap: { paddingHorizontal: 18, gap: 14 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 14 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${TINT}12`,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  emptyHint: { fontSize: 13, color: "#AEAEAE", fontFamily: "Inter_400Regular" },

  // FAB
  fab: {
    position: "absolute", right: 20,
    width: 56, height: 56, borderRadius: 28, overflow: "hidden",
    shadowColor: TINT, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  fabGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
});
