import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Animated, Alert, Platform,
  Dimensions, KeyboardAvoidingView, Modal,
} from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;
const { width: SW, height: SH } = Dimensions.get("window");
const MAP_H = Math.min(SH * 0.38, 300);

const ORANGE = "#E8742A";
const NAVY = "#0F1F3D";
const GOLD = "#F5C842";
const GREEN = "#22C55E";
const RED = "#EF4444";

type RideStatus = "idle" | "estimating" | "booking" | "requested" | "accepted" | "ongoing" | "completed";

interface Coords { lat: number; lng: number; address?: string }
interface RideEstimate { distanceKm: number; durationMin: number; fare: number }
interface ActiveRide {
  id: string; status: string; fare: number;
  pickup_address?: string; drop_address?: string;
  distance_km?: number; duration_min?: number;
  driver_name?: string; driver_phone?: string;
  driver_lat?: number; driver_lng?: number;
  rider_name?: string; rider_phone?: string;
  pickup_lat: number; pickup_lng: number;
  drop_lat: number; drop_lng: number;
}
interface RideRequest {
  id: string; pickup_address?: string; drop_address?: string;
  pickup_lat: number; pickup_lng: number; drop_lat: number; drop_lng: number;
  distance_km?: number; fare?: number;
}

const VEHICLE_TYPES = [
  { id: "Bike", label: "Bike", icon: "🏍️", tagline: "Fastest" },
  { id: "Auto", label: "Auto", icon: "🛺", tagline: "Affordable" },
  { id: "Car", label: "Car", icon: "🚗", tagline: "Comfortable" },
  { id: "SUV", label: "SUV", icon: "🚙", tagline: "Spacious" },
];

function fmt(n?: number | null) { return n ? n.toFixed(1) : "—"; }

// ─── Animated Map Background ───────────────────────────────────────────────
function MapCanvas({ pickup, drop }: { pickup?: Coords; drop?: Coords }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.25, duration: 900, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }),
    ])).start();
  }, []);

  const gridLines = Array.from({ length: 9 }, (_, i) => i);

  return (
    <LinearGradient colors={["#0d1b35", "#1a2f55", "#0d1b35"]} style={styles.mapCanvas}>
      {/* Grid streets */}
      {gridLines.map(i => (
        <View key={`h${i}`} style={[styles.gridLine, { top: (i + 1) * (MAP_H / 10), width: "100%" }]} />
      ))}
      {gridLines.map(i => (
        <View key={`v${i}`} style={[styles.gridLine, { left: (i + 1) * (SW / 10), height: "100%", width: 1 }]} />
      ))}

      {/* Route line */}
      {pickup && drop && (
        <LinearGradient
          colors={[ORANGE, GOLD]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.routeLine, { width: SW * 0.5, left: SW * 0.2, top: MAP_H * 0.45 }]}
        />
      )}

      {/* Pickup pin */}
      {pickup && (
        <View style={[styles.mapPin, { bottom: 30, left: SW * 0.28 }]}>
          <View style={[styles.pinDot, { backgroundColor: GREEN }]} />
          <View style={[styles.pinLabel, { borderColor: GREEN }]}>
            <Text style={styles.pinText} numberOfLines={1}>Pickup</Text>
          </View>
        </View>
      )}

      {/* Drop pin */}
      {drop && (
        <Animated.View style={[styles.mapPin, { top: 26, right: SW * 0.18, transform: [{ scale: pulse }] }]}>
          <View style={[styles.pinDot, { backgroundColor: ORANGE }]} />
          <View style={[styles.pinLabel, { borderColor: ORANGE }]}>
            <Text style={styles.pinText} numberOfLines={1}>Drop</Text>
          </View>
        </Animated.View>
      )}

      {/* Location dot when no destination */}
      {pickup && !drop && (
        <Animated.View style={[styles.locationPing, { transform: [{ scale: pulse }] }]}>
          <View style={styles.locationDot} />
        </Animated.View>
      )}

      {/* Coordinates badge */}
      {pickup && (
        <View style={styles.coordBadge}>
          <Feather name="map-pin" size={11} color={GOLD} />
          <Text style={styles.coordText}>
            {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
          </Text>
        </View>
      )}
    </LinearGradient>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string; icon: string }> = {
    requested: { color: GOLD, label: "Finding Driver…", icon: "clock" },
    accepted: { color: GREEN, label: "Driver Assigned", icon: "user-check" },
    ongoing: { color: ORANGE, label: "On the Way", icon: "navigation" },
    completed: { color: C.textSecondary, label: "Completed", icon: "check-circle" },
  };
  const s = cfg[status] ?? cfg.requested;
  return (
    <View style={[styles.statusBadge, { borderColor: s.color + "44", backgroundColor: s.color + "18" }]}>
      <Feather name={s.icon as any} size={14} color={s.color} />
      <Text style={[styles.statusLabel, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────
export default function CarsScreen() {
  const insets = useSafeAreaInsets();
  const { user, activeMode } = useAuth();
  const { get, post, patch } = useApi();

  const isProvider = (user?.role === "provider" || user?.role === "both") && activeMode === "provider";
  const [tab, setTab] = useState<"rider" | "driver">(isProvider ? "driver" : "rider");

  // ── RIDER STATE ──
  const DEFAULT_COORDS: Coords = { lat: 30.7333, lng: 76.7794, address: "Chandigarh, Punjab" };
  const [pickup, setPickup] = useState<Coords>(DEFAULT_COORDS);
  const [dropInput, setDropInput] = useState("");
  const [drop, setDrop] = useState<Coords | null>(null);
  const [vehicleType, setVehicleType] = useState("Car");
  const [estimate, setEstimate] = useState<RideEstimate | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  // ── DRIVER STATE ──
  const [isOnline, setIsOnline] = useState(false);
  const [driverRequests, setDriverRequests] = useState<RideRequest[]>([]);
  const [driverActiveRide, setDriverActiveRide] = useState<ActiveRide | null>(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RideRequest | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Get current location ──
  useEffect(() => {
    (async () => {
      setLocLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setPickup({ lat: 30.7333, lng: 76.7794, address: "Chandigarh, Punjab" });
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geo[0]) {
            const g = geo[0];
            address = [g.name, g.street, g.city, g.region].filter(Boolean).join(", ").substring(0, 50);
          }
        } catch {}
        setPickup({ lat: latitude, lng: longitude, address });
      } catch {
        setPickup({ lat: 30.7333, lng: 76.7794, address: "Chandigarh, Punjab" });
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  // ── Poll for active ride (rider) ──
  useEffect(() => {
    if (tab !== "rider") return;
    const check = async () => {
      if (rideStatus === "idle" || rideStatus === "completed") return;
      try {
        const data = await get<ActiveRide | null>("/rides/active");
        if (data) {
          setActiveRide(data);
          setRideStatus(data.status as RideStatus);
        } else {
          setActiveRide(null);
          if (rideStatus !== "idle") setRideStatus("idle");
        }
      } catch {}
    };
    pollRef.current = setInterval(check, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, rideStatus]);

  // ── Poll for driver requests / active ride ──
  useEffect(() => {
    if (tab !== "driver" || !isOnline) return;
    const check = async () => {
      try {
        const [requests, active] = await Promise.all([
          get<RideRequest[]>("/rides/driver/requests"),
          get<ActiveRide | null>("/rides/driver/active"),
        ]);
        setDriverRequests(requests ?? []);
        setDriverActiveRide(active);
      } catch {}
    };
    check();
    pollRef.current = setInterval(check, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, isOnline]);

  // ── Location update for drivers ──
  useEffect(() => {
    if (tab !== "driver" || !isOnline) return;
    let watchSub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
        (loc) => {
          post("/rides/driver/location", { lat: loc.coords.latitude, lng: loc.coords.longitude }).catch(() => {});
        }
      );
    })();
    return () => { watchSub?.remove(); };
  }, [tab, isOnline]);

  // ── Get estimate when drop changes ──
  useEffect(() => {
    if (!pickup || !drop) { setEstimate(null); return; }
    (async () => {
      try {
        const data = await post<RideEstimate>("/rides/estimate", {
          pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropLat: drop.lat, dropLng: drop.lng, vehicleType,
        });
        setEstimate(data);
      } catch {}
    })();
  }, [drop, vehicleType, pickup]);

  // ── Fake geocode from text ──
  const geocodeDrop = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const base = pickup;
    // Generate 5-15 km offset in a random direction
    const kmToLat = 1 / 111;
    const kmToLng = 1 / (111 * Math.cos((base.lat * Math.PI) / 180));
    const dist = 5 + Math.random() * 10;
    const angle = Math.random() * 2 * Math.PI;
    const offset = { lat: dist * kmToLat * Math.sin(angle), lng: dist * kmToLng * Math.cos(angle) };
    setDrop({ lat: base.lat + offset.lat, lng: base.lng + offset.lng, address: text.trim() });
  }, [pickup]);

  const handleBookRide = async () => {
    if (!pickup || !drop) { Alert.alert("Missing location", "Please enter a destination"); return; }
    setRideStatus("booking");
    try {
      const data = await post<ActiveRide>("/rides/request", {
        pickupLat: pickup.lat, pickupLng: pickup.lng, pickupAddress: pickup.address,
        dropLat: drop.lat, dropLng: drop.lng, dropAddress: drop.address,
        vehicleType,
      });
      setActiveRide(data);
      setRideStatus("requested");
    } catch (e: any) {
      setRideStatus("idle");
      Alert.alert("Error", e?.message ?? "Could not book ride");
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    try {
      await patch(`/rides/${activeRide.id}/cancel`, {});
      setActiveRide(null);
      setRideStatus("idle");
    } catch {}
  };

  const handleToggleOnline = async () => {
    setDriverLoading(true);
    try {
      await patch("/rides/driver/status", { isOnline: !isOnline });
      setIsOnline(!isOnline);
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
    } catch (e: any) {
      Alert.alert("Oops", e?.message ?? "Could not accept ride");
    }
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

  // ── RIDER UI ────────────────────────────────────────────────────────────
  const renderRiderView = () => {
    const hasActiveRide = ["requested", "accepted", "ongoing"].includes(rideStatus);
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <MapCanvas pickup={pickup ?? undefined} drop={drop ?? undefined} />

        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          {hasActiveRide && activeRide ? (
            // ── Active ride tracker ──
            <View>
              <StatusBadge status={rideStatus} />
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your Ride</Text>
                <View style={styles.rideRow}>
                  <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
                  <Text style={styles.rideAddr} numberOfLines={2}>{activeRide.pickup_address ?? "Pickup"}</Text>
                </View>
                <View style={styles.routeVLine} />
                <View style={styles.rideRow}>
                  <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
                  <Text style={styles.rideAddr} numberOfLines={2}>{activeRide.drop_address ?? "Destination"}</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Fare</Text>
                  <Text style={styles.fareValue}>₹{activeRide.fare}</Text>
                  <Text style={styles.fareLabel}>{fmt(activeRide.distance_km)} km</Text>
                  <Text style={styles.fareLabel}>{activeRide.duration_min} min</Text>
                </View>
                {activeRide.driver_name && (
                  <View style={styles.driverCard}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>{activeRide.driver_name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>{activeRide.driver_name}</Text>
                      <Text style={styles.driverPhone}>{activeRide.driver_phone ?? "—"}</Text>
                    </View>
                    <Feather name="phone" size={18} color={ORANGE} />
                  </View>
                )}
                {rideStatus === "requested" && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRide}>
                    <Text style={styles.cancelBtnText}>Cancel Ride</Text>
                  </TouchableOpacity>
                )}
                {rideStatus === "completed" && (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => { setRideStatus("idle"); setActiveRide(null); setDrop(null); setDropInput(""); setEstimate(null); }}>
                    <Text style={styles.primaryBtnText}>Book Another</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            // ── Booking form ──
            <View>
              <Text style={styles.sheetTitle}>Book a Ride</Text>
              {/* Pickup */}
              <View style={styles.inputGroup}>
                <View style={[styles.locationDotSmall, { backgroundColor: GREEN }]} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Pickup</Text>
                  <Text style={styles.inputValue} numberOfLines={1}>
                    {locLoading ? "Detecting location…" : (pickup?.address ?? "Unknown")}
                  </Text>
                </View>
              </View>
              <View style={styles.connector} />
              {/* Drop */}
              <View style={styles.inputGroup}>
                <View style={[styles.locationDotSmall, { backgroundColor: ORANGE }]} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Where to?</Text>
                  <TextInput
                    style={styles.dropInput}
                    placeholder="Enter destination"
                    placeholderTextColor={C.textTertiary}
                    value={dropInput}
                    onChangeText={setDropInput}
                    onSubmitEditing={() => geocodeDrop(dropInput)}
                    returnKeyType="search"
                  />
                </View>
                {dropInput.length > 1 && (
                  <TouchableOpacity style={styles.searchBtn} onPress={() => geocodeDrop(dropInput)}>
                    <Feather name="arrow-right" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Vehicle type */}
              <Text style={styles.sectionLabel}>Vehicle Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {VEHICLE_TYPES.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.vehicleChip, vehicleType === v.id && styles.vehicleChipActive]}
                    onPress={() => setVehicleType(v.id)}
                  >
                    <Text style={styles.vehicleIcon}>{v.icon}</Text>
                    <Text style={[styles.vehicleLabel, vehicleType === v.id && styles.vehicleChipActiveText]}>{v.label}</Text>
                    <Text style={[styles.vehicleTagline, vehicleType === v.id && { color: "#fff" }]}>{v.tagline}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Estimate card */}
              {estimate && (
                <LinearGradient colors={[NAVY, "#1a2f55"]} style={styles.estimateCard}>
                  <View style={styles.estimateRow}>
                    <View style={styles.estimateStat}>
                      <Text style={styles.estimateVal}>{fmt(estimate.distanceKm)} km</Text>
                      <Text style={styles.estimateKey}>Distance</Text>
                    </View>
                    <View style={styles.estimateDivider} />
                    <View style={styles.estimateStat}>
                      <Text style={styles.estimateVal}>{estimate.durationMin} min</Text>
                      <Text style={styles.estimateKey}>Est. Time</Text>
                    </View>
                    <View style={styles.estimateDivider} />
                    <View style={styles.estimateStat}>
                      <Text style={[styles.estimateVal, { color: GOLD }]}>₹{estimate.fare}</Text>
                      <Text style={styles.estimateKey}>Fare</Text>
                    </View>
                  </View>
                </LinearGradient>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (!pickup || !drop) && { opacity: 0.5 }]}
                onPress={handleBookRide}
                disabled={!pickup || !drop || rideStatus === "booking"}
              >
                {rideStatus === "booking"
                  ? <ActivityIndicator color="#fff" />
                  : <>
                    <Feather name="navigation" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Book Ride</Text>
                  </>
                }
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // ── DRIVER UI ───────────────────────────────────────────────────────────
  const renderDriverView = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.driverContainer, { paddingTop: 16 }]}>
      {/* Online toggle card */}
      <LinearGradient
        colors={isOnline ? ["#166534", "#15803D"] : [NAVY, "#1a2f55"]}
        style={styles.onlineCard}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.onlineStatus}>{isOnline ? "🟢 Online" : "⚫ Offline"}</Text>
          <Text style={styles.onlineDesc}>
            {isOnline ? "You are receiving ride requests" : "Go online to start earning"}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: isOnline ? RED : GREEN }]}
          onPress={handleToggleOnline}
          disabled={driverLoading}
        >
          {driverLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.toggleBtnText}>{isOnline ? "Go Offline" : "Go Online"}</Text>
          }
        </TouchableOpacity>
      </LinearGradient>

      {/* Active ride for driver */}
      {driverActiveRide && (
        <View style={[styles.card, { marginBottom: 16 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Active Ride</Text>
            <StatusBadge status={driverActiveRide.status} />
          </View>
          <View style={styles.rideRow}>
            <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
            <Text style={styles.rideAddr}>{driverActiveRide.pickup_address ?? `${driverActiveRide.pickup_lat.toFixed(4)}, ${driverActiveRide.pickup_lng.toFixed(4)}`}</Text>
          </View>
          <View style={styles.routeVLine} />
          <View style={styles.rideRow}>
            <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
            <Text style={styles.rideAddr}>{driverActiveRide.drop_address ?? `${driverActiveRide.drop_lat.toFixed(4)}, ${driverActiveRide.drop_lng.toFixed(4)}`}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Rider</Text>
            <Text style={styles.fareValue}>{driverActiveRide.rider_name ?? "—"}</Text>
            <Text style={[styles.fareValue, { color: GOLD }]}>₹{driverActiveRide.fare}</Text>
          </View>
          {driverActiveRide.status === "accepted" && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: GREEN }]} onPress={handleStartRide}>
              <Feather name="play" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Start Trip</Text>
            </TouchableOpacity>
          )}
          {driverActiveRide.status === "ongoing" && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: RED }]} onPress={handleEndRide}>
              <Feather name="flag" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>End Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Ride requests */}
      {isOnline && !driverActiveRide && (
        <View>
          <Text style={styles.sectionLabel}>
            {driverRequests.length ? `${driverRequests.length} Ride Request${driverRequests.length > 1 ? "s" : ""}` : "No ride requests yet"}
          </Text>
          {driverRequests.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyTitle}>Waiting for requests…</Text>
              <Text style={styles.emptyDesc}>Stay online and ride requests will appear here</Text>
            </View>
          )}
          {driverRequests.map(req => (
            <TouchableOpacity key={req.id} style={styles.requestCard} onPress={() => setSelectedRequest(req)}>
              <View style={{ flex: 1 }}>
                <View style={styles.rideRow}>
                  <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
                  <Text style={styles.rideAddr} numberOfLines={1}>{req.pickup_address ?? `${req.pickup_lat.toFixed(3)}, ${req.pickup_lng.toFixed(3)}`}</Text>
                </View>
                <View style={styles.rideRow}>
                  <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
                  <Text style={styles.rideAddr} numberOfLines={1}>{req.drop_address ?? `${req.drop_lat.toFixed(3)}, ${req.drop_lng.toFixed(3)}`}</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>{fmt(req.distance_km)} km</Text>
                  <Text style={[styles.fareValue, { color: GOLD }]}>₹{req.fare ?? "—"}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptRide(req.id)}>
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!isOnline && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🌙</Text>
          <Text style={styles.emptyTitle}>You're offline</Text>
          <Text style={styles.emptyDesc}>Tap "Go Online" to start receiving ride requests and earn money</Text>
        </View>
      )}
    </ScrollView>
  );

  // ── Request detail modal ─────────────────────────────────────────────
  const renderRequestModal = () => (
    <Modal visible={!!selectedRequest} transparent animationType="slide" onRequestClose={() => setSelectedRequest(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New Ride Request</Text>
          {selectedRequest && (
            <>
              <View style={styles.card}>
                <View style={styles.rideRow}>
                  <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
                  <View>
                    <Text style={styles.modalLabel}>Pickup</Text>
                    <Text style={styles.rideAddr}>{selectedRequest.pickup_address ?? `${selectedRequest.pickup_lat.toFixed(4)}, ${selectedRequest.pickup_lng.toFixed(4)}`}</Text>
                  </View>
                </View>
                <View style={styles.routeVLine} />
                <View style={styles.rideRow}>
                  <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
                  <View>
                    <Text style={styles.modalLabel}>Destination</Text>
                    <Text style={styles.rideAddr}>{selectedRequest.drop_address ?? `${selectedRequest.drop_lat.toFixed(4)}, ${selectedRequest.drop_lng.toFixed(4)}`}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.estimateCard}>
                <View style={styles.estimateRow}>
                  <View style={styles.estimateStat}>
                    <Text style={styles.estimateVal}>{fmt(selectedRequest.distance_km)} km</Text>
                    <Text style={styles.estimateKey}>Distance</Text>
                  </View>
                  <View style={styles.estimateDivider} />
                  <View style={styles.estimateStat}>
                    <Text style={[styles.estimateVal, { color: GOLD }]}>₹{selectedRequest.fare ?? "—"}</Text>
                    <Text style={styles.estimateKey}>Fare</Text>
                  </View>
                </View>
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => setSelectedRequest(null)}>
                  <Text style={styles.rejectBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => handleAcceptRide(selectedRequest.id)}>
                  <Text style={styles.primaryBtnText}>Accept Ride</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const isProviderUser = user?.role === "provider" || user?.role === "both";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Cars</Text>
          <Text style={styles.headerSub}>Ride-booking for Punjab</Text>
        </View>
        {/* Mode switcher */}
        {isProviderUser && (
          <View style={styles.tabSwitcher}>
            {(["rider", "driver"] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabSwitcherPill, tab === t && styles.tabSwitcherPillActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabSwitcherText, tab === t && styles.tabSwitcherTextActive]}>
                  {t === "rider" ? "Rider" : "Driver"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {tab === "rider" ? renderRiderView() : renderDriverView()}
      {renderRequestModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: NAVY },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", marginTop: 2 },
  tabSwitcher: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, padding: 3 },
  tabSwitcherPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 17 },
  tabSwitcherPillActive: { backgroundColor: ORANGE },
  tabSwitcherText: { fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_500Medium" },
  tabSwitcherTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  // Map canvas
  mapCanvas: { height: MAP_H, overflow: "hidden", position: "relative" },
  gridLine: { position: "absolute", backgroundColor: "rgba(255,255,255,0.05)", height: 1 },
  routeLine: { position: "absolute", height: 3, borderRadius: 2 },
  mapPin: { position: "absolute", alignItems: "center" },
  pinDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#fff" },
  pinLabel: { marginTop: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1 },
  pinText: { fontSize: 10, color: "#fff", fontFamily: "Inter_500Medium" },
  locationPing: { position: "absolute", bottom: 50, alignSelf: "center", width: 24, height: 24, borderRadius: 12, backgroundColor: `${ORANGE}44`, alignItems: "center", justifyContent: "center" },
  locationDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: ORANGE, borderWidth: 2, borderColor: "#fff" },
  coordBadge: { position: "absolute", bottom: 10, left: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  coordText: { fontSize: 11, color: GOLD, fontFamily: "Inter_400Regular" },

  // Bottom sheet
  sheet: { flex: 1, backgroundColor: C.background },
  sheetContent: { padding: 16, paddingBottom: 120 },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold", marginBottom: 16 },

  // Location inputs
  inputGroup: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  locationDotSmall: { width: 10, height: 10, borderRadius: 5, marginLeft: 4 },
  connector: { width: 2, height: 18, backgroundColor: C.border, marginLeft: 8, marginVertical: 2 },
  inputWrapper: { flex: 1, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 8 },
  inputLabel: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular", marginBottom: 2 },
  inputValue: { fontSize: 15, color: C.text, fontFamily: "Inter_500Medium" },
  dropInput: { fontSize: 15, color: C.text, fontFamily: "Inter_500Medium", padding: 0 },
  searchBtn: { backgroundColor: ORANGE, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  // Section label
  sectionLabel: { fontSize: 13, fontWeight: "600", color: C.textSecondary, fontFamily: "Inter_600SemiBold", marginTop: 16, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },

  // Vehicle chips
  vehicleChip: { alignItems: "center", padding: 12, borderRadius: 14, marginRight: 10, backgroundColor: C.backgroundTertiary, minWidth: 80, borderWidth: 1.5, borderColor: "transparent" },
  vehicleChipActive: { borderColor: ORANGE, backgroundColor: `${ORANGE}15` },
  vehicleIcon: { fontSize: 22, marginBottom: 4 },
  vehicleLabel: { fontSize: 13, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  vehicleChipActiveText: { color: ORANGE },
  vehicleTagline: { fontSize: 10, color: C.textTertiary, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Estimate card
  estimateCard: { borderRadius: 16, padding: 16, marginBottom: 16, backgroundColor: NAVY },
  estimateRow: { flexDirection: "row", alignItems: "center" },
  estimateStat: { flex: 1, alignItems: "center", gap: 4 },
  estimateVal: { fontSize: 20, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  estimateKey: { fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular" },
  estimateDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.12)" },

  // Buttons
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  cancelBtn: { borderRadius: 14, paddingVertical: 14, marginTop: 8, alignItems: "center", borderWidth: 1.5, borderColor: RED },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: RED, fontFamily: "Inter_600SemiBold" },

  // Ride status
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start", marginBottom: 12 },
  statusLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Cards
  card: { backgroundColor: C.backgroundSecondary, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  rideRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeVLine: { width: 2, height: 14, backgroundColor: C.border, marginLeft: 4, marginVertical: 2 },
  rideAddr: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fareRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  fareLabel: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  fareValue: { fontSize: 16, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },

  // Driver card
  driverCard: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  driverAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: `${ORANGE}22`, alignItems: "center", justifyContent: "center" },
  driverAvatarText: { fontSize: 18, fontWeight: "700", color: ORANGE, fontFamily: "Inter_700Bold" },
  driverName: { fontSize: 15, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  driverPhone: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  // Driver view
  driverContainer: { padding: 16, paddingBottom: 120 },
  onlineCard: { borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  onlineStatus: { fontSize: 18, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  onlineDesc: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", marginTop: 4 },
  toggleBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  toggleBtnText: { fontSize: 14, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  requestCard: { backgroundColor: C.backgroundSecondary, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  acceptBtn: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  acceptBtnText: { fontSize: 13, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, paddingHorizontal: 20 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold", marginBottom: 16 },
  modalLabel: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
  rejectBtn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1.5, borderColor: C.border },
  rejectBtnText: { fontSize: 15, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
});
