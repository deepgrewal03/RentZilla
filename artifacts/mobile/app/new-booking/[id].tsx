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
  KeyboardAvoidingView,
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
const GREEN = "#22C55E";
const RED = "#EF4444";
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

interface SlotInfo { slot: string; available: boolean; }
interface PricingResult {
  found: boolean; customer_price: number; provider_payout: number;
  app_commission: number; commission_percent: number; security_deposit: number;
}
interface PromoResult {
  valid: boolean; code?: string; type?: string; value?: number;
  discount?: number; finalAmount?: number; message: string; description?: string;
}
interface ServiceTypePriceInfo {
  name: string; hasPrice: boolean; estimatedPrice: number;
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
  const [serviceTypePrices, setServiceTypePrices] = useState<ServiceTypePriceInfo[]>([]);

  // ── Multi-select state ─────────────────────────────────────────────────────
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // ── Notes ──────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ── Promo code state ───────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoApplied, setPromoApplied] = useState(false);

  // ── Pricing ────────────────────────────────────────────────────────────────
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const confirmScale = useRef(new Animated.Value(1)).current;

  useEffect(() => { loadListing(); }, [id]);
  useEffect(() => { if (listing) loadSlots(); }, [selectedDate, listing]);

  // Reset promo when price changes (slots added/removed)
  useEffect(() => {
    if (promoApplied) {
      setPromoResult(null);
      setPromoApplied(false);
    }
  }, [selectedSlots.length]);

  async function loadListing() {
    try {
      const data = await get<Listing>(`/listings/${id}`);
      setListing(data);
      const svcData = await get<{ serviceTypes: string[] }>(`/listings/${id}/service-types`);
      const types = svcData.serviceTypes || [];
      setServiceTypes(types);

      if (types.length === 0) {
        // No service types — fetch pricing immediately with category/subcategory
        await fetchPricing(data, undefined);
      } else if (data.category && data.subcategory) {
        // Fetch per-service-type prices to show inline in the selection list
        try {
          const priceData = await get<{ serviceTypes: ServiceTypePriceInfo[] }>(
            `/pricing/service-types?category=${encodeURIComponent(data.category)}&subcategory=${encodeURIComponent(data.subcategory)}`
          );
          setServiceTypePrices(priceData.serviceTypes || []);
        } catch {
          // Show service types without prices if this fails
        }
      }
    } catch {
    } finally {
      setListingLoading(false);
    }
  }

  // fetchPricing: calls /pricing/calculate with the actual slot count so
  // hourly_rate × numSlots is computed server-side and returned as a single total.
  async function fetchPricing(
    l: Listing,
    serviceType: string | undefined,
    numSlots: number = 1,
  ) {
    if (!l.category || !l.subcategory) return;
    setPricingLoading(true);
    try {
      const isEquip = l.category === "equipment";
      const params = new URLSearchParams({
        category: l.category, subcategory: l.subcategory,
        // Equipment is priced per-day; services/professions per-hour.
        hours: isEquip ? "0" : String(Math.max(1, numSlots)),
        days:  isEquip ? String(Math.max(1, numSlots)) : "0",
        distance_km: "0",
      });
      if (serviceType) params.set("service_type", serviceType);
      const result = await get<PricingResult>(`/pricing/calculate?${params.toString()}`);
      setPricingResult(result);
    } catch {
    } finally {
      setPricingLoading(false);
    }
  }

  // Re-fetch whenever the primary service type OR the slot count changes
  useEffect(() => {
    if (!listing) return;
    if (serviceTypes.length === 0) return;
    const primary = selectedServices[0];
    if (primary) {
      fetchPricing(listing, primary, selectedSlots.length || 1);
    } else {
      setPricingResult(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServices[0], selectedSlots.length]);

  // For listings with no service-type selection, re-fetch when slot count changes
  useEffect(() => {
    if (!listing) return;
    if (serviceTypes.length > 0) return; // handled above
    fetchPricing(listing, undefined, selectedSlots.length || 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlots.length]);

  async function loadSlots() {
    if (!id || !selectedDate) return;
    setSlotsLoading(true);
    setSelectedSlots([]);
    try {
      const data = await get<{ slots: SlotInfo[] }>(`/bookings/availability?listingId=${id}&date=${selectedDate}`);
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  const handleDateSelect = useCallback((iso: string) => {
    Haptics.selectionAsync();
    setSelectedDate(iso);
    setSelectedSlots([]);
  }, []);

  const toggleSlot = useCallback((slot: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSlots(prev => {
      if (prev.includes(slot)) return prev.filter(s => s !== slot);
      return [...prev, slot];
    });
  }, []);

  const toggleService = useCallback((svc: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedServices(prev => {
      if (prev.includes(svc)) return prev.filter(s => s !== svc);
      return [...prev, svc];
    });
  }, []);

  async function applyPromo() {
    if (!promoCode.trim()) return;
    if (!listing) return;
    // customer_price is already the total for all selected slots (server-side calculation)
    const amount = pricingResult?.found
      ? pricingResult.customer_price
      : listing.price * Math.max(1, selectedSlots.length);

    setPromoLoading(true);
    setPromoResult(null);
    try {
      const result = await post<PromoResult>("/bookings/validate-promo", {
        code: promoCode.trim(),
        amount,
      });
      setPromoResult(result);
      setPromoApplied(result.valid);
      if (result.valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setPromoResult({ valid: false, message: "Could not validate promo code. Try again." });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPromoLoading(false);
    }
  }

  function clearPromo() {
    setPromoCode("");
    setPromoResult(null);
    setPromoApplied(false);
  }

  async function handleConfirm() {
    if (selectedSlots.length === 0) {
      Alert.alert("Select Time Slots", "Please choose at least one time slot to continue.");
      return;
    }
    if (serviceTypes.length > 0 && selectedServices.length === 0) {
      Alert.alert("Select Service Type", "Please select at least one service type.");
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
        timeSlots: selectedSlots,
        serviceTypes: selectedServices,
        notes: notes.trim() || undefined,
        promoCode: promoApplied ? promoCode.trim() : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const slotLabel = selectedSlots.length === 1
        ? selectedSlots[0]
        : `${selectedSlots.length} slots (${selectedSlots.length} hr${selectedSlots.length > 1 ? "s" : ""})`;
      Alert.alert(
        "Booking Confirmed!",
        `Your booking for ${listing?.title} on ${selectedDate} at ${slotLabel} has been placed successfully.`,
        [{ text: "View Booking", onPress: () => router.replace(`/booking/${result.id}` as any) }]
      );
    } catch (e: any) {
      const raw = e?.message || "";
      const msg = raw.includes("409") || raw.includes("already booked")
        ? "One or more of the selected time slots is already booked. Please pick different times."
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

  // pricingResult.customer_price is already the TOTAL for the actual number of
  // slots passed to /pricing/calculate (hourly_rate × numSlots computed server-side).
  // Never multiply it by numSlots again.
  const baseTotal  = pricingResult?.found
    ? pricingResult.customer_price
    : listing.price * Math.max(1, selectedSlots.length);
  const discount   = promoApplied && promoResult?.valid ? (promoResult.discount ?? 0) : 0;
  const finalTotal = Math.max(0, baseTotal - discount);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
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
          </View>
        </View>

        {/* ── STEP 1: Date ── */}
        <SectionLabel step={1} label="Select Date" />
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.dateScroll} contentContainerStyle={styles.dateScrollContent}
        >
          {DAYS.map((d) => {
            const isSelected = d.iso === selectedDate;
            return (
              <Pressable key={d.iso} onPress={() => handleDateSelect(d.iso)}
                style={[styles.dateTile, isSelected && styles.dateTileSelected]}>
                <Text style={[styles.dateTileDay, isSelected && styles.dateTileDaySelected]}>{d.day}</Text>
                <Text style={[styles.dateTileNum, isSelected && styles.dateTileNumSelected]}>{d.date.getDate()}</Text>
                <Text style={[styles.dateTileMon, isSelected && styles.dateTileMonSelected]}>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.date.getMonth()]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── STEP 2: Time Slots (multi-select) ── */}
        <SectionLabel
          step={2}
          label="Select Time Slots"
          sub={selectedSlots.length > 0
            ? `${selectedSlots.length} slot${selectedSlots.length > 1 ? "s" : ""} selected · ${selectedSlots.length} hr${selectedSlots.length > 1 ? "s" : ""}`
            : "Tap multiple slots to book more hours"}
        />
        {slotsLoading ? (
          <View style={styles.slotsLoader}>
            <ActivityIndicator size="small" color={ORANGE} />
            <Text style={styles.slotsLoaderText}>Checking availability...</Text>
          </View>
        ) : (
          <View style={styles.slotGrid}>
            {slots.map((s) => {
              const isSelected = selectedSlots.includes(s.slot);
              return (
                <Pressable
                  key={s.slot}
                  onPress={() => s.available && toggleSlot(s.slot)}
                  disabled={!s.available}
                  style={[
                    styles.slotTile,
                    isSelected && styles.slotTileSelected,
                    !s.available && styles.slotTileBooked,
                  ]}
                >
                  <Ionicons
                    name={isSelected ? "checkbox" : s.available ? "square-outline" : "close-circle"}
                    size={15}
                    color={isSelected ? "#fff" : !s.available ? "#ccc" : C.textSecondary}
                  />
                  <Text style={[
                    styles.slotText,
                    isSelected && styles.slotTextSelected,
                    !s.available && styles.slotTextBooked,
                  ]}>
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

        {/* ── STEP 3: Service Type (multi-select) ── */}
        {serviceTypes.length > 0 && (
          <>
            <SectionLabel
              step={3}
              label="Select Service Types"
              sub={selectedServices.length > 0
                ? `${selectedServices.length} selected`
                : "Pick one or more service types"}
            />
            <View style={styles.serviceList}>
              {serviceTypes.map((svc, idx) => {
                const isSelected = selectedServices.includes(svc);
                const priceInfo = serviceTypePrices.find(p => p.name === svc);
                return (
                  <Pressable
                    key={svc}
                    onPress={() => toggleService(svc)}
                    style={[styles.serviceTile, isSelected && styles.serviceTileSelected]}
                  >
                    <View style={[styles.serviceNum, isSelected && styles.serviceNumSelected]}>
                      <Text style={[styles.serviceNumText, isSelected && styles.serviceNumTextSelected]}>
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.serviceText, isSelected && styles.serviceTextSelected]}>{svc}</Text>
                      {priceInfo?.hasPrice && priceInfo.estimatedPrice > 0 && (
                        <Text style={[styles.servicePriceTag, isSelected && styles.servicePriceTagSelected]}>
                          from ₹{priceInfo.estimatedPrice.toLocaleString("en-IN")}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={20}
                      color={isSelected ? ORANGE : C.textTertiary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ── STEP 4: Notes ── */}
        <SectionLabel
          step={serviceTypes.length > 0 ? 4 : 3}
          label="Additional Notes"
          sub="Optional — any special requirements?"
        />
        <View style={styles.notesWrap}>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Need delivery by morning, prefer 2-person operator..."
            placeholderTextColor={C.textTertiary}
            multiline numberOfLines={3} textAlignVertical="top"
          />
        </View>

        {/* ── STEP 5: Promo Code ── */}
        <SectionLabel
          step={serviceTypes.length > 0 ? 5 : 4}
          label="Promo Code"
          sub="Have a coupon? Enter it below"
        />
        <View style={styles.promoWrap}>
          <View style={[
            styles.promoRow,
            promoResult?.valid === true && styles.promoRowValid,
            promoResult?.valid === false && styles.promoRowInvalid,
          ]}>
            <Ionicons
              name="pricetag-outline"
              size={18}
              color={promoResult?.valid === true ? GREEN : promoResult?.valid === false ? RED : ORANGE}
              style={{ marginLeft: 12 }}
            />
            <TextInput
              style={styles.promoInput}
              value={promoCode}
              onChangeText={(t) => {
                setPromoCode(t.toUpperCase());
                if (promoApplied) { setPromoResult(null); setPromoApplied(false); }
              }}
              placeholder="ENTER CODE"
              placeholderTextColor={C.textTertiary}
              autoCapitalize="characters"
              editable={!promoApplied}
              returnKeyType="done"
              onSubmitEditing={applyPromo}
            />
            {promoApplied ? (
              <Pressable onPress={clearPromo} style={styles.promoClearBtn}>
                <Ionicons name="close-circle" size={18} color={RED} />
                <Text style={[styles.promoActionText, { color: RED }]}>Remove</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={applyPromo}
                disabled={promoLoading || !promoCode.trim()}
                style={[styles.promoApplyBtn, (!promoCode.trim()) && styles.promoApplyBtnDisabled]}
              >
                {promoLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.promoApplyText}>Apply</Text>
                )}
              </Pressable>
            )}
          </View>
          {promoResult && (
            <View style={[styles.promoMessage, promoResult.valid ? styles.promoMessageValid : styles.promoMessageInvalid]}>
              <Ionicons
                name={promoResult.valid ? "checkmark-circle" : "close-circle"}
                size={14}
                color={promoResult.valid ? GREEN : RED}
              />
              <Text style={[styles.promoMessageText, { color: promoResult.valid ? GREEN : RED }]}>
                {promoResult.message}
              </Text>
            </View>
          )}
        </View>

        {/* ── Price Summary ── */}
        {(selectedSlots.length === 0 || (serviceTypes.length > 0 && selectedServices.length === 0)) && (
          <View style={styles.pricePlaceholder}>
            <Ionicons name="calculator-outline" size={28} color={ORANGE} style={{ marginBottom: 8 }} />
            <Text style={styles.pricePlaceholderTitle}>Select to see pricing</Text>
            <Text style={styles.pricePlaceholderSub}>
              {selectedSlots.length === 0
                ? "Choose time slots above to calculate the total"
                : "Pick a service type above to calculate the total"}
            </Text>
          </View>
        )}
        {selectedSlots.length > 0 && (serviceTypes.length === 0 || selectedServices.length > 0) && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Price Summary</Text>
          </View>

          {/* Base price row */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {listing.subcategory || listing.title}
              {selectedSlots.length > 1
                ? listing.category === "equipment"
                  ? ` × ${selectedSlots.length} days`
                  : ` × ${selectedSlots.length} hrs`
                : ""}
            </Text>
            <Text style={styles.summaryValue}>
              ₹{baseTotal.toLocaleString("en-IN")}
            </Text>
          </View>

          {/* Security deposit (refundable) — shown to customer when applicable */}
          {pricingResult?.found && pricingResult.security_deposit > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Security deposit (refundable)</Text>
              <Text style={styles.summaryValue}>
                ₹{pricingResult.security_deposit.toLocaleString("en-IN")}
              </Text>
            </View>
          )}

          {/* Selected info rows */}
          {selectedServices.length > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service{selectedServices.length > 1 ? "s" : ""}</Text>
              <Text style={[styles.summaryValue, { maxWidth: 180 }]} numberOfLines={2}>
                {selectedServices.join(", ")}
              </Text>
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
          {selectedSlots.length > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time slot{selectedSlots.length > 1 ? "s" : ""}</Text>
              <Text style={[styles.summaryValue, { maxWidth: 180 }]} numberOfLines={3}>
                {selectedSlots.join("\n")}
              </Text>
            </View>
          )}

          {/* Discount row */}
          {promoApplied && discount > 0 && (
            <View style={[styles.summaryRow, styles.discountRow]}>
              <View style={styles.discountLabel}>
                <Ionicons name="pricetag" size={13} color={GREEN} />
                <Text style={[styles.summaryLabel, { color: GREEN }]}>
                  {" "}Promo ({promoResult?.code})
                  {promoResult?.type === "percent" ? ` -${promoResult.value}%` : ""}
                </Text>
              </View>
              <Text style={[styles.summaryValue, { color: GREEN }]}>
                -₹{discount.toLocaleString("en-IN")}
              </Text>
            </View>
          )}

          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>Total Amount</Text>
            {pricingLoading ? (
              <ActivityIndicator size="small" color={ORANGE} />
            ) : (
              <View style={styles.totalAmountCol}>
                {promoApplied && discount > 0 && (
                  <Text style={styles.originalPrice}>₹{baseTotal.toLocaleString("en-IN")}</Text>
                )}
                <Text style={[styles.summaryTotalValue, promoApplied && discount > 0 && { color: GREEN }]}>
                  ₹{finalTotal.toLocaleString("en-IN")}
                </Text>
              </View>
            )}
          </View>
          {!pricingResult?.found && (
            <Text style={[styles.summaryNote, { color: "#AEAEAE" }]}>Price from provider listing</Text>
          )}
          <Text style={styles.summaryNote}>Payment will be collected after confirmation</Text>
        </View>
        )}

        {/* ── Confirm Button ── */}
        <Animated.View style={[styles.confirmWrap, { transform: [{ scale: confirmScale }] }]}>
          <Pressable onPress={handleConfirm} disabled={submitting} style={styles.confirmPress}>
            <LinearGradient
              colors={[ORANGE, ORANGE2]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.confirmBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                  <Text style={styles.confirmText}>Confirm Booking</Text>
                  {selectedSlots.length > 0 && (
                    <View style={styles.confirmBadge}>
                      <Text style={styles.confirmBadgeText}>{selectedSlots.length} hr{selectedSlots.length > 1 ? "s" : ""}</Text>
                    </View>
                  )}
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <View style={{ height: isWeb ? 30 : 50 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SectionLabel({ step, label, sub }: { step: number; label: string; sub?: string }) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.stepCircle}>
        <Text style={secStyles.stepNum}>{step}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={secStyles.label}>{label}</Text>
        {sub && <Text style={secStyles.sub}>{sub}</Text>}
      </View>
    </View>
  );
}

const secStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, marginTop: 22, marginBottom: 10,
  },
  stepCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: ORANGE, alignItems: "center", justifyContent: "center",
  },
  stepNum: { color: "#fff", fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold" },
  label: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  sub: { fontSize: 11, color: "#AEAEAE", fontFamily: "Inter_400Regular", marginTop: 1 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },
  loadRoot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: "#F5F6FA" },
  loadText: { fontSize: 16, color: "#7A7A7A", fontFamily: "Inter_400Regular" },
  backLink: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: ORANGE, borderRadius: 10 },
  backLinkText: { color: "#fff", fontWeight: "700", fontFamily: "Inter_700Bold" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", marginTop: 1 },
  headerRight: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  listingCard: {
    flexDirection: "row", backgroundColor: "#fff",
    marginHorizontal: 20, marginTop: 18, borderRadius: 16,
    overflow: "hidden", borderWidth: 1, borderColor: "#EAEAEA",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  listingImg: { width: 90, height: 90 },
  listingImgInner: { width: 90, height: 90 },
  listingImgPlaceholder: { alignItems: "center", justifyContent: "center" },
  listingInfo: { flex: 1, padding: 12, gap: 4 },
  catChip: {
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, marginBottom: 2,
  },
  catChipText: { fontSize: 10, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  listingTitle: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  listingMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  listingLocation: { fontSize: 11, color: "#7A7A7A", fontFamily: "Inter_400Regular", flex: 1 },
  listingPrice: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE, marginTop: 2 },
  listingPriceUnit: { fontSize: 11, color: "#AEAEAE", fontWeight: "400", fontFamily: "Inter_400Regular" },

  dateScroll: { marginTop: 2 },
  dateScrollContent: { paddingHorizontal: 20, gap: 10, paddingVertical: 4 },
  dateTile: {
    width: 60, paddingVertical: 10, borderRadius: 14,
    alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: "#E8E8E8",
  },
  dateTileSelected: { backgroundColor: ORANGE, borderColor: ORANGE },
  dateTileDay: { fontSize: 10, color: "#AEAEAE", fontFamily: "Inter_400Regular" },
  dateTileDaySelected: { color: "rgba(255,255,255,0.85)" },
  dateTileNum: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C", marginVertical: 2 },
  dateTileNumSelected: { color: "#fff" },
  dateTileMon: { fontSize: 10, color: "#7A7A7A", fontFamily: "Inter_400Regular" },
  dateTileMonSelected: { color: "rgba(255,255,255,0.85)" },

  slotsLoader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  slotsLoaderText: { color: "#7A7A7A", fontSize: 13, fontFamily: "Inter_400Regular" },

  slotGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 8 },
  slotTile: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E8E8E8",
    minWidth: "45%",
  },
  slotTileSelected: { backgroundColor: ORANGE, borderColor: ORANGE },
  slotTileBooked: { backgroundColor: "#F9F9F9", borderColor: "#EAEAEA", opacity: 0.6 },
  slotText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#2C2C2C" },
  slotTextSelected: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  slotTextBooked: { color: "#AEAEAE" },
  slotBookedBadge: {
    backgroundColor: "#F0F0F0", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  slotBookedText: { fontSize: 9, color: "#AEAEAE", fontFamily: "Inter_400Regular" },
  noSlotsWrap: { paddingVertical: 16, alignItems: "center", width: "100%" },
  noSlotsText: { color: "#AEAEAE", fontSize: 13, fontFamily: "Inter_400Regular" },

  serviceList: { paddingHorizontal: 20, gap: 8 },
  serviceTile: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: "#E8E8E8",
  },
  serviceTileSelected: { borderColor: ORANGE, backgroundColor: "#FFF5ED" },
  serviceNum: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: "#F0F0F0",
    alignItems: "center", justifyContent: "center",
  },
  serviceNumSelected: { backgroundColor: `${ORANGE}22` },
  serviceNumText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#7A7A7A" },
  serviceNumTextSelected: { color: ORANGE },
  serviceText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#2C2C2C" },
  serviceTextSelected: { fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  servicePriceTag: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#7A7A7A", marginTop: 2 },
  servicePriceTagSelected: { color: ORANGE, fontFamily: "Inter_600SemiBold" },

  notesWrap: { marginHorizontal: 20 },
  notesInput: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#2C2C2C",
    borderWidth: 1, borderColor: "#E8E8E8", minHeight: 80,
  },

  // Promo code
  promoWrap: { marginHorizontal: 20, gap: 8 },
  promoRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5,
    borderColor: "#E8E8E8", overflow: "hidden",
  },
  promoRowValid: { borderColor: GREEN },
  promoRowInvalid: { borderColor: RED },
  promoInput: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 8,
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#2C2C2C",
    letterSpacing: 1.5,
  },
  promoApplyBtn: {
    backgroundColor: ORANGE, paddingHorizontal: 18, paddingVertical: 14,
    alignItems: "center", justifyContent: "center",
  },
  promoApplyBtnDisabled: { backgroundColor: "#DCDCDC" },
  promoApplyText: { color: "#fff", fontWeight: "700", fontFamily: "Inter_700Bold", fontSize: 13 },
  promoClearBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  promoActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  promoMessage: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  promoMessageValid: { backgroundColor: "#F0FDF4" },
  promoMessageInvalid: { backgroundColor: "#FEF2F2" },
  promoMessageText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  pricePlaceholder: {
    marginHorizontal: 20, marginTop: 20, borderRadius: 16,
    backgroundColor: "#FFF8F2", borderWidth: 1.5, borderColor: `${ORANGE}25`,
    borderStyle: "dashed", paddingVertical: 28, paddingHorizontal: 20,
    alignItems: "center",
  },
  pricePlaceholderTitle: {
    fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold",
    color: "#2C2C2C", marginBottom: 6,
  },
  pricePlaceholderSub: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "#7A7A7A", textAlign: "center", lineHeight: 18,
  },

  summaryCard: {
    backgroundColor: "#fff", marginHorizontal: 20, marginTop: 20,
    borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#EAEAEA",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  summaryTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: "#7A7A7A", fontFamily: "Inter_400Regular", flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#2C2C2C", textAlign: "right" },

  discountRow: {
    backgroundColor: "#F0FDF4", marginHorizontal: -4, paddingHorizontal: 10,
    paddingVertical: 8, borderRadius: 8, marginBottom: 10,
  },
  discountLabel: { flexDirection: "row", alignItems: "center", flex: 1 },

  summaryDivider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 },
  summaryTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryTotalLabel: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  summaryTotalValue: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  totalAmountCol: { alignItems: "flex-end", gap: 2 },
  originalPrice: { fontSize: 13, color: "#AEAEAE", fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  summaryNote: { fontSize: 11, color: "#AEAEAE", fontFamily: "Inter_400Regular", marginTop: 6, textAlign: "center" },

  confirmWrap: { marginHorizontal: 20, marginTop: 20 },
  confirmPress: { borderRadius: 16, overflow: "hidden" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, gap: 10,
  },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  confirmBadge: {
    backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8,
  },
  confirmBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
