import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Alert, Platform, Modal,
  Dimensions, PanResponder, StatusBar, TextInput,
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
const NAVY   = "#0F1F3D";
const GOLD   = "#F5C842";
const GREEN  = "#22C55E";
const RED    = "#EF4444";
const PURPLE = "#8B5CF6";

const SHEET_COLLAPSED = SH * 0.52;
const SHEET_EXPANDED  = SH * 0.72;
const MAP_HEIGHT = SH - SHEET_COLLAPSED - (Platform.OS === "android" ? 32 : 0);

interface Coords { lat: number; lng: number; address: string }
interface RideEstimate { distanceKm: number; durationMin: number; fare: number }
interface ActiveRide {
  id: string; status: string; fare: number; ride_type?: string; scheduled_at?: string;
  pickup_address?: string; drop_address?: string;
  distance_km?: number; duration_min?: number;
  driver_name?: string; driver_phone?: string;
  driver_lat?: number; driver_lng?: number;
  rider_name?: string; rider_phone?: string;
  pickup_lat: number; pickup_lng: number;
  drop_lat: number; drop_lng: number;
  vehicle_type?: string;
  ride_for_type?: string;
  passenger_name?: string;
  passenger_phone?: string;
}
interface RideRequest {
  id: string; pickup_address?: string; drop_address?: string;
  pickup_lat: number; pickup_lng: number; drop_lat: number; drop_lng: number;
  distance_km?: number; fare?: number; rider_name?: string;
  ride_for_type?: string; passenger_name?: string;
}

const VEHICLE_TYPES = [
  { id: "Bike",  icon: "🏍️", label: "Bike",  tagline: "Fastest",     color: "#06B6D4" },
  { id: "Auto",  icon: "🛺", label: "Auto",  tagline: "Affordable",  color: "#10B981" },
  { id: "Car",   icon: "🚗", label: "Car",   tagline: "Comfortable", color: ORANGE },
  { id: "SUV",   icon: "🚙", label: "SUV",   tagline: "Spacious",    color: PURPLE },
  { id: "Van",   icon: "🚐", label: "Van",   tagline: "Group",       color: "#EC4899" },
];

const DEFAULT_PRICING: Record<string, { baseFare: number; perKm: number }> = {
  Bike: { baseFare: 30, perKm: 6 },
  Auto: { baseFare: 40, perKm: 8 },
  Car:  { baseFare: 50, perKm: 12 },
  SUV:  { baseFare: 70, perKm: 16 },
  Van:  { baseFare: 90, perKm: 20 },
};

// ── Straight-line distance for instant estimate (Directions API updates later) ──
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35).toFixed(2); // ×1.35 road factor
}

const STATUS_LABEL: Record<string, string> = {
  requested: "Finding Driver",
  scheduled: "Scheduled",
  accepted:  "Driver Assigned",
  ongoing:   "On the Way",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  requested: GOLD,
  scheduled: PURPLE,
  accepted:  GREEN,
  ongoing:   ORANGE,
  completed: GREEN,
  cancelled: RED,
};

function fmt(n?: number | null, d = 1) { return n != null ? n.toFixed(d) : "—"; }

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
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                done   && { backgroundColor: GREEN },
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
function VehicleCard({ v, selected, estimate, onPress, distanceKm, pricing }: {
  v: typeof VEHICLE_TYPES[0]; selected: boolean;
  estimate: RideEstimate | null; onPress: () => void;
  distanceKm?: number; pricing: { baseFare: number; perKm: number };
}) {
  const fare = distanceKm != null
    ? Math.max(pricing.baseFare, Math.round(pricing.baseFare + distanceKm * pricing.perKm))
    : null;
  const eta = estimate
    ? estimate.durationMin + (v.id === "Bike" ? -3 : v.id === "Auto" ? -1 : v.id === "SUV" ? 2 : v.id === "Van" ? 4 : 0)
    : null;
  return (
    <TouchableOpacity
      style={[styles.vehicleCard, selected && { borderColor: v.color, backgroundColor: v.color + "12" }]}
      onPress={onPress} activeOpacity={0.75}
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
      {eta != null && <Text style={styles.vehicleEta}>{Math.max(2, eta)} min</Text>}
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
          Animated.spring(sheetY, { toValue: SHEET_EXPANDED,  tension: 60, friction: 12, useNativeDriver: false }).start();
        } else if (g.dy > 30) {
          Animated.spring(sheetY, { toValue: SHEET_COLLAPSED, tension: 60, friction: 12, useNativeDriver: false }).start();
        }
      },
    })
  ).current;
  return (
    <Animated.View style={[styles.bottomSheet, { height: sheetY }]}>
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

// ─── ACTIVE RIDE CARD (used inside modal) ─────────────────────────────────────
function ActiveRideCard({ ride, onCancel }: { ride: ActiveRide; onCancel: (r: ActiveRide) => void }) {
  const statusColor = STATUS_COLOR[ride.status] ?? C.textSecondary;
  const statusLabel = STATUS_LABEL[ride.status] ?? ride.status;
  const veh = VEHICLE_TYPES.find(v => v.id === (ride.vehicle_type ?? "Car")) ?? VEHICLE_TYPES[2];
  const isForOther = ride.ride_for_type === "someone_else";
  const canCancel  = ["requested", "scheduled", "accepted"].includes(ride.status);

  return (
    <View style={styles.activeRideCard}>
      {/* Status row */}
      <View style={styles.activeRideHeader}>
        <View style={styles.activeRideVehicleRow}>
          <Text style={styles.activeRideEmoji}>{veh.icon}</Text>
          <Text style={styles.activeRideVehicle}>{veh.label}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + "20" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Passenger badge */}
      {isForOther && ride.passenger_name && (
        <View style={styles.passengerBadge}>
          <Feather name="user" size={12} color={PURPLE} />
          <Text style={styles.passengerBadgeText}>For: {ride.passenger_name}</Text>
          {ride.passenger_phone && (
            <Text style={styles.passengerBadgePhone}>{ride.passenger_phone}</Text>
          )}
        </View>
      )}

      {/* Route */}
      <View style={styles.routeCard}>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
          <Text style={styles.routeAddr} numberOfLines={2}>{ride.pickup_address ?? "Pickup"}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
          <Text style={styles.routeAddr} numberOfLines={2}>{ride.drop_address ?? "Destination"}</Text>
        </View>
        <View style={styles.rideMeta}>
          <View style={styles.rideMetaItem}>
            <Feather name="navigation" size={12} color={C.textSecondary} />
            <Text style={styles.rideMetaText}>{fmt(ride.distance_km)} km</Text>
          </View>
          <View style={styles.rideMetaItem}>
            <Feather name="clock" size={12} color={C.textSecondary} />
            <Text style={styles.rideMetaText}>{ride.duration_min ?? "—"} min</Text>
          </View>
          <Text style={styles.rideMetaFare}>₹{ride.fare}</Text>
        </View>
      </View>

      {/* Driver */}
      {ride.driver_name && (
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>{ride.driver_name[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{ride.driver_name}</Text>
            <Text style={styles.driverSub}>Your driver</Text>
          </View>
          {ride.driver_phone && (
            <TouchableOpacity style={styles.callBtn}>
              <Feather name="phone" size={16} color={GREEN} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Scheduled time */}
      {ride.status === "scheduled" && ride.scheduled_at && (
        <View style={styles.scheduledBanner}>
          <Feather name="clock" size={14} color={PURPLE} />
          <Text style={styles.scheduledText}>
            Scheduled: {new Date(ride.scheduled_at).toLocaleString("en-IN", {
              weekday: "short", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </Text>
        </View>
      )}

      {/* Cancel */}
      {canCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(ride)}>
          <Feather name="x-circle" size={14} color={RED} />
          <Text style={styles.cancelBtnText}>Cancel Ride</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── CANCEL REASON MODAL ──────────────────────────────────────────────────────
function CancelModal({ ride, visible, loading, onConfirm, onDismiss }: {
  ride: ActiveRide | null; visible: boolean; loading: boolean;
  onConfirm: (rideId: string, reason: string) => void;
  onDismiss: () => void;
}) {
  const [reason, setReason] = useState("");
  const REASONS = ["Changed my mind", "Driver taking too long", "Found another option", "Booked by mistake", "Other"];

  useEffect(() => { if (visible) setReason(""); }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible statusBarTranslucent transparent animationType="slide" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} style={styles.cancelModalCard} onPress={() => {}}>
          <View style={styles.handleArea}><View style={styles.handleBar} /></View>
          <Text style={styles.cancelModalTitle}>Cancel Ride?</Text>
          <Text style={styles.cancelModalSub}>
            {ride?.pickup_address ?? "Pickup"} → {ride?.drop_address ?? "Destination"}
          </Text>

          <Text style={styles.cancelReasonLabel}>Reason (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reasonPillRow}>
            {REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonPill, reason === r && styles.reasonPillActive]}
                onPress={() => setReason(prev => prev === r ? "" : r)}
              >
                <Text style={[styles.reasonPillText, reason === r && styles.reasonPillTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.reasonInput}
            placeholder="Or type a reason…"
            placeholderTextColor={C.textTertiary}
            value={reason}
            onChangeText={setReason}
            maxLength={120}
          />

          <View style={styles.cancelModalBtns}>
            <TouchableOpacity
              style={[styles.cancelModalKeep, loading && { opacity: 0.4 }]}
              onPress={onDismiss}
              disabled={loading}
            >
              <Text style={styles.cancelModalKeepText}>Keep Ride</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelModalConfirm, loading && { opacity: 0.75 }]}
              onPress={() => !loading && ride && onConfirm(ride.id, reason)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.cancelModalConfirmText}>Yes, Cancel</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── HISTORY RIDE CARD (cancelled / completed) ────────────────────────────────
function HistoryRideCard({ ride }: { ride: ActiveRide }) {
  const isCancelled = ride.status === "cancelled";
  const statusColor = isCancelled ? RED : GREEN;
  const statusLabel = isCancelled ? "Cancelled" : "Completed";
  const veh = VEHICLE_TYPES.find(v => v.id === (ride.vehicle_type ?? "Car")) ?? VEHICLE_TYPES[2];

  return (
    <View style={[styles.activeRideCard, { opacity: isCancelled ? 0.82 : 1, borderColor: statusColor + "30" }]}>
      <View style={styles.activeRideHeader}>
        <View style={styles.activeRideVehicleRow}>
          <Text style={styles.activeRideEmoji}>{veh.icon}</Text>
          <Text style={styles.activeRideVehicle}>{veh.label}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {ride.ride_for_type === "someone_else" && ride.passenger_name && (
        <View style={styles.passengerBadge}>
          <Feather name="user" size={12} color={PURPLE} />
          <Text style={styles.passengerBadgeText}>For: {ride.passenger_name}</Text>
        </View>
      )}

      <View style={styles.routeCard}>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: GREEN }]} />
          <Text style={styles.routeAddr} numberOfLines={1}>{ride.pickup_address ?? "Pickup"}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: ORANGE }]} />
          <Text style={styles.routeAddr} numberOfLines={1}>{ride.drop_address ?? "Destination"}</Text>
        </View>
        <View style={styles.rideMeta}>
          <View style={styles.rideMetaItem}>
            <Feather name="navigation" size={12} color={C.textSecondary} />
            <Text style={styles.rideMetaText}>{fmt(ride.distance_km)} km</Text>
          </View>
          <Text style={[styles.rideMetaFare, { color: isCancelled ? C.textSecondary : C.text }]}>₹{ride.fare}</Text>
          {isCancelled && (ride as any).cancellation_reason ? (
            <Text style={[styles.rideMetaText, { color: RED, fontStyle: "italic" }]} numberOfLines={1}>
              "{(ride as any).cancellation_reason}"
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── ACTIVE RIDES MODAL ───────────────────────────────────────────────────────
function ActiveRidesModal({ visible, rides, history, onClose, onCancelRide }: {
  visible: boolean; rides: ActiveRide[]; history: ActiveRide[];
  onClose: () => void;
  onCancelRide: (ride: ActiveRide) => void;
}) {
  const [tab,           setTab]           = useState<"active" | "history">("active");
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "cancelled">("all");

  useEffect(() => { if (visible) { setTab("active"); setHistoryFilter("all"); } }, [visible]);

  if (!visible) return null;

  const cancelled = history.filter(r => r.status === "cancelled");
  const completed = history.filter(r => r.status === "completed");
  const filteredHistory =
    historyFilter === "completed" ? completed :
    historyFilter === "cancelled" ? cancelled :
    history;

  return (
    <Modal visible statusBarTranslucent transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.activeRidesSheet} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.handleArea}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.activeRidesHeader}>
            <View>
              <Text style={styles.activeRidesTitle}>My Rides</Text>
              <Text style={styles.activeRidesSub}>
                {rides.length} active · {history.length} past
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.ridesTabRow}>
            <TouchableOpacity
              style={[styles.ridesTab, tab === "active" && styles.ridesTabActive]}
              onPress={() => setTab("active")}
            >
              <Text style={[styles.ridesTabText, tab === "active" && styles.ridesTabTextActive]}>
                Active {rides.length > 0 ? `(${rides.length})` : ""}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ridesTab, tab === "history" && styles.ridesTabActive]}
              onPress={() => setTab("history")}
            >
              <Text style={[styles.ridesTabText, tab === "history" && styles.ridesTabTextActive]}>
                History {history.length > 0 ? `(${history.length})` : ""}
              </Text>
            </TouchableOpacity>
          </View>

          {/* History filter pills — shown only on History tab */}
          {tab === "history" && (
            <View style={styles.historyFilterRow}>
              {(["all", "completed", "cancelled"] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.historyFilterPill, historyFilter === f && styles.historyFilterPillActive]}
                  onPress={() => setHistoryFilter(f)}
                >
                  <Text style={[styles.historyFilterText, historyFilter === f && styles.historyFilterTextActive]}>
                    {f === "all" ? `All (${history.length})` : f === "completed" ? `✓ Completed (${completed.length})` : `✕ Cancelled (${cancelled.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView contentContainerStyle={styles.activeRidesScroll} showsVerticalScrollIndicator={false}>
            {tab === "active" ? (
              rides.length === 0 ? (
                <View style={styles.driverEmptyState}>
                  <Text style={{ fontSize: 44 }}>🚗</Text>
                  <Text style={styles.emptyTitle}>No active rides</Text>
                  <Text style={styles.emptyDesc}>Your active ride bookings will appear here</Text>
                </View>
              ) : (
                rides.map(r => <ActiveRideCard key={r.id} ride={r} onCancel={onCancelRide} />)
              )
            ) : (
              <>
                {filteredHistory.length > 0
                  ? filteredHistory.map(r => <HistoryRideCard key={r.id} ride={r} />)
                  : (
                    <View style={styles.driverEmptyState}>
                      <Text style={{ fontSize: 44 }}>📋</Text>
                      <Text style={styles.emptyTitle}>
                        {historyFilter === "all" ? "No past rides" : historyFilter === "completed" ? "No completed rides" : "No cancelled rides"}
                      </Text>
                      <Text style={styles.emptyDesc}>Completed and cancelled rides will appear here</Text>
                    </View>
                  )
                }
              </>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function CarsScreen() {
  const insets = useSafeAreaInsets();
  const { user, activeMode } = useAuth();
  const { get, post, patch } = useApi();

  const isProvider     = (user?.role === "provider" || user?.role === "both") && activeMode === "provider";
  const isProviderUser = user?.role === "provider" || user?.role === "both";
  const [tab, setTab]  = useState<"rider" | "driver">(isProvider ? "driver" : "rider");

  // ── Rider Booking State ──
  const DEFAULT: Coords = { lat: 30.7333, lng: 76.7794, address: "Chandigarh, Punjab" };
  const [pickup,        setPickup]       = useState<Coords>(DEFAULT);
  const [drop,          setDrop]         = useState<Coords | null>(null);
  const [vehicleType,   setVehicleType]  = useState("Car");
  const [estimate,      setEstimate]     = useState<RideEstimate | null>(null);
  const [locLoading,    setLocLoading]   = useState(true);
  const [rideMode,      setRideMode]     = useState<"instant" | "scheduled">("instant");
  const [scheduledTime, setScheduledTime] = useState<ScheduledTime | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [booking,       setBooking]      = useState(false);

  // ── "Ride for someone else" state ──
  const [rideFor,        setRideFor]        = useState<"me" | "someone_else">("me");
  const [passengerName,  setPassengerName]  = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  // ── Multiple active rides state ──
  const [activeRides,     setActiveRides]  = useState<ActiveRide[]>([]);
  const [rideHistory,     setRideHistory]  = useState<ActiveRide[]>([]);
  const [showActiveRides, setShowActiveRides] = useState(false);
  const [cancellingRide,  setCancellingRide] = useState<ActiveRide | null>(null);
  const [cancelLoading,   setCancelLoading]  = useState(false);
  const [toastMsg,        setToastMsg]       = useState<string | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dynamic pricing from admin ──
  const [ridePricing, setRidePricing] = useState<Record<string, { baseFare: number; perKm: number }>>(DEFAULT_PRICING);

  // ── Modals ──
  const [pickupModalOpen,   setPickupModalOpen]   = useState(false);
  const [dropModalOpen,     setDropModalOpen]     = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // ── Driver State ──
  const [isOnline,         setIsOnline]         = useState(false);
  const [driverRequests,   setDriverRequests]   = useState<RideRequest[]>([]);
  const [driverActiveRide, setDriverActiveRide] = useState<ActiveRide | null>(null);
  const [driverLoading,    setDriverLoading]    = useState(false);
  const [selectedRequest,  setSelectedRequest]  = useState<RideRequest | null>(null);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef       = useRef<MapRef>(null);
  const mapReadyRef  = useRef(false);

  const syncPickupToMap = useCallback((loc: Coords) => {
    if (mapReadyRef.current) mapRef.current?.setPickup(loc.lat, loc.lng, loc.address);
  }, []);

  // ── Location ──
  useEffect(() => {
    (async () => {
      setLocLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setLocLoading(false); return; }
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

  // ── Fetch live pricing from admin rules ──
  useEffect(() => {
    (async () => {
      try {
        const data = await get<Record<string, { baseFare: number; perKm: number }>>("/pricing/rides");
        if (data && typeof data === "object") setRidePricing(prev => ({ ...prev, ...data }));
      } catch {}
    })();
  }, []);

  // ── Update estimate when vehicle changes ──
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

  // ── Poll ALL active rides ──
  useEffect(() => {
    if (tab !== "rider") return;
    const check = async () => {
      try {
        const data = await get<ActiveRide[]>("/rides/active");
        setActiveRides(Array.isArray(data) ? data : []);
      } catch {}
    };
    check();
    pollRef.current = setInterval(check, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab]);

  // ── Fetch ride history whenever the modal opens ──
  useEffect(() => {
    if (!showActiveRides) return;
    (async () => {
      try {
        const data = await get<ActiveRide[]>("/rides/history");
        if (Array.isArray(data)) {
          setRideHistory(data.filter(r => ["cancelled", "completed"].includes(r.status)));
        }
      } catch {}
    })();
  }, [showActiveRides]);

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

  // ── Reset the booking form completely ──
  const resetBookingForm = useCallback(() => {
    setDrop(null);
    setEstimate(null);
    setScheduledTime(null);
    setSheetExpanded(false);
    setRideFor("me");
    setPassengerName("");
    setPassengerPhone("");
    setRideMode("instant");
    mapRef.current?.clearDrop?.();
  }, []);

  // ── Book Ride ──
  const handleBookRide = async () => {
    if (!drop) { Alert.alert("Destination required", "Please select a destination first"); return; }
    if (rideMode === "scheduled" && !scheduledTime) { setScheduleModalOpen(true); return; }
    if (rideFor === "someone_else" && !passengerName.trim()) {
      Alert.alert("Passenger name required", "Please enter the name of the passenger"); return;
    }
    setBooking(true);
    try {
      const newRide = await post<ActiveRide>("/rides/request", {
        pickupLat: pickup.lat, pickupLng: pickup.lng, pickupAddress: pickup.address,
        dropLat: drop.lat, dropLng: drop.lng, dropAddress: drop.address,
        vehicleType,
        ...(rideMode === "scheduled" && scheduledTime ? { scheduledAt: scheduledTime.date.toISOString() } : {}),
        rideFor,
        passengerName:  rideFor === "someone_else" ? passengerName.trim()  : undefined,
        passengerPhone: rideFor === "someone_else" ? passengerPhone.trim() : undefined,
      });
      setActiveRides(prev => [newRide, ...prev]);
      resetBookingForm();
      Alert.alert(
        "Ride Booked!",
        rideFor === "someone_else"
          ? `Ride booked for ${passengerName.trim()}. Tap "Active Rides" to track.`
          : "Looking for a driver nearby. Tap \"Active Rides\" to track.",
        [{ text: "View Active Rides", onPress: () => setShowActiveRides(true) }, { text: "Book Another" }]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not book ride");
    }
    setBooking(false);
  };

  // ── Toast helper ──
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // ── Cancel Ride (opens confirm modal) — close rides modal first to avoid stacked portals ──
  const handleCancelRequest = (ride: ActiveRide) => {
    setShowActiveRides(false);   // dismiss rides list before opening cancel dialog
    setCancellingRide(ride);
  };

  // ── Cancel Ride (confirmed with reason) — loading guard + map reset + toast ──
  const handleCancelConfirmed = async (rideId: string, reason: string) => {
    if (cancelLoading) return; // double-tap guard
    setCancelLoading(true);

    // Grab the ride before any state changes
    const rideToCancel = activeRides.find(r => r.id === rideId) ?? cancellingRide;

    // Compute remaining rides BEFORE the optimistic update (for post-cancel re-open logic)
    const remainingRides = activeRides.filter(r => r.id !== rideId);

    // Optimistically remove from active list & add to history immediately
    setActiveRides(prev => prev.filter(r => r.id !== rideId));
    if (rideToCancel) {
      const cancelledRide: ActiveRide = {
        ...rideToCancel,
        status: "cancelled",
        ...(reason ? { cancellation_reason: reason } as any : {}),
      };
      setRideHistory(prev => [cancelledRide, ...prev.filter(r => r.id !== rideId)]);
    }

    try {
      await patch(`/rides/${rideId}/cancel`, { cancellationReason: reason });

      // Close the cancel modal and show success toast
      setCancellingRide(null);
      showToast("Ride cancelled successfully");
      // Re-open rides list if the user still has other active rides
      if (remainingRides.length > 0) setShowActiveRides(true);

      // Reset the map/estimate if this ride's route is currently displayed
      if (drop && rideToCancel?.drop_address === drop.address) {
        setDrop(null);
        setEstimate(null);
        setSheetExpanded(false);
        mapRef.current?.clearDrop?.();
      }
    } catch {
      // Rollback optimistic updates if API fails
      if (rideToCancel) {
        setActiveRides(prev => [rideToCancel, ...prev]);
        setRideHistory(prev => prev.filter(r => r.id !== rideId));
      }
      Alert.alert("Error", "Could not cancel the ride. Please try again.");
    } finally {
      setCancelLoading(false);
    }
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
  const renderRider = () => (
    <>
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
            setPickup({ lat, lng, address });
          }}
          onGpsLocation={(lat, lng, address) => {
            setPickup({ lat, lng, address });
          }}
          onLocationSelected={(mode, lat, lng, address) => {
            if (mode === "pickup") {
              setPickup({ lat, lng, address });
            } else {
              setDrop({ lat, lng, address });
              // Instant Haversine estimate so prices show immediately
              if (pickup) {
                const km = haversineKm(pickup.lat, pickup.lng, lat, lng);
                const durationMin = Math.round(km * 60 / 38);
                const p = ridePricing[vehicleType] ?? DEFAULT_PRICING[vehicleType] ?? { baseFare: 50, perKm: 12 };
                setEstimate({ distanceKm: km, durationMin, fare: Math.max(p.baseFare, Math.round(p.baseFare + km * p.perKm)) });
              } else {
                setEstimate(null);
              }
              setSheetExpanded(true);
            }
          }}
        />
      </View>

      <BottomSheet isExpanded={sheetExpanded} onToggle={() => setSheetExpanded(v => !v)}>
        <View style={styles.sheetInner}>

          {/* Ride mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, rideMode === "instant" && styles.modeBtnActive]}
              onPress={() => setRideMode("instant")}
            >
              <Feather name="zap" size={14} color={rideMode === "instant" ? "#fff" : C.textSecondary} />
              <Text style={[styles.modeBtnText, rideMode === "instant" && styles.modeBtnTextActive]}>Book Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, rideMode === "scheduled" && { ...styles.modeBtnActive, backgroundColor: PURPLE }]}
              onPress={() => setRideMode("scheduled")}
            >
              <Feather name="clock" size={14} color={rideMode === "scheduled" ? "#fff" : C.textSecondary} />
              <Text style={[styles.modeBtnText, rideMode === "scheduled" && styles.modeBtnTextActive]}>Schedule</Text>
            </TouchableOpacity>
          </View>

          {/* Scheduled time */}
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
            <View style={styles.locDivider}><View style={styles.locLine} /></View>
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

          {/* Estimate */}
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
                <Text style={[styles.estimateVal, { color: GOLD }]}>₹{estimate.fare}</Text>
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

          {/* Ride For Toggle */}
          {drop && (
            <View style={styles.rideForSection}>
              <Text style={styles.sectionLabel}>Who is this ride for?</Text>
              <View style={styles.rideForToggle}>
                <TouchableOpacity
                  style={[styles.rideForBtn, rideFor === "me" && styles.rideForBtnActive]}
                  onPress={() => setRideFor("me")}
                >
                  <Feather name="user" size={14} color={rideFor === "me" ? "#fff" : C.textSecondary} />
                  <Text style={[styles.rideForBtnText, rideFor === "me" && styles.rideForBtnTextActive]}>Me</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rideForBtn, rideFor === "someone_else" && { ...styles.rideForBtnActive, backgroundColor: PURPLE }]}
                  onPress={() => setRideFor("someone_else")}
                >
                  <Feather name="users" size={14} color={rideFor === "someone_else" ? "#fff" : C.textSecondary} />
                  <Text style={[styles.rideForBtnText, rideFor === "someone_else" && styles.rideForBtnTextActive]}>Someone Else</Text>
                </TouchableOpacity>
              </View>

              {rideFor === "someone_else" && (
                <View style={styles.passengerFields}>
                  <View style={styles.passengerInputWrap}>
                    <Feather name="user" size={15} color={PURPLE} style={styles.passengerInputIcon} />
                    <TextInput
                      style={styles.passengerInput}
                      placeholder="Passenger full name *"
                      placeholderTextColor={C.textTertiary}
                      value={passengerName}
                      onChangeText={setPassengerName}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={styles.passengerInputWrap}>
                    <Feather name="phone" size={15} color={PURPLE} style={styles.passengerInputIcon} />
                    <TextInput
                      style={styles.passengerInput}
                      placeholder="Passenger phone (optional)"
                      placeholderTextColor={C.textTertiary}
                      value={passengerPhone}
                      onChangeText={setPassengerPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Book button */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { marginTop: 12, backgroundColor: rideMode === "scheduled" ? PURPLE : ORANGE },
              (!drop || booking) && { opacity: 0.5 },
            ]}
            onPress={handleBookRide}
            disabled={!drop || booking}
          >
            {booking
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
      </BottomSheet>
    </>
  );

  // ── DRIVER UI ───────────────────────────────────────────────────────────────
  const renderDriver = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.driverContainer}>
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
          onPress={handleToggleOnline} disabled={driverLoading}
        >
          {driverLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.onlineToggleText}>{isOnline ? "Go\nOffline" : "Go\nOnline"}</Text>
          }
        </TouchableOpacity>
      </LinearGradient>

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

          {/* Show passenger info if ride booked for someone else */}
          {driverActiveRide.ride_for_type === "someone_else" && driverActiveRide.passenger_name && (
            <View style={[styles.passengerBadge, { marginBottom: 10 }]}>
              <Feather name="users" size={12} color={PURPLE} />
              <Text style={styles.passengerBadgeText}>Passenger: {driverActiveRide.passenger_name}</Text>
              {driverActiveRide.passenger_phone && (
                <Text style={styles.passengerBadgePhone}>{driverActiveRide.passenger_phone}</Text>
              )}
            </View>
          )}

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
            <Text style={styles.rideMetaText}>
              Rider: {driverActiveRide.rider_name ?? "—"}
            </Text>
            <Text style={styles.rideMetaFare}>₹{driverActiveRide.fare}</Text>
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
                  {req.ride_for_type === "someone_else" && req.passenger_name && (
                    <Text style={[styles.rideMetaText, { color: PURPLE }]}>For: {req.passenger_name}</Text>
                  )}
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

      {selectedRequest && (
        <View style={styles.requestDetailOverlay}>
          <View style={styles.requestDetailCard}>
            <Text style={styles.requestDetailTitle}>New Ride Request</Text>
            {selectedRequest.ride_for_type === "someone_else" && selectedRequest.passenger_name && (
              <View style={[styles.passengerBadge, { marginBottom: 10 }]}>
                <Feather name="users" size={12} color={PURPLE} />
                <Text style={styles.passengerBadgeText}>Passenger: {selectedRequest.passenger_name}</Text>
              </View>
            )}
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

  // ── Active rides badge count ──
  const activeCount = activeRides.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <LinearGradient colors={[NAVY, "#152847"]} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Cars</Text>
          <Text style={styles.headerSub}>Ride-booking · Punjab</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Active Rides button with badge */}
          {tab === "rider" && (
            <TouchableOpacity
              style={[styles.activeRidesBtn, activeCount > 0 && styles.activeRidesBtnActive]}
              onPress={() => setShowActiveRides(true)}
            >
              <Feather name="navigation" size={14} color={activeCount > 0 ? "#fff" : "rgba(255,255,255,0.7)"} />
              <Text style={[styles.activeRidesBtnText, activeCount > 0 && { color: "#fff" }]}>
                {activeCount > 0 ? `Active Rides (${activeCount})` : "My Rides"}
              </Text>
              {activeCount > 0 && (
                <View style={styles.rideBadge}>
                  <Text style={styles.rideBadgeText}>{activeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {isProviderUser && (
            <View style={styles.tabPills}>
              {(["rider", "driver"] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tabPill, tab === t && styles.tabPillActive]}
                  onPress={() => { setTab(t); if (pollRef.current) clearInterval(pollRef.current); }}
                >
                  <Feather name={t === "rider" ? "user" : "truck"} size={13} color={tab === t ? "#fff" : "rgba(255,255,255,0.55)"} />
                  <Text style={[styles.tabPillText, tab === t && styles.tabPillTextActive]}>
                    {t === "rider" ? "Rider" : "Driver"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === "rider" ? renderRider() : renderDriver()}
      </View>

      {/* Location Modals */}
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
        onCurrentLocation={() => { mapRef.current?.getCurrentLocation(); }}
        userLat={pickup.lat}
        userLng={pickup.lng}
      />
      <LocationSearchModal
        visible={dropModalOpen}
        onClose={() => setDropModalOpen(false)}
        onSelect={(loc: LocationResult) => {
          const d: Coords = { lat: loc.lat, lng: loc.lng, address: loc.address };
          setDrop(d);
          // Instant Haversine estimate so prices show immediately
          const km = haversineKm(pickup.lat, pickup.lng, loc.lat, loc.lng);
          const durationMin = Math.round(km * 60 / 38);
          const p = ridePricing[vehicleType] ?? DEFAULT_PRICING[vehicleType] ?? { baseFare: 50, perKm: 12 };
          setEstimate({ distanceKm: km, durationMin, fare: Math.max(p.baseFare, Math.round(p.baseFare + km * p.perKm)) });
          setSheetExpanded(true);
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

      {/* Active Rides Modal */}
      <ActiveRidesModal
        visible={showActiveRides}
        rides={activeRides}
        history={rideHistory}
        onClose={() => setShowActiveRides(false)}
        onCancelRide={handleCancelRequest}
      />

      {/* Cancel Confirmation Modal */}
      <CancelModal
        ride={cancellingRide}
        visible={cancellingRide !== null}
        loading={cancelLoading}
        onConfirm={handleCancelConfirmed}
        onDismiss={() => {
          if (!cancelLoading) {
            setCancellingRide(null);
            setShowActiveRides(true); // return to rides list on dismiss
          }
        }}
      />

      {/* Success Toast */}
      {toastMsg !== null && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastPill}>
            <Feather name="check-circle" size={16} color="#fff" />
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a1628" },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, flexWrap: "wrap", gap: 8 },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },

  // Active rides button
  activeRidesBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  activeRidesBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  activeRidesBtnText: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_600SemiBold" },
  rideBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  rideBadgeText: { fontSize: 9, fontWeight: "800", color: ORANGE, fontFamily: "Inter_700Bold" },

  tabPills: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 3, gap: 2 },
  tabPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 17 },
  tabPillActive: { backgroundColor: ORANGE },
  tabPillText: { fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_500Medium" },
  tabPillTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  // Map
  mapContainer: { width: "100%", overflow: "hidden", position: "relative", backgroundColor: "#e8ddd0" },

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

  // Ride for toggle
  rideForSection: { marginBottom: 14 },
  rideForToggle: { flexDirection: "row", backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 4, gap: 4, marginBottom: 10 },
  rideForBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 11 },
  rideForBtnActive: { backgroundColor: ORANGE },
  rideForBtnText: { fontSize: 14, fontWeight: "600", color: C.textSecondary, fontFamily: "Inter_600SemiBold" },
  rideForBtnTextActive: { color: "#fff" },

  // Passenger fields
  passengerFields: { gap: 8 },
  passengerInputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: C.backgroundSecondary, borderRadius: 14, borderWidth: 1.5, borderColor: `${PURPLE}40`, paddingHorizontal: 12, paddingVertical: 4 },
  passengerInputIcon: { marginRight: 8 },
  passengerInput: { flex: 1, fontSize: 15, color: C.text, fontFamily: "Inter_400Regular", paddingVertical: 10 },

  // Passenger badge (in active ride card / driver view)
  passengerBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${PURPLE}14`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: `${PURPLE}25`, marginBottom: 8 },
  passengerBadgeText: { fontSize: 12, color: PURPLE, fontFamily: "Inter_600SemiBold", flex: 1 },
  passengerBadgePhone: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  // Primary button
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16 },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  cancelBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: RED, marginTop: 8 },
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
  scheduledText: { fontSize: 13, color: PURPLE, fontFamily: "Inter_500Medium", flex: 1 },

  // Status pill / dot
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

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

  // Modal backdrop (replaces modalOverlay — uses TouchableOpacity for tap-to-close)
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  activeRidesSheet: { backgroundColor: C.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: SH * 0.88, paddingBottom: 40 },
  activeRidesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  activeRidesTitle: { fontSize: 22, fontWeight: "800", color: C.text, fontFamily: "Inter_700Bold" },
  activeRidesSub: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  activeRidesScroll: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },

  // Tabs (Active / History)
  ridesTabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 14, backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 4, gap: 4 },
  ridesTab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center" },
  ridesTabActive: { backgroundColor: ORANGE },
  ridesTabText: { fontSize: 14, fontWeight: "600", color: C.textSecondary, fontFamily: "Inter_600SemiBold" },
  ridesTabTextActive: { color: "#fff" },
  historyGroupLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8, marginTop: 4 },

  // Active ride card
  activeRideCard: { backgroundColor: C.backgroundSecondary, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border },
  activeRideHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  activeRideVehicleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  activeRideEmoji: { fontSize: 22 },
  activeRideVehicle: { fontSize: 16, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },

  // Cancel modal
  cancelModalCard: { backgroundColor: C.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  cancelModalTitle: { fontSize: 22, fontWeight: "800", color: C.text, fontFamily: "Inter_700Bold", marginBottom: 4 },
  cancelModalSub: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginBottom: 20 },
  cancelReasonLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 },
  reasonPillRow: { gap: 8, paddingBottom: 4 },
  reasonPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.backgroundSecondary, borderWidth: 1.5, borderColor: C.border },
  reasonPillActive: { backgroundColor: RED, borderColor: RED },
  reasonPillText: { fontSize: 13, color: C.text, fontFamily: "Inter_500Medium" },
  reasonPillTextActive: { color: "#fff" },
  reasonInput: { backgroundColor: C.backgroundSecondary, borderRadius: 14, padding: 14, fontSize: 15, color: C.text, fontFamily: "Inter_400Regular", marginTop: 12, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  cancelModalBtns: { flexDirection: "row", gap: 10 },
  cancelModalKeep: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1.5, borderColor: C.border },
  cancelModalKeepText: { fontSize: 15, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  cancelModalConfirm: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: "center", backgroundColor: RED },
  cancelModalConfirmText: { fontSize: 15, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },

  // History filter pills
  historyFilterRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 10, gap: 8, flexWrap: "wrap" },
  historyFilterPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.backgroundSecondary, borderWidth: 1.5, borderColor: C.border },
  historyFilterPillActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  historyFilterText: { fontSize: 12, fontWeight: "600", color: C.textSecondary, fontFamily: "Inter_600SemiBold" },
  historyFilterTextActive: { color: "#fff" },

  // Success toast
  toastContainer: { position: "absolute", bottom: 110, left: 20, right: 20, alignItems: "center", zIndex: 9999 },
  toastPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: GREEN, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
  toastText: { fontSize: 14, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold" },
});
