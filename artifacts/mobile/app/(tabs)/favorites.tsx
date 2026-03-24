import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
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
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";
import { Listing } from "@/types";

const C = Colors.light;

interface FavoritedListing extends Listing {
  favoriteId: string;
  favoritedAt: string;
}

export default function FavoritesScreen() {
  const { get, post } = useApi();
  const { t, language } = useLang();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const isPa = language === "pa";

  const [favorites, setFavorites] = useState<FavoritedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [])
  );

  async function fetchFavorites() {
    try {
      const data = await get<FavoritedListing[]>("/favorites");
      setFavorites(data.sort((a, b) => new Date(b.favoritedAt).getTime() - new Date(a.favoritedAt).getTime()));
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function removeFavorite(listingId: string) {
    Haptics.selectionAsync();
    await post("/favorites", { listingId });
    setFavorites((prev) => prev.filter((f) => f.id !== listingId));
  }

  const count = favorites.length;
  const countLabel = isPa
    ? `${count} ${count === 1 ? t.savedListings : t.savedListingsPlural}`
    : `${count} ${count === 1 ? t.savedListings : t.savedListingsPlural}`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <Text style={styles.headerTitle}>{t.favourites}</Text>
        <Text style={styles.headerSub}>{countLabel}</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFavorites(); }} tintColor={C.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerBox}><ActivityIndicator color={C.tint} size="large" /></View>
        ) : favorites.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="heart-outline" size={56} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>{t.noFavourites}</Text>
            <Text style={styles.emptyText}>{t.noFavouritesDesc}</Text>
            <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.browseBtn}>
              <Text style={styles.browseBtnText}>{t.browseListings}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {favorites.map((fav) => (
              <View key={fav.id} style={styles.favItem}>
                <ListingCard listing={fav} style={styles.card} />
                <Pressable onPress={() => removeFavorite(fav.id)} style={styles.removeBtn} hitSlop={8}>
                  <Ionicons name="heart" size={20} color={C.error} />
                </Pressable>
              </View>
            ))}
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
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 4,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  centerBox: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingTop: 80, paddingHorizontal: 40, gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  emptyText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  browseBtn: {
    backgroundColor: C.tint, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  browseBtnText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  list: { padding: 20, gap: 14 },
  favItem: { position: "relative" },
  card: {},
  removeBtn: {
    position: "absolute", top: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
});
