import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button3D, { shadeColor } from "@/components/Button3D";
import { ListingCard } from "@/components/ListingCard";
import { ListingCardSkeleton } from "@/components/SkeletonLoader";
import { NotificationBell } from "@/components/NotificationBell";
import { SideDrawer } from "@/components/SideDrawer";
import { CategoryArtwork, CountrysideHeaderArt } from "@/components/HomeArtwork";
import Colors, { GRADIENT_ORANGE } from "@/constants/colors";
import HomeVisual from "@/constants/homeVisualTokens";
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
  const { width: screenWidth } = useWindowDimensions();
  const isWeb         = Platform.OS === "web";
  const isPa          = language === "pa";

  const [listings, setListings]               = useState<Listing[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [selectedSubcat, setSelectedSubcat]   = useState<string>("");
  const [drawerOpen, setDrawerOpen]           = useState(false);
  const [isGoldMember, setIsGoldMember]       = useState(true); // start true to avoid flash

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
      const [data, goldData] = await Promise.all([
        get<Listing[]>(path),
        get<{ isGoldMember: boolean }>("/membership/status").catch(() => ({ isGoldMember: true })),
      ]);
      setIsGoldMember(Boolean(goldData.isGoldMember));
      // Cars are exclusively for ride-booking via the Cars tab — never show them here
      setListings(data.filter((l: Listing) => l.category !== "cars"));
    } catch (err) {
      console.error("fetchListings error", err);
      if (!refreshing) Alert.alert("Connection Error", "Could not load listings. Pull down to retry.");
    } finally { setLoading(false); setRefreshing(false); }
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
  const categoryCardWidth = Math.max(72, Math.min(98, (screenWidth - 36 - 24) / 4));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ─── HEADER: orange gradient with rounded bottom ─── */}
      <LinearGradient
        colors={["#F36D26", "#FF9638", "#FFD34D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        {/* Tractor anchored just above the floating search bar, clear of the top row */}
        <CountrysideHeaderArt tractorBottomOffset={78} />
        {/* Top row */}
        <View style={styles.headerTop}>
          <Button3D
            onPress={() => setDrawerOpen(true)}
            color="rgba(255,255,255,0.2)"
            edgeColor="#C65F16"
            radius={22}
            depth={3}
            faceStyle={styles.menuBtn}
            style={{ top: 10 }}
            hitSlop={4}
            accessibilityLabel="Open menu"
          >
            <Ionicons name="menu" size={22} color="#fff" />
          </Button3D>

          <View style={styles.headerMid}>
            <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {isPa ? "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ" : "Hello"}, {firstName}
            </Text>
            <View style={styles.locRow}>
              <Ionicons name="location-sharp" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.locText} numberOfLines={1}>{t.location}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Button3D
              onPress={toggleLanguage}
              color="rgba(255,255,255,0.2)"
              edgeColor="#C65F16"
              radius={12}
              depth={3}
              faceStyle={styles.langPill}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              accessibilityLabel={isPa ? "Switch to English" : "Switch to Punjabi"}
            >
              <Text style={styles.langPillText}>{isPa ? "EN" : "ਪੰਜਾਬੀ"}</Text>
            </Button3D>
            <View style={styles.bellStack}>
              <NotificationBell />
              {isGoldMember && (
                <Button3D onPress={() => router.push("/gold-membership")} faceStyle={styles.goldCoin}>
                  <Ionicons name="trophy" size={13} color={HomeVisual.gold} />
                </Button3D>
              )}
            </View>
          </View>
        </View>

        {/* Dual-role switcher */}
        {isBoth && (
          <View style={styles.modeRow}>
            <Button3D
              onPress={() => { Haptics.selectionAsync(); setActiveMode("customer"); }}
              faceStyle={[styles.modeBtn, activeMode === "customer" && styles.modeBtnOn]}
            >
              <Ionicons name="person-outline" size={13} color={activeMode === "customer" ? "#FF7A18" : "rgba(255,255,255,0.8)"} />
              <Text style={[styles.modeTxt, activeMode === "customer" && styles.modeTxtOn]}>Customer</Text>
            </Button3D>
            <Button3D
              onPress={() => {
                Haptics.selectionAsync();
                setActiveMode("provider");
                router.replace("/(tabs)/dashboard");
              }}
              faceStyle={[styles.modeBtn, activeMode === "provider" && styles.modeBtnOn]}
            >
              <Ionicons name="briefcase-outline" size={13} color={activeMode === "provider" ? "#FF7A18" : "rgba(255,255,255,0.8)"} />
              <Text style={[styles.modeTxt, activeMode === "provider" && styles.modeTxtOn]}>Provider</Text>
            </Button3D>
          </View>
        )}

        {/* ─── Floating search bar (inside header, visually floats) ─── */}
        <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.searchBar}>
          <Ionicons name="search" size={19} color="#8C908A" />
          <Text style={styles.searchHint}>{t.searchPlaceholder}</Text>
          <Button3D
            onPress={() => router.push("/(tabs)/search")}
            color="#FDF0E6"
            edgeColor="#E9B993"
            radius={16}
            depth={3}
            reserveSpace={false}
            shadow={0.5}
            faceStyle={[styles.micBtn, { backgroundColor: "#FDF0E6" }]}
            hitSlop={6}
            accessibilityLabel="Voice search"
          >
            <Ionicons name="mic" size={15} color="#FF7A18" />
          </Button3D>
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
        {/* ─── Gold Membership Reminder (non-members only) ─── */}
        {!inProviderMode && !isGoldMember && (
          <Pressable
            onPress={() => router.push("/gold-membership")}
            style={styles.goldBanner}
          >
            <LinearGradient
              colors={["#B8860B", "#F5C518", "#FFE066", "#F5C518"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.goldBannerGrad}
            >
              <View style={styles.goldBannerLeft}>
                <View style={styles.goldIconWrap}>
                  <Ionicons name="trophy" size={20} color="#1A1A0D" />
                </View>
                <View style={styles.goldBannerTexts}>
                  <Text style={styles.goldBannerTitle}>Unlock Gold — only ₹2.49</Text>
                  <Text style={styles.goldBannerSub}>4% off every booking. ₹2.49/year — less than a chai!</Text>
                </View>
              </View>
              <Button3D
                onPress={() => router.push("/gold-membership")}
                color="#BCA032"
                edgeColor="#8C7517"
                radius={20}
                depth={4}
                faceStyle={[styles.goldBannerCta, { backgroundColor: "#BCA032" }]}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                accessibilityLabel="Unlock Gold"
              >
                <Text style={styles.goldBannerCtaText}>Unlock</Text>
                <Ionicons name="chevron-forward" size={13} color="#1A1A0D" />
              </Button3D>
            </LinearGradient>
          </Pressable>
        )}

        {/* ─── Ride booking: Car & Bike ─── */}
        {!inProviderMode && (
          <View style={styles.rideRow}>
            {([
              { id: "Car",  title: isPa ? "ਕਾਰ ਬੁੱਕ ਕਰੋ" : "Book a Car",  sub: isPa ? "ਡਰਾਈਵਰ ਨਾਲ" : "With driver", icon: "car-sport" as const, colors: ["#8E6FE0", "#A88BEB", "#C7B4F5"] as const, edge: "#6D50C2" },
              { id: "Bike", title: isPa ? "ਬਾਈਕ ਬੁੱਕ ਕਰੋ" : "Book a Bike", sub: isPa ? "ਸਵਾਰ ਨਾਲ · 1 ਸਵਾਰੀ" : "With rider · 1 seat", icon: "bicycle" as const, colors: ["#B07AD8", "#C79AE6", "#E0C6F3"] as const, edge: "#8C55B8" },
            ]).map((card) => (
              <Pressable
                key={card.id}
                onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/(tabs)/cars", params: { vehicle: card.id } } as any); }}
                style={styles.rideCard}
                accessibilityRole="button"
                accessibilityLabel={card.title}
              >
                <LinearGradient colors={card.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rideCardGrad}>
                  <View style={styles.rideIcon}>
                    <Ionicons name={card.icon} size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rideTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{card.title}</Text>
                    <Text style={styles.rideSub} numberOfLines={1}>{card.sub}</Text>
                  </View>
                  <View style={[styles.rideArrow, { borderColor: card.edge + "33" }]}>
                    <Ionicons name="chevron-forward" size={12} color={card.edge} />
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        )}

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
            { label: "Plough",      labelPa: "ਹਲ",          icon: "git-branch-outline", color: "#4E342E", bg: "#EFEBE9" },
            { label: "Cultivator",  labelPa: "ਕਲਟੀਵੇਟਰ",   icon: "grid-outline",       color: "#37474F", bg: "#ECEFF1" },
            { label: "JCB",          labelPa: "ਜੇਸੀਬੀ",       icon: "construct-outline",  color: "#E65100", bg: "#FFF3E0" },
            { label: "Excavator",    labelPa: "ਖੁਦਾਈ ਮਸ਼ੀਨ",  icon: "build-outline",      color: "#4E342E", bg: "#EFEBE9" },
            { label: "Poclain",      labelPa: "ਪੋਕਲੇਨ",       icon: "construct-outline",  color: "#BF360C", bg: "#FBE9E7" },
            { label: "Chhota Hathi", labelPa: "ਛੋਟਾ ਹਾਥੀ",    icon: "car-outline",        color: "#6D4C41", bg: "#EFEBE9" },
          ].map((item) => {
            const active = selectedCategory === "equipment" && selectedSubcat === item.label;
            return (
              <Button3D
                key={item.label}
                onPress={() => pickSubcat("equipment", item.label)}
                color={active ? item.color : item.bg}
                edgeColor={shadeColor(active ? item.color : item.bg, 0.12)}
                radius={14}
                depth={3}
                faceStyle={[styles.chip, { width: categoryCardWidth, backgroundColor: active ? item.color : HomeVisual.surface }]}
                accessibilityLabel={item.label}
              >
                <View style={[styles.artworkWrap, { backgroundColor: active ? "rgba(255,255,255,0.25)" : item.bg }]}>
                  <CategoryArtwork kind="equipment" name={item.label} color={active ? "#fff" : item.color} />
                </View>
                <View style={styles.chipLabelRow}>
                  <Text style={[styles.chipLabel, { color: active ? "#fff" : HomeVisual.ink }]} numberOfLines={2}>
                    {isPa ? item.labelPa : item.label}
                  </Text>
                  <View style={[styles.miniArrow, active && styles.miniArrowActive]}>
                    <Ionicons name="chevron-forward" size={10} color={active ? item.color : HomeVisual.ink} />
                  </View>
                </View>
              </Button3D>
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
            { label: "AC Repair",   labelPa: "ਏਸੀ ਰਿਪੇਅਰ",     icon: "thermometer-outline", color: "#0277BD", bg: "#E1F5FE" },
          ].map((item) => {
            const active = selectedCategory === "services" && selectedSubcat === item.label;
            return (
              <Button3D
                key={item.label}
                onPress={() => pickSubcat("services", item.label)}
                color={active ? item.color : item.bg}
                edgeColor={shadeColor(active ? item.color : item.bg, 0.12)}
                radius={14}
                depth={3}
                faceStyle={[styles.chip, { width: categoryCardWidth, backgroundColor: active ? item.color : HomeVisual.surface }]}
                accessibilityLabel={item.label}
              >
                <View style={[styles.artworkWrap, { backgroundColor: active ? "rgba(255,255,255,0.25)" : item.bg }]}>
                  <CategoryArtwork kind="service" name={item.label} color={active ? "#fff" : item.color} />
                </View>
                <View style={styles.chipLabelRow}>
                  <Text style={[styles.chipLabel, { color: active ? "#fff" : HomeVisual.ink }]} numberOfLines={2}>
                    {isPa ? item.labelPa : item.label}
                  </Text>
                  <View style={[styles.miniArrow, active && styles.miniArrowActive]}>
                    <Ionicons name="chevron-forward" size={10} color={active ? item.color : HomeVisual.ink} />
                  </View>
                </View>
              </Button3D>
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
        <Button3D
          onPress={() => router.push("/add-listing")}
          color="#FF7A18"
          edgeColor="#D16412"
          radius={28}
          depth={4}
          gradientColors={GRADIENT_ORANGE}
          faceStyle={styles.fabFace}
          reserveSpace={false}
          style={[styles.fab, { bottom: (isWeb ? 34 : insets.bottom) + 80 }]}
          accessibilityLabel="Add listing"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Button3D>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HomeVisual.canvas },

  // ── Header ──────────────────────────────────────────────────
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  menuBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.19)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center", justifyContent: "center",
  },
  headerMid: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center" },
  greeting: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.25, textShadowColor: "rgba(80,30,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locText: { flexShrink: 1, fontSize: 12, color: "rgba(255,255,255,0.95)", fontFamily: "Inter_500Medium", textShadowColor: "rgba(80,30,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  headerActions: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bellStack: { alignItems: "center", gap: 3, top: 10 },
  goldCoin: {
    alignItems: "center", justifyContent: "center",
    marginTop: 6,
    backgroundColor: "#72531D", borderRadius: 12,
    width: 25, height: 25,
    borderWidth: 1.5, borderColor: HomeVisual.gold,
    shadowColor: HomeVisual.gold, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.36, shadowRadius: 4, elevation: 3,
  },
  goldCoinText: { fontSize: 12, lineHeight: 13 },

  referBanner:      { marginHorizontal: 16, marginTop: 10, marginBottom: 6, borderRadius: 20, overflow: "hidden", elevation: 3, shadowColor: "#CE4A58", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.19, shadowRadius: 10 },
  referBannerGrad:  { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 14, gap: 10 },
  referGiftIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.17)", alignItems: "center", justifyContent: "center" },
  referBannerTexts: { flex: 1 },
  referBannerTitle: { fontSize: 13, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#fff" },
  referBannerSub:   { fontSize: 11, color: "rgba(255,255,255,0.88)", fontFamily: "Inter_400Regular", marginTop: 1 },
  referBannerCta:   { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#FFF8F5", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  referBannerCtaTxt: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: HomeVisual.orange },
  rideRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 6 },
  rideCard: { flex: 1, borderRadius: 20, overflow: "hidden", elevation: 3, shadowColor: "#7A5AC8", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.19, shadowRadius: 10 },
  rideCardGrad: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 11, gap: 8, minHeight: 66 },
  rideIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  rideTitle: { fontSize: 13, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#fff" },
  rideSub: { fontSize: 10.5, color: "rgba(255,255,255,0.92)", fontFamily: "Inter_400Regular", marginTop: 1 },
  rideArrow: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  langPill: {
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 16,
    paddingHorizontal: 11, paddingVertical: 7, marginTop: 7,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  langPillText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Mode switcher
  modeRow: {
    flexDirection: "row", alignSelf: "center",
    backgroundColor: "rgba(82,45,16,0.18)", borderRadius: 20, padding: 3,
    marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 17 },
  modeBtnOn: { backgroundColor: "#fff" },
  modeTxt: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  modeTxtOn: { color: "#FF7A18" },

  // Search bar (inside header, floats visually)
  searchBar: {
    marginTop: 72,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: HomeVisual.surface,
    borderRadius: 28,
    paddingHorizontal: 16, paddingVertical: 10,
    minHeight: 56,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.65)",
    shadowColor: "#734B22",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  searchHint: { flex: 1, fontSize: 14, color: "#AEAEAE", fontFamily: "Inter_400Regular" },
  micBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#FFF0E1",
    alignItems: "center", justifyContent: "center",
  },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: 8 },

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
    paddingHorizontal: 18, marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: HomeVisual.ink, letterSpacing: -0.25,
  },
  sectionLink: {
    fontSize: 12, fontWeight: "700", fontFamily: "Inter_600SemiBold", color: HomeVisual.orange,
  },
  sectionLinkActive: {
    textDecorationLine: "underline",
    opacity: 0.75,
  },

  // Subcategory chip rows
  chipRow: {
    paddingHorizontal: 18,
    paddingBottom: 15,
    gap: 8,
  },
  chip: {
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 5,
    borderRadius: 17,
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: HomeVisual.border,
    shadowColor: HomeVisual.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 7,
    elevation: 2,
  },
  artworkWrap: {
    width: "100%", height: 65, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  chipLabelRow: { width: "100%", minHeight: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1 },
  chipLabel: {
    flexShrink: 1, fontSize: 9.5, fontWeight: "700", fontFamily: "Inter_700Bold",
    textAlign: "center", lineHeight: 12,
  },
  miniArrow: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#F2F3EE", alignItems: "center", justifyContent: "center" },
  miniArrowActive: { backgroundColor: "#FFFFFF" },

  // Category tabs
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: HomeVisual.canvas,
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
  listingsWrap: { paddingHorizontal: 16, gap: 14 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  emptyHint: { fontSize: 13, color: "#AEAEAE", fontFamily: "Inter_400Regular" },

  // FAB
  fab: {
    position: "absolute", right: 20,
    width: 56, height: 56, borderRadius: 28,
    shadowColor: "#FF7A18", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  fabGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  fabFace: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },

  // Gold membership banner
  goldBanner: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 6, borderRadius: 20, overflow: "hidden",
    shadowColor: "#B78B20", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 9, elevation: 4,
  },
  goldBannerGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, paddingHorizontal: 14,
  },
  goldBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  goldIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.18)", alignItems: "center", justifyContent: "center",
  },
  goldBannerTexts: { flex: 1 },
  goldBannerTitle: { fontSize: 13, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#1A1A0D" },
  goldBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#3D2F00", marginTop: 1 },
  goldBannerCta: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  goldBannerCtaText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#1A1A0D" },
});
