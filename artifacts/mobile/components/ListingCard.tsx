import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import { Listing } from "@/types";

const C = Colors.light;

function getCategoryIcon(category: string, subcategory?: string | null) {
  if (category === "cars") return { name: "car-outline", lib: "ion" };
  if (category === "equipment") {
    if (subcategory?.toLowerCase().includes("tractor")) return { name: "tractor", lib: "mci" };
    return { name: "tools", lib: "ion" };
  }
  if (category === "services") return { name: "briefcase-outline", lib: "ion" };
  return { name: "cube-outline", lib: "ion" };
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
  const icon = getCategoryIcon(listing.category, listing.subcategory);
  const hasImage = listing.images && listing.images.length > 0;

  function handlePress() {
    Haptics.selectionAsync();
    router.push({ pathname: "/listing/[id]", params: { id: listing.id } });
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {/* Image / Placeholder */}
      <View style={styles.imageContainer}>
        {hasImage ? (
          <Image source={{ uri: listing.images[0] }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <View style={styles.iconCircle}>
              {icon.lib === "ion" ? (
                <Ionicons name={icon.name as keyof typeof Ionicons.glyphMap} size={28} color={C.tint} />
              ) : (
                <MaterialCommunityIcons name={icon.name as keyof typeof MaterialCommunityIcons.glyphMap} size={28} color={C.tint} />
              )}
            </View>
          </View>
        )}
        {/* Availability badge */}
        {!listing.isAvailable && (
          <View style={styles.unavailableBadge}>
            <Text style={styles.unavailableBadgeText}>Unavailable</Text>
          </View>
        )}
        {/* Category chip */}
        <View style={styles.categoryChip}>
          <Text style={styles.categoryChipText}>{listing.subcategory || listing.category}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={C.textSecondary} />
          <Text style={styles.location} numberOfLines={1}>{listing.location}</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatPrice(listing.price, listing.priceUnit)}</Text>
          {listing.rating != null ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={C.gold} />
              <Text style={styles.rating}>{listing.rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({listing.reviewCount})</Text>
            </View>
          ) : (
            <Text style={styles.newBadge}>NEW</Text>
          )}
        </View>
        <Text style={styles.provider} numberOfLines={1}>by {listing.providerName || "Provider"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.cardBorder,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 160,
  },
  imagePlaceholder: {
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${C.tint}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  unavailableBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: C.error,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unavailableBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  categoryChip: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(15, 31, 61, 0.75)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryChipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  info: {
    padding: 12,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  location: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.tint,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  rating: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  reviewCount: {
    fontSize: 11,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  newBadge: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.success,
    letterSpacing: 0.5,
  },
  provider: {
    fontSize: 11,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
});
