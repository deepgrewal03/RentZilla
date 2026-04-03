import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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

import { BookingStatusBadge } from "@/components/BookingStatusBadge";
import { StarRating } from "@/components/StarRating";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Booking } from "@/types";

const C = Colors.light;

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { get, post, put } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => {
    loadBooking();
  }, [id]);

  async function loadBooking() {
    try {
      const data = await get<Booking>(`/bookings/${id}`);
      setBooking(data);
      // Check if the current user already reviewed this booking
      if (data.status === "completed") {
        try {
          const reviews = await get<{ bookingId: string }[]>(`/reviews?bookingId=${id}`);
          setHasReview(reviews.length > 0);
        } catch {
          setHasReview(false);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking() {
    if (!booking) return;
    Alert.alert("Cancel Booking", "Are you sure?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await put(`/bookings/${booking.id}`, { status: "cancelled" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadBooking();
          } catch {}
        },
      },
    ]);
  }

  async function simulatePay() {
    if (!booking) return;
    try {
      await put(`/bookings/${booking.id}`, { status: "confirmed", paymentStatus: "paid" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Payment Success", "Your booking is now confirmed!");
      loadBooking();
    } catch {}
  }

  async function submitReview() {
    if (!booking) return;
    setSubmitting(true);
    try {
      await post("/reviews", {
        providerId: booking.providerId,
        listingId: booking.listingId,
        bookingId: booking.id,
        rating,
        comment,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Review Submitted", "Thank you for your feedback!");
      setShowReview(false);
      setHasReview(true);
    } catch (e: any) {
      const msg = e?.message?.includes("409") || e?.message?.includes("already")
        ? "You have already reviewed this booking."
        : "Could not submit review. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>Booking not found</Text>
      </View>
    );
  }

  const isCustomer = user?.id === booking.customerId;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 10 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Booking Details</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          {booking.listingImage ? (
            <Image source={{ uri: booking.listingImage }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Ionicons name="cube-outline" size={40} color={C.textTertiary} />
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>{booking.listingTitle}</Text>
            <BookingStatusBadge status={booking.status} />
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailCard}>
          {booking.bookingDate ? (
            <InfoRow
              icon="calendar-outline"
              label="Booking Date"
              value={new Date(booking.bookingDate).toLocaleDateString("en-IN", { dateStyle: "long" })}
            />
          ) : (
            <>
              <InfoRow icon="calendar-outline" label="Start Date" value={new Date(booking.startDate).toLocaleDateString("en-IN", { dateStyle: "long" })} />
              <InfoRow icon="calendar" label="End Date" value={new Date(booking.endDate).toLocaleDateString("en-IN", { dateStyle: "long" })} />
            </>
          )}
          {booking.timeSlot ? (
            <>
              <InfoRow icon="time-outline" label="Time Slot" value={booking.timeSlot} />
              <InfoRow icon="hourglass-outline" label="Duration" value="1 hour" />
            </>
          ) : (
            <InfoRow icon="time-outline" label="Duration" value={`${booking.totalDays} day${booking.totalDays > 1 ? "s" : ""}`} />
          )}
          <InfoRow icon="cash-outline" label="Base Amount" value={`₹${(booking as any).totalAmount?.toLocaleString("en-IN") ?? "—"}`} />
          {(booking as any).serviceFee > 0 && (
            <InfoRow icon="shield-checkmark-outline" label="Service Fee" value={`₹${(booking as any).serviceFee.toLocaleString("en-IN")}`} />
          )}
          {Array.isArray((booking as any).extraCharges) && (booking as any).extraCharges.map((c: any, i: number) => (
            <InfoRow key={i} icon="add-circle-outline" label={c.label || "Extra Charge"} value={`₹${Number(c.amount).toLocaleString("en-IN")}`} sub={c.description || undefined} />
          ))}
          {(booking as any).discountAmount > 0 && (
            <InfoRow icon="pricetag-outline" label={`Promo${(booking as any).promoCode ? ` (${(booking as any).promoCode})` : ""}`} value={`-₹${(booking as any).discountAmount.toLocaleString("en-IN")}`} />
          )}
          <InfoRow icon="wallet-outline" label="Total Payable" value={`₹${((booking as any).finalAmount || (booking as any).totalAmount || 0).toLocaleString("en-IN")}`} highlight />
          <InfoRow icon="card-outline" label="Payment" value={booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)} />
          {isCustomer ? (
            <InfoRow icon="person-outline" label="Provider" value={`${booking.customerName || "Provider"}`} />
          ) : (
            <InfoRow icon="person-outline" label="Customer" value={`${booking.customerName || "Customer"} · ${booking.customerPhone}`} />
          )}
          {booking.serviceType && <InfoRow icon="options-outline" label="Service Type" value={booking.serviceType} />}
          {booking.notes && <InfoRow icon="document-text-outline" label="Notes" value={booking.notes} />}
        </View>

        {/* Review form */}
        {showReview && (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>Leave a Review</Text>
            <StarRating rating={rating} size={32} interactive onRate={setRating} />
            <TextInput
              style={styles.reviewInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Share your experience..."
              placeholderTextColor={C.textTertiary}
              multiline
              numberOfLines={4}
            />
            <View style={styles.reviewActions}>
              <Pressable onPress={() => setShowReview(false)} style={styles.cancelReviewBtn}>
                <Text style={styles.cancelReviewText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitReview} disabled={submitting} style={styles.submitReviewBtn}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitReviewText}>Submit</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {isCustomer && booking.status === "pending" && (
            <Pressable onPress={simulatePay} style={styles.payBtn}>
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={styles.payBtnText}>Pay via UPI (Mock)</Text>
            </Pressable>
          )}
          {isCustomer && booking.status === "completed" && !showReview && (
            hasReview ? (
              <View style={styles.reviewedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                <Text style={styles.reviewedBadgeText}>Review Submitted</Text>
              </View>
            ) : (
              <Pressable onPress={() => { Haptics.selectionAsync(); setShowReview(true); }} style={styles.reviewBtn}>
                <Ionicons name="star-outline" size={18} color={C.tint} />
                <Text style={styles.reviewBtnText}>Leave a Review</Text>
              </Pressable>
            )
          )}
          {(booking.status === "pending" || booking.status === "confirmed") && (
            <Pressable onPress={cancelBooking} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel Booking</Text>
            </Pressable>
          )}
        </View>

        <View style={{ height: isWeb ? 34 : 60 }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, highlight, sub }: { icon: string; label: string; value: string; highlight?: boolean; sub?: string }) {
  const C = Colors.light;
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconWrap}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={C.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={infoStyles.label}>{label}</Text>
        {sub ? <Text style={infoStyles.sub}>{sub}</Text> : null}
      </View>
      <Text style={[infoStyles.value, highlight && { color: C.tint, fontFamily: "Inter_700Bold" }]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    gap: 12,
  },
  iconWrap: { width: 32, alignItems: "center" },
  label: { fontSize: 14, color: Colors.light.textSecondary, fontFamily: "Inter_400Regular" },
  sub: { fontSize: 11, color: Colors.light.textTertiary, fontFamily: "Inter_400Regular", marginTop: 2 },
  value: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: Colors.light.text },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  scroll: { flex: 1 },
  hero: {
    backgroundColor: C.backgroundSecondary,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  heroImage: { width: "100%", height: 160 },
  heroPlaceholder: { backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center" },
  heroInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  heroTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  detailCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginHorizontal: 20,
    marginTop: 14,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  reviewCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
    gap: 14,
  },
  reviewTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  reviewInput: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
    minHeight: 90,
    textAlignVertical: "top",
  },
  reviewActions: { flexDirection: "row", gap: 10 },
  cancelReviewBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
  },
  cancelReviewText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  submitReviewBtn: { flex: 2, backgroundColor: C.tint, borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  submitReviewText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  actions: { marginHorizontal: 20, marginTop: 16, gap: 10 },
  payBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  reviewBtn: {
    borderWidth: 2,
    borderColor: C.tint,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reviewBtnText: { color: C.tint, fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  reviewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#22C55E40",
  },
  reviewedBadgeText: { color: "#22C55E", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: C.error,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelBtnText: { color: C.error, fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 16, color: C.textSecondary, fontFamily: "Inter_400Regular" },
});
