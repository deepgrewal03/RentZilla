import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
import {
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
import { SkeletonLoader } from "@/components/SkeletonLoader";
import Colors from "@/constants/colors";
import { useFavorites } from "@/context/FavoritesContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";
import { Listing } from "@/types";

const C = Colors.light;

interface FavoritedListing extends Listing {
  favoriteId: string;
  favoritedAt: string;
}

export default function FavoritesScreen() {
  const { get }            = useApi();
  const { refresh }        = useFavorites();
  const { t, language }    = useLang();
  const insets             = useSafeAreaInsets();
  const isWeb              = Platform.OS === "web";
  const isPa               = language === "pa";

  const [favorites, setFavorites] = useState<FavoritedListing[]>([]);
  const [loading, setLoading]     = useState(true);
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

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchFavorites(), refresh()]);
  }

  const count = favorites.length;
  const countLabel = `${count} ${count === 1 ? "saved item" : "saved items"}`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t.favourites}</Text>
            <Text style={styles.headerSub}>{countLabel}</Text>
          </View>
          <View style={styles.heartCircle}>
            <Ionicons name="heart" size={22} color="#FF3B5C" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.tint}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.list}>
            <SkeletonLoader width="100%" height={220} borderRadius={16} />
            <SkeletonLoader width="100%" height={220} borderRadius={16} />
            <SkeletonLoader width="100%" height={220} borderRadius={16} />
          </View>
        ) : favorites.length === 0 ? (
          <View style={styles.centerBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={48} color="#FF3B5C" />
            </View>
            <Text style={styles.emptyTitle}>{t.noFavourites}</Text>
            <Text style={styles.emptyText}>{t.noFavouritesDesc}</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/(tabs)/search");
              }}
              style={({ pressed }) => [styles.browseBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="search-outline" size={16} color="#fff" />
              <Text style={styles.browseBtnText}>{t.browseListings}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            <Text style={styles.listLabel}>Tap the heart on any card to remove it</Text>
            {favorites.map((fav) => (
              <ListingCard key={fav.id} listing={fav} />
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
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub:   { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", marginTop: 2 },
  heartCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  scroll: { flex: 1 },
  list: { padding: 20, gap: 14 },
  listLabel: {
    fontSize: 12,
    color: C.textTertiary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 4,
  },
  centerBox: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#FFF0F3",
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  emptyText: {
    fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 20,
  },
  browseBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 13,
    marginTop: 4,
  },
  browseBtnText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
