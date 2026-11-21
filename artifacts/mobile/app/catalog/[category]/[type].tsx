import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetListings } from "@workspace/api-client-react";
import Colors, { GRADIENT_ORANGE } from "@/constants/colors";
import HomeVisual from "@/constants/homeVisualTokens";
import { useAuth } from "@/context/AuthContext";
import { ListingCard } from "@/components/ListingCard";
import { CatalogLocationSelect } from "@/components/CatalogLocationSelect";
import { districts, matchesCatalogListing, punjabTowns } from "@/lib/catalogLocation";
import type { Listing } from "@/types";

const C = Colors.light;
const retired = new Set(["sprayer", "rock breaker", "bulldozer", "painter", "wheel loader"]);

export default function CategoryListings() {
  const params = useLocalSearchParams<{ category: string; type: string }>();
  // A keyed child resets both location selectors when a different type is opened.
  return <CategoryResults key={`${params.category}/${params.type}`} category={params.category} type={params.type} />;
}

function CategoryResults({ category, type }: { category: string; type: string }) {
  const { user, token, activeMode } = useAuth();
  const insets = useSafeAreaInsets();
  const [district, setDistrict] = useState("");
  const [town, setTown] = useState("");
  const valid = (category === "equipment" || category === "services") && Boolean(type) && !retired.has(type.toLowerCase());
  const query = useGetListings({ category: category === "services" ? "services" : "equipment" }, {
    query: { queryKey: ["category-listings", category, user?.id], enabled: valid, staleTime: 0, retry: 1 },
    request: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
  const isCustomer = user?.role === "customer" || (user?.role === "both" && activeMode === "customer");
  const listings = useMemo(() => (query.data ?? [])
    .filter(item => matchesCatalogListing(item, category, type ?? "", district, town, user?.id))
    .map((item): Listing => ({
      ...item, subcategory: item.subcategory ?? null, description: item.description ?? null,
      providerName: item.providerName ?? null, providerPhone: item.providerPhone ?? null,
      providerRating: item.providerRating ?? null, providerReviewCount: item.providerReviewCount ?? 0,
      rating: item.rating ?? null, reviewCount: item.reviewCount ?? 0, images: item.images ?? [],
      operatorIncluded: null, fuelIncluded: null, deliveryCharges: null,
    })), [query.data, category, type, district, town, user?.id]);
  const clear = () => { setDistrict(""); setTown(""); };
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={GRADIENT_ORANGE} style={[styles.header, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to home" style={styles.back}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
          <Ionicons name="arrow-back" size={24} color={C.card} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{type || "Listings"}</Text>
          <Text style={styles.subtitle}>{category === "services" ? "Available services" : "Available equipment"}</Text>
        </View>
      </LinearGradient>
      <FlatList data={query.isError || !valid ? [] : listings} keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(34, insets.bottom + 20) }}
        refreshing={query.isRefetching} onRefresh={() => { if (valid) void query.refetch(); }}
        renderItem={({ item }) => <ListingCard listing={item} isCustomer={isCustomer} style={{ width: "100%", marginBottom: 16 }} />}
        ListHeaderComponent={valid ? (
          <View style={styles.filters}>
            <Text style={styles.filterTitle}>Find {type.toLowerCase()} near you</Text>
            <CatalogLocationSelect label="District" value={district} options={districts} allLabel="All districts"
              onChange={value => { setDistrict(value); setTown(""); }} />
            <CatalogLocationSelect label="Town / City" value={town} options={punjabTowns[district] ?? []}
              disabled={!district} allLabel="All towns / cities" onChange={setTown} />
            <Text style={styles.hint}>Locations from the Punjab district and town list. Filters match the listing’s saved location.</Text>
            <View style={styles.resultsRow}>
              <Text style={styles.count}>{query.isPending ? "Loading listings…" : query.isError ? "Unable to load listings" : `${listings.length} available`}</Text>
              {!!district && <Pressable accessibilityRole="button" onPress={clear} style={{ padding: 8 }}><Text style={styles.action}>Clear filters</Text></Pressable>}
            </View>
          </View>
        ) : null}
        ListEmptyComponent={
          !valid ? <Text style={styles.empty}>This category is not available.</Text> :
          query.isPending ? <ActivityIndicator size="large" color={C.tint} style={{ margin: 32 }} /> :
          query.isError ? <View style={styles.emptyBox}>
            <Text style={styles.empty}>Could not load listings. Check your connection and try again.</Text>
            <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.retry}><Text style={styles.action}>Try again</Text></Pressable>
          </View> :
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={32} color={C.textSecondary} />
            <Text style={styles.empty}>No available {type.toLowerCase()} listings{town ? ` in ${town}` : district ? ` in ${district}` : ""}.</Text>
            {!!district && <Pressable accessibilityRole="button" onPress={clear} style={styles.retry}><Text style={styles.action}>View all locations</Text></Pressable>}
          </View>
        } />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HomeVisual.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 20 },
  back: { padding: 10 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.card },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.card, marginTop: 4 },
  filters: { gap: 14, marginBottom: 16 },
  filterTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginTop: 4 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  resultsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  action: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.tint },
  emptyBox: { alignItems: "center", paddingVertical: 28, gap: 12 },
  empty: { textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 15, color: C.textSecondary, lineHeight: 23, padding: 12 },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 20 },
});
