import Button3D from "@/components/Button3D";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import { useRazorpay } from "@/hooks/useRazorpay";
import { Booking } from "@/types";
import RazorpayCheckout from "@/components/RazorpayCheckout";
import BookingPriceComparison from "@/components/BookingPriceComparison";
import BookingReferralPrompt from "@/components/BookingReferralPrompt";
import { bookingPrices } from "@/lib/bookingPrices";

const C = Colors.light;

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { get, post, put } = useApi();
  const { initiatePayment, checkout, loading: paymentLoading } = useRazorpay();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReferral, setShowReferral] = useState(false);
  const promptedBookings = useRef(new Set<string>());
  const [showReview, setShowReview] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Per-service pricing breakdown (fetched from pricing API when serviceTypes > 1)
  const [svcPrices, setSvcPrices] = useState<Record<string, number>>({});

  // ── Provider: open/complete job ────────────────────────────────────────────
  const [providerServiceFee, setProviderServiceFee] = useState("");
  const [providerExtraCharges, setProviderExtraCharges] = useState<
    { id: string; label: string; amount: string; description: string }[]
  >([]);
  const [completing, setCompleting] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => {
    loadBooking();
  }, [id]);

  async function loadBooking() {
    try {
      const data = await get<Booking>(`/bookings/${id}`);
      setBooking(data);
      // Fetch per-service pricing if multiple service types are present
      const bAnyData = data as any;
      const svcTypes: string[] = bAnyData.serviceTypes ?? [];
      if (svcTypes.length > 1 && bAnyData.listingCategory && bAnyData.listingSubcategory) {
        const numDays = bAnyData.totalDays ?? 1;
        const isHourly = bAnyData.listingCategory === "cars";
        const numHours = bAnyData.timeSlots?.length ?? 1;
        try {
          const entries = await Promise.all(
            svcTypes.map(async (svc) => {
              const params = new URLSearchParams({
                category: bAnyData.listingCategory,
                subcategory: bAnyData.listingSubcategory,
                hours: isHourly ? String(numHours) : "0",
                days: isHourly ? "0" : String(numDays),
                distance_km: "0",
                service_type: svc,
              });
              try {
                const r = await get<{ found: boolean; customer_price: number }>(`/pricing/calculate?${params.toString()}`);
                return [svc, r.found ? r.customer_price : 0] as [string, number];
              } catch { return [svc, 0] as [string, number]; }
            })
          );
          const priceMap = Object.fromEntries(entries.filter(([, v]) => v > 0));
          setSvcPrices(priceMap);
        } catch { /* non-critical */ }
      }
      // Check if the current user already reviewed this booking
      if (data.status === "completed") {
        try {
          const reviews = await get<{ bookingId: string }[]>(`/reviews?bookingId=${id}`);
          setHasReview(reviews.length > 0);
        } catch {
          setHasReview(false);
        }
      }
    } catch (err) {
      console.error("loadBooking error", err);
      Alert.alert("Error", "Could not load booking details. Please try again.");
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

  async function payBooking() {
    if (!booking) return;
    await initiatePayment({
      purpose: "booking_payment",
      bookingId: booking.id,
      description: `Payment for ${booking.listingTitle || "booking"}`,
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!promptedBookings.current.has(booking.id)) {
          promptedBookings.current.add(booking.id);
          setShowReferral(true);
        }
        loadBooking();
      },
      onError: (message) => {
        Alert.alert("Payment Not Verified", message || "No paid booking was created. Please retry.");
        loadBooking();
      },
      onDismiss: () => {
        Alert.alert("Payment Cancelled", "The booking is still unpaid. No charge was applied.");
      },
    });
  }

  async function viewInvoice() {
    if (!booking) return;
    try {
      const invoice = await get<{
        invoiceNumber: string;
        listingTitle: string;
        customerName: string;
        paymentId: string;
        currency: string;
        subtotal: number;
        discountAmount: number;
        totalAmount: number;
        issuedAt: string;
      }>(`/bookings/${booking.id}/invoice`);
      const text = [
        `RentZilla Invoice ${invoice.invoiceNumber}`,
        invoice.listingTitle || booking.listingTitle || "Booking",
        `Issued: ${new Date(invoice.issuedAt).toLocaleString("en-IN")}`,
        `Subtotal: ₹${invoice.subtotal.toLocaleString("en-IN")}`,
        `Discount: ₹${invoice.discountAmount.toLocaleString("en-IN")}`,
        `Paid: ₹${invoice.totalAmount.toLocaleString("en-IN")}`,
        `Transaction: ${invoice.paymentId}`,
      ].join("\n");
      Alert.alert("Transaction Invoice", text, [
        { text: "Close", style: "cancel" },
        { text: "Share / Save", onPress: () => { void Share.share({ title: invoice.invoiceNumber, message: text }); } },
      ]);
    } catch (e: any) {
      Alert.alert("Invoice Unavailable", e?.message || "Could not open this invoice.");
    }
  }


  // ── Provider: accept a pending booking ───────────────────────────────────
  async function acceptBooking() {
    if (!booking) return;
    Alert.alert("Accept Booking", "Accept this booking request?", [
      { text: "No", style: "cancel" },
      {
        text: "Accept",
        onPress: async () => {
          try {
            await post(`/bookings/${booking.id}/accept`, {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Booking Accepted", "The customer has been notified.");
            loadBooking();
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Could not accept booking.");
          }
        },
      },
    ]);
  }

  // ── Provider: reject a pending booking ───────────────────────────────────
  async function rejectBooking() {
    if (!booking) return;
    Alert.alert(
      "Reject Booking",
      "This will notify the customer that you are unavailable. Continue?",
      [
        { text: "Go Back", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await post(`/bookings/${booking.id}/reject`, { reason: "Provider unavailable" });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert("Booking Rejected", "The customer has been notified.");
              loadBooking();
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not reject booking.");
            }
          },
        },
      ],
    );
  }

  async function completeJob() {
    if (!booking) return;
    setCompleting(true);
    try {
      const cleanedCharges = providerExtraCharges
        .filter(c => c.label.trim() && parseFloat(c.amount) > 0)
        .map(c => ({ label: c.label.trim(), amount: parseFloat(c.amount), description: c.description.trim() || undefined }));
      const data = await post<Booking>(`/bookings/${booking.id}/complete-job`, {
        serviceFee: parseFloat(providerServiceFee) || undefined,
        extraCharges: cleanedCharges.length > 0 ? cleanedCharges : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBooking(data as any);
      Alert.alert("Job Completed", "The booking has been marked as completed and the final amount has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not complete job.");
    } finally {
      setCompleting(false);
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
  const isProvider = user?.id === booking.providerId;
  const bAny = booking as any;
  const savedTotal = Number(bAny.finalAmount ?? booking.totalAmount);
  const savedGold = Number(bAny.goldDiscountAmount ?? 0);
  const hypotheticalSaving = bookingPrices(Number(booking.totalAmount), Number(bAny.promoDiscountAmount ?? bAny.discountAmount ?? 0)).saving;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <BookingReferralPrompt visible={showReferral}
        onClose={() => setShowReferral(false)}
        onRefer={() => { setShowReferral(false); router.push("/referral"); }} />
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
            <View>
              <Image source={{ uri: booking.listingImage }} style={styles.heroImage} contentFit="cover" />
              {booking.listingCategory === "cars" && (
                <View style={styles.frontViewBadge}>
                  <Ionicons name="car-outline" size={12} color="#fff" />
                  <Text style={styles.frontViewText}>Front View · Number Plate</Text>
                </View>
              )}
            </View>
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
          {/* Category / subcategory chip */}
          {(bAny.listingSubcategory || bAny.listingCategory) && (
            <View style={detailStyles.categoryChip}>
              <Text style={detailStyles.categoryChipText}>
                {bAny.listingSubcategory || bAny.listingCategory}
              </Text>
            </View>
          )}

          {/* Date */}
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

          {/* Duration: multi-slot time display */}
          {(() => {
            const slots: string[] = bAny.timeSlots && Array.isArray(bAny.timeSlots) && bAny.timeSlots.length > 0
              ? bAny.timeSlots
              : bAny.timeSlot ? [bAny.timeSlot] : [];
            if (slots.length > 0) {
              const hrs = slots.length;
              return (
                <>
                  <InfoRow
                    icon="time-outline"
                    label={`Time Slot${slots.length > 1 ? "s" : ""}`}
                    value={slots.length === 1
                      ? slots[0]
                      : `${slots[0]} … +${slots.length - 1} more`}
                    sub={slots.length > 1 ? slots.join(" · ") : undefined}
                  />
                  <InfoRow
                    icon="hourglass-outline"
                    label="Duration"
                    value={`${hrs} hour${hrs > 1 ? "s" : ""}`}
                  />
                </>
              );
            } else {
              const days = booking.totalDays || 1;
              return (
                <InfoRow
                  icon="hourglass-outline"
                  label="Duration"
                  value={`${days} day${days > 1 ? "s" : ""}`}
                />
              );
            }
          })()}

          {/* Location */}
          {bAny.location && (
            <InfoRow icon="location-outline" label="Service Location" value={bAny.location} />
          )}

          {/* Per-service price breakdown (when multiple service types) */}
          {Object.keys(svcPrices).length > 0 && (bAny.serviceTypes as string[]).map((svc: string) => {
            const price = svcPrices[svc];
            if (!price) return null;
            const days = bAny.totalDays ?? 1;
            return (
              <InfoRow
                key={svc}
                icon="construct-outline"
                label={svc}
                value={`₹${price.toLocaleString("en-IN")}`}
                sub={`${days} day${days > 1 ? "s" : ""}`}
              />
            );
          })}

          {/* Price breakdown */}
          <InfoRow icon="cash-outline" label="Subtotal" value={`₹${Number(booking.totalAmount).toLocaleString("en-IN")}`} />
          {bAny.serviceFee > 0 && (
            <InfoRow icon="shield-checkmark-outline" label="Service Fee" value={`₹${Number(bAny.serviceFee).toLocaleString("en-IN")}`} />
          )}
          {Array.isArray(bAny.extraCharges) && bAny.extraCharges.map((c: any, i: number) => (
            <InfoRow key={i} icon="add-circle-outline" label={c.label || "Extra Charge"} value={`₹${Number(c.amount).toLocaleString("en-IN")}`} sub={c.description || undefined} />
          ))}
          {/* Promo discount */}
          {bAny.promoDiscountAmount > 0 && (
            <InfoRow
              icon="pricetag-outline"
              label={bAny.promoCode ? `Promo (${bAny.promoCode})` : "Promo Discount"}
              value={`-₹${Number(bAny.promoDiscountAmount).toLocaleString("en-IN")}`}
            />
          )}
          {/* Gold membership discount */}
          {bAny.goldDiscountAmount > 0 && (
            <InfoRow
              icon="star-outline"
              label="Gold Membership (-4%)"
              value={`-₹${Number(bAny.goldDiscountAmount).toLocaleString("en-IN")}`}
            />
          )}
          {/* If only total discount shown (legacy bookings) */}
          {bAny.discountAmount > 0 && !bAny.promoDiscountAmount && !bAny.goldDiscountAmount && (
            <InfoRow
              icon="pricetag-outline"
              label={bAny.promoCode ? `Discount (${bAny.promoCode})` : "Discount"}
              value={`-₹${Number(bAny.discountAmount).toLocaleString("en-IN")}`}
            />
          )}
          {isCustomer && <BookingPriceComparison
            normal={savedTotal + savedGold}
            gold={bAny.goldDiscountApplied ? savedTotal : Math.max(0, savedTotal - hypotheticalSaving)}
            active={!!bAny.goldDiscountApplied} historical />}
          <InfoRow
            icon="wallet-outline"
            label="Total Payable"
            value={`₹${savedTotal.toLocaleString("en-IN")}`}
            highlight
          />
          <InfoRow
            icon="card-outline"
            label="Payment"
            value={booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
          />
          {isProvider && booking.status === "completed" && Number(bAny.providerEarning) > 0 && (
            <InfoRow
              icon="cash-outline"
              label="Your Earning (wallet)"
              value={`₹${Number(bAny.providerEarning).toLocaleString("en-IN")}`}
              highlight
            />
          )}
          {isCustomer ? (
            <InfoRow icon="person-outline" label="Provider" value={booking.providerName || "Provider"} />
          ) : (
            <InfoRow icon="person-outline" label="Customer" value={`${booking.customerName || "Customer"} · ${booking.customerPhone}`} />
          )}
          {(bAny.serviceTypes?.length > 1 ? bAny.serviceTypes : null) && (
            <InfoRow icon="options-outline" label="Service Types" value={(bAny.serviceTypes as string[]).join(", ")} />
          )}
          {booking.serviceType && !(bAny.serviceTypes?.length > 1) && (
            <InfoRow icon="options-outline" label="Service Type" value={booking.serviceType} />
          )}
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
              <Button3D onPress={() => setShowReview(false)} faceStyle={styles.cancelReviewBtn}>
                <Text style={styles.cancelReviewText}>Cancel</Text>
              </Button3D>
              <Button3D onPress={submitReview} disabled={submitting} faceStyle={styles.submitReviewBtn}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitReviewText}>Submit</Text>}
              </Button3D>
            </View>
          </View>
        )}


        {/* Actions */}
        <View style={styles.actions}>
          {/* Customer actions */}
          {isCustomer && booking.paymentStatus !== "paid" && booking.status !== "cancelled" && (
            <Button3D onPress={payBooking} disabled={paymentLoading} faceStyle={styles.payBtn}>
              {paymentLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="card-outline" size={19} color="#fff" />
                    <Text style={styles.payBtnText}>Pay Securely</Text>
                  </>}
            </Button3D>
          )}
          {isCustomer && booking.paymentStatus === "paid" && (
            <Button3D onPress={viewInvoice} faceStyle={styles.invoiceBtn}>
              <Ionicons name="receipt-outline" size={19} color={C.tint} />
              <Text style={styles.invoiceBtnText}>View or Save Invoice</Text>
            </Button3D>
          )}
          {isCustomer && booking.status === "completed" && !showReview && (
            hasReview ? (
              <View style={styles.reviewedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                <Text style={styles.reviewedBadgeText}>Review Submitted</Text>
              </View>
            ) : (
              <Button3D onPress={() => { Haptics.selectionAsync(); setShowReview(true); }} faceStyle={styles.reviewBtn}>
                <Ionicons name="star-outline" size={18} color={C.tint} />
                <Text style={styles.reviewBtnText}>Leave a Review</Text>
              </Button3D>
            )
          )}

          {/* ── Provider: accept/reject for pending bookings ── */}
          {isProvider && booking.status === "pending" && booking.paymentStatus === "paid" && (
            <View style={styles.acceptRejectPanel}>
              <View style={styles.acceptRejectHeader}>
                <Ionicons name="notifications-outline" size={18} color="#D97706" />
                <Text style={styles.acceptRejectTitle}>New Booking Request</Text>
              </View>
              <Text style={styles.acceptRejectSub}>Accept or reject this booking request from the customer.</Text>
              <View style={styles.acceptRejectRow}>
                <Button3D onPress={rejectBooking} faceStyle={styles.rejectBtn}>
                  <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </Button3D>
                <Button3D onPress={acceptBooking} faceStyle={styles.acceptBtn}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </Button3D>
              </View>
            </View>
          )}

          {/* ── Provider: charges panel shown for confirmed & in-progress ── */}
          {isProvider && (booking.status === "confirmed" || booking.status === "in_progress" || booking.status === "accepted") && (
            <View style={styles.completePanel}>
              <View style={styles.completePanelHeader}>
                <Ionicons name="receipt-outline" size={18} color={C.tint} />
                <Text style={styles.completePanelTitle}>Complete Job & Add Charges</Text>
              </View>
              <Text style={styles.completePanelSub}>Add any service fee or extra charges before marking complete.</Text>

              {/* Service Fee */}
              <Text style={styles.completeFieldLabel}>Service Fee (optional)</Text>
              <View style={styles.completeInputRow}>
                <Text style={styles.completeRupee}>₹</Text>
                <TextInput
                  style={styles.completeInput}
                  value={providerServiceFee}
                  onChangeText={v => setProviderServiceFee(v.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Extra Charges */}
              <Text style={[styles.completeFieldLabel, { marginTop: 14 }]}>Other Charges</Text>
              {providerExtraCharges.map((charge, idx) => (
                <View key={charge.id} style={styles.extraCard}>
                  <View style={styles.extraTopRow}>
                    <TextInput
                      style={[styles.completeInput, { flex: 2 }]}
                      value={charge.label}
                      onChangeText={v => { const u = [...providerExtraCharges]; u[idx] = { ...u[idx], label: v }; setProviderExtraCharges(u); }}
                      placeholder="Charge name"
                      placeholderTextColor={C.textTertiary}
                    />
                    <View style={styles.completeInputRow}>
                      <Text style={styles.completeRupee}>₹</Text>
                      <TextInput
                        style={[styles.completeInput, { flex: 1 }]}
                        value={charge.amount}
                        onChangeText={v => { const u = [...providerExtraCharges]; u[idx] = { ...u[idx], amount: v.replace(/[^0-9.]/g, "") }; setProviderExtraCharges(u); }}
                        placeholder="0"
                        placeholderTextColor={C.textTertiary}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Pressable onPress={() => setProviderExtraCharges(providerExtraCharges.filter((_, i) => i !== idx))} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color="#DC2626" />
                    </Pressable>
                  </View>
                  <View style={styles.extraDescRow}>
                    <Ionicons name="document-text-outline" size={13} color={C.textTertiary} />
                    <TextInput
                      style={styles.extraDescInput}
                      value={charge.description}
                      onChangeText={v => { const u = [...providerExtraCharges]; u[idx] = { ...u[idx], description: v }; setProviderExtraCharges(u); }}
                      placeholder="Description (optional)"
                      placeholderTextColor={C.textTertiary}
                      multiline
                    />
                  </View>
                </View>
              ))}

              <Button3D
                onPress={() => setProviderExtraCharges([...providerExtraCharges, { id: Date.now().toString(), label: "", amount: "", description: "" }])}
                faceStyle={styles.addExtraBtn}
              >
                <Ionicons name="add-circle-outline" size={16} color={C.tint} />
                <Text style={styles.addExtraBtnText}>Add Another Charge</Text>
              </Button3D>

              <Button3D onPress={completeJob} disabled={completing} faceStyle={styles.completeConfirmBtn}>
                {completing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.completeConfirmBtnText}>Mark as Complete</Text>
                  </>
                )}
              </Button3D>
            </View>
          )}

          {/* Cancel (both roles, only if not yet started) */}
          {(booking.status === "pending" || booking.status === "confirmed") && (
            <Button3D onPress={cancelBooking} faceStyle={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel Booking</Text>
            </Button3D>
          )}

          {/* Open / View Dispute (customer only, confirmed or completed) */}
          {user?.role !== "provider" && (booking.status === "confirmed" || booking.status === "completed") && (
            <Button3D
              onPress={() => router.push(`/dispute/${booking.id}` as any)}
              faceStyle={[styles.cancelBtn, {
                backgroundColor: booking.dispute_status === "resolved" ? "#D1FAE5"
                  : booking.dispute_status === "open" || booking.dispute_status === "under_review" ? "#FEF3C7"
                  : "#FFF7F0",
                borderColor: booking.dispute_status === "resolved" ? "#6EE7B7"
                  : booking.dispute_status === "open" || booking.dispute_status === "under_review" ? "#FDE68A"
                  : "#FDBA74",
                marginTop: 10,
              }]}
            >
              <Ionicons
                name={
                  booking.dispute_status === "resolved" ? "checkmark-circle-outline"
                  : booking.dispute_status === "open" || booking.dispute_status === "under_review" ? "time-outline"
                  : "alert-circle-outline"
                }
                size={16}
                color={
                  booking.dispute_status === "resolved" ? "#059669"
                  : booking.dispute_status === "open" || booking.dispute_status === "under_review" ? "#D97706"
                  : "#C2410C"
                }
              />
              <Text style={[styles.cancelBtnText, {
                color: booking.dispute_status === "resolved" ? "#059669"
                  : booking.dispute_status === "open" || booking.dispute_status === "under_review" ? "#D97706"
                  : "#C2410C",
              }]}>
                {booking.dispute_status === "resolved" ? "Dispute Resolved"
                  : booking.dispute_status === "open" ? "Dispute Open — View Thread"
                  : booking.dispute_status === "under_review" ? "Dispute Under Review"
                  : "Open a Dispute"}
              </Text>
            </Button3D>
          )}
        </View>

        <View style={{ height: isWeb ? 34 : 60 }} />
      </ScrollView>
      {checkout && <RazorpayCheckout {...checkout} />}
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

const detailStyles = StyleSheet.create({
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF3E9",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
  },
  categoryChipText: {
    fontSize: 12,
    color: "#FF7A18",
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    textTransform: "capitalize",
  },
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
  frontViewBadge: {
    position: "absolute", bottom: 8, left: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.62)", borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  frontViewText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
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
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 14, paddingVertical: 14, backgroundColor: C.tint,
  },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  invoiceBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: C.tint, borderRadius: 14, paddingVertical: 13,
    backgroundColor: "#FFF7F0",
  },
  invoiceBtnText: { color: C.tint, fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
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

  // Provider: open/complete job buttons
  openJobBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#059669", borderRadius: 14, paddingVertical: 13,
  },
  openJobBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  completeJobBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FF7A18", borderRadius: 14, paddingVertical: 13,
  },
  completeJobBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Complete job panel
  completePanel: {
    marginHorizontal: 20, marginTop: 4, marginBottom: 4,
    backgroundColor: "#fff", borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: "#E8E8E8",
  },
  completePanelHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  completePanelTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  completePanelSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, marginBottom: 14 },
  completeFieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#2C2C2C", marginBottom: 6 },
  completeInputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 2, backgroundColor: "#F9F9F9",
  },
  completeRupee: { fontSize: 15, color: "#FF7A18", fontFamily: "Inter_600SemiBold", marginRight: 4 },
  completeInput: {
    flex: 1, paddingVertical: 10, fontSize: 14,
    fontFamily: "Inter_500Medium", color: "#2C2C2C",
  },
  extraCard: {
    borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 10,
    backgroundColor: "#F9F9F9", marginBottom: 8, overflow: "hidden",
  },
  extraTopRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, paddingBottom: 6 },
  extraDescRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    borderTopWidth: 1, borderTopColor: "#EFEFEF", paddingHorizontal: 10, paddingVertical: 8,
  },
  extraDescInput: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#2C2C2C", minHeight: 16 },
  addExtraBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8, alignSelf: "flex-start", marginTop: 2,
  },
  addExtraBtnText: { color: "#FF7A18", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  completePanelBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  completeCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
  },
  completeCancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  completeConfirmBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#FF7A18", borderRadius: 12, paddingVertical: 12,
  },
  completeConfirmBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  errorText: { fontSize: 16, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  acceptRejectPanel: {
    marginHorizontal: 20, marginTop: 4, marginBottom: 4,
    backgroundColor: "#FFFBEB", borderRadius: 16, padding: 18,
    borderWidth: 1.5, borderColor: "#FDE68A",
  },
  acceptRejectHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  acceptRejectTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#92400E" },
  acceptRejectSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#78350F", marginBottom: 16 },
  acceptRejectRow: { flexDirection: "row", gap: 12 },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: "#DC2626", borderRadius: 12, paddingVertical: 12,
    backgroundColor: "#FEF2F2",
  },
  rejectBtnText: { color: "#DC2626", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  acceptBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#059669", borderRadius: 12, paddingVertical: 12,
  },
  acceptBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
