import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { Listing } from "@/types";

const C = Colors.light;
const ORANGE = "#FF7A18";
const ORANGE2 = "#FF9F43";
const SPRING = { useNativeDriver: false, tension: 300, friction: 14 };

function generateDays(count = 14): { date: Date; label: string; day: string; iso: string }[] {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push({
      date: d,
      label: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`,
      day: i === 0 ? "Today" : DAY_NAMES[d.getDay()],
      iso,
    });
  }
  return result;
}

const DAYS = generateDays(14);

function getCategoryAccent(category: string) {
  if (category === "cars")      return { bg: "#FFF3E9", fg: "#FF7A18" };
  if (category === "equipment") return { bg: "#E8F5E9", fg: "#2E7D32" };
  if (category === "services")  return { bg: "#E0F7FA", fg: "#0288D1" };
  return { bg: "#FFF3E9", fg: "#FF7A18" };
}

interface SlotInfo {
  slot: string;
  available: boolean;
}

export default function NewBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [listing, setListing] = useState<Listing | null>(null);
  const [listingLoading, setListingLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(DAYS[0].iso);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const confirmScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadListing();
  }, [id]);

  useEffect(() => {
    if (listing) loadSlots();
  }, [selectedDate, listing]);

  async function loadListing() {
    try {
      const data = await get<Listing>(`/listings/${id}`);
      setListing(data);
      const svcData = await get<{ serviceTypes: string[] }>(`/listings/${id}/service-types`);
      setServiceTypes(svcData.serviceTypes || []);
    } catch {
    } finally {
      setListingLoading(false);
    }
  }

  async function loadSlots() {
    if (!id || !selectedDate) return;
    setSlotsLoading(true);
    try {
      const data = await get<{ slots: SlotInfo[] }>(`/bookings/availability?listingId=${id}&date=${selectedDate}`);
      setSlots(data.slots || []);
      setSelectedSlot(null);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  const handleDateSelect = useCallback((iso: string) => {
    Haptics.selectionAsync();
    setSelectedDate(iso);
    setSelectedSlot(null);
  }, []);

  const handleSlotSelect = useCallback((slot: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSlot(slot);
  }, []);

  const handleServiceSelect = useCallback((svc: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedService(svc);
  }, []);

  async function handleConfirm() {
    if (!selectedSlot) {
      Alert.alert("Select Time Slot", "Please choose a time slot to continue.");
      return;
    }
    if (!selectedService) {
      Alert.alert("Select Service Type", "Please select the type of service you need.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(confirmScale, { toValue: 0.95, ...SPRING }),
      Animated.spring(confirmScale, { toValue: 1, ...SPRING }),
    ]).start();
    setSubmitting(true);
    try {
      const result = await post<{ id: string }>("/bookings", {
        listingId: id,
        bookingDate: selectedDate,
        timeSlot: selectedSlot,
        serviceType: selectedService,
        notes: notes.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Booking Confirmed!",
        `Your booking for ${listing?.title} on ${selectedDate} at ${selectedSlot} has been placed successfully.`,
        [{ text: "View Booking", onPress: () => router.replace({ pathname: "/booking/[id]", params: { id: result.id } }) }]
      );
    } catch (e: any) {
      const msg = e?.message?.includes("409")
        ? "This time slot is already booked. Please choose another."
        : "Could not place booking. Please try again.";
      Alert.alert("Booking Failed", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (listingLoading) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={styles.loadText}>Loading listing...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.loadRoot}>
        <Ionicons name="alert-circle-outline" size={48} color={C.textTertiary} />
        <Text style={styles.loadText}>Listing not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const accent = getCategoryAccent(listing.category);
  const hasImg = listing.images && listing.images.length > 0;
  const priceLabel = listing.priceUnit === "per_hour"
    ? `₹${listing.price.toLocaleString("en-IN")}/hr × 1 hour`
    : `₹${listing.price.toLocaleString("en-IN")}/day × 1 day`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={[ORANGE, ORANGE2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 10 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Book Now</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{listing.title}</Text>
        </View>
        <View style={styles.headerRight}>
          <Ionicons name="calendar" size={22} color="rgba(255,255,255,0.6)" />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Listing Preview */}
        <View style={styles.listingCard}>
          <View style={styles.listingImg}>
            {hasImg ? (
              <Image source={{ uri: listing.images[0] }} style={styles.listingImgInner} contentFit="cover" />
            ) : (
              <View style={[styles.listingImgInner, styles.listingImgPlaceholder, { backgroundColor: accent.bg }]}>
                <Ionicons name="cube-outline" size={36} color={accent.fg} />
              </View>
            )}
          </View>
          <View style={styles.listingInfo}>
            <View style={[styles.catChip, { backgroundColor: `${accent.fg}18` }]}>
              <Text style={[styles.catChipText, { color: accent.fg }]}>
                {listing.subcategory || listing.category}
              </Text>
            </View>
            <Text style={styles.listingTitle} numberOfLines={2}>{listing.title}</Text>
            <View style={styles.listingMeta}>
              <Ionicons name="location-outline" size={12} color={C.textTertiary} />
              <Text style={styles.listingLocation} numberOfLines={1}>{listing.location}</Text>
            </View>
            <Text style={styles.listingPrice}>
              ₹{listing.price.toLocaleString("en-IN")}
              <Text style={styles.listingPriceUnit}>
                {listing.priceUnit === "per_hour" ? "/hr" : "/day"}
              </Text>
            </Text>
          </View>
        </View>

        {/* ── STEP 1: Date ── */}
        <SectionLabel step={1} label="Select Date" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateScroll}
          contentContainerStyle={styles.dateScrollContent}
        >
          {DAYS.map((d) => {
            const isSelected = d.iso === selectedDate;
            return (
              <Pressable
                key={d.iso}
                onPress={() => handleDateSelect(d.iso)}
                style={[styles.dateTile, isSelected && styles.dateTileSelected]}
              >
                <Text style={[styles.dateTileDay, isSelected && styles.dateTileDaySelected]}>
                  {d.day}
                </Text>
                <Text style={[styles.dateTileNum, isSelected && styles.dateTileNumSelected]}>
                  {d.date.getDate()}
                </Text>
                <Text style={[styles.dateTileMon, isSelected && styles.dateTileMonSelected]}>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.date.getMonth()]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── STEP 2: Time Slot ── */}
        <SectionLabel step={2} label="Select Time Slot" sub="1-hour slots · 8 AM to 6 PM" />
        {slotsLoading ? (
          <View style={styles.slotsLoader}>
            <ActivityIndicator size="small" color={ORANGE} />
            <Text style={styles.slotsLoaderText}>Checking availability...</Text>
          </View>
        ) : (
          <View style={styles.slotGrid}>
            {slots.map((s) => {
              const isSelected = selectedSlot === s.slot;
              return (
                <Pressable
                  key={s.slot}
                  onPress={() => s.available && handleSlotSelect(s.slot)}
                  disabled={!s.available}
                  style={[
                    styles.slotTile,
                    isSelected && styles.slotTileSelected,
                    !s.available && styles.slotTileBooked,
                  ]}
                >
                  <Ionicons
                    name={isSelected ? "radio-button-on" : s.available ? "radio-button-off" : "close-circle"}
                    size={15}
                    color={isSelected ? "#fff" : !s.available ? "#ccc" : C.textSecondary}
                  />
                  <Text
                    style={[
                      styles.slotText,
                      isSelected && styles.slotTextSelected,
                      !s.available && styles.slotTextBooked,
                    ]}
                  >
                    {s.slot}
                  </Text>
                  {!s.available && (
                    <View style={styles.slotBookedBadge}>
                      <Text style={styles.slotBookedText}>Booked</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            {slots.length === 0 && !slotsLoading && (
              <View style={styles.noSlotsWrap}>
                <Text style={styles.noSlotsText}>No slots available for this date</Text>
              </View>
            )}
          </View>
        )}

        {/* ── STEP 3: Service Type ── */}
        <SectionLabel step={3} label="Select Service Type" sub="Choose what kind of service you need" />
        <View style={styles.serviceList}>
          {serviceTypes.map((svc, idx) => {
            const isSelected = selectedService === svc;
            return (
              <Pressable
                key={svc}
                onPress={() => handleServiceSelect(svc)}
                style={[styles.serviceTile, isSelected && styles.serviceTileSelected]}
              >
                <View style={[styles.serviceNum, isSelected && styles.serviceNumSelected]}>
                  <Text style={[styles.serviceNumText, isSelected && styles.serviceNumTextSelected]}>
                    {idx + 1}
                  </Text>
                </View>
                <Text style={[styles.serviceText, isSelected && styles.serviceTextSelected]}>
                  {svc}
                </Text>
                <Ionicons
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={isSelected ? ORANGE : C.textTertiary}
                />
              </Pressable>
            );
          })}
        </View>

        {/* ── STEP 4: Notes ── */}
        <SectionLabel step={4} label="Additional Notes" sub="Optional — any special requirements?" />
        <View style={styles.notesWrap}>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Need delivery by morning, prefer 2-person operator..."
            placeholderTextColor={C.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* ── Price Summary ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Price Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{listing.title}</Text>
            <Text style={styles.summaryValue}>{priceLabel}</Text>
          </View>
          {selectedService && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service</Text>
              <Text style={styles.summaryValue}>{selectedService}</Text>
            </View>
          )}
          {selectedDate && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { dateStyle: "long" })}
              </Text>
            </View>
          )}
          {selectedSlot && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time</Text>
              <Text style={styles.summaryValue}>{selectedSlot}</Text>
            </View>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>Total Amount</Text>
            <Text style={styles.summaryTotalValue}>
              ₹{listing.price.toLocaleString("en-IN")}
            </Text>
          </View>
          <Text style={styles.summaryNote}>Payment will be collected after confirmation</Text>
        </View>

        {/* ── Confirm Button ── */}
        <Animated.View style={[styles.confirmWrap, { transform: [{ scale: confirmScale }] }]}>
          <Pressable
            onPress={handleConfirm}
            disabled={submitting}
            style={styles.confirmPress}
          >
            <LinearGradient
              colors={[ORANGE, ORANGE2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                  <Text style={styles.confirmText}>Confirm Booking</Text>
                  <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.8)" />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <View style={{ height: isWeb ? 30 : 50 }} />
      </ScrollView>
    </View>
  );
}

function SectionLabel({ step, label, sub }: { step: number; label: string; sub?: string }) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.stepCircle}>
        <Text style={secStyles.stepNum}>{step}</Text>
      </View>
      <View>
        <Text style={secStyles.label}>{label}</Text>
        {sub && <Text style={secStyles.sub}>{sub}</Text>}
      </View>
    </View>
  );
}

const secStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 10,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#2C2C2C",
  },
  sub: {
    fontSize: 11,
    color: "#AEAEAE",
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },
  loadRoot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: "#F5F6FA" },
  loadText: { fontSize: 16, color: "#7A7A7A", fontFamily: "Inter_400Regular" },
  backLink: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: ORANGE, borderRadius: 10 },
  backLinkText: { color: "#fff", fontWeight: "700", fontFamily: "Inter_700Bold" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", marginTop: 1 },
  headerRight: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  listingCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EAEAEA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  listingImg: { width: 100, height: 100 },
  listingImgInner: { width: 100, height: 100 },
  listingImgPlaceholder: { alignItems: "center", justifyContent: "center" },
  listingInfo: { flex: 1, padding: 12, gap: 4 },
  catChip: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  catChipText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  listingTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C", lineHeight: 19 },
  listingMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  listingLocation: { fontSize: 11, color: "#AEAEAE", fontFamily: "Inter_400Regular", flex: 1 },
  listingPrice: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE, marginTop: 2 },
  listingPriceUnit: { fontSize: 11, fontWeight: "400", fontFamily: "Inter_400Regular", color: "#AEAEAE" },

  dateScroll: { marginTop: 0 },
  dateScrollContent: { paddingHorizontal: 20, gap: 10 },
  dateTile: {
    width: 62,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#EAEAEA",
    gap: 2,
  },
  dateTileSelected: { backgroundColor: ORANGE, borderColor: ORANGE },
  dateTileDay: { fontSize: 10, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#AEAEAE" },
  dateTileDaySelected: { color: "rgba(255,255,255,0.85)" },
  dateTileNum: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  dateTileNumSelected: { color: "#fff" },
  dateTileMon: { fontSize: 10, fontWeight: "500", fontFamily: "Inter_500Medium", color: "#AEAEAE" },
  dateTileMonSelected: { color: "rgba(255,255,255,0.85)" },

  slotsLoader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  slotsLoaderText: { fontSize: 13, color: "#AEAEAE", fontFamily: "Inter_400Regular" },

  slotGrid: { paddingHorizontal: 20, gap: 8 },
  slotTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EAEAEA",
  },
  slotTileSelected: { backgroundColor: ORANGE, borderColor: ORANGE },
  slotTileBooked: { backgroundColor: "#F8F8F8", borderColor: "#EAEAEA", opacity: 0.7 },
  slotText: { flex: 1, fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  slotTextSelected: { color: "#fff" },
  slotTextBooked: { color: "#CBCBCB" },
  slotBookedBadge: {
    backgroundColor: "#EF444422",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  slotBookedText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#EF4444" },
  noSlotsWrap: { alignItems: "center", paddingVertical: 20 },
  noSlotsText: { fontSize: 14, color: "#AEAEAE", fontFamily: "Inter_400Regular" },

  serviceList: { paddingHorizontal: 20, gap: 8 },
  serviceTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EAEAEA",
  },
  serviceTileSelected: { borderColor: ORANGE, backgroundColor: "#FFF8F4" },
  serviceNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#F0F0F0",
    alignItems: "center", justifyContent: "center",
  },
  serviceNumSelected: { backgroundColor: ORANGE },
  serviceNumText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#AEAEAE" },
  serviceNumTextSelected: { color: "#fff" },
  serviceText: { flex: 1, fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium", color: "#2C2C2C" },
  serviceTextSelected: { color: ORANGE, fontFamily: "Inter_600SemiBold" },

  notesWrap: { marginHorizontal: 20 },
  notesInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EAEAEA",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#2C2C2C",
    minHeight: 80,
    textAlignVertical: "top",
  },

  summaryCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  summaryTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  summaryLabel: { fontSize: 13, color: "#7A7A7A", fontFamily: "Inter_400Regular", flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium", color: "#2C2C2C", textAlign: "right", flex: 1.5 },
  summaryDivider: { height: 1, backgroundColor: "#EAEAEA", marginVertical: 4 },
  summaryTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryTotalLabel: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  summaryTotalValue: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  summaryNote: { fontSize: 11, color: "#AEAEAE", fontFamily: "Inter_400Regular", textAlign: "center" },

  confirmWrap: { marginHorizontal: 20, marginTop: 20 },
  confirmPress: { borderRadius: 16, overflow: "hidden" },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  confirmText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
});
