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
import { useFavorites } from "@/context/FavoritesContext";
import { useApi } from "@/hooks/useApi";
import { Listing, Review } from "@/types";

const C = Colors.light;

const TINT = "#FF7A18";

const TIME_SLOTS = [
  "08:00 AM – 10:00 AM",
  "10:00 AM – 12:00 PM",
  "12:00 PM – 02:00 PM",
  "02:00 PM – 04:00 PM",
  "04:00 PM – 06:00 PM",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBefore(a: Date, b: Date) {
  return a.getFullYear() < b.getFullYear() ||
    (a.getFullYear() === b.getFullYear() && a.getMonth() < b.getMonth()) ||
    (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() < b.getDate());
}

interface CalendarProps {
  selected: string;
  onSelect: (dateStr: string) => void;
}

function MiniCalendar({ selected, onSelect }: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  return (
    <View style={cal.root}>
      <View style={cal.header}>
        <Pressable onPress={prevMonth} disabled={!canGoPrev} style={cal.navBtn}>
          <Ionicons name="chevron-back" size={20} color={canGoPrev ? TINT : "#ccc"} />
        </Pressable>
        <Text style={cal.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={cal.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={TINT} />
        </Pressable>
      </View>

      <View style={cal.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={cal.weekDay}>{d}</Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={cal.cell} />;
            const cellDate = new Date(viewYear, viewMonth, day);
            cellDate.setHours(0, 0, 0, 0);
            const past = isBefore(cellDate, today);
            const dateStr = toDateStr(cellDate);
            const isToday = dateStr === toDateStr(today);
            const isSel = dateStr === selected;

            return (
              <Pressable
                key={ci}
                onPress={() => { if (!past) { Haptics.selectionAsync(); onSelect(dateStr); } }}
                style={[
                  cal.cell,
                  isToday && !isSel && cal.todayCell,
                  isSel && cal.selectedCell,
                  past && cal.pastCell,
                ]}
              >
                <Text style={[
                  cal.dayText,
                  past && cal.pastText,
                  isToday && !isSel && cal.todayText,
                  isSel && cal.selectedText,
                ]}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const cal = StyleSheet.create({
  root: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 15, fontWeight: "700", color: "#2C2C2C" },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: "#AEAEAE" },
  row: { flexDirection: "row" },
  cell: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, margin: 1 },
  todayCell: { borderWidth: 1.5, borderColor: TINT },
  selectedCell: { backgroundColor: TINT },
  pastCell: {},
  dayText: { fontSize: 14, fontWeight: "500", color: "#2C2C2C" },
  pastText: { color: "#D0D0D0" },
  todayText: { color: TINT, fontWeight: "700" },
  selectedText: { color: "#fff", fontWeight: "700" },
});

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { get, post } = useApi();
  const { isFavorited, toggle: toggleFav } = useFavorites();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [showBooking, setShowBooking] = useState(false);
  const [bookingDate, setBookingDate] = useState(toDateStr(new Date()));
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slotStatus, setSlotStatus] = useState<{ slot: string; available: boolean }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);

  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (showBooking && bookingDate && listing) {
      fetchSlots();
    }
  }, [bookingDate, showBooking, listing]);

  async function loadData() {
    try {
      const [l, r] = await Promise.all([
        get<Listing>(`/listings/${id}`),
        get<Review[]>(`/reviews?listingId=${id}`),
      ]);
      setListing(l);
      setReviews(r);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlots() {
    if (!listing) return;
    setSlotsLoading(true);
    setSelectedSlot("");
    try {
      const data = await get<{ slots: { slot: string; available: boolean }[] }>(
        `/bookings/availability?listingId=${listing.id}&date=${bookingDate}`
      );
      setSlotStatus(data.slots || []);
    } catch {
      setSlotStatus(TIME_SLOTS.map((slot) => ({ slot, available: true })));
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleBook() {
    if (!listing) return;

    // Restrict bookings to Punjab region
    const loc = listing.location || "";
    if (!loc.toLowerCase().includes("punjab")) {
      Alert.alert(
        "Region Restricted",
        "Services are currently available only in Punjab region. This listing's location is outside our service area.",
        [{ text: "OK" }]
      );
      return;
    }

    if (!bookingDate) {
      Alert.alert("Missing Info", "Please select a date.");
      return;
    }
    if (!selectedSlot) {
      Alert.alert("Missing Info", "Please select a time slot.");
      return;
    }

    setBooking(true);
    try {
      await post("/bookings", {
        listingId: listing.id,
        startDate: bookingDate,
        endDate: bookingDate,
        bookingDate,
        timeSlot: selectedSlot,
        notes,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Booking Sent!",
        `Your booking for ${bookingDate} at ${selectedSlot} has been sent to the provider.`,
        [
          { text: "View Bookings", onPress: () => router.push("/(tabs)/bookings") },
          { text: "OK" },
        ]
      );
      setShowBooking(false);
      setSelectedSlot("");
    } catch (e: any) {
      const msg = e?.message || "Could not create booking. Please try again.";
      Alert.alert("Error", msg);
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

  const isOwner = user?.id === listing.providerId;
  const isCustomer = user?.role === "customer";
  const isCarListing = listing.category === "cars";

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
          <Pressable onPress={() => router.back()} style={[styles.backCircle, { top: (isWeb ? 67 : insets.top) + 12 }]}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
          {listing && (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleFav(listing.id); }}
              style={[styles.heartCircle, { top: (isWeb ? 67 : insets.top) + 12 }]}
            >
              <Ionicons
                name={isFavorited(listing.id) ? "heart" : "heart-outline"}
                size={20}
                color={isFavorited(listing.id) ? "#FF3B5C" : "#fff"}
              />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
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

          {listing.rating != null && (
            <View style={styles.ratingRow}>
              <StarRating rating={Math.round(listing.rating)} size={16} />
              <Text style={styles.ratingText}>{listing.rating.toFixed(1)} ({listing.reviewCount} reviews)</Text>
            </View>
          )}

          {listing.description && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          )}

          {/* Earth Mover specs — shown for heavy construction subcategories */}
          {listing.category === "equipment" && (
            listing.operatorIncluded !== null ||
            listing.fuelIncluded !== null ||
            listing.deliveryCharges !== null
          ) && (
            <View style={styles.specsSection}>
              <View style={styles.specsBanner}>
                <Ionicons name="construct" size={14} color="#BF360C" />
                <Text style={styles.specsBannerText}>Machine Details</Text>
              </View>
              <View style={styles.specsGrid}>
                <View style={[styles.specBadge, { backgroundColor: listing.operatorIncluded ? "#E8F5E9" : "#FFF3E0" }]}>
                  <Ionicons
                    name={listing.operatorIncluded ? "person" : "person-outline"}
                    size={16}
                    color={listing.operatorIncluded ? "#2E7D32" : "#E65100"}
                  />
                  <Text style={[styles.specLabel, { color: listing.operatorIncluded ? "#2E7D32" : "#E65100" }]}>
                    Operator
                  </Text>
                  <Text style={[styles.specValue, { color: listing.operatorIncluded ? "#2E7D32" : "#E65100" }]}>
                    {listing.operatorIncluded ? "Included" : "Not included"}
                  </Text>
                </View>

                <View style={[styles.specBadge, { backgroundColor: listing.fuelIncluded ? "#E8F5E9" : "#FFF3E0" }]}>
                  <Ionicons
                    name={listing.fuelIncluded ? "flame" : "flame-outline"}
                    size={16}
                    color={listing.fuelIncluded ? "#2E7D32" : "#E65100"}
                  />
                  <Text style={[styles.specLabel, { color: listing.fuelIncluded ? "#2E7D32" : "#E65100" }]}>
                    Fuel
                  </Text>
                  <Text style={[styles.specValue, { color: listing.fuelIncluded ? "#2E7D32" : "#E65100" }]}>
                    {listing.fuelIncluded ? "Included" : "Not included"}
                  </Text>
                </View>

                {listing.deliveryCharges !== null && (
                  <View style={[styles.specBadge, { backgroundColor: "#E3F2FD" }]}>
                    <Ionicons name="car-outline" size={16} color="#1565C0" />
                    <Text style={[styles.specLabel, { color: "#1565C0" }]}>Delivery</Text>
                    <Text style={[styles.specValue, { color: "#1565C0" }]}>
                      ₹{listing.deliveryCharges.toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

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

          {/* Booking form — date + slot picker */}
          {showBooking && isCustomer && !isCarListing && (
            <View style={styles.bookingForm}>
              <Text style={styles.sectionTitle}>Book This Listing</Text>

              {/* Calendar */}
              <Text style={styles.fieldLabel}>Select Date</Text>
              <MiniCalendar selected={bookingDate} onSelect={setBookingDate} />

              {/* Time Slots */}
              <Text style={styles.fieldLabel}>Select Time Slot</Text>
              {slotsLoading ? (
                <View style={styles.slotsLoading}>
                  <ActivityIndicator color={TINT} />
                  <Text style={styles.slotsLoadingText}>Checking availability…</Text>
                </View>
              ) : (
                <View style={styles.slotsGrid}>
                  {(slotStatus.length ? slotStatus : TIME_SLOTS.map((s) => ({ slot: s, available: true }))).map(({ slot, available }) => {
                    const isSel = selectedSlot === slot;
                    return (
                      <Pressable
                        key={slot}
                        onPress={() => {
                          if (!available) return;
                          Haptics.selectionAsync();
                          setSelectedSlot(isSel ? "" : slot);
                        }}
                        style={[
                          styles.slotBtn,
                          isSel && styles.slotBtnSelected,
                          !available && styles.slotBtnBooked,
                        ]}
                      >
                        <Ionicons
                          name={!available ? "close-circle" : isSel ? "checkmark-circle" : "time-outline"}
                          size={16}
                          color={!available ? "#AEAEAE" : isSel ? "#fff" : TINT}
                        />
                        <Text style={[styles.slotText, isSel && styles.slotTextSel, !available && styles.slotTextBooked]}>
                          {slot}
                        </Text>
                        {!available && <Text style={styles.bookedBadge}>Booked</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Notes */}
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Special requirements (optional)"
                placeholderTextColor={C.textTertiary}
                multiline
                numberOfLines={3}
              />

              {/* Summary */}
              {selectedSlot && (
                <View style={styles.summaryRow}>
                  <Ionicons name="calendar-outline" size={15} color={TINT} />
                  <Text style={styles.summaryText}>
                    {bookingDate} · {selectedSlot}
                  </Text>
                  <Text style={styles.summaryAmount}>₹{listing.price.toLocaleString("en-IN")}</Text>
                </View>
              )}

              <View style={styles.formActions}>
                <Pressable onPress={() => { setShowBooking(false); setSelectedSlot(""); }} style={styles.cancelFormBtn}>
                  <Text style={styles.cancelFormText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleBook} disabled={booking || !selectedSlot} style={[styles.confirmBookBtn, (!selectedSlot || booking) && styles.confirmBookBtnDisabled]}>
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

      {/* Bottom action bar */}
      {!isOwner && listing.isAvailable && isCustomer && !showBooking && !isCarListing && (
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
  thumbActive: { borderColor: TINT },
  backCircle: {
    position: "absolute", left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  heartCircle: {
    position: "absolute", right: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  content: { padding: 20 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  title: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, flex: 1, lineHeight: 28 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  location: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  unavailBadge: { backgroundColor: C.error, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  unavailText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginBottom: 10 },
  price: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", color: TINT },
  priceUnit: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  ratingText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  descSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, marginBottom: 10 },
  description: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 22 },
  specsSection: { marginBottom: 20 },
  specsBanner: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#FBE9E7", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 12, borderWidth: 1, borderColor: "#FFCCBC",
  },
  specsBannerText: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#BF360C" },
  specsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  specBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    minWidth: "30%",
  },
  specLabel: { fontSize: 10, fontWeight: "600", fontFamily: "Inter_600SemiBold", lineHeight: 14 },
  specValue: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
  providerCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.cardBorder,
    padding: 14, gap: 12, marginBottom: 20,
  },
  providerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${TINT}20`,
    alignItems: "center", justifyContent: "center",
  },
  providerAvatarText: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: TINT },
  providerName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  providerRating: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  providerRatingText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  msgBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${TINT}15`,
    alignItems: "center", justifyContent: "center",
  },
  reviewSection: { marginBottom: 20 },
  reviewCard: {
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.cardBorder,
    padding: 12, marginBottom: 8, gap: 8,
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

  // Booking form
  bookingForm: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.cardBorder,
    padding: 16, gap: 10, marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, marginBottom: 6,
  },

  slotsLoading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  slotsLoadingText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  slotsGrid: { gap: 8, marginBottom: 6 },
  slotBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FFF3E9",
    borderWidth: 1.5, borderColor: `${TINT}30`,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  slotBtnSelected: {
    backgroundColor: TINT, borderColor: TINT,
  },
  slotBtnBooked: {
    backgroundColor: "#F5F5F5", borderColor: "#E0E0E0",
  },
  slotText: { flex: 1, fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: TINT },
  slotTextSel: { color: "#fff" },
  slotTextBooked: { color: "#AEAEAE" },
  bookedBadge: {
    fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold",
    color: "#AEAEAE", backgroundColor: "#E8E8E8",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },

  notesInput: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.text,
    minHeight: 60, textAlignVertical: "top",
  },

  summaryRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: `${TINT}0F`, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  summaryText: { flex: 1, fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium", color: "#2C2C2C" },
  summaryAmount: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: TINT },

  formActions: { flexDirection: "row", gap: 10 },
  cancelFormBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, alignItems: "center",
  },
  cancelFormText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  confirmBookBtn: {
    flex: 2, backgroundColor: TINT,
    paddingVertical: 13, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  confirmBookBtnDisabled: { backgroundColor: "#FFBA8A", opacity: 0.7 },
  confirmBookText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },

  bottomBar: {
    backgroundColor: C.backgroundSecondary,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 14,
  },
  bottomPrice: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  bottomUnit: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  bookNowBtn: {
    backgroundColor: TINT, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 13,
    flexDirection: "row", gap: 8, alignItems: "center",
  },
  bookNowText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  errorText: { fontSize: 16, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  backBtn: {
    backgroundColor: TINT, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 12,
  },
  backBtnText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
