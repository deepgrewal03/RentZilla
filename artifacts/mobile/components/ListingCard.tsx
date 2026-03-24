import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import { Listing } from "@/types";

const C = Colors.light;
const ORANGE = "#FF7A18";

function getCategoryIcon(category: string, subcategory?: string | null) {
  if (category === "cars") return { name: "car-outline", lib: "ion" };
  if (category === "equipment") {
    if (subcategory?.toLowerCase().includes("tractor")) return { name: "tractor", lib: "mci" };
    return { name: "hammer-outline", lib: "ion" };
  }
  if (category === "services") return { name: "construct-outline", lib: "ion" };
  return { name: "cube-outline", lib: "ion" };
}

function getCategoryColor(category: string) {
  if (category === "cars") return { bg: "#FFF3E0", fg: ORANGE };
  if (category === "equipment") return { bg: "#E8F5E9", fg: "#2E7D32" };
  if (category === "services") return { bg: "#E0F7FA", fg: "#0284C7" };
  return { bg: `${ORANGE}15`, fg: ORANGE };
}

function formatPrice(price: number, unit: string) {
  const unitLabel = unit === "per_hour" ? "/hr" : "/day";
  return `₹${price.toLocaleString("en-IN")}${unitLabel}`;
}

interface Props {
  listing: Listing;
  style?: object;
}

export function ListingCard({ listing, style }: Props) {
  const icon   = getCategoryIcon(listing.category, listing.subcategory);
  const colors = getCategoryColor(listing.category);
  const hasImage = listing.images && listing.images.length > 0;

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/listing/[id]", params: { id: listing.id } }); }}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}
    >
      {/* Image */}
      <View style={styles.imageWrap}>
        {hasImage ? (
          <Image source={{ uri: listing.images[0] }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.bg }]}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.fg}18` }]}>
              {icon.lib === "ion" ? (
                <Ionicons name={icon.name as any} size={30} color={colors.fg} />
              ) : (
                <MaterialCommunityIcons name={icon.name as any} size={30} color={colors.fg} />
              )}
            </View>
          </View>
        )}

        {/* Availability badge */}
        {!listing.isAvailable && (
          <View style={styles.unavailBadge}>
            <Text style={styles.unavailText}>Unavailable</Text>
          </View>
        )}

        {/* Category chip */}
        <View style={[styles.catChip, { backgroundColor: `${colors.fg}E6` }]}>
          <Text style={styles.catChipText}>{listing.subcategory || listing.category}</Text>
        </View>

        {/* Rating overlay (if rated) */}
        {listing.rating != null && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#F5C842" />
            <Text style={styles.ratingBadgeText}>{listing.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={C.textTertiary} />
          <Text style={styles.location} numberOfLines={1}>{listing.location}</Text>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>{formatPrice(listing.price, listing.priceUnit)}</Text>
            <Text style={styles.provider} numberOfLines={1}>by {listing.providerName || "Provider"}</Text>
          </View>
          <View style={styles.bookBtn}>
            <Text style={styles.bookBtnText}>Book</Text>
            <Ionicons name="arrow-forward" size={12} color="#fff" />
          </View>
        </View>

        {listing.rating == null && (
          <View style={styles.newBadgeRow}>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.cardBorder,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },

  imageWrap: { position: "relative" },
  image: { width: "100%", height: 170 },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  iconCircle: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },

  unavailBadge: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: "#EF4444", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  unavailText: { color: "#fff", fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold" },

  catChip: {
    position: "absolute", bottom: 10, left: 10,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  catChipText: { color: "#fff", fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", textTransform: "capitalize" },

  ratingBadge: {
    position: "absolute", top: 10, left: 10,
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
  },
  ratingBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },

  info: { padding: 14, gap: 6 },
  title: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, lineHeight: 21 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  location: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular", flex: 1 },

  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  price: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  provider: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular", marginTop: 2 },
  bookBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: ORANGE, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  bookBtnText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },

  newBadgeRow: { flexDirection: "row" },
  newBadge: {
    backgroundColor: "#E8F5E9", borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  newBadgeText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2E7D32", letterSpacing: 0.5 },
});
