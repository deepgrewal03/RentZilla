import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Alert, Platform,
  Dimensions, PanResponder, StatusBar,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { LocationSearchModal, type LocationResult } from "@/components/rides/LocationSearchModal";
import { SchedulePickerModal, type ScheduledTime } from "@/components/rides/SchedulePickerModal";
import LeafletMapView, { type MapRef } from "@/components/rides/LeafletMapView";

const C = Colors.light;
const { width: SW, height: SH } = Dimensions.get("window");

const ORANGE = "#E8742A";
const NAVY = "#0F1F3D";
const GOLD = "#F5C842";
const GREEN = "#22C55E";
const RED = "#EF4444";
const PURPLE = "#8B5CF6";

// Bottom sheet snap points
const SHEET_COLLAPSED = SH * 0.52;  // how much the sheet peeks from bottom
const SHEET_EXPANDED  = SH * 0.72;
const MAP_HEIGHT = SH - SHEET_COLLAPSED - (Platform.OS === "android" ? 32 : 0);

type RideStatus = "idle" | "booking" | "requested" | "scheduled" | "accepted" | "ongoing" | "completed";

interface Coords { lat: number; lng: number; address: string }
interface RideEstimate { distanceKm: number; durationMin: number; fare: number }
interface ActiveRide {
  id: string; status: string; fare: number; ride_type?: string; scheduled_at?: string;
  pickup_address?: string; drop_address?: string;
  distance_km?: number; duration_min?: number;
  driver_name?: string; driver_phone?: string;
  driver_lat?: number; driver_lng?: number;
  rider_name?: string; rider_phone?: string;
  pickup_lat: number; pickup_lng: number; drop_lat: number; drop_lng: number;
}
interface RideRequest {
  id: string; pickup_address?: string; drop_address?: string;
  pickup_lat: number; pickup_lng: number; drop_lat: number; drop_lng: number;
  distance_km?: number; fare?: number;
}

// Visual metadata only — pricing (baseFare/perKm) is fetched from the server
const VEHICLE_TYPES = [
  { id: "Bike",  icon: "🏍️", label: "Bike",  tagline: "Fastest",     color: "#06B6D4" },
  { id: "Auto",  icon: "🛺", label: "Auto",  tagline: "Affordable",  color: "#10B981" },
  { id: "Car",   icon: "🚗", label: "Car",   tagline: "Comfortable", color: ORANGE },
  { id: "SUV",   icon: "🚙", label: "SUV",   tagline: "Spacious",    color: PURPLE },
  { id: "Van",   icon: "🚐", label: "Van",   tagline: "Group",       color: "#EC4899" },
];

// Default fallback pricing used before API response arrives
const DEFAULT_PRICING: Record<string, { baseFare: number; perKm: number }> = {
  Bike: { baseFare: 30, perKm: 6 },
  Auto: { baseFare: 40, perKm: 8 },
  Car:  { baseFare: 50, perKm: 12 },
  SUV:  { baseFare: 70, perKm: 16 },
  Van:  { baseFare: 90, perKm: 20 },
};

function fmt(n?: number | null, d = 1) { return n != null ? n.toFixed(d) : "—"; }
function pad(n: number) { return String(n).padStart(2, "0"); }


// ─── STATUS STEP BAR ─────────────────────────────────────────────────────────
function RideSteps({ status }: { status: string }) {
  const STEPS = [
    { key: "requested", label: "Finding\nDriver" },
    { key: "accepted",  label: "Driver\nAssigned" },
    { key: "ongoing",   label: "On the\nWay" },
    { key: "completed", label: "Arrived" },
  ];
  const currentIdx = STEPS.findIndex(s => s.key === status);

  return (
    <View style={styles.stepsRow}>
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                done && { backgroundColor: GREEN },
                active && { backgroundColor: ORANGE, borderColor: ORANGE, borderWidth: 2 },
              ]}>
                {done && <Feather name="check" size={10} color="#fff" />}
              </View>
              <Text style={[styles.stepLabel, active && { color: ORANGE }]}>{step.label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, done && { backgroundColor: GREEN }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── VEHICLE CARD ─────────────────────────────────────────────────────────────
function VehicleCard({
  v, selected, estimate, onPress, distanceKm, pricing,
}: {
  v: typeof VEHICLE_TYPES[0]; selected: boolean;
  estimate: RideEstimate | null;
  onPress: () => void; distanceKm?: number;
  pricing: { baseFare: number; perKm: number };
}) {
  const fare = distanceKm != null
    ? Math.max(pricing.baseFare, Math.round(pricing.baseFare + distanceKm * pricing.perKm))
    : null;
  const eta = estimate ? estimate.durationMin + (v.id === "Bike" ? -3 : v.id === "Auto" ? -1 : v.id === "SUV" ? 2 : v.id === "Van" ? 4 : 0) : null;

  return (
    <TouchableOpacity
      style={[styles.vehicleCard, selected && { borderColor: v.color, backgroundColor: v.color + "12" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {selected && (
        <View style={[styles.vehicleCheck, { backgroundColor: v.color }]}>
          <Feather name="check" size={10} color="#fff" />
        </View>
      )}
      <Text style={styles.vehicleEmoji}>{v.icon}</Text>
      <Text style={[styles.vehicleName, selected && { color: v.color }]}>{v.label}</Text>
      <Text style={styles.vehicleTagline}>{v.tagline}</Text>
      {fare != null ? (
        <Text style={[styles.vehicleFare, selected && { color: v.color }]}>₹{fare}</Text>
      ) : (
        <View style={styles.vehicleFareSkeleton} />
      )}
      {eta != null && (
        <Text style={styles.vehicleEta}>{Math.max(2, eta)} min</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── ANIMATED BOTTOM SHEET ───────────────────────────────────────────────────
function BottomSheet({ children, isExpanded, onToggle }: {
  children: React.ReactNode; isExpanded: boolean; onToggle: () => void;
}) {
  const sheetY = useRef(new Animated.Value(SHEET_COLLAPSED)).current;

  useEffect(() => {
    Animated.spring(sheetY, {
      toValue: isExpanded ? SHEET_EXPANDED : SHEET_COLLAPSED,
      tension: 60, friction: 12, useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30) {
          Animated.spring(sheetY, { toValue: SHEET_EXPANDED, tension: 60, friction: 12, useNativeDriver: false }).start();
        } else if (g.dy > 30) {
          Animated.spring(sheetY, { toValue: SHEET_COLLAPSED, tension: 60, friction: 12, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.bottomSheet, { height: sheetY }]}>
      {/* Drag handle */}
      <TouchableOpacity {...panResponder.panHandlers} onPress={onToggle} style={styles.handleArea} activeOpacity={1}>
        <View style={styles.handleBar} />
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function CarsScreen() {
  const insets = useSafeAreaInsets();
  const { user, activeMode } = useAuth();
  const { get, post, patch } = useApi();

  const isProvider = (user?.role === "provider" || user?.role === "both") && activeMode === "provider";
  const isProviderUser = user?.role === "provider" || user?.role === "both";
  const [tab, setTab] = useState<"rider" | "driver">(isProvider ? "driver" : "rider");

  // ── Rider State ──
  const DEFAULT: Coords = { lat: 30.7333, lng: 76.7794, address: "Chandigarh, Punjab" };
  const [pickup, setPickup]         = useState<Coords>(DEFAULT);
  const [drop, setDrop]             = useState<Coords | null>(null);
  const [vehicleType, setVehicleType] = useState("Car");
  const [estimate, setEstimate]     = useState<RideEstimate | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [rideMode, setRideMode]     = useState<"instant" | "scheduled">("instant");
  const [scheduledTime, setScheduledTime] = useState<ScheduledTime | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  // ── Dynamic pricing from admin ──
  const [ridePricing, setRidePricing] = useState<Record<string, { baseFare: number; perKm: number }>>(DEFAULT_PRICING);

  // ── Modals ──
  const [pickupModalOpen,  setPickupModalOpen]  = useState(false);
  const [dropModalOpen,    setDropModalOpen]    = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // ── Driver State ──
  const [isOnline, setIsOnline]           = useState(false);
  const [driverRequests, setDriverRequests] = useState<RideRequest[]>([]);
  const [driverActiveRide, setDriverActiveRide] = useState<ActiveRide | null>(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RideRequest | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapRef>(null);
  const mapReadyRef = useRef(false);

  const syncPickupToMap = useCallback((loc: Coords) => {
    if (mapReadyRef.current) mapRef.current?.setPickup(loc.lat, loc.lng, loc.address);
  }, []);
  const syncDropToMap = useCallback((loc: Coords) => {
    if (mapReadyRef.current) mapRef.current?.setDrop(loc.lat, loc.lng, loc.address);
  }, []);

  // ── Location ──
  useEffect(() => {
    (async () => {
      setLocLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude: lat, longitude: lng } = loc.coords;
        let address = "Current Location";
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (geo[0]) {
            const g = geo[0];
            address = [g.name, g.city, g.region].filter(Boolean).join(", ").substring(0, 50);
          }
        } catch {}
        const loc2: Coords = { lat, lng, address };
        setPickup(loc2);
        syncPickupToMap(loc2);
      } catch {}
      finally { setLocLoading(false); }
    })();
  }, []);

  // ── Fetch live pricing from admin rules ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await get<Record<string, { baseFare: number; perKm: number }>>("/pricing/rides");
        if (data && typeof data === "object") {
          setRidePricing(prev => ({ ...prev, ...data }));
        }
      } catch {}
    })();
  }, []);

  // ── Update estimate when vehicle type changes (if we have a map route) ──
  useEffect(() => {
    if (!estimate || !drop) return;
    const p = ridePricing[vehicleType] ?? DEFAULT_PRICING[vehicleType] ?? { baseFare: 50, perKm: 12 };
    const fare = Math.max(p.baseFare, Math.round(p.baseFare + estimate.distanceKm * p.perKm));
    setEstimate(prev => prev ? { ...prev, fare } : null);
  }, [vehicleType, ridePricing]);

  const handleRouteCalculated = useCallback((distanceKm: number, durationMin: number) => {
    const p = ridePricing[vehicleType] ?? DEFAULT_PRICING[vehicleType] ?? { baseFare: 50, perKm: 12 };
    const fare = Math.max(p.baseFare, Math.round(p.baseFare + distanceKm * p.perKm));
    setEstimate({ distanceKm, durationMin, fare });
    setSheetExpanded(true);
  }, [vehicleType, ridePricing]);

  // ── Poll rider active ride ──
  useEffect(() => {
    if (tab !== "rider") return;
    const check = async () => {
      if (rideStatus === "idle") return;
      try {
        const data = await get<ActiveRide | null>("/rides/active");
        if (data) { setActiveRide(data); setRideStatus(data.status as RideStatus); }
        else if (rideStatus === "completed") { /* stay on completed view */ }
        else { setActiveRide(null); setRideStatus("idle"); }
      } catch {}
    };
    pollRef.current = setInterval(check, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, rideStatus]);

  // ── Poll driver requests + active ride ──
  useEffect(() => {
    if (tab !== "driver" || !isOnline) return;
    const check = async () => {
      try {
        const [reqs, active] = await Promise.all([
          get<RideRequest[]>("/rides/driver/requests"),
          get<ActiveRide | null>("/rides/driver/active"),
        ]);
        setDriverRequests(reqs ?? []);
        setDriverActiveRide(active);
      } catch {}
    };
    check();
    pollRef.current = setInterval(check, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, isOnline]);

  // ── Driver location broadcast ──
  useEffect(() => {
    if (tab !== "driver" || !isOnline) return;
    let watchSub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
        (loc) => { post("/rides/driver/location", { lat: loc.coords.latitude, lng: loc.coords.longitude }).catch(() => {}); }
      );
    })();
    return () => { watchSub?.remove(); };
  }, [tab, isOnline]);

  // ── Booking ──
  const handleBookRide = async () => {
    if (!drop) { Alert.alert("Destination required", "Please select a destination first"); return; }
    if (rideMode === "scheduled" && !scheduledTime) { setScheduleModalOpen(true); return; }
    setRideStatus("booking");
    try {
      const data = await post<ActiveRide>("/rides/request", {
        pickupLat: pickup.lat, pickupLng: pickup.lng, pickupAddress: pickup.address,
        dropLat: drop.lat, dropLng: drop.lng, dropAddress: drop.address,
        vehicleType,
        ...(rideMode === "scheduled" && scheduledTime ? { scheduledAt: scheduledTime.date.toISOString() } : {}),
      });
      setActiveRide(data);
      setRideStatus(rideMode === "scheduled" ? "scheduled" : "requested");
    } catch (e: any) {
      setRideStatus("idle");
      Alert.alert("Error", e?.message ?? "Could not book ride");
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    try {
      await patch(`/rides/${activeRide.id}/cancel`, {});
      setActiveRide(null); setRideStatus("idle"); setDrop(null);
      setScheduledTime(null); setSheetExpanded(false); setEstimate(null);
      mapRef.current?.clearDrop();
    } catch {}
  };

  const handleToggleOnline = async () => {
    setDriverLoading(true);
    try {
      await patch("/rides/driver/status", { isOnline: !isOnline });
      setIsOnline(v => !v);
      if (isOnline) { setDriverRequests([]); setDriverActiveRide(null); }
    } catch {}
    setDriverLoading(false);
  };

  const handleAcceptRide = async (rid: string) => {
    try {
      await patch(`/rides/${rid}/accept`, {});
      setSelectedRequest(null);
      const active = await get<ActiveRide | null>("/rides/driver/active");
      setDriverActiveRide(active);
      setDriverRequests([]);
    } catch (e: any) { Alert.alert("Oops", e?.message ?? "Could not accept ride"); }
  };

  const handleStartRide = async () => {
    if (!driverActiveRide) return;
    await patch(`/rides/${driverActiveRide.id}/start`, {});
    setDriverActiveRide({ ...driverActiveRide, status: "ongoing" });
  };

  const handleEndRide = async () => {
    if (!driverActiveRide) return;
    await patch(`/rides/${driverActiveRide.id}/end`, {});
    setDriverActiveRide(null);
  };

  // ── RIDER UI ────────────────────────────────────────────────────────────────
  const renderRider = () => {
    const hasActiveRide = ["requested", "scheduled", "accepted", "ongoing", "completed"].includes(rideStatus);
    const selectedVehicle = VEHICLE_TYPES.find(v => v.id === vehicleType) ?? VEHICLE_TYPES[2];

    return (
      <>
        {/* Real Interactive Map */}
        <View style={[styles.mapContainer, { height: MAP_HEIGHT }]}>
          <LeafletMapView
            ref={mapRef}
            initialLat={pickup.lat}
            initialLng={pickup.lng}
            onReady={() => {
              mapReadyRef.current = true;
              mapRef.current?.setPickup(pickup.lat, pickup.lng, pickup.address);
              if (drop) mapRef.current?.setDrop(drop.lat, drop.lng, drop.address);
            }}
            onRouteCalculated={handleRouteCalculated}
            onCenterChanged={(lat, lng, address) => {
              // When user drags the map — update pickup with the fully reverse-geocoded address
              if (rideStatus === "idle" && !activeRide) {
                setPickup({ lat, lng, address });
              }
            }}
            onGpsLocation={(lat, lng, address) => {
              const loc: Coords = { lat, lng, address };
              setPickup(loc);
            }}
            onLocationSelected={(mode, lat, lng, address) => {
              if (mode === "pickup") {
                setPickup({ lat, lng, address });
              } else {
                const loc: Coords = { lat, lng, address };
                setDrop(loc);
                setEstimate(null);
              }
            }}
          />
          {activeRide?.driver_lat && ["accepted", "ongoing"].includes(rideStatus) && (
            <View pointerEvents="none" style={StyleSheet.absoluteFillObject} />
          )}
        </View>

        {/* Bottom Sheet */}
        <BottomSheet isExpanded={sheetExpanded} onToggle={() => setSheetExpanded(v => !v)}>
          {hasActiveRide && activeRide ? (
            // ── Active ride view ──
            <View style={styles.sheetInner}>
              {rideStatus === "scheduled" ? (
                <View style={styles.scheduledBanner}>
                  <Feather name="clock" size={16} color={PURPLE} />
                  <Text style={styles.scheduledText}>
                    Scheduled for {activeRide.scheduled_at
                      ? new Date(activeRide.scheduled_at).toLocaleString("en-IN", { weekday: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </Text>
                </View>
              ) : (
                <RideSteps status={rideStatus} />
              )}

              <View style={styles.routeCard}>
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
                  <Text style={styles.routeAddr} numberOfLines={2}>{activeRide.pickup_address ?? "Pickup"}</Text>
                </View>
                <View style={styles.routeConnector} />
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
                  <Text style={styles.routeAddr} numberOfLines={2}>{activeRide.drop_address ?? "Destination"}</Text>
                </View>

                <View style={styles.rideMeta}>
                  <View style={styles.rideMetaItem}>
                    <Feather name="navigation" size={13} color={C.textSecondary} />
                    <Text style={styles.rideMetaText}>{fmt(activeRide.distance_km)} km</Text>
                  </View>
                  <View style={styles.rideMetaItem}>
                    <Feather name="clock" size={13} color={C.textSecondary} />
                    <Text style={styles.rideMetaText}>{activeRide.duration_min} min</Text>
                  </View>
                  <View style={styles.rideMetaItem}>
                    <Text style={styles.rideMetaFare}>₹{activeRide.fare}</Text>
                  </View>
                </View>
              </View>

              {activeRide.driver_name && (
                <View style={styles.driverCard}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>{activeRide.driver_name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{activeRide.driver_name}</Text>
                    <Text style={styles.driverSub}>Your driver • {selectedVehicle.icon} {vehicleType}</Text>
                  </View>
                  <TouchableOpacity style={styles.callBtn}>
                    <Feather name="phone" size={16} color={GREEN} />
                  </TouchableOpacity>
                </View>
              )}

              {["requested", "scheduled"].includes(rideStatus) && (
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRide}>
                  <Text style={styles.cancelBtnText}>Cancel Ride</Text>
                </TouchableOpacity>
              )}
              {rideStatus === "completed" && (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => {
                  setRideStatus("idle"); setActiveRide(null); setDrop(null);
                  setScheduledTime(null); setSheetExpanded(false);
                }}>
                  <Feather name="star" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>Done — Rate Ride</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            // ── Booking form ──
            <View style={styles.sheetInner}>
              {/* Ride mode toggle */}
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeBtn, rideMode === "instant" && styles.modeBtnActive]}
                  onPress={() => setRideMode("instant")}
                >
                  <Feather name="zap" size={14} color={rideMode === "instant" ? "#fff" : C.textSecondary} />
                  <Text style={[styles.modeBtnText, rideMode === "instant" && styles.modeBtnTextActive]}>
                    Book Now
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, rideMode === "scheduled" && { ...styles.modeBtnActive, backgroundColor: PURPLE }]}
                  onPress={() => setRideMode("scheduled")}
                >
                  <Feather name="clock" size={14} color={rideMode === "scheduled" ? "#fff" : C.textSecondary} />
                  <Text style={[styles.modeBtnText, rideMode === "scheduled" && styles.modeBtnTextActive]}>
                    Schedule
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Scheduled time display */}
              {rideMode === "scheduled" && (
                <TouchableOpacity style={styles.scheduledTimeRow} onPress={() => setScheduleModalOpen(true)}>
                  <Feather name="clock" size={16} color={PURPLE} />
                  <Text style={styles.scheduledTimeText}>
                    {scheduledTime ? scheduledTime.label : "Select date & time"}
                  </Text>
                  <Feather name="chevron-right" size={16} color={C.textTertiary} />
                </TouchableOpacity>
              )}

              {/* Location inputs */}
              <View style={styles.locationBox}>
                {/* Pickup */}
                <TouchableOpacity style={styles.locationRow} onPress={() => setPickupModalOpen(true)}>
                  <View style={[styles.locDot, { backgroundColor: GREEN }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locLabel}>Pickup</Text>
                    <Text style={styles.locValue} numberOfLines={1}>
                      {locLoading ? "Detecting your location…" : pickup.address}
                    </Text>
                  </View>
                  <Feather name="edit-2" size={14} color={C.textTertiary} />
                </TouchableOpacity>

                <View style={styles.locDivider}>
                  <View style={styles.locLine} />
                </View>

                {/* Drop */}
                <TouchableOpacity
                  style={[styles.locationRow, !drop && styles.locationRowPlaceholder]}
                  onPress={() => { setDropModalOpen(true); setSheetExpanded(true); }}
                >
                  <View style={[styles.locDot, { backgroundColor: drop ? ORANGE : C.border }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locLabel}>Drop-off</Text>
                    <Text style={[styles.locValue, !drop && { color: C.textTertiary }]} numberOfLines={1}>
                      {drop ? drop.address : "Where are you going?"}
                    </Text>
                  </View>
                  <Feather name={drop ? "edit-2" : "search"} size={14} color={drop ? C.textTertiary : ORANGE} />
                </TouchableOpacity>
              </View>

              {/* Estimate summary (compact) */}
              {estimate && (
                <LinearGradient colors={[NAVY, "#1a3060"]} style={styles.estimateBanner}>
                  <View style={styles.estimateStat}>
                    <Text style={styles.estimateVal}>{fmt(estimate.distanceKm)} km</Text>
                    <Text style={styles.estimateKey}>Distance</Text>
                  </View>
                  <View style={styles.estimateDivider} />
                  <View style={styles.estimateStat}>
                    <Text style={styles.estimateVal}>{estimate.durationMin} min</Text>
                    <Text style={styles.estimateKey}>Est. time</Text>
                  </View>
                  <View style={styles.estimateDivider} />
                  <View style={styles.estimateStat}>
                    <Text style={[styles.estimateVal, { color: GOLD }]}>
                      ₹{estimate.fare}
                    </Text>
                    <Text style={styles.estimateKey}>Base fare</Text>
                  </View>
                </LinearGradient>
              )}

              {/* Vehicle selector */}
              {drop && (
                <>
                  <Text style={styles.sectionLabel}>Choose Vehicle</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleRow}>
                    {VEHICLE_TYPES.map(v => (
                      <VehicleCard
                        key={v.id} v={v}
                        selected={vehicleType === v.id}
                        estimate={estimate}
                        distanceKm={estimate?.distanceKm}
                        onPress={() => setVehicleType(v.id)}
                        pricing={ridePricing[v.id] ?? DEFAULT_PRICING[v.id] ?? { baseFare: 50, perKm: 12 }}
                      />
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Book button */}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { marginTop: 12, backgroundColor: rideMode === "scheduled" ? PURPLE : ORANGE },
                  (!drop) && { opacity: 0.45 },
                ]}
                onPress={handleBookRide}
                disabled={!drop || rideStatus === "booking"}
              >
                {rideStatus === "booking"
                  ? <ActivityIndicator color="#fff" />
                  : <>
                    <Feather name={rideMode === "scheduled" ? "clock" : "navigation"} size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>
                      {rideMode === "scheduled"
                        ? (scheduledTime ? `Schedule for ${scheduledTime.label}` : "Schedule Ride")
                        : "Book Ride Now"}
                    </Text>
                  </>
                }
              </TouchableOpacity>
            </View>
          )}
        </BottomSheet>
      </>
    );
  };

  // ── DRIVER UI ───────────────────────────────────────────────────────────────
  const renderDriver = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.driverContainer]}>
      {/* Online toggle */}
      <LinearGradient
        colors={isOnline ? ["#14532D", "#15803D"] : [NAVY, "#1a3060"]}
        style={styles.onlineCard}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.onlineStatusRow}>
            <View style={[styles.onlineLED, { backgroundColor: isOnline ? GREEN : C.textTertiary }]} />
            <Text style={styles.onlineStatusText}>{isOnline ? "Online — Receiving Requests" : "Offline"}</Text>
          </View>
          <Text style={styles.onlineSubText}>
            {isOnline ? "Ride requests appear below. Location is broadcasting." : "Go online to start earning."}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.onlineToggleBtn, { backgroundColor: isOnline ? RED : GREEN }]}
          onPress={handleToggleOnline}
          disabled={driverLoading}
        >
          {driverLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.onlineToggleText}>{isOnline ? "Go\nOffline" : "Go\nOnline"}</Text>
          }
        </TouchableOpacity>
      </LinearGradient>

      {/* Active ride for driver */}
      {driverActiveRide && (
        <View style={styles.driverActiveCard}>
          <View style={styles.driverActiveHeader}>
            <Text style={styles.driverActiveTitle}>Active Ride</Text>
            <View style={[styles.statusPill, { backgroundColor: driverActiveRide.status === "ongoing" ? `${ORANGE}22` : `${GREEN}22` }]}>
              <Text style={[styles.statusPillText, { color: driverActiveRide.status === "ongoing" ? ORANGE : GREEN }]}>
                {driverActiveRide.status === "ongoing" ? "On Trip" : "Assigned"}
              </Text>
            </View>
          </View>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
            <Text style={styles.routeAddr}>{driverActiveRide.pickup_address ?? `${driverActiveRide.pickup_lat.toFixed(3)}, ${driverActiveRide.pickup_lng.toFixed(3)}`}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
            <Text style={styles.routeAddr}>{driverActiveRide.drop_address ?? `${driverActiveRide.drop_lat.toFixed(3)}, ${driverActiveRide.drop_lng.toFixed(3)}`}</Text>
          </View>
          <View style={styles.rideMeta}>
            <View style={styles.rideMetaItem}>
              <Text style={styles.rideMetaText}>Rider: {driverActiveRide.rider_name ?? "—"}</Text>
            </View>
            <View style={styles.rideMetaItem}>
              <Text style={styles.rideMetaFare}>₹{driverActiveRide.fare}</Text>
            </View>
          </View>
          {driverActiveRide.status === "accepted" && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: GREEN }]} onPress={handleStartRide}>
              <Feather name="play" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Start Trip</Text>
            </TouchableOpacity>
          )}
          {driverActiveRide.status === "ongoing" && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: RED }]} onPress={handleEndRide}>
              <Feather name="flag" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>End Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Ride requests */}
      {isOnline && !driverActiveRide && (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.sectionLabel}>
            {driverRequests.length ? `${driverRequests.length} Ride Request${driverRequests.length > 1 ? "s" : ""}` : "Waiting for requests…"}
          </Text>
          {driverRequests.length === 0 && (
            <View style={styles.driverEmptyState}>
              <Text style={{ fontSize: 44 }}>🚗</Text>
              <Text style={styles.emptyTitle}>Standby for rides</Text>
              <Text style={styles.emptyDesc}>New requests will pop up here instantly</Text>
            </View>
          )}
          {driverRequests.map(req => (
            <View key={req.id} style={styles.requestCard}>
              <View style={{ flex: 1 }}>
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
                  <Text style={styles.routeAddr} numberOfLines={1}>{req.pickup_address ?? `${req.pickup_lat.toFixed(3)}, ${req.pickup_lng.toFixed(3)}`}</Text>
                </View>
                <View style={styles.routeConnector} />
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
                  <Text style={styles.routeAddr} numberOfLines={1}>{req.drop_address ?? `${req.drop_lat.toFixed(3)}, ${req.drop_lng.toFixed(3)}`}</Text>
                </View>
                <View style={styles.rideMeta}>
                  <Text style={styles.rideMetaText}>{fmt(req.distance_km)} km</Text>
                  <Text style={[styles.rideMetaFare, { color: GOLD }]}>₹{req.fare ?? "—"}</Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity style={styles.rejectSmallBtn} onPress={() => {}}>
                  <Feather name="x" size={16} color={RED} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptSmallBtn} onPress={() => setSelectedRequest(req)}>
                  <Text style={styles.acceptSmallText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {!isOnline && (
        <View style={styles.driverEmptyState}>
          <Text style={{ fontSize: 44 }}>🌙</Text>
          <Text style={styles.emptyTitle}>You're offline</Text>
          <Text style={styles.emptyDesc}>Tap "Go Online" to start receiving ride requests</Text>
        </View>
      )}

      {/* Request detail */}
      {selectedRequest && (
        <View style={styles.requestDetailOverlay}>
          <View style={styles.requestDetailCard}>
            <Text style={styles.requestDetailTitle}>New Ride Request</Text>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
              <View>
                <Text style={styles.routeAddrSmall}>Pickup</Text>
                <Text style={styles.routeAddr}>{selectedRequest.pickup_address ?? `${selectedRequest.pickup_lat.toFixed(4)}, ${selectedRequest.pickup_lng.toFixed(4)}`}</Text>
              </View>
            </View>
            <View style={styles.routeConnector} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
              <View>
                <Text style={styles.routeAddrSmall}>Destination</Text>
                <Text style={styles.routeAddr}>{selectedRequest.drop_address ?? `${selectedRequest.drop_lat.toFixed(4)}, ${selectedRequest.drop_lng.toFixed(4)}`}</Text>
              </View>
            </View>
            <LinearGradient colors={[NAVY, "#1a3060"]} style={[styles.estimateBanner, { marginTop: 12 }]}>
              <View style={styles.estimateStat}>
                <Text style={styles.estimateVal}>{fmt(selectedRequest.distance_km)} km</Text>
                <Text style={styles.estimateKey}>Distance</Text>
              </View>
              <View style={styles.estimateDivider} />
              <View style={styles.estimateStat}>
                <Text style={[styles.estimateVal, { color: GOLD }]}>₹{selectedRequest.fare ?? "—"}</Text>
                <Text style={styles.estimateKey}>Fare</Text>
              </View>
            </LinearGradient>
            <View style={styles.requestDetailBtns}>
              <TouchableOpacity style={styles.declineBtn} onPress={() => setSelectedRequest(null)}>
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => handleAcceptRide(selectedRequest.id)}>
                <Text style={styles.primaryBtnText}>Accept Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <LinearGradient colors={[NAVY, "#152847"]} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Cars</Text>
          <Text style={styles.headerSub}>Ride-booking · Punjab</Text>
        </View>
        {isProviderUser && (
          <View style={styles.tabPills}>
            {(["rider", "driver"] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabPill, tab === t && styles.tabPillActive]}
                onPress={() => { setTab(t); if (pollRef.current) clearInterval(pollRef.current); }}
              >
                <Feather
                  name={t === "rider" ? "user" : "truck"}
                  size={13} color={tab === t ? "#fff" : "rgba(255,255,255,0.55)"}
                />
                <Text style={[styles.tabPillText, tab === t && styles.tabPillTextActive]}>
                  {t === "rider" ? "Rider" : "Driver"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </LinearGradient>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === "rider" ? renderRider() : renderDriver()}
      </View>

      {/* Modals */}
      <LocationSearchModal
        visible={pickupModalOpen}
        onClose={() => setPickupModalOpen(false)}
        onSelect={(loc: LocationResult) => {
          const p: Coords = { lat: loc.lat, lng: loc.lng, address: loc.address };
          setPickup(p);
          mapRef.current?.setPickup(loc.lat, loc.lng, loc.address);
          mapRef.current?.setMode("drop");
        }}
        title="Choose Pickup"
        color={GREEN}
        showCurrentLocation
        onCurrentLocation={() => {
          mapRef.current?.getCurrentLocation();
        }}
        userLat={pickup.lat}
        userLng={pickup.lng}
      />
      <LocationSearchModal
        visible={dropModalOpen}
        onClose={() => setDropModalOpen(false)}
        onSelect={(loc: LocationResult) => {
          const d: Coords = { lat: loc.lat, lng: loc.lng, address: loc.address };
          setDrop(d);
          setEstimate(null);
          mapRef.current?.setDrop(loc.lat, loc.lng, loc.address);
        }}
        title="Choose Destination"
        color={ORANGE}
        userLat={pickup.lat}
        userLng={pickup.lng}
      />
      <SchedulePickerModal
        visible={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onConfirm={(t: ScheduledTime) => setScheduledTime(t)}
      />
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a1628" },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", marginTop: 2 },
  tabPills: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 3, gap: 2 },
  tabPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 17 },
  tabPillActive: { backgroundColor: ORANGE },
  tabPillText: { fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_500Medium" },
  tabPillTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  // Map container
  mapContainer: { width: "100%", overflow: "hidden", position: "relative", backgroundColor: "#e8ddd0" },
  coordText: { fontSize: 10, color: GOLD, fontFamily: "Inter_400Regular" },

  // Bottom sheet
  bottomSheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  handleArea: { alignItems: "center", paddingVertical: 10 },
  handleBar: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2 },
  sheetInner: { paddingHorizontal: 16, paddingBottom: 8 },

  // Ride mode toggle
  modeToggle: { flexDirection: "row", backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 4, gap: 4, marginBottom: 14 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 11 },
  modeBtnActive: { backgroundColor: ORANGE },
  modeBtnText: { fontSize: 14, fontWeight: "600", color: C.textSecondary, fontFamily: "Inter_600SemiBold" },
  modeBtnTextActive: { color: "#fff" },

  // Scheduled time
  scheduledTimeRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${PURPLE}14`, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: `${PURPLE}30` },
  scheduledTimeText: { flex: 1, fontSize: 14, color: PURPLE, fontFamily: "Inter_500Medium" },

  // Location box
  locationBox: { backgroundColor: C.backgroundSecondary, borderRadius: 18, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  locationRowPlaceholder: {},
  locDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  locDivider: { paddingLeft: 16 },
  locLine: { height: 1, backgroundColor: C.border },
  locLabel: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular", marginBottom: 2 },
  locValue: { fontSize: 15, color: C.text, fontFamily: "Inter_500Medium" },

  // Estimate banner
  estimateBanner: { borderRadius: 16, padding: 16, marginBottom: 14, flexDirection: "row", alignItems: "center" },
  estimateStat: { flex: 1, alignItems: "center" },
  estimateVal: { fontSize: 18, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  estimateKey: { fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", marginTop: 3 },
  estimateDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.1)" },

  // Section label
  sectionLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 },

  // Vehicle row
  vehicleRow: { gap: 10, paddingRight: 8, paddingBottom: 4 },
  vehicleCard: { alignItems: "center", padding: 12, borderRadius: 18, backgroundColor: C.backgroundSecondary, minWidth: 88, borderWidth: 1.5, borderColor: "transparent", position: "relative" },
  vehicleCheck: { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  vehicleEmoji: { fontSize: 26, marginBottom: 4 },
  vehicleName: { fontSize: 13, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  vehicleTagline: { fontSize: 10, color: C.textTertiary, fontFamily: "Inter_400Regular", marginTop: 2 },
  vehicleFare: { fontSize: 15, fontWeight: "800", color: C.text, fontFamily: "Inter_700Bold", marginTop: 6 },
  vehicleFareSkeleton: { width: 40, height: 16, backgroundColor: C.border, borderRadius: 4, marginTop: 6 },
  vehicleEta: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Primary button
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16 },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  cancelBtn: { borderRadius: 16, paddingVertical: 15, alignItems: "center", borderWidth: 1.5, borderColor: RED, marginTop: 8 },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: RED, fontFamily: "Inter_600SemiBold" },

  // Ride details
  routeCard: { backgroundColor: C.backgroundSecondary, borderRadius: 16, padding: 14, marginBottom: 12 },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeConnector: { width: 2, height: 14, backgroundColor: C.border, marginLeft: 4, marginVertical: 3 },
  routeAddr: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 20 },
  routeAddrSmall: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  rideMeta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, flexWrap: "wrap" },
  rideMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  rideMetaText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  rideMetaFare: { fontSize: 16, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },

  // Driver card
  driverCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.backgroundSecondary, borderRadius: 16, padding: 14, marginBottom: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${ORANGE}22`, alignItems: "center", justifyContent: "center" },
  driverAvatarText: { fontSize: 20, fontWeight: "700", color: ORANGE, fontFamily: "Inter_700Bold" },
  driverName: { fontSize: 15, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  driverSub: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${GREEN}18`, alignItems: "center", justifyContent: "center" },

  // Steps bar
  stepsRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: C.border },
  stepLabel: { fontSize: 9, color: C.textTertiary, textAlign: "center", fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 12 },
  stepLine: { flex: 1, height: 2, backgroundColor: C.border, marginBottom: 16 },

  // Scheduled banner
  scheduledBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: `${PURPLE}14`, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: `${PURPLE}30` },
  scheduledText: { fontSize: 14, color: PURPLE, fontFamily: "Inter_500Medium", flex: 1 },

  // Driver view
  driverContainer: { paddingTop: 16, paddingBottom: 120 },
  onlineCard: { marginHorizontal: 16, borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  onlineStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  onlineLED: { width: 10, height: 10, borderRadius: 5 },
  onlineStatusText: { fontSize: 15, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  onlineSubText: { fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", lineHeight: 18 },
  onlineToggleBtn: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, alignItems: "center", minWidth: 70 },
  onlineToggleText: { fontSize: 13, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold", textAlign: "center" },
  driverActiveCard: { marginHorizontal: 16, backgroundColor: C.backgroundSecondary, borderRadius: 20, padding: 16, marginBottom: 16 },
  driverActiveHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  driverActiveTitle: { fontSize: 16, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  requestCard: { backgroundColor: C.backgroundSecondary, borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  requestActions: { gap: 8, alignItems: "center" },
  rejectSmallBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${RED}15`, alignItems: "center", justifyContent: "center" },
  acceptSmallBtn: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  acceptSmallText: { fontSize: 13, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  driverEmptyState: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 30, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  // Request detail overlay
  requestDetailOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", padding: 16, paddingBottom: 40 },
  requestDetailCard: { backgroundColor: C.background, borderRadius: 24, padding: 20 },
  requestDetailTitle: { fontSize: 18, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold", marginBottom: 14 },
  requestDetailBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  declineBtn: { flex: 0.6, borderRadius: 14, paddingVertical: 15, alignItems: "center", borderWidth: 1.5, borderColor: C.border },
  declineBtnText: { fontSize: 15, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
});
