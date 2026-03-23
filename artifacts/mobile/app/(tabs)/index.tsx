import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryPill, CATEGORIES } from "@/components/CategoryPill";
import { ListingCard } from "@/components/ListingCard";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Listing, Category } from "@/types";

const C = Colors.light;

const FEATURED_SUBCATEGORIES = [
  { id: "tractor", label: "Tractors", icon: "🚜", color: "#22C55E", bg: "#F0FFF4" },
  { id: "harvester", label: "Harvesters", icon: "⚙️", color: "#F59E0B", bg: "#FFFBEB" },
  { id: "plumber", label: "Plumbers", icon: "🔧", color: "#3B82F6", bg: "#EBF4FF" },
  { id: "sedan", label: "Cars", icon: "🚗", color: "#8B5CF6", bg: "#F5F0FF" },
  { id: "electrician", label: "Electricians", icon: "⚡", color: "#EF4444", bg: "#FEF2F2" },
  { id: "beauty", label: "Beauty", icon: "✂️", color: "#EC4899", bg: "#FFF0F8" },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { get } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");

  useEffect(() => {
    if (!user) {
      router.replace("/auth");
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

  async function onRefresh() {
    setRefreshing(true);
    fetchListings();
  }

  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[C.navy, "#1B3260"]} style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              Sat Sri Akal, {user?.name?.split(" ")[0] || "Friend"} 🌾
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={13} color={`${C.tint}`} />
              <Text style={styles.locationText}>Punjab, India</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/messages")} style={styles.headerIcon}>
            <Ionicons name="chatbubble-outline" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Search bar (tap to go to search) */}
        <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.searchBar}>
          <Ionicons name="search" size={16} color={C.textSecondary} />
          <Text style={styles.searchPlaceholder}>Search cars, tractors, services...</Text>
        </Pressable>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse by Category</Text>
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
          <Text style={styles.sectionTitle}>Popular in Punjab</Text>
          <View style={styles.quickGrid}>
            {FEATURED_SUBCATEGORIES.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push({ pathname: "/(tabs)/search", params: { q: item.label } })}
                style={({ pressed }) => [styles.quickItem, { backgroundColor: item.bg, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.quickIcon}>{item.icon}</Text>
                <Text style={[styles.quickLabel, { color: item.color }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Listings */}
        <View style={[styles.section, styles.listingsSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === "all" ? "All Listings" : CATEGORIES.find(c => c.id === selectedCategory)?.label}
            </Text>
            <Text style={styles.listingCount}>{listings.length} found</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.tint} size="large" />
            </View>
          ) : listings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={48} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyText}>Be the first to list in this category!</Text>
            </View>
          ) : (
            <View style={styles.listingsGrid}>
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} style={styles.listingCard} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>

      {/* FAB for providers */}
      {user?.role === "provider" && (
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: C.textTertiary,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  scroll: { flex: 1 },
  section: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  listingCount: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  catScroll: {
    gap: 10,
    paddingRight: 20,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickItem: {
    width: "30%",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    minWidth: 90,
    flex: 1,
  },
  quickIcon: { fontSize: 24 },
  quickLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  listingsSection: {},
  listingsGrid: {
    gap: 14,
  },
  listingCard: {},
  loadingBox: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptyText: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});
