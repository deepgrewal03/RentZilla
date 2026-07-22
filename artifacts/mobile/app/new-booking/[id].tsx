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
import GlowButton from "@/components/GlowButton";
import * as AudioService from "@/services/AudioService";

const C = Colors.light;
const ORANGE = "#FF7A18";
const ORANGE2 = "#FF9F43";
const GREEN = "#22C55E";
const RED = "#EF4444";
const SPRING = { useNativeDriver: false, tension: 300, friction: 14 };

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function isoToDate(iso: string): Date { return new Date(iso + "T00:00:00"); }
function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayIso(): string { return dateToIso(new Date()); }
function daysBetween(a: string, b: string): number {
  return Math.round((isoToDate(b).getTime() - isoToDate(a).getTime()) / 86400000);
}

function generateDays(count = 14): { date: Date; label: string; day: string; iso: string }[] {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = dateToIso(d);
    result.push({
      date: d,
      label: `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`,
      day: i === 0 ? "Today" : DAY_NAMES_SHORT[d.getDay()],
      iso,
    });
  }
  return result;
}

const DAYS = generateDays(14);

// ── MonthCalendar component ────────────────────────────────────────────────────
function MonthCalendar({
  startIso, endIso, onPickDate, minIso,
}: {
  startIso: string; endIso: string;
  onPickDate: (iso: string) => void; minIso: string;
}) {
  const initYear = parseInt(startIso.split("-")[0]);
  const initMonth = parseInt(startIso.split("-")[1]) - 1;
  const [year, setYear] = React.useState(initYear);
  const [month, setMonth] = React.useState(initMonth);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const offset = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dateToIso(new Date(year, month, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={cal.wrap}>
      {/* Header */}
      <View style={cal.header}>
        <Pressable onPress={prevMonth} hitSlop={12} style={cal.navBtn}>
          <Ionicons name="chevron-back" size={20} color="#FF7A18" />
        </Pressable>
        <Text style={cal.headerTitle}>{MONTH_NAMES_FULL[month]} {year}</Text>
        <Pressable onPress={nextMonth} hitSlop={12} style={cal.navBtn}>
          <Ionicons name="chevron-forward" size={20} color="#FF7A18" />
        </Pressable>
      </View>
      {/* Day of week labels */}
      <View style={cal.dowRow}>
        {DAY_NAMES_SHORT.map(d => (
          <Text key={d} style={cal.dowLabel}>{d}</Text>
        ))}
      </View>
      {/* Day grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((iso, ci) => {
            if (!iso) return <View key={ci} style={cal.cell} />;
            const isPast = iso < minIso;
            const isStart = iso === startIso;
            const isEnd = iso === endIso;
            const inRange = iso > startIso && iso < endIso;
            const isToday = iso === todayIso();
            return (
              <Pressable
                key={ci}
                onPress={() => !isPast && onPickDate(iso)}
                style={[
                  cal.cell,
                  inRange && cal.cellInRange,
                  (isStart || isEnd) && cal.cellEndpoint,
                ]}
                disabled={isPast}
              >
                <View style={[
                  cal.dayCircle,
                  (isStart || isEnd) && cal.dayCircleActive,
                  isToday && !isStart && !isEnd && cal.dayCircleToday,
                ]}>
                  <Text style={[
                    cal.dayText,
                    isPast && cal.dayTextPast,
                    (isStart || isEnd) && cal.dayTextActive,
                    inRange && cal.dayTextRange,
                    isToday && !isStart && !isEnd && cal.dayTextToday,
                  ]}>
                    {parseInt(iso.split("-")[2])}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      {/* Legend */}
      <View style={cal.legend}>
        <View style={cal.legendDot} />
        <Text style={cal.legendText}>Tap start date, then tap end date to set range</Text>
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  wrap: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginHorizontal: 16, marginBottom: 4, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn: { padding: 6 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#1A1A1A" },
  dowRow: { flexDirection: "row", marginBottom: 4 },
  dowLabel: { flex: 1, textAlign: "center", fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#9CA3AF" },
  row: { flexDirection: "row" },
  cell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 0 },
  cellInRange: { backgroundColor: "#FFF0E6" },
  cellEndpoint: { backgroundColor: "#FFF0E6" },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayCircleActive: { backgroundColor: "#FF7A18" },
  dayCircleToday: { borderWidth: 1.5, borderColor: "#FF7A18" },
  dayText: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#1A1A1A" },
  dayTextPast: { color: "#D1D5DB" },
  dayTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },
  dayTextRange: { color: "#FF7A18" },
  dayTextToday: { color: "#FF7A18", fontFamily: "Inter_600SemiBold" },
  legend: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF7A18" },
  legendText: { fontSize: 11, color: "#9CA3AF", fontFamily: "Inter_400Regular", flex: 1 },
});

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

// All equipment and services use day-count picker; cars use time slots
function isDayBasedCategory(category: string | undefined): boolean {
  return category === "equipment" || category === "services";
}

// Add N days to a YYYY-MM-DD string
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  // ── Multi-day state ────────────────────────────────────────────────────────
  const [numDays, setNumDays] = useState(1);
  // Calendar mode for day-based bookings: "start" = picking start date, "end" = picking end date
  const [calPickMode, setCalPickMode] = React.useState<"start" | "end">("start");
  // Booking unit toggle: equipment & services can be booked by days OR hours
  const [bookingUnit, setBookingUnit] = useState<"days" | "hours">("days");

  // ── Location state ─────────────────────────────────────────────────────────
  const [bookingLocation, setBookingLocation] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);

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
  // Per-service-type pricing map: { "Pipe Repair": PricingResult, ... }
  const [serviceTypePricingMap, setServiceTypePricingMap] = useState<Record<string, PricingResult>>({});
  const [submitting, setSubmitting] = useState(false);
  const confirmScale = useRef(new Animated.Value(1)).current;

  const isDayBased = listing ? isDayBasedCategory(listing.category) : false;
  // isDayMode: true when booking by calendar days (equipment/services in days mode)
  const isDayMode = isDayBased && bookingUnit === "days";
  // useSlots: true when showing the time-slot grid (cars always, or equipment/services in hours mode)
  const useSlots = !isDayBased || bookingUnit === "hours";

  useEffect(() => { loadListing(); }, [id]);
  useEffect(() => {
    if (listing && useSlots) loadSlots();
  }, [selectedDate, listing, bookingUnit]);

  // Reset promo when price changes (numDays for agri, slot count for hourly)
  useEffect(() => {
    if (promoApplied) { setPromoResult(null); setPromoApplied(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numDays, selectedSlots.length]);

  async function loadListing() {
    try {
      const data = await get<Listing>(`/listings/${id}`);
      setListing(data);
      const svcData = await get<{ serviceTypes: string[] }>(`/listings/${id}/service-types`);
      const types = svcData.serviceTypes || [];
      setServiceTypes(types);

      if (types.length === 0) {
        await fetchPricing(data, undefined, 1);
      } else if (data.category && data.subcategory) {
        try {
          const priceData = await get<{ serviceTypes: ServiceTypePriceInfo[] }>(
            `/pricing/service-types?category=${encodeURIComponent(data.category)}&subcategory=${encodeURIComponent(data.subcategory)}`
          );
          setServiceTypePrices(priceData.serviceTypes || []);
        } catch {}
      }
    } catch {
    } finally {
      setListingLoading(false);
    }
  }

  async function getGpsLocation() {
    setGpsLoading(true);
    try {
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to use GPS. Please enter your address manually.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo) {
        const addr = [geo.name, geo.street, geo.city, geo.region].filter(Boolean).join(", ");
        setBookingLocation(addr || `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
      }
    } catch {
      Alert.alert("GPS Error", "Could not get your location. Please enter your address manually.");
    } finally {
      setGpsLoading(false);
    }
  }

  // fetchPricing: calls /pricing/calculate
  async function fetchPricing(
    l: Listing,
    serviceType: string | undefined,
    count: number = 1,
  ) {
    if (!l.category || !l.subcategory) return;
    setPricingLoading(true);
    try {
      const inDayMode = isDayBasedCategory(l.category) && bookingUnit === "days";
      const params = new URLSearchParams({
        category: l.category, subcategory: l.subcategory,
        hours: inDayMode ? "0" : String(Math.max(1, count)),
        days:  inDayMode ? String(Math.max(1, count)) : "0",
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

  // Fetch pricing for ALL selected service types in parallel
  async function fetchAllServicePricing(l: Listing, services: string[], count: number) {
    if (!l.category || !l.subcategory || services.length === 0) {
      setServiceTypePricingMap({});
      return;
    }
    setPricingLoading(true);
    const inDayMode = isDayBasedCategory(l.category) && bookingUnit === "days";
    try {
      const entries = await Promise.all(
        services.map(async (svc) => {
          const params = new URLSearchParams({
            category: l.category!, subcategory: l.subcategory!,
            hours: inDayMode ? "0" : String(Math.max(1, count)),
            days:  inDayMode ? String(Math.max(1, count)) : "0",
            distance_km: "0",
            service_type: svc,
          });
          try {
            const r = await get<PricingResult>(`/pricing/calculate?${params.toString()}`);
            return [svc, r] as [string, PricingResult];
          } catch {
            return [svc, { found: false, customer_price: 0, provider_payout: 0, app_commission: 0, commission_percent: 15, security_deposit: 0 }] as [string, PricingResult];
          }
        })
      );
      setServiceTypePricingMap(Object.fromEntries(entries));
    } finally {
      setPricingLoading(false);
    }
  }

  // Re-fetch ALL selected service type prices when selection or count changes
  useEffect(() => {
    if (!listing) return;
    if (serviceTypes.length === 0) return;
    if (selectedServices.length === 0) {
      setServiceTypePricingMap({});
      return;
    }
    const count = isDayMode ? numDays : selectedSlots.length || 1;
    fetchAllServicePricing(listing, selectedServices, count);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedServices), numDays, selectedSlots.length, bookingUnit]);

  // For listings with no service-type selection
  useEffect(() => {
    if (!listing) return;
    if (serviceTypes.length > 0) return;
    const count = isDayMode ? numDays : selectedSlots.length || 1;
    fetchPricing(listing, undefined, count);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numDays, selectedSlots.length, bookingUnit]);

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

  // Calendar tap handler — "start" mode sets start date; "end" mode (or tapping after start) sets end
  const handleCalendarPickDate = useCallback((iso: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (calPickMode === "start" || iso <= selectedDate) {
      setSelectedDate(iso);
      setCalPickMode("end");
    } else {
      // iso > selectedDate → set as end date, compute numDays
      const diff = daysBetween(selectedDate, iso) + 1;
      setNumDays(Math.max(1, diff));
      setCalPickMode("start");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calPickMode, selectedDate]);

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
    // Use the computed baseTotal which already accounts for all selected services × days/slots
    const amount = baseTotal > 0 ? baseTotal : listing.price * unitCount;

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
    if (serviceTypes.length > 0 && selectedServices.length === 0) {
      Alert.alert("Select Service Type", "Please select at least one service type.");
      return;
    }

    const confirmDayBased = isDayMode;

    if (!confirmDayBased && selectedSlots.length === 0) {
      Alert.alert("Select Time Slots", "Please choose at least one time slot to continue.");
      return;
    }
    if (confirmDayBased && numDays < 1) {
      Alert.alert("Select Days", "Please select at least 1 day.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(confirmScale, { toValue: 0.95, ...SPRING }),
      Animated.spring(confirmScale, { toValue: 1, ...SPRING }),
    ]).start();
    setSubmitting(true);
    try {
      let payload: Record<string, any>;
      let successMsg: string;

      if (confirmDayBased) {
        // Multi-day booking (equipment & services): date-range path
        const endDate = addDays(selectedDate, numDays);
        payload = {
          listingId: id,
          startDate: selectedDate,
          endDate,
          totalDays: numDays,
          serviceTypes: selectedServices,
          notes: notes.trim() || undefined,
          promoCode: promoApplied ? promoCode.trim() : undefined,
          location: bookingLocation.trim() || undefined,
        };
        successMsg = `${listing?.title} booked for ${numDays} day${numDays > 1 ? "s" : ""} starting ${selectedDate}.`;
      } else {
        // Hourly slot booking (cars)
        payload = {
          listingId: id,
          bookingDate: selectedDate,
          timeSlots: selectedSlots,
          serviceTypes: selectedServices,
          notes: notes.trim() || undefined,
          promoCode: promoApplied ? promoCode.trim() : undefined,
          location: bookingLocation.trim() || undefined,
        };
        const slotLabel = selectedSlots.length === 1
          ? selectedSlots[0]
          : `${selectedSlots.length} slot${selectedSlots.length > 1 ? "s" : ""} (${selectedSlots.length} hr${selectedSlots.length > 1 ? "s" : ""})`;
        successMsg = `${listing?.title} booked on ${selectedDate} at ${slotLabel}.`;
      }

      const result = await post<{ id: string }>("/bookings", payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AudioService.playBookingSuccess().catch(() => {});
      Alert.alert(
        "Booking Confirmed! 🎉",
        successMsg,
        [{ text: "View Booking", onPress: () => router.replace(`/booking/${result.id}` as any) }]
      );
    } catch (e: any) {
      const raw = e?.message || "";
      const msg = raw.includes("409") || raw.includes("already booked")
        ? "These time slots are already booked. Please choose different times."
        : raw.includes("past") ? "Cannot book a past date. Please select a future date."
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

  // pricingResult.customer_price is the TOTAL already computed server-side.
  // For equipment/services → price × numDays; for hourly (cars) → price × numSlots.
  const unitCount = isDayMode ? numDays : Math.max(1, selectedSlots.length);

  // When service types are selected, sum up all individual service prices
  const hasServicePricing = serviceTypes.length > 0 && selectedServices.length > 0;
  const svcPricingTotal = hasServicePricing
    ? selectedServices.reduce((sum, svc) => {
        const r = serviceTypePricingMap[svc];
        return sum + (r?.found ? r.customer_price : listing.price * unitCount);
      }, 0)
    : 0;

  const baseTotal = hasServicePricing
    ? svcPricingTotal
    : pricingResult?.found
      ? pricingResult.customer_price
      : listing.price * unitCount;
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

        {/* ── Booking Type Toggle (equipment & services only) ── */}
        {isDayBased && (
          <View style={styles.unitToggleCard}>
            <View style={styles.unitToggleHeader}>
              <Ionicons name="swap-horizontal-outline" size={18} color={ORANGE} />
              <Text style={styles.unitToggleTitle}>How would you like to book?</Text>
            </View>
            <View style={styles.unitToggleRow}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setBookingUnit("days"); setSelectedSlots([]); }}
                style={[styles.unitToggleOpt, bookingUnit === "days" && styles.unitToggleOptActive]}
              >
                <Ionicons name="calendar-outline" size={22} color={bookingUnit === "days" ? "#fff" : ORANGE} />
                <Text style={[styles.unitToggleOptTitle, bookingUnit === "days" && styles.unitToggleOptTitleActive]}>Per Day</Text>
                <Text style={[styles.unitToggleOptSub, bookingUnit === "days" && { color: "rgba(255,255,255,0.75)" }]}>Choose calendar dates</Text>
                {bookingUnit === "days" && (
                  <View style={styles.unitToggleCheck}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setBookingUnit("hours"); setNumDays(1); }}
                style={[styles.unitToggleOpt, bookingUnit === "hours" && styles.unitToggleOptActive]}
              >
                <Ionicons name="time-outline" size={22} color={bookingUnit === "hours" ? "#fff" : ORANGE} />
                <Text style={[styles.unitToggleOptTitle, bookingUnit === "hours" && styles.unitToggleOptTitleActive]}>Per Hour</Text>
                <Text style={[styles.unitToggleOptSub, bookingUnit === "hours" && { color: "rgba(255,255,255,0.75)" }]}>Pick time slots</Text>
                {bookingUnit === "hours" && (
                  <View style={styles.unitToggleCheck}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 1: Date ── */}
        {isDayMode ? (
          <>
            <SectionLabel
              step={1}
              label="Select Dates"
              sub={calPickMode === "start"
                ? "Tap start date on calendar"
                : "Now tap end date to set range"}
            />
            {/* Calendar range picker */}
            <MonthCalendar
              startIso={selectedDate}
              endIso={addDays(selectedDate, numDays)}
              onPickDate={handleCalendarPickDate}
              minIso={todayIso()}
            />
            {/* Pick-mode indicator */}
            <View style={styles.calModeRow}>
              <Pressable
                onPress={() => setCalPickMode("start")}
                style={[styles.calModeBtn, calPickMode === "start" && styles.calModeBtnActive]}
              >
                <Ionicons name="play-circle-outline" size={14} color={calPickMode === "start" ? "#fff" : ORANGE} />
                <Text style={[styles.calModeBtnText, calPickMode === "start" && styles.calModeBtnTextActive]}>
                  Start: {selectedDate}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCalPickMode("end")}
                style={[styles.calModeBtn, calPickMode === "end" && styles.calModeBtnActive]}
              >
                <Ionicons name="stop-circle-outline" size={14} color={calPickMode === "end" ? "#fff" : ORANGE} />
                <Text style={[styles.calModeBtnText, calPickMode === "end" && styles.calModeBtnTextActive]}>
                  End: {addDays(selectedDate, numDays)}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
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
                      {MONTH_NAMES_SHORT[d.date.getMonth()]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* ── STEP 2: Day-count stepper OR Time Slots ── */}
        {isDayMode ? (
          <>
            <SectionLabel
              step={2}
              label="Number of Days"
              sub={`${numDays} day${numDays > 1 ? "s" : ""} · ${selectedDate} → ${addDays(selectedDate, numDays)}`}
            />
            <View style={styles.dayPickerWrap}>
              <Pressable
                onPress={() => { if (numDays > 1) { Haptics.selectionAsync(); setNumDays(n => n - 1); } }}
                style={[styles.dayBtn, numDays <= 1 && styles.dayBtnDisabled]}
                disabled={numDays <= 1}
              >
                <Ionicons name="remove" size={22} color={numDays <= 1 ? "#ccc" : ORANGE} />
              </Pressable>
              <View style={styles.dayCountWrap}>
                <Text style={styles.dayCount}>{numDays}</Text>
                <Text style={styles.dayCountSub}>{numDays === 1 ? "day" : "days"}</Text>
              </View>
              <Pressable
                onPress={() => { if (numDays < 30) { Haptics.selectionAsync(); setNumDays(n => n + 1); } }}
                style={[styles.dayBtn, numDays >= 30 && styles.dayBtnDisabled]}
                disabled={numDays >= 30}
              >
                <Ionicons name="add" size={22} color={numDays >= 30 ? "#ccc" : ORANGE} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
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
          </>
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

        {/* ── STEP 4: Location ── */}
        {(() => {
          const svcStep = serviceTypes.length > 0 ? 1 : 0;
          const stepBase = 3 + svcStep;
          return (
            <>
              <SectionLabel
                step={stepBase}
                label="Service Location"
                sub="Where should the provider come? (optional)"
              />
              <View style={styles.locationWrap}>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={18} color={ORANGE} style={{ marginLeft: 12 }} />
                  <TextInput
                    style={styles.locationInput}
                    value={bookingLocation}
                    onChangeText={setBookingLocation}
                    placeholder="Enter your address or use GPS..."
                    placeholderTextColor={C.textTertiary}
                    multiline={false}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={getGpsLocation}
                    style={styles.gpsBtn}
                    disabled={gpsLoading}
                  >
                    {gpsLoading ? (
                      <ActivityIndicator size="small" color={ORANGE} />
                    ) : (
                      <Ionicons name="navigate" size={18} color={ORANGE} />
                    )}
                  </Pressable>
                </View>
                {bookingLocation.length > 0 && (
                  <Pressable onPress={() => setBookingLocation("")} style={styles.locationClear}>
                    <Ionicons name="close-circle" size={16} color="#ccc" />
                    <Text style={styles.locationClearText}>Clear</Text>
                  </Pressable>
                )}
              </View>

              {/* ── Notes ── */}
              <SectionLabel
                step={stepBase + 1}
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

              {/* ── Promo Code ── */}
              <SectionLabel
                step={stepBase + 2}
                label="Promo Code"
                sub="Have a coupon? Enter it below"
              />
            </>
          );
        })()}

        {/* keep promo placeholder for flow */}
        {false && <SectionLabel step={99} label="Promo Code" sub="" />}
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
        {/* Show placeholder only when needed selection is missing */}
        {((!isDayMode && selectedSlots.length === 0) || (serviceTypes.length > 0 && selectedServices.length === 0)) && (
          <View style={styles.pricePlaceholder}>
            <Ionicons name="calculator-outline" size={28} color={ORANGE} style={{ marginBottom: 8 }} />
            <Text style={styles.pricePlaceholderTitle}>Select to see pricing</Text>
            <Text style={styles.pricePlaceholderSub}>
              {!isDayMode && selectedSlots.length === 0
                ? "Choose time slots above to calculate the total"
                : "Pick a service type above to calculate the total"}
            </Text>
          </View>
        )}
        {(isDayMode || selectedSlots.length > 0) && (serviceTypes.length === 0 || selectedServices.length > 0) && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Price Summary</Text>
          </View>

          {/* ── Per-service line items (when service types selected) ── */}
          {hasServicePricing ? (
            <>
              {selectedServices.map((svc) => {
                const r = serviceTypePricingMap[svc];
                const svcPrice = r?.found
                  ? r.customer_price
                  : listing.price * unitCount;
                return (
                  <View key={svc} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel} numberOfLines={2}>
                      {svc}
                      {isDayMode ? ` × ${numDays} day${numDays > 1 ? "s" : ""}` : selectedSlots.length > 1 ? ` × ${selectedSlots.length} hrs` : ""}
                    </Text>
                    <Text style={styles.summaryValue}>
                      {pricingLoading ? "..." : `₹${svcPrice.toLocaleString("en-IN")}`}
                    </Text>
                  </View>
                );
              })}
              {selectedServices.length > 1 && (
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 8, marginTop: 2 }]}>
                  <Text style={[styles.summaryLabel, { fontFamily: "Inter_600SemiBold", color: "#2C2C2C" }]}>Subtotal</Text>
                  <Text style={[styles.summaryValue, { fontFamily: "Inter_700Bold" }]}>
                    {pricingLoading ? "..." : `₹${svcPricingTotal.toLocaleString("en-IN")}`}
                  </Text>
                </View>
              )}
              {/* Max security deposit across all selected services */}
              {selectedServices.some(svc => (serviceTypePricingMap[svc]?.security_deposit ?? 0) > 0) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Security deposit (refundable)</Text>
                  <Text style={styles.summaryValue}>
                    ₹{Math.max(...selectedServices.map(svc => serviceTypePricingMap[svc]?.security_deposit ?? 0)).toLocaleString("en-IN")}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Single base price row */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {listing.subcategory || listing.title}
                  {isDayMode && numDays > 1 ? ` × ${numDays} days`
                    : !isDayMode && selectedSlots.length > 1 ? ` × ${selectedSlots.length} hrs`
                    : isDayMode ? " × 1 day" : ""}
                </Text>
                <Text style={styles.summaryValue}>
                  ₹{baseTotal.toLocaleString("en-IN")}
                </Text>
              </View>
              {pricingResult?.found && pricingResult.security_deposit > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Security deposit (refundable)</Text>
                  <Text style={styles.summaryValue}>
                    ₹{pricingResult.security_deposit.toLocaleString("en-IN")}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Date / time slot info rows */}
          {selectedDate && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { dateStyle: "long" })}
                {isDayMode && numDays > 1 ? ` – ${addDays(selectedDate, numDays)}` : ""}
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
          {hasServicePricing
            ? selectedServices.some(svc => !serviceTypePricingMap[svc]?.found) && (
                <Text style={[styles.summaryNote, { color: "#AEAEAE" }]}>Some prices based on provider listing</Text>
              )
            : !pricingResult?.found && (
                <Text style={[styles.summaryNote, { color: "#AEAEAE" }]}>Price from provider listing</Text>
              )
          }
          <Text style={styles.summaryNote}>Payment will be collected after confirmation</Text>
        </View>
        )}

        {/* ── Confirm Button ── */}
        <GlowButton
          title="Confirm Booking"
          color={ORANGE}
          onPress={handleConfirm}
          loading={submitting}
          disabled={submitting}
          iconLeft={<Ionicons name="checkmark-circle-outline" size={22} color="#fff" />}
          iconRight={
            (isDayMode || selectedSlots.length > 0) ? (
              <View style={styles.confirmBadge}>
                <Text style={styles.confirmBadgeText}>
                  {isDayMode
                    ? `${numDays} day${numDays > 1 ? "s" : ""}`
                    : `${selectedSlots.length} hr${selectedSlots.length > 1 ? "s" : ""}`}
                </Text>
              </View>
            ) : undefined
          }
          fullWidth
          height={56}
          fontSize={17}
          borderRadius={16}
          glowStrength={0.65}
          style={{ marginHorizontal: 20, marginBottom: 12 }}
        />

        <View style={{ height: isWeb ? 30 : insets.bottom + 50 }} />
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

  /* ── Agricultural Day Picker ── */
  dayPickerWrap: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginHorizontal: 20, marginTop: 8, backgroundColor: "#fff",
    borderRadius: 16, borderWidth: 1, borderColor: "#EAEAEA",
    padding: 20, gap: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  dayBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#FFF5ED", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#FFD9BA",
  },
  dayBtnDisabled: { backgroundColor: "#F5F5F5", borderColor: "#E8E8E8" },
  dayCountWrap: { alignItems: "center", minWidth: 60 },
  dayCount: { fontSize: 40, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  dayCountSub: { fontSize: 13, color: "#AEAEAE", fontFamily: "Inter_400Regular", marginTop: -4 },
  agriInfoBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFF5ED", marginHorizontal: 20, marginTop: 10,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#FFD9BA",
  },
  agriInfoText: { fontSize: 12, color: "#FF7A18", fontFamily: "Inter_400Regular", flex: 1 },
  calModeRow: {
    flexDirection: "row", gap: 10,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
  },
  calModeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#FFD9BA", backgroundColor: "#FFF5ED",
    justifyContent: "center",
  },
  calModeBtnActive: { backgroundColor: "#FF7A18", borderColor: "#FF7A18" },
  calModeBtnText: { fontSize: 12, color: "#FF7A18", fontFamily: "Inter_600SemiBold" },
  calModeBtnTextActive: { color: "#fff" },

  /* ── Location Input ── */
  locationWrap: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: "#EAEAEA",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    overflow: "hidden",
  },
  locationRow: { flexDirection: "row", alignItems: "center", minHeight: 48 },
  locationInput: {
    flex: 1, fontSize: 14, color: "#2C2C2C",
    fontFamily: "Inter_400Regular", paddingVertical: 12, paddingHorizontal: 10,
  },
  gpsBtn: {
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
    marginRight: 4,
  },
  locationClear: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  locationClearText: { fontSize: 12, color: "#AEAEAE", fontFamily: "Inter_400Regular" },

  /* ── Booking Type Toggle ── */
  unitToggleCard: {
    marginHorizontal: 20, marginTop: 16, marginBottom: 4,
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: `${ORANGE}30`,
    shadowColor: ORANGE, shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  unitToggleHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12,
  },
  unitToggleTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#2C2C2C",
  },
  unitToggleRow: {
    flexDirection: "row", gap: 10,
  },
  unitToggleOpt: {
    flex: 1, alignItems: "center", gap: 4,
    paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: "#FFF5ED", borderWidth: 1.5, borderColor: `${ORANGE}30`,
    position: "relative",
  },
  unitToggleOptActive: {
    backgroundColor: ORANGE, borderColor: ORANGE,
    shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  unitToggleOptTitle: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: ORANGE,
  },
  unitToggleOptTitleActive: { color: "#fff" },
  unitToggleOptSub: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: "#AEAEAE",
  },
  unitToggleCheck: {
    position: "absolute", top: 6, right: 8,
  },
});
