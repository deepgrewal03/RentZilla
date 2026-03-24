import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryPill, CATEGORIES } from "@/components/CategoryPill";
import { ListingCard } from "@/components/ListingCard";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { Listing, Category } from "@/types";

const C = Colors.light;

export default function SearchScreen() {
  const { get } = useApi();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const isWeb = Platform.OS === "web";

  const [query, setQuery] = useState(q || "");
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    search();
  }, [selectedCategory, query]);

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (query.trim()) params.set("search", query.trim());
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      const data = await get<Listing[]>(`/listings?${params.toString()}`);
      setListings(data);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }

  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <Text style={[styles.headerTitle, { color: "#fff" }]}>Search</Text>

        {/* Search input */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={C.textSecondary} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Cars, tractors, plumbers..."
              placeholderTextColor={C.textTertiary}
              returnKeyType="search"
              onSubmitEditing={search}
              autoFocus={!!q}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={16} color={C.textTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          >
            <Ionicons name="options-outline" size={18} color={showFilters ? "#fff" : C.text} />
          </Pressable>
        </View>

        {/* Filters */}
        {showFilters && (
          <View style={styles.filtersBox}>
            <View style={styles.priceRow}>
              <View style={styles.priceInput}>
                <Text style={styles.priceLabel}>Min ₹</Text>
                <TextInput
                  style={styles.priceField}
                  value={minPrice}
                  onChangeText={setMinPrice}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.textTertiary}
                />
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceInput}>
                <Text style={styles.priceLabel}>Max ₹</Text>
                <TextInput
                  style={styles.priceField}
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  keyboardType="numeric"
                  placeholder="Any"
                  placeholderTextColor={C.textTertiary}
                />
              </View>
            </View>
            <Pressable onPress={search} style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </Pressable>
          </View>
        )}

        {/* Category pills */}
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
      </LinearGradient>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            {loading ? "Searching..." : `${listings.length} listings found`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={C.tint} size="large" />
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="search-outline" size={56} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>Try a different search or category</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {listings.map((l) => <ListingCard key={l.id} listing={l} style={styles.card} />)}
          </View>
        )}
        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  searchRow: { flexDirection: "row", gap: 10 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 26,
    paddingHorizontal: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#2C2C2C",
    paddingVertical: 13,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: C.tint,
    borderColor: C.tint,
  },
  filtersBox: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  priceInput: {
    flex: 1,
    gap: 4,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  priceField: {
    backgroundColor: C.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  priceDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.border,
    marginTop: 16,
  },
  applyBtn: {
    backgroundColor: C.tint,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  applyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  catScroll: { gap: 10 },
  scroll: { flex: 1 },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  resultsText: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  list: { padding: 20, gap: 14 },
  card: {},
});
