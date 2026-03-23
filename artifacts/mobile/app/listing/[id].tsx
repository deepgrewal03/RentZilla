import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StarRating } from "@/components/StarRating";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Listing, Review } from "@/types";

const C = Colors.light;

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { get, post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking flow
  const [showBooking, setShowBooking] = useState(false);
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date(Date.now() + 86400000)));
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);

  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [l, r] = await Promise.all([
        get<Listing>(`/listings/${id}`),
        get<Review[]>(`/reviews?listingId=${id}`),
      ]);
      setListing(l);
      setReviews(r);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleBook() {
    if (!listing) return;
    setBooking(true);
    try {
      await post("/bookings", { listingId: listing.id, startDate, endDate, notes });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Booking Sent!", "Your booking request has been sent to the provider.", [
        { text: "View Bookings", onPress: () => router.push("/(tabs)/bookings") },
        { text: "OK" },
      ]);
      setShowBooking(false);
    } catch {
      Alert.alert("Error", "Could not create booking. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBooking(false);
    }
  }

  async function handleChat() {
    if (!listing) return;
    try {
      const chat = await post<{ id: string }>("/chats/start", {
        providerId: listing.providerId,
        listingId: listing.id,
      });
      router.push({ pathname: "/chat/[id]", params: { id: chat.id } });
    } catch {
      Alert.alert("Error", "Could not start chat.");
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>Listing not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const totalDays = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const total = listing.price * totalDays;
  const isOwner = user?.id === listing.providerId;
  const isCustomer = user?.role === "customer";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Images */}
        <View style={styles.imageContainer}>
          {listing.images?.length > 0 ? (
            <>
              <Image source={{ uri: listing.images[activeImage] }} style={styles.mainImage} contentFit="cover" />
              {listing.images.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
                  {listing.images.map((img, i) => (
                    <Pressable key={i} onPress={() => setActiveImage(i)}>
                      <Image
                        source={{ uri: img }}
                        style={[styles.thumb, activeImage === i && styles.thumbActive]}
                        contentFit="cover"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder]}>
              <Ionicons name="cube-outline" size={48} color={C.textTertiary} />
            </View>
          )}
          {/* Back button */}
          <Pressable onPress={() => router.back()} style={[styles.backCircle, { top: (isWeb ? 67 : insets.top) + 12 }]}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title & price */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{listing.title}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={C.textSecondary} />
                <Text style={styles.location}>{listing.location}</Text>
              </View>
            </View>
            {!listing.isAvailable && (
              <View style={styles.unavailBadge}>
                <Text style={styles.unavailText}>Unavailable</Text>
              </View>
            )}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{listing.price.toLocaleString("en-IN")}</Text>
            <Text style={styles.priceUnit}>/{listing.priceUnit === "per_day" ? "day" : "hour"}</Text>
          </View>

          {/* Rating */}
          {listing.rating != null && (
            <View style={styles.ratingRow}>
              <StarRating rating={Math.round(listing.rating)} size={16} />
              <Text style={styles.ratingText}>{listing.rating.toFixed(1)} ({listing.reviewCount} reviews)</Text>
            </View>
          )}

          {/* Description */}
          {listing.description && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          )}

          {/* Provider */}
          <View style={styles.providerCard}>
            <View style={styles.providerAvatar}>
              <Text style={styles.providerAvatarText}>{(listing.providerName || "P")[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerName}>{listing.providerName || "Provider"}</Text>
              {listing.providerRating != null && (
                <View style={styles.providerRating}>
                  <Ionicons name="star" size={12} color={C.gold} />
                  <Text style={styles.providerRatingText}>{listing.providerRating.toFixed(1)} · {listing.providerReviewCount} reviews</Text>
                </View>
              )}
            </View>
            {!isOwner && (
              <Pressable onPress={handleChat} style={styles.msgBtn}>
                <Ionicons name="chatbubble-outline" size={18} color={C.tint} />
              </Pressable>
            )}
          </View>

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={styles.reviewSection}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              {reviews.slice(0, 3).map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{(r.userName || "U")[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewUser}>{r.userName || "User"}</Text>
                      <StarRating rating={r.rating} size={12} />
                    </View>
                    <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString("en-IN")}</Text>
                  </View>
                  {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Booking form */}
          {showBooking && isCustomer && (
            <View style={styles.bookingForm}>
              <Text style={styles.sectionTitle}>Book This Listing</Text>
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={C.textTertiary}
                  />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={C.textTertiary}
                  />
                </View>
              </View>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Special requirements (optional)"
                placeholderTextColor={C.textTertiary}
                multiline
                numberOfLines={3}
              />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{totalDays} day(s) × ₹{listing.price.toLocaleString("en-IN")}</Text>
                <Text style={styles.totalAmount}>₹{total.toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.formActions}>
                <Pressable onPress={() => setShowBooking(false)} style={styles.cancelFormBtn}>
                  <Text style={styles.cancelFormText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleBook} disabled={booking} style={styles.confirmBookBtn}>
                  {booking ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBookText}>Confirm Booking</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom actions */}
      {!isOwner && listing.isAvailable && isCustomer && !showBooking && (
        <View style={[styles.bottomBar, { paddingBottom: (isWeb ? 34 : insets.bottom) + 12 }]}>
          <View>
            <Text style={styles.bottomPrice}>₹{listing.price.toLocaleString("en-IN")}</Text>
            <Text style={styles.bottomUnit}>per {listing.priceUnit === "per_day" ? "day" : "hour"}</Text>
          </View>
          <Pressable onPress={() => { Haptics.selectionAsync(); setShowBooking(true); }} style={styles.bookNowBtn}>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.bookNowText}>Book Now</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  center: { alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  imageContainer: { position: "relative" },
  mainImage: { width: "100%", height: 280 },
  imagePlaceholder: { backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center" },
  thumbScroll: { position: "absolute", bottom: 10, paddingHorizontal: 12 },
  thumb: { width: 56, height: 44, borderRadius: 8, marginRight: 8, borderWidth: 2, borderColor: "transparent" },
  thumbActive: { borderColor: C.tint },
  backCircle: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  title: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, flex: 1, lineHeight: 28 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  location: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  unavailBadge: { backgroundColor: C.error, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  unavailText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginBottom: 10 },
  price: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  priceUnit: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  ratingText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  descSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, marginBottom: 10 },
  description: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 22 },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    gap: 12,
    marginBottom: 20,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${C.tint}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  providerAvatarText: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  providerName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  providerRating: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  providerRatingText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  msgBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${C.tint}15`,
    alignItems: "center", justifyContent: "center",
  },
  reviewSection: { marginBottom: 20 },
  reviewCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
  },
  reviewAvatarText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  reviewUser: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  reviewDate: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  reviewComment: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bookingForm: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1, gap: 4 },
  dateLabel: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  dateInput: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  notesInput: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
    minHeight: 70,
    textAlignVertical: "top",
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 },
  totalLabel: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  totalAmount: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  formActions: { flexDirection: "row", gap: 10 },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
  },
  cancelFormText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  confirmBookBtn: {
    flex: 2,
    backgroundColor: C.tint,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBookText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  bottomBar: {
    backgroundColor: C.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  bottomPrice: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  bottomUnit: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  bookNowBtn: {
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  bookNowText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  errorText: { fontSize: 16, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  backBtn: {
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 12,
  },
  backBtnText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
