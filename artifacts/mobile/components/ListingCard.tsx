import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef } from "react";
import Button3D from "@/components/Button3D";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import HomeVisual from "@/constants/homeVisualTokens";
import { useFavorites } from "@/context/FavoritesContext";
import { Listing } from "@/types";

const C = Colors.light;

function getCategoryIcon(category: string, subcategory?: string | null) {
  if (category === "cars") return { name: "car-outline", lib: "ion" };
  if (category === "equipment") {
    if (subcategory?.toLowerCase().includes("tractor")) return { name: "tractor", lib: "mci" };
    return { name: "hammer-outline", lib: "ion" };
  }
  if (category === "services") return { name: "construct-outline", lib: "ion" };
  return { name: "cube-outline", lib: "ion" };
}

function getCategoryAccent(category: string) {
  if (category === "cars")      return { bg: "#FFF0E1", fg: HomeVisual.orange };
  if (category === "equipment") return { bg: HomeVisual.greenSoft, fg: HomeVisual.green };
  if (category === "services")  return { bg: HomeVisual.blueSoft, fg: "#2789A5" };
  return { bg: "#FFF0E1", fg: HomeVisual.orange };
}

function formatPrice(price: number, unit: string) {
  return `₹${price.toLocaleString("en-IN")}${unit === "per_hour" ? "/hr" : "/day"}`;
}

interface Props {
  listing: Listing;
  style?: object;
  isCustomer?: boolean;
}

const SPRING = { useNativeDriver: false, tension: 340, friction: 12 };

export function ListingCard({ listing, style, isCustomer }: Props) {
  const icon   = getCategoryIcon(listing.category, listing.subcategory);
  const accent = getCategoryAccent(listing.category);
  const hasImg = listing.images && listing.images.length > 0;

  const { isFavorited, toggle } = useFavorites();
  const faved = isFavorited(listing.id);

  const scale      = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const bookScale  = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, ...SPRING }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, ...SPRING }).start();
  }

  function handleFavorite() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: false, tension: 400, friction: 8 }),
      Animated.spring(heartScale, { toValue: 1,    useNativeDriver: false, tension: 400, friction: 10 }),
    ]).start();
    toggle(listing.id);
  }

  function handleBookNow() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(bookScale, { toValue: 0.94, useNativeDriver: false, tension: 400, friction: 8 }),
      Animated.spring(bookScale, { toValue: 1,    useNativeDriver: false, tension: 400, friction: 10 }),
    ]).start(() => {
      router.push({ pathname: "/new-booking/[id]", params: { id: listing.id } });
    });
  }

  const showBookBtn = isCustomer && listing.isAvailable;

  return (
    <Animated.View style={[styles.card, style, { transform: [{ scale }] }]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          router.push({ pathname: "/listing/[id]", params: { id: listing.id } });
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Image */}
        <View style={styles.imgWrap}>
          {hasImg ? (
            <Image source={{ uri: listing.images[0] }} style={styles.img} contentFit="cover" />
          ) : (
            <View style={[styles.img, styles.imgPlaceholder, { backgroundColor: accent.bg }]}>
              <View style={[styles.iconCircle, { backgroundColor: `${accent.fg}18` }]}>
                {icon.lib === "ion"
                  ? <Ionicons name={icon.name as any} size={28} color={accent.fg} />
                  : <MaterialCommunityIcons name={icon.name as any} size={28} color={accent.fg} />
                }
              </View>
            </View>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", "rgba(28,35,24,0.28)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.imageShade}
          />

          {/* Unavailable overlay */}
          {!listing.isAvailable && (
            <View style={styles.unavailBadge}>
              <Text style={styles.unavailText}>Unavailable</Text>
            </View>
          )}

          {/* Favorite heart button */}
          <Button3D
            onPress={handleFavorite}
            hitSlop={10}
            style={styles.heartBtn}
            color={faved ? "#FFF0F3" : "#FFFFFF"}
            edgeColor="#D2D6DF"
            radius={17}
            depth={3}
            haptics={false}
            clipFace={false}
            accessibilityLabel={faved ? "Remove from favourites" : "Add to favourites"}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <View style={[styles.heartBg, { backgroundColor: "#FFFFFF" }, faved && styles.heartBgActive]}>
                <Ionicons
                  name={faved ? "heart" : "heart-outline"}
                  size={18}
                  color={faved ? "#FF3B5C" : "#666"}
                />
              </View>
            </Animated.View>
          </Button3D>

          {/* Category label */}
          <View style={[styles.catLabel, { backgroundColor: `${accent.fg}DD` }]}>
            <Text style={styles.catLabelText}>{listing.subcategory || listing.category}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={[styles.info, showBookBtn && styles.infoWithBtn]}>
          <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={C.textTertiary} />
            <Text style={styles.location} numberOfLines={1}>{listing.location}</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.ratingRow}>
              {listing.rating != null ? (
                <>
                  <Ionicons name="star" size={13} color="#FFA000" />
                  <Text style={styles.rating}>{listing.rating.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>({listing.reviewCount})</Text>
                </>
              ) : (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
            </View>
            <View style={styles.quoteChip}>
              <Text style={styles.quoteChipText}>Get Quote</Text>
            </View>
          </View>

          <Text style={styles.providerText} numberOfLines={1}>by {listing.providerName || "Provider"}</Text>
        </View>
      </Pressable>

      {/* Book Now CTA — customers only, available listings only */}
      {showBookBtn && (
        <Animated.View style={[styles.bookBtnWrap, { transform: [{ scale: bookScale }] }]}>
          <Button3D
            onPress={handleBookNow}
            color="#FF7A18"
            edgeColor="#D16412"
            radius={12}
            depth={4}
            haptics={false}
            gradientColors={["#FF7A18", "#FF9F43"]}
            gradientStart={{ x: 0, y: 0 }}
            gradientEnd={{ x: 1, y: 0 }}
            faceStyle={styles.bookBtn}
            accessibilityLabel="Book Now"
          >
            <Ionicons name="calendar-outline" size={15} color="#fff" />
            <Text style={styles.bookBtnText}>Book Now</Text>
            <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.8)" />
          </Button3D>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HomeVisual.surface,
    borderRadius: 21,
    overflow: "hidden",
    shadowColor: HomeVisual.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.11,
    shadowRadius: 14,
    elevation: 3,
    borderWidth: 1,
    borderColor: HomeVisual.border,
  },

  imgWrap: { position: "relative" },
  img: { width: "100%", height: 178 },
  imgPlaceholder: { alignItems: "center", justifyContent: "center" },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  imageShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 72 },

  unavailBadge: {
    position: "absolute", top: 10, left: 10,
    backgroundColor: "#D65248", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  unavailText: { color: "#fff", fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold" },

  heartBtn: {
    position: "absolute", top: 12, right: 12,
    zIndex: 10,
  },
  heartBg: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  heartBgActive: {
    backgroundColor: "#FFF0F3",
  },

  catLabel: {
    position: "absolute", bottom: 11, left: 12,
    borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5,
  },
  catLabelText: { color: "#fff", fontSize: 10, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },

  info: { padding: 15, gap: 5 },
  infoWithBtn: { paddingBottom: 10 },
  title: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: HomeVisual.ink },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  location: { fontSize: 12, color: "#7A7A7A", fontFamily: "Inter_400Regular", flex: 1 },

  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  rating: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  ratingCount: { fontSize: 11, color: "#AEAEAE", fontFamily: "Inter_400Regular" },
  quoteChip: {
    backgroundColor: "#FFF1E5", paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "#F7D6B9",
  },
  quoteChipText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#FF7A18" },

  newBadge: { backgroundColor: "#E8F5E9", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  newBadgeText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2E7D32", letterSpacing: 0.5 },

  providerText: { fontSize: 11, color: "#AEAEAE", fontFamily: "Inter_400Regular" },

  bookBtnWrap: { paddingHorizontal: 15, paddingBottom: 15 },
  bookBtnPress: { borderRadius: 12, overflow: "hidden" },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: 14,
  },
  bookBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
