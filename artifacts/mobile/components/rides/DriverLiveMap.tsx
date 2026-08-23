import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { API_BASE_URL } from "@/constants/apiUrl";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";

const ORANGE = "#E8742A";
const GREEN  = "#22C55E";
const NAVY   = "#0F1F3D";

export interface RequestPin {
  id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address?: string;
  distance_km?: number;
}

interface Props {
  requests?: RequestPin[];
  height?: number;
}

// ── Singleton Google Maps loader ─────────────────────────────────────────────
let _loaded = typeof window !== "undefined" && !!(window as any).google?.maps;
let _loading = false;
const _queue: Array<() => void> = [];

function loadGM(key: string, cb: () => void) {
  if (_loaded) { cb(); return; }
  _queue.push(cb);
  if (_loading) return;
  _loading = true;
  (window as any).__drv_gm_cb__ = () => {
    _loaded = true; _loading = false;
    _queue.forEach(fn => fn()); _queue.length = 0;
  };
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&callback=__drv_gm_cb__`;
  s.async = true;
  document.head.appendChild(s);
}

async function getKey(): Promise<string> {
  const env = (process.env.EXPO_PUBLIC_GMAPS_KEY as string) || "";
  if (env) return env;
  try {
    const base = API_BASE_URL;
    const r = await fetch(`${base}/api/maps/key`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) { const d: any = await r.json(); if (d?.key) return d.key; }
  } catch {}
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DriverLiveMap({ requests = [], height = 270 }: Props) {
  const divRef        = useRef<any>(null);
  const mapInst       = useRef<any>(null);
  const driverMarker  = useRef<any>(null);
  const reqMarkers    = useRef<any[]>([]);
  const watchId       = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [pos, setPos]           = useState<{ lat: number; lng: number } | null>(null);
  const [locErr, setLocErr]     = useState(false);

  // ── Update driver marker on map ───────────────────────────────────────────
  const placeDriver = useCallback((lat: number, lng: number) => {
    if (!mapInst.current) return;
    const G = (window as any).google?.maps;
    if (!G) return;
    const p = { lat, lng };
    if (driverMarker.current) {
      driverMarker.current.setPosition(p);
    } else {
      driverMarker.current = new G.Marker({
        map: mapInst.current,
        position: p,
        icon: {
          path: G.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: ORANGE,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          rotation: 0,
        },
        title: "Your location",
        zIndex: 999,
      });
    }
    mapInst.current.panTo(p);
  }, []);

  // ── Place pickup pins for pending ride requests ────────────────────────────
  const placeRequestPins = useCallback(() => {
    if (!mapInst.current) return;
    const G = (window as any).google?.maps;
    if (!G) return;

    // Remove old markers
    reqMarkers.current.forEach(m => m.setMap(null));
    reqMarkers.current = [];

    requests.forEach(req => {
      const m = new G.Marker({
        map: mapInst.current,
        position: { lat: req.pickup_lat, lng: req.pickup_lng },
        icon: {
          path: G.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: GREEN,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        title: req.pickup_address ?? "Pickup",
        zIndex: 10,
      });

      const info = new G.InfoWindow({
        content: `<div style="font-size:12px;font-weight:600;color:#333">${req.pickup_address?.split(",")[0] ?? "Pickup"}${req.distance_km ? ` · ${Number(req.distance_km).toFixed(1)} km` : ""}</div>`,
      });
      m.addListener("click", () => info.open(mapInst.current, m));
      reqMarkers.current.push(m);
    });
  }, [requests]);

  // ── Init map ─────────────────────────────────────────────────────────────
  const initMap = useCallback(async (lat: number, lng: number) => {
    if (!divRef.current) return;
    const key = await getKey();
    if (!key) { setMapReady(true); return; }

    loadGM(key, () => {
      if (!divRef.current) return;
      const G = (window as any).google.maps;

      mapInst.current = new G.Map(divRef.current, {
        center: { lat, lng },
        zoom: 15,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });

      setMapReady(true);
      placeDriver(lat, lng);
    });
  }, [placeDriver]);

  // ── GPS on web ────────────────────────────────────────────────────────────
  const startWebGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setLocErr(true); return; }

    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        setPos({ lat, lng });
        initMap(lat, lng);
      },
      () => { setLocErr(true); },
      { enableHighAccuracy: true, timeout: 10000 },
    );

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        setPos({ lat, lng });
        placeDriver(lat, lng);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }, [initMap, placeDriver]);

  // ── GPS on native ─────────────────────────────────────────────────────────
  const startNativeGps = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocErr(true); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      setPos({ lat, lng });

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (l) => {
          const { latitude: lat2, longitude: lng2 } = l.coords;
          setPos({ lat: lat2, lng: lng2 });
        },
      );
      watchId.current = sub;
    } catch { setLocErr(true); }
  }, []);

  // ── Start GPS on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === "web") {
      startWebGps();
    } else {
      startNativeGps();
    }

    return () => {
      if (Platform.OS === "web" && watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
      } else {
        watchId.current?.remove?.();
      }
      driverMarker.current?.setMap?.(null);
      driverMarker.current = null;
      reqMarkers.current.forEach(m => m.setMap(null));
      reqMarkers.current = [];
      mapInst.current = null;
    };
  }, []);

  // ── Redraw request pins when requests change ──────────────────────────────
  useEffect(() => {
    if (mapReady) placeRequestPins();
  }, [mapReady, requests.length]);

  // ── Coords badge text ─────────────────────────────────────────────────────
  const coordsText = pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : null;

  return (
    <View style={[styles.wrapper, { height }]}>
      {/* Map area */}
      {Platform.OS === "web" ? (
        <div
          ref={divRef}
          style={{ width: "100%", height: "100%", backgroundColor: "#1a2a40" } as any}
        />
      ) : (
        <View style={[styles.nativeFallback, { height }]}>
          <Feather name="map-pin" size={32} color={ORANGE} />
          <Text style={styles.nativeText}>
            {locErr ? "Location unavailable" : pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : "Getting GPS…"}
          </Text>
          {requests.length > 0 && (
            <Text style={styles.nativeReqs}>{requests.length} pickup{requests.length > 1 ? "s" : ""} nearby</Text>
          )}
        </View>
      )}

      {/* Loading overlay */}
      {!mapReady && Platform.OS === "web" && !locErr && (
        <View style={styles.loadOverlay}>
          <ActivityIndicator color={ORANGE} size="large" />
          <Text style={styles.loadText}>Getting your location…</Text>
        </View>
      )}

      {/* Error state */}
      {locErr && (
        <View style={styles.loadOverlay}>
          <Feather name={"map-off" as any} size={28} color="#888" />
          <Text style={[styles.loadText, { color: "#888" }]}>Location access denied</Text>
        </View>
      )}

      {/* Live badge */}
      {mapReady && pos && (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live · Broadcasting</Text>
        </View>
      )}

      {/* Request count badge */}
      {requests.length > 0 && (
        <View style={styles.reqBadge}>
          <Feather name="navigation" size={11} color="#fff" />
          <Text style={styles.reqBadgeText}>{requests.length} nearby request{requests.length > 1 ? "s" : ""}</Text>
        </View>
      )}

      {/* Coords badge */}
      {coordsText && Platform.OS === "web" && (
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>{coordsText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%", position: "relative", borderRadius: 16, overflow: "hidden", backgroundColor: "#1a2a40" },

  nativeFallback: { alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#1a2a40" },
  nativeText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  nativeReqs: { color: GREEN, fontSize: 12, fontWeight: "700" },

  loadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(15,31,61,0.85)",
    gap: 10,
  },
  loadText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  liveBadge: {
    position: "absolute", top: 10, left: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  liveText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  reqBadge: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  reqBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  coordsBadge: {
    position: "absolute", bottom: 8, left: 8,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  coordsText: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "500" },
});
