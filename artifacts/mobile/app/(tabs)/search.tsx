import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingCard } from "@/components/ListingCard";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { Listing } from "@/types";

const C = Colors.light;
const ORANGE = "#FF7A18";
const RECENT_KEY = "rz_recent_searches";
const MAX_RECENT = 8;

const POPULAR = [
  { q: "Swift Car",      icon: "car-outline",         lib: "ion",  cat: "cars" },
  { q: "Tractor",        icon: "tractor",              lib: "mci",  cat: "equipment" },
  { q: "Plumber",        icon: "construct-outline",    lib: "ion",  cat: "services" },
  { q: "Electrician",    icon: "flash-outline",        lib: "ion",  cat: "services" },
  { q: "Beauty Parlor",  icon: "sparkles-outline",     lib: "ion",  cat: "services" },
  { q: "Mechanic",       icon: "build-outline",        lib: "ion",  cat: "services" },
  { q: "Toyota Innova",  icon: "car-outline",          lib: "ion",  cat: "cars" },
  { q: "Harvester",      icon: "tractor",              lib: "mci",  cat: "equipment" },
  { q: "Carpenter",      icon: "hammer-outline",       lib: "ion",  cat: "services" },
  { q: "Ludhiana",       icon: "location-outline",     lib: "ion",  cat: "location" },
];

interface SuggestionItem {
  id: string;
  type: "listing" | "provider" | "location";
  category?: string;
  subcategory?: string | null;
  title: string;
  subtitle: string;
  location?: string | null;
  price?: number;
  priceUnit?: string;
}

interface SearchResults {
  vehicles: SuggestionItem[];
  services: SuggestionItem[];
  providers: SuggestionItem[];
  locations: SuggestionItem[];
  intent: string;
}

const GROUP_CONFIG = {
  vehicles:  { label: "Vehicles",   icon: "car-outline",       color: "#3B82F6" },
  services:  { label: "Services",   icon: "construct-outline", color: "#A855F7" },
  providers: { label: "Businesses", icon: "storefront-outline", color: "#F59E0B" },
  locations: { label: "Locations",  icon: "location-outline",  color: "#10B981" },
} as const;

function HighlightText({ text, query, style }: { text: string; query: string; style?: object }) {
  if (!query.trim()) return <Text style={style}>{text}</Text>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <Text key={i} style={[style, styles.highlight]}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

type FilterTab = "all" | "cars" | "equipment" | "services";
const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "cars", label: "Cars" },
  { id: "equipment", label: "Equipment" },
  { id: "services", label: "Services" },
];

export default function SearchScreen() {
  const { get } = useApi();
  const { user, activeMode } = useAuth();
  const insets = useSafeAreaInsets();
  const { q: initialQ } = useLocalSearchParams<{ q?: string }>();
  const isWeb = Platform.OS === "web";

  const [query, setQuery] = useState(initialQ || "");
  const [committedQuery, setCommittedQuery] = useState(initialQ || "");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResults | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => {
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (committedQuery) fetchResults(committedQuery);
    else setListings([]);
  }, [committedQuery, activeTab, minPrice, maxPrice, minRating]);

  async function loadRecentSearches() {
    try {
      const stored = await AsyncStorage.getItem(RECENT_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }

  async function saveRecentSearch(q: string) {
    try {
      const trimmed = q.trim();
      if (!trimmed) return;
      const updated = [trimmed, ...recentSearches.filter(r => r !== trimmed)].slice(0, MAX_RECENT);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {}
  }

  async function removeRecentSearch(q: string) {
    try {
      const updated = recentSearches.filter(r => r !== q);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {}
  }

  async function clearRecentSearches() {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_KEY);
    } catch {}
  }

  function showDropdown() {
    Animated.spring(dropdownAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start();
  }

  function hideDropdown() {
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }

  const onQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSuggestions(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text.trim());
    }, 300);
  }, []);

  async function fetchSuggestions(q: string) {
    setSuggestionsLoading(true);
    try {
      const data = await get<SearchResults>(`/search?q=${encodeURIComponent(q)}&limit=5`);
      setSuggestions(data);
    } catch {
      setSuggestions(null);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function fetchResults(q: string) {
    setResultsLoading(true);
    try {
      const params = new URLSearchParams({ search: q });
      if (activeTab !== "all") params.set("category", activeTab);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (user?.id && (user.role === "provider" || user.role === "both")) {
        params.set("excludeProviderId", user.id);
      }
      let data = await get<Listing[]>(`/listings?${params.toString()}`);
      if (minRating !== null) {
        data = data.filter((l) => l.rating !== null && l.rating >= minRating!);
      }
      setListings(data);
    } catch {
      setListings([]);
    } finally {
      setResultsLoading(false);
    }
  }

  function commitSearch(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    setCommittedQuery(q);
    saveRecentSearch(q);
    setIsFocused(false);
    hideDropdown();
    Keyboard.dismiss();
  }

  function onFocus() {
    setIsFocused(true);
    showDropdown();
  }

  function onBlur() {
    setTimeout(() => {
      setIsFocused(false);
      hideDropdown();
    }, 200);
  }

  function clearQuery() {
    setQuery("");
    setCommittedQuery("");
    setSuggestions(null);
    setListings([]);
    inputRef.current?.focus();
  }

  const showingDropdown = isFocused;
  const hasSuggestions = suggestions &&
    (suggestions.vehicles.length + suggestions.services.length +
     suggestions.providers.length + suggestions.locations.length) > 0;
  const showRecent = isFocused && !query.trim() && recentSearches.length > 0;
  const showPopular = isFocused && !query.trim() && recentSearches.length === 0;

  const dropdownHeight = dropdownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Header with gradient ── */}
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <Text style={styles.headerTitle}>Search</Text>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, isFocused && styles.searchBoxFocused]}>
            {suggestionsLoading
              ? <ActivityIndicator size="small" color={C.textTertiary} style={{ marginLeft: 2 }} />
              : <Ionicons name="search" size={18} color={isFocused ? ORANGE : C.textSecondary} />
            }
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={onQueryChange}
              onFocus={onFocus}
              onBlur={onBlur}
              onSubmitEditing={() => commitSearch(query)}
              placeholder="Search cars, services, or locations..."
              placeholderTextColor={C.textTertiary}
              returnKeyType="search"
              autoFocus={!!initialQ}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={clearQuery} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={C.textTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => { setShowFilters(!showFilters); }}
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          >
            <Ionicons name="options-outline" size={18} color={showFilters ? "#fff" : C.text} />
          </Pressable>
        </View>

        {/* Filters panel */}
        {showFilters && (
          <View style={styles.filtersBox}>
            {/* Price Range */}
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
              <Pressable
                onPress={() => { setMinPrice(""); setMaxPrice(""); setMinRating(null); }}
                style={styles.resetBtn}
              >
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
            </View>
            {/* Rating Filter */}
            <View style={styles.ratingFilterRow}>
              <Text style={styles.ratingFilterLabel}>Min Rating</Text>
              <View style={styles.ratingChips}>
                {([null, 3, 4, 4.5] as (number | null)[]).map((r) => {
                  const label = r === null ? "Any" : r === 4.5 ? "4.5★+" : `${r}★+`;
                  const active = minRating === r;
                  return (
                    <Pressable
                      key={String(r)}
                      onPress={() => setMinRating(active ? null : r)}
                      style={[styles.ratingChip, active && styles.ratingChipActive]}
                    >
                      <Text style={[styles.ratingChipText, active && styles.ratingChipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {FILTER_TABS.map(tab => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabPill, activeTab === tab.id && styles.tabPillActive]}
            >
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* ── Suggestions Dropdown ── */}
      {showingDropdown && (
        <Animated.View style={[styles.dropdown, { opacity: dropdownAnim }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Loading */}
            {suggestionsLoading && query.trim() && (
              <View style={styles.dropLoadingRow}>
                <ActivityIndicator size="small" color={ORANGE} />
                <Text style={styles.dropLoadingText}>Searching...</Text>
              </View>
            )}

            {/* Live suggestions grouped */}
            {!suggestionsLoading && hasSuggestions && suggestions && (
              <>
                {(["vehicles", "services", "providers", "locations"] as const).map(group => {
                  const items = suggestions[group];
                  if (!items.length) return null;
                  const cfg = GROUP_CONFIG[group];
                  return (
                    <View key={group}>
                      <View style={styles.groupHeader}>
                        <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={13} color={cfg.color} />
                        <Text style={[styles.groupLabel, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                      {items.map(item => (
                        <Pressable
                          key={item.id}
                          style={({ pressed }) => [styles.suggRow, pressed && styles.suggRowPressed]}
                          onPress={() => {
                            if (item.type === "listing") {
                              saveRecentSearch(item.title);
                              router.push(`/listing/${item.id}` as any);
                              hideDropdown();
                              setIsFocused(false);
                            } else if (item.type === "provider") {
                              saveRecentSearch(item.title);
                              router.push(`/provider/${item.id}` as any);
                              hideDropdown();
                              setIsFocused(false);
                            } else {
                              commitSearch(item.title);
                            }
                          }}
                        >
                          <View style={[styles.suggIcon, { backgroundColor: `${cfg.color}18` }]}>
                            <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={14} color={cfg.color} />
                          </View>
                          <View style={styles.suggText}>
                            <HighlightText
                              text={item.title}
                              query={query}
                              style={styles.suggTitle}
                            />
                            <Text style={styles.suggSub} numberOfLines={1}>{item.subtitle}</Text>
                          </View>
                          {item.type === "listing" && (
                            <Text style={styles.suggPrice}>
                              ₹{item.price ? Math.round(item.price).toLocaleString("en-IN") : "—"}
                            </Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  );
                })}

                <Pressable style={styles.seeAllRow} onPress={() => commitSearch(query)}>
                  <Text style={styles.seeAllText}>See all results for "{query}"</Text>
                  <Ionicons name="arrow-forward" size={14} color={ORANGE} />
                </Pressable>
              </>
            )}

            {/* No results message */}
            {!suggestionsLoading && query.trim() && !hasSuggestions && (
              <View style={styles.noResultsRow}>
                <Ionicons name="search-outline" size={20} color={C.textTertiary} />
                <Text style={styles.noResultsText}>No suggestions for "{query}"</Text>
              </View>
            )}

            {/* Recent Searches */}
            {showRecent && (
              <>
                <View style={styles.groupHeader}>
                  <Ionicons name="time-outline" size={13} color={C.textSecondary} />
                  <Text style={[styles.groupLabel, { color: C.textSecondary }]}>Recent</Text>
                  <Pressable onPress={clearRecentSearches} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </Pressable>
                </View>
                {recentSearches.map(recent => (
                  <Pressable
                    key={recent}
                    style={({ pressed }) => [styles.suggRow, pressed && styles.suggRowPressed]}
                    onPress={() => commitSearch(recent)}
                  >
                    <View style={[styles.suggIcon, { backgroundColor: "#F0F0F0" }]}>
                      <Ionicons name="time-outline" size={14} color={C.textSecondary} />
                    </View>
                    <Text style={[styles.suggTitle, { flex: 1 }]}>{recent}</Text>
                    <Pressable onPress={() => removeRecentSearch(recent)} hitSlop={8}>
                      <Ionicons name="close" size={14} color={C.textTertiary} />
                    </Pressable>
                  </Pressable>
                ))}
              </>
            )}

            {/* Popular Searches */}
            {showPopular && (
              <>
                <View style={styles.groupHeader}>
                  <Ionicons name="flame-outline" size={13} color="#F97316" />
                  <Text style={[styles.groupLabel, { color: "#F97316" }]}>Popular in Punjab</Text>
                </View>
                <View style={styles.popularGrid}>
                  {POPULAR.map(p => (
                    <Pressable
                      key={p.q}
                      style={({ pressed }) => [styles.popularChip, pressed && { opacity: 0.7 }]}
                      onPress={() => commitSearch(p.q)}
                    >
                      {p.lib === "mci"
                        ? <MaterialCommunityIcons name={p.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={14} color={ORANGE} />
                        : <Ionicons name={p.icon as keyof typeof Ionicons.glyphMap} size={14} color={ORANGE} />
                      }
                      <Text style={styles.popularChipText}>{p.q}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* ── Results ── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {committedQuery ? (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsText}>
                {resultsLoading
                  ? "Searching..."
                  : `${listings.length} result${listings.length !== 1 ? "s" : ""} for "${committedQuery}"`
                }
              </Text>
            </View>

            {resultsLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={ORANGE} size="large" />
                <Text style={styles.loadingText}>Finding the best matches…</Text>
              </View>
            ) : listings.length === 0 ? (
              <View style={styles.centerBox}>
                <Ionicons name="search-outline" size={56} color={C.textTertiary} />
                <Text style={styles.emptyTitle}>No results</Text>
                <Text style={styles.emptyText}>
                  Try different keywords or browse categories below
                </Text>
                <View style={styles.quickTips}>
                  {["Tractor", "Plumber", "Swift"].map(tip => (
                    <Pressable key={tip} style={styles.tipChip} onPress={() => commitSearch(tip)}>
                      <Text style={styles.tipChipText}>{tip}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.list}>
                {listings.map(l => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    style={styles.card}
                    isCustomer={user?.role === "customer" || (user?.role === "both" && activeMode === "customer")}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          !showingDropdown && (
            <View style={styles.idleBox}>
              <LinearGradient
                colors={["#FFF3E9", "#FFF8F0"]}
                style={styles.idleBanner}
              >
                <Ionicons name="search-outline" size={44} color={ORANGE} />
                <Text style={styles.idleTitle}>Find anything in Punjab</Text>
                <Text style={styles.idleText}>Cars · Equipment · Services · Businesses</Text>
              </LinearGradient>

              <Text style={styles.popularHeading}>🔥 Popular Searches</Text>
              <View style={styles.popularGrid2}>
                {POPULAR.map(p => (
                  <Pressable
                    key={p.q}
                    style={({ pressed }) => [styles.popularCard, pressed && { opacity: 0.8 }]}
                    onPress={() => commitSearch(p.q)}
                  >
                    {p.lib === "mci"
                      ? <MaterialCommunityIcons name={p.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={ORANGE} />
                      : <Ionicons name={p.icon as keyof typeof Ionicons.glyphMap} size={22} color={ORANGE} />
                    }
                    <Text style={styles.popularCardText}>{p.q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        )}
        <View style={{ height: (isWeb ? 80 : 100) + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },

  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 14,
    gap: 8,
    height: 48,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchBoxFocused: {
    borderColor: `${ORANGE}60`,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#2C2C2C",
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: { backgroundColor: ORANGE },

  filtersBox: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  priceInput: { flex: 1, gap: 4 },
  priceLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_600SemiBold",
  },
  priceField: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  priceDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.4)" },
  applyBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  applyBtnText: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  resetBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  resetBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  ratingFilterRow: {
    marginTop: 10,
    gap: 6,
  },
  ratingFilterLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_600SemiBold",
  },
  ratingChips: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  ratingChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  ratingChipActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  ratingChipText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  ratingChipTextActive: {
    color: ORANGE,
  },

  tabsScroll: { gap: 8 },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  tabPillActive: { backgroundColor: "#fff" },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.9)",
  },
  tabLabelActive: { color: ORANGE },

  // Dropdown
  dropdown: {
    position: "absolute",
    top: Platform.OS === "web" ? 200 : 220,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "#fff",
    maxHeight: 420,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
    overflow: "hidden",
  },
  dropLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  dropLoadingText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  clearBtnText: { fontSize: 12, color: ORANGE, fontFamily: "Inter_500Medium" },
  suggRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  suggRowPressed: { backgroundColor: C.backgroundSecondary },
  suggIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  suggText: { flex: 1 },
  suggTitle: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    color: C.text,
  },
  suggSub: {
    fontSize: 12,
    color: C.textTertiary,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  suggPrice: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: ORANGE,
  },
  highlight: {
    backgroundColor: "#FFDAB0",
    color: "#C05000",
    borderRadius: 3,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  seeAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: ORANGE,
  },
  noResultsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  noResultsText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  popularGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 6,
  },
  popularChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF3E9",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: `${ORANGE}30`,
  },
  popularChipText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    color: C.text,
  },

  // Results
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
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  quickTips: { flexDirection: "row", gap: 8, marginTop: 4 },
  tipChip: {
    backgroundColor: "#FFF3E9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: `${ORANGE}40`,
  },
  tipChipText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: ORANGE,
  },
  list: { padding: 20, gap: 14 },
  card: {},

  // Idle state
  idleBox: { paddingHorizontal: 20, paddingTop: 20, gap: 20 },
  idleBanner: {
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    gap: 10,
  },
  idleTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  idleText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  popularHeading: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  popularGrid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  popularCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  popularCardText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    textAlign: "center",
  },
});
