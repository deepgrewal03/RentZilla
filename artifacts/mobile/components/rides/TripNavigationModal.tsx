import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Alert, Dimensions, Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");
const ORANGE = "#E8742A";
const GREEN  = "#22C55E";
const RED    = "#EF4444";
const NAVY   = "#0F1F3D";
const GOLD   = "#F5C842";

export interface TripRide {
  id: string;
  rider_id?: string;
  rider_name?: string;
  rider_phone?: string;
  drop_lat: number;
  drop_lng: number;
  drop_address?: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address?: string;
  fare?: number;
  distance_km?: number;
  vehicle_type?: string;
  passenger_name?: string;
  ride_for_type?: string;
}

interface Props {
  visible: boolean;
  ride: TripRide | null;
  apiBase: string;
  token: string;
  onComplete: () => void;
  onClose: () => void;
}

// ── Singleton Google Maps loader (reuses loaded script if present) ─────────────
let _gmLoaded = typeof window !== "undefined" && !!(window as any).google?.maps;
let _gmLoading = false;
const _gmQueue: Array<() => void> = [];

function loadGoogleMaps(key: string, cb: () => void) {
  if (_gmLoaded) { cb(); return; }
  _gmQueue.push(cb);
  if (_gmLoading) return;
  _gmLoading = true;
  (window as any).__trip_gm_cb__ = () => {
    _gmLoaded = true;
    _gmLoading = false;
    _gmQueue.forEach(fn => fn());
    _gmQueue.length = 0;
  };
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&callback=__trip_gm_cb__`;
  s.async = true;
  document.head.appendChild(s);
}

async function getMapsKey(): Promise<string> {
  const envKey = (process.env.EXPO_PUBLIC_GMAPS_KEY as string) || "";
  if (envKey) return envKey;
  try {
    const base = (process.env.EXPO_PUBLIC_DOMAIN as string)
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : window.location.origin;
    const r = await fetch(`${base}/api/maps/key`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) { const d: any = await r.json(); if (d?.key) return d.key; }
  } catch {}
  return "";
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TripNavigationModal({ visible, ride, apiBase, token, onComplete, onClose }: Props) {
  const insets = useSafeAreaInsets();

  // ── State ──────────────────────────────────────────────────────────────────
  const [mapReady, setMapReady]   = useState(false);
  const [eta, setEta]             = useState<number | null>(null);
  const [elapsed, setElapsed]     = useState(0);
  const [completing, setCompleting] = useState(false);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const divRef        = useRef<any>(null);
  const mapInst       = useRef<any>(null);
  const dirSvc        = useRef<any>(null);
  const dirRend       = useRef<any>(null);
  const driverMarker  = useRef<any>(null);
  const locSub        = useRef<any>(null);
  const pingTimer     = useRef<any>(null);
  const elapsedTimer  = useRef<any>(null);
  const etaTimer      = useRef<any>(null);
  const lastPos       = useRef<{ lat: number; lng: number } | null>(null);
  const lastEtaReq    = useRef<number>(0);

  // ── Location helpers ────────────────────────────────────────────────────────
  const sendLocation = useCallback(async (lat: number, lng: number, heading?: number, speed?: number) => {
    if (!ride || !token) return;
    try {
      await fetch(`${apiBase}/api/rides/${ride.id}/driver-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat, lng, heading: heading ?? 0, speed: speed ?? 0 }),
      });
      // Also update global driver_locations for customer polling
      await fetch(`${apiBase}/api/rides/driver/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat, lng }),
      });
    } catch {}
  }, [ride?.id, token, apiBase]);

  const refreshEta = useCallback((fromLat: number, fromLng: number) => {
    if (!ride || !dirSvc.current || !mapInst.current) return;
    const now = Date.now();
    if (now - lastEtaReq.current < 10000) return; // throttle to once per 10s
    lastEtaReq.current = now;
    const G = (window as any).google?.maps;
    if (!G) return;
    dirSvc.current.route(
      {
        origin: { lat: fromLat, lng: fromLng },
        destination: { lat: ride.drop_lat, lng: ride.drop_lng },
        travelMode: G.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === "OK") {
          dirRend.current?.setDirections(result);
          const min = Math.round(result.routes[0].legs[0].duration.value / 60);
          setEta(min);
        }
      },
    );
  }, [ride?.drop_lat, ride?.drop_lng]);

  const updateDriverMarker = useCallback((lat: number, lng: number) => {
    const G = (window as any).google?.maps;
    if (!G || !mapInst.current) return;
    const pos = { lat, lng };
    if (driverMarker.current) {
      driverMarker.current.setPosition(pos);
    } else {
      driverMarker.current = new G.Marker({
        map: mapInst.current,
        position: pos,
        icon: {
          path: G.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: ORANGE,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          rotation: 0,
        },
        title: "You",
        zIndex: 999,
      });
    }
    mapInst.current.panTo(pos);
  }, []);

  // ── Map init ────────────────────────────────────────────────────────────────
  const initMap = useCallback(async () => {
    if (!divRef.current || !ride) return;
    const key = await getMapsKey();
    if (!key) { setMapReady(true); return; }

    loadGoogleMaps(key, () => {
      if (!divRef.current) return;
      const G = (window as any).google.maps;

      mapInst.current = new G.Map(divRef.current, {
        center: { lat: ride.pickup_lat, lng: ride.pickup_lng },
        zoom: 15,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "greedy",
      });

      dirSvc.current  = new G.DirectionsService();
      dirRend.current = new G.DirectionsRenderer({
        map: mapInst.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: ORANGE,
          strokeWeight: 5,
          strokeOpacity: 0.95,
        },
      });

      // Destination pin
      new G.Marker({
        map: mapInst.current,
        position: { lat: ride.drop_lat, lng: ride.drop_lng },
        icon: {
          path: G.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: RED,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2.5,
        },
        title: ride.drop_address ?? "Destination",
      });

      setMapReady(true);
    });
  }, [ride?.id]);

  // ── GPS watching ───────────────────────────────────────────────────────────
  const startGps = useCallback(async () => {
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
          lastPos.current = { lat, lng };
          setDriverPos({ lat, lng });
          updateDriverMarker(lat, lng);
          sendLocation(lat, lng, heading ?? 0, speed ?? 0);
          refreshEta(lat, lng);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
      );
      (locSub.current as any) = { type: "web", id: watchId };
    } else {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5 },
          (loc) => {
            const { latitude: lat, longitude: lng, heading, speed } = loc.coords;
            lastPos.current = { lat, lng };
            setDriverPos({ lat, lng });
            updateDriverMarker(lat, lng);
            sendLocation(lat, lng, heading ?? 0, speed ?? 0);
            refreshEta(lat, lng);
          },
        );
        locSub.current = { type: "native", sub };
      } catch {}
    }
  }, [sendLocation, updateDriverMarker, refreshEta]);

  const stopGps = useCallback(() => {
    if (!locSub.current) return;
    if (locSub.current.type === "web") {
      navigator.geolocation.clearWatch(locSub.current.id);
    } else {
      locSub.current.sub?.remove?.();
    }
    locSub.current = null;
  }, []);

  // ── Lifecycle: start/stop everything when visible changes ──────────────────
  useEffect(() => {
    if (!visible || !ride) return;
    setElapsed(0);
    setEta(null);
    setMapReady(false);
    setCompleting(false);

    // Small delay to let the modal render the div
    const initDelay = setTimeout(() => initMap(), 150);

    startGps();

    // Trip timer
    elapsedTimer.current = setInterval(() => setElapsed(s => s + 1), 1000);

    return () => {
      clearTimeout(initDelay);
      stopGps();
      clearInterval(elapsedTimer.current);
      clearTimeout(etaTimer.current);
      // Clean up Google Maps instances
      driverMarker.current?.setMap(null);
      driverMarker.current = null;
      try { dirRend.current?.setDirections({ routes: [] }); } catch {}
      mapInst.current = null;
      dirSvc.current  = null;
      dirRend.current = null;
    };
  }, [visible, ride?.id]);

  // ── Draw initial route once map + GPS position are both ready ─────────────
  useEffect(() => {
    if (!mapReady || !driverPos) return;
    refreshEta(driverPos.lat, driverPos.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, driverPos?.lat, driverPos?.lng]);

  // ── Complete trip handler ──────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (!ride || completing) return;
    Alert.alert(
      "Complete Trip?",
      `End the trip to ${ride.drop_address ?? "destination"}?`,
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Complete",
          style: "default",
          onPress: async () => {
            setCompleting(true);
            try {
              await fetch(`${apiBase}/api/rides/${ride.id}/end`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({}),
              });
              onComplete();
            } catch {
              Alert.alert("Error", "Could not complete trip. Try again.");
              setCompleting(false);
            }
          },
        },
      ],
    );
  }, [ride?.id, completing, token, apiBase, onComplete]);

  const handleCallRider = useCallback(() => {
    if (ride?.rider_phone) {
      Linking.openURL(`tel:${ride.rider_phone}`).catch(() => {
        Alert.alert("Cannot call", "Phone dialer not available.");
      });
    }
  }, [ride?.rider_phone]);

  // ── Guards (after all hooks) ───────────────────────────────────────────────
  if (!visible || !ride) return null;

  const passengerLabel = ride.ride_for_type === "someone_else" && ride.passenger_name
    ? ride.passenger_name
    : (ride.rider_name ?? "Rider");

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {/* ── Top info strip ─────────────────────────────────────────────── */}
        <LinearGradient colors={[NAVY, "#1a3060"]} style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topLeft}>
            <Text style={styles.riderName} numberOfLines={1}>🧑 {passengerLabel}</Text>
            <View style={styles.tripMetaRow}>
              <Text style={styles.tripMeta}>
                {ride.drop_address?.split(",")[0] ?? "Destination"}
              </Text>
            </View>
          </View>
          <View style={styles.topRight}>
            <Text style={styles.fareLabel}>Fare</Text>
            <Text style={styles.fareAmount}>₹{ride.fare ?? "—"}</Text>
          </View>
        </LinearGradient>

        {/* ── ETA + Timer row ────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Feather name="clock" size={14} color={ORANGE} />
            <Text style={styles.statVal}>{eta != null ? `${eta} min` : "—"}</Text>
            <Text style={styles.statKey}>ETA</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Feather name="activity" size={14} color={GREEN} />
            <Text style={styles.statVal}>{fmtTime(elapsed)}</Text>
            <Text style={styles.statKey}>Trip Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <View style={[styles.liveIndicator, { backgroundColor: driverPos ? GREEN : "#888" }]} />
            <Text style={styles.statVal}>{driverPos ? "Live" : "GPS…"}</Text>
            <Text style={styles.statKey}>Tracking</Text>
          </View>
        </View>

        {/* ── Map ────────────────────────────────────────────────────────── */}
        <View style={styles.mapArea}>
          {Platform.OS === "web" ? (
            <div
              ref={divRef}
              style={{ width: "100%", height: "100%", backgroundColor: "#e8ddd0" } as any}
            />
          ) : (
            <View ref={divRef} style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>
                {driverPos
                  ? `📍 ${driverPos.lat.toFixed(4)}, ${driverPos.lng.toFixed(4)}`
                  : "Acquiring GPS…"}
              </Text>
              <Text style={[styles.mapFallbackText, { marginTop: 6, fontSize: 12, opacity: 0.6 }]}>
                → {ride.drop_address ?? `${ride.drop_lat.toFixed(4)}, ${ride.drop_lng.toFixed(4)}`}
              </Text>
            </View>
          )}

          {!mapReady && Platform.OS === "web" && (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={ORANGE} size="large" />
              <Text style={{ color: "#fff", marginTop: 8, fontSize: 13 }}>Loading map…</Text>
            </View>
          )}

          {/* Floating destination badge */}
          <View style={styles.destBadge}>
            <Feather name="map-pin" size={12} color={RED} />
            <Text style={styles.destBadgeText} numberOfLines={1}>
              {ride.drop_address?.split(",")[0] ?? "Destination"}
            </Text>
          </View>
        </View>

        {/* ── Bottom controls ─────────────────────────────────────────────── */}
        <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.bottomRow}>
            {/* Call Rider */}
            <TouchableOpacity style={styles.iconBtn} onPress={handleCallRider}>
              <View style={[styles.iconBtnCircle, { backgroundColor: `${GREEN}22` }]}>
                <Feather name="phone-call" size={20} color={GREEN} />
              </View>
              <Text style={styles.iconBtnLabel}>Call Rider</Text>
            </TouchableOpacity>

            {/* Complete Trip (center, prominent) */}
            <TouchableOpacity
              style={[styles.completeBtn, completing && { opacity: 0.6 }]}
              onPress={handleComplete}
              disabled={completing}
            >
              <LinearGradient colors={[ORANGE, "#FF9F43"]} style={styles.completeBtnGrad}>
                {completing
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Feather name="flag" size={18} color="#fff" />
                      <Text style={styles.completeBtnText}>Complete Trip</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Emergency */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => Alert.alert("Emergency", "Emergency support: 112")}>
              <View style={[styles.iconBtnCircle, { backgroundColor: `${RED}22` }]}>
                <Feather name="alert-triangle" size={20} color={RED} />
              </View>
              <Text style={styles.iconBtnLabel}>Emergency</Text>
            </TouchableOpacity>
          </View>

          {/* Ongoing status badge */}
          <View style={styles.ongoingBadge}>
            <View style={styles.ongoingDot} />
            <Text style={styles.ongoingText}>Trip Ongoing · Tracking Active</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14,
  },
  topLeft: { flex: 1, marginRight: 16 },
  topRight: { alignItems: "flex-end" },
  riderName: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 2 },
  tripMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tripMeta: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  fareLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  fareAmount: { color: GOLD, fontSize: 20, fontWeight: "800" },

  statsRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingVertical: 10, paddingHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "rgba(0,0,0,0.1)" },
  statVal: { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  statKey: { fontSize: 10, color: "#888", fontWeight: "500" },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },

  mapArea: { flex: 1, position: "relative" },
  mapFallback: {
    flex: 1, backgroundColor: "#1a2a40", alignItems: "center", justifyContent: "center",
    padding: 20,
  },
  mapFallbackText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  mapLoading: {
    ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  destBadge: {
    position: "absolute", top: 10, left: 12, right: 12,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: "flex-start",
  },
  destBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600", flex: 1 },

  bottomPanel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingHorizontal: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 16,
  },
  bottomRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  iconBtn: { alignItems: "center", gap: 6, width: 70 },
  iconBtnCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  iconBtnLabel: { fontSize: 11, color: "#555", fontWeight: "500" },

  completeBtn: { flex: 1, marginHorizontal: 12 },
  completeBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, paddingVertical: 16,
  },
  completeBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  ongoingBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  ongoingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  ongoingText: { fontSize: 12, color: "#666", fontWeight: "500" },
});
