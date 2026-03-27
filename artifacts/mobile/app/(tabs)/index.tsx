import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationBell } from "@/components/NotificationBell";
import { SideDrawer } from "@/components/SideDrawer";
import Colors, { GRADIENT_ORANGE } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";

const C = Colors.light;

const SERVICES = [
  { icon: "car-outline",           labelEn: "Car Rental",     labelPa: "ਕਾਰ ਕਿਰਾਇਆ",        color: "#FF7A18", bg: "#FFF3E9", cat: "services" },
  { icon: "construct-outline",     labelEn: "Tractor Hire",   labelPa: "ਟਰੈਕਟਰ ਕਿਰਾਇਆ",     color: "#2E7D32", bg: "#E8F5E9", cat: "services" },
  { icon: "umbrella-outline",      labelEn: "Tent & Marquee", labelPa: "ਤੰਬੂ & ਮਾਰਕੀ",      color: "#7B1FA2", bg: "#F3E5F5", cat: "services" },
  { icon: "musical-notes-outline", labelEn: "Sound System",   labelPa: "ਸਾਊਂਡ ਸਿਸਟਮ",       color: "#0288D1", bg: "#E0F7FA", cat: "services" },
  { icon: "camera-outline",        labelEn: "Photography",    labelPa: "ਫੋਟੋਗ੍ਰਾਫੀ",         color: "#F57C00", bg: "#FFF8E1", cat: "services" },
  { icon: "restaurant-outline",    labelEn: "Catering",       labelPa: "ਕੈਟਰਿੰਗ",            color: "#C62828", bg: "#FFEBEE", cat: "services" },
  { icon: "sparkles-outline",      labelEn: "Cleaning",       labelPa: "ਸਫਾਈ ਸੇਵਾ",          color: "#00838F", bg: "#E0F2F1", cat: "services" },
  { icon: "water-outline",         labelEn: "Plumbing",       labelPa: "ਪਲੰਬਿੰਗ",            color: "#1565C0", bg: "#E3F2FD", cat: "services" },
  { icon: "flash-outline",         labelEn: "Electrician",    labelPa: "ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ",      color: "#F9A825", bg: "#FFFDE7", cat: "services" },
  { icon: "thermometer-outline",   labelEn: "AC Repair",      labelPa: "ਏਸੀ ਰਿਪੇਅਰ",         color: "#0277BD", bg: "#E1F5FE", cat: "services" },
];

const EQUIPMENT = [
  { icon: "cog-outline",             labelEn: "Tractor",       labelPa: "ਟਰੈਕਟਰ",            color: "#33691E", bg: "#F1F8E9" },
  { icon: "settings-outline",        labelEn: "Thresher",      labelPa: "ਥਰੈਸ਼ਰ",            color: "#558B2F", bg: "#DCEDC8" },
  { icon: "hammer-outline",          labelEn: "JCB / Excavator",labelPa: "ਜੇਸੀਬੀ",           color: "#E65100", bg: "#FBE9E7" },
  { icon: "battery-charging-outline",labelEn: "Generator",     labelPa: "ਜਨਰੇਟਰ",           color: "#AD1457", bg: "#FCE4EC" },
  { icon: "water-outline",           labelEn: "Water Pump",    labelPa: "ਵਾਟਰ ਪੰਪ",         color: "#006064", bg: "#E0F7FA" },
  { icon: "leaf-outline",            labelEn: "Crop Sprayer",  labelPa: "ਸਪ੍ਰੇਅਰ",           color: "#1B5E20", bg: "#E8F5E9" },
  { icon: "grid-outline",            labelEn: "Scaffolding",   labelPa: "ਸਕੈਫੋਲਡਿੰਗ",       color: "#37474F", bg: "#ECEFF1" },
  { icon: "build-outline",           labelEn: "Drill Machine", labelPa: "ਡਰਿੱਲ ਮਸ਼ੀਨ",      color: "#4E342E", bg: "#EFEBE9" },
  { icon: "layers-outline",          labelEn: "Compactor",     labelPa: "ਕੰਪੈਕਟਰ",           color: "#455A64", bg: "#ECEFF1" },
  { icon: "flame-outline",           labelEn: "Welder",        labelPa: "ਵੈਲਡਰ",             color: "#BF360C", bg: "#FBE9E7" },
];

export default function HomeScreen() {
  const { user, activeMode, setActiveMode } = useAuth();
  const isBoth         = user?.role === "both";
  const isPureProvider = user?.role === "provider";
  const { t, language, toggleLanguage } = useLang();
  const insets         = useSafeAreaInsets();
  const isWeb          = Platform.OS === "web";
  const isPa           = language === "pa";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const inProviderMode = isPureProvider || (isBoth && activeMode === "provider");

  useEffect(() => {
    if (!user) { router.replace("/sign-in"); return; }
    if (inProviderMode) { router.replace("/(tabs)/dashboard"); return; }
  }, [user, inProviderMode]);

  const topPad    = isWeb ? 67 : insets.top;
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "Friend";

  function handleServicePress(cat: string) {
    Haptics.selectionAsync();
    router.push({ pathname: "/(tabs)/search", params: { category: cat } });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ─── HEADER ─── */}
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

        {/* Floating search bar */}
        <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.searchBar}>
          <Ionicons name="search" size={17} color="#AEAEAE" />
          <Text style={styles.searchHint}>{t.searchPlaceholder}</Text>
          <View style={styles.micBtn}>
            <Ionicons name="mic" size={15} color="#FF7A18" />
          </View>
        </Pressable>
      </LinearGradient>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Services Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isPa ? "ਸੇਵਾਵਾਂ" : "Services"}</Text>
          <Pressable onPress={() => handleServicePress("services")}>
            <Text style={styles.sectionLink}>{isPa ? "ਸਭ ਵੇਖੋ" : "See all"}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {SERVICES.map((item) => (
            <Pressable
              key={item.labelEn}
              onPress={() => handleServicePress(item.cat)}
              style={[styles.chip, { backgroundColor: item.bg }]}
            >
              <View style={[styles.chipIcon, { backgroundColor: `${item.color}22` }]}>
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={item.color} />
              </View>
              <Text style={[styles.chipLabel, { color: item.color }]} numberOfLines={2}>
                {isPa ? item.labelPa : item.labelEn}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Equipment Section ── */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>{isPa ? "ਮਸ਼ੀਨਰੀ" : "Equipment"}</Text>
          <Pressable onPress={() => handleServicePress("equipment")}>
            <Text style={styles.sectionLink}>{isPa ? "ਸਭ ਵੇਖੋ" : "See all"}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {EQUIPMENT.map((item) => (
            <Pressable
              key={item.labelEn}
              onPress={() => handleServicePress("equipment")}
              style={[styles.chip, { backgroundColor: item.bg }]}
            >
              <View style={[styles.chipIcon, { backgroundColor: `${item.color}22` }]}>
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={item.color} />
              </View>
              <Text style={[styles.chipLabel, { color: item.color }]} numberOfLines={2}>
                {isPa ? item.labelPa : item.labelEn}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

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
  root: { flex: 1, backgroundColor: "#F5F6FA" },

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

  modeRow: {
    flexDirection: "row", alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 20, padding: 3,
    marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 17 },
  modeBtnOn: { backgroundColor: "#fff" },
  modeTxt: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  modeTxtOn: { color: "#FF7A18" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 28,
    paddingHorizontal: 16, paddingVertical: 13,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  searchHint: { flex: 1, fontSize: 14, color: "#AEAEAE", fontFamily: "Inter_400Regular" },
  micBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#FFF3E9",
    alignItems: "center", justifyContent: "center",
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 20 },

  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C",
  },
  sectionLink: {
    fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#FF7A18",
  },

  chipRow: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 12,
  },
  chip: {
    width: 88,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  chipIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
  },
  chipLabel: {
    fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold",
    textAlign: "center", lineHeight: 14,
  },

  fab: {
    position: "absolute", right: 20,
    width: 56, height: 56, borderRadius: 28, overflow: "hidden",
    shadowColor: "#FF7A18", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  fabGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
});
