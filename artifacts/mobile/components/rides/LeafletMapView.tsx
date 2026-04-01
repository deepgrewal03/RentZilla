import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

export interface MapRef {
  setPickup: (lat: number, lng: number, address: string) => void;
  setDrop: (lat: number, lng: number, address: string) => void;
  clearDrop: () => void;
  setDriver: (lat: number, lng: number) => void;
  setMode: (mode: "pickup" | "drop") => void;
  getCurrentLocation: () => void;
  fitBounds: () => void;
}

interface Props {
  initialLat?: number;
  initialLng?: number;
  pickup?: { lat: number; lng: number; address: string };
  drop?: { lat: number; lng: number; address: string };
  driverCoords?: { lat: number; lng: number };
  status?: string;
  onGpsLocation?: (lat: number, lng: number, address: string) => void;
  onGpsError?: (msg: string) => void;
  onReady?: () => void;
  onCenterChanged?: (lat: number, lng: number, address: string) => void;
  onLocationSelected?: (
    mode: "pickup" | "drop",
    lat: number, lng: number, address: string
  ) => void;
  onRouteCalculated?: (distanceKm: number, durationMin: number) => void;
  style?: object;
}

// ── Google Maps script loader (singleton) ────────────────────────────────────
let _gmLoaded = false;
let _gmLoading = false;
const _gmQueue: Array<() => void> = [];

function loadGoogleMaps(key: string, cb: () => void) {
  if (_gmLoaded) { cb(); return; }
  _gmQueue.push(cb);
  if (_gmLoading) return;
  _gmLoading = true;

  (window as any).__gm_cb__ = () => {
    _gmLoaded = true;
    _gmLoading = false;
    _gmQueue.forEach(fn => fn());
    _gmQueue.length = 0;
    delete (window as any).__gm_cb__;
  };

  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&callback=__gm_cb__`;
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

// ── Maps API key fetcher (mirrors LocationSearchModal logic) ─────────────────
let _cachedKey: string = (process.env.EXPO_PUBLIC_GMAPS_KEY as string) || "";
let _keyPromise: Promise<string> | null = null;

async function getMapsApiKey(): Promise<string> {
  if (_cachedKey) return _cachedKey;
  if (_keyPromise) return _keyPromise;

  const candidates: string[] = [];
  const pubDomain = (process.env.EXPO_PUBLIC_DOMAIN as string) || "";
  if (pubDomain) candidates.push(`https://${pubDomain}`);
  if (typeof window !== "undefined") candidates.push(window.location.origin);

  _keyPromise = (async () => {
    for (const base of candidates) {
      try {
        const r = await fetch(`${base}/api/maps/key`, { signal: AbortSignal.timeout(5000) });
        if (r.ok) {
          const d: any = await r.json();
          if (d?.key) { _cachedKey = d.key; return d.key; }
        }
      } catch {}
    }
    return "";
  })();
  return _keyPromise;
}

// Eagerly kick off key fetch
getMapsApiKey().catch(() => {});

// ── Helpers ──────────────────────────────────────────────────────────────────
type LatLng = { lat: number; lng: number };

function makeCircleIcon(G: any, color: string, scale = 10) {
  return {
    path: G.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 2.5,
  };
}

// ── Component ────────────────────────────────────────────────────────────────
const LeafletMapView = forwardRef<MapRef, Props>(
  ({ pickup, drop, driverCoords, status, onReady, onRouteCalculated, style }, ref) => {
    const divRef = useRef<any>(null);
    const mapInst = useRef<any>(null);
    const dirSvc  = useRef<any>(null);
    const dirRend = useRef<any>(null);
    const puMarker = useRef<any>(null);
    const dpMarker = useRef<any>(null);
    const drMarker = useRef<any>(null);
    const [ready, setReady] = useState(false);

    // Keep latest props in refs so callbacks don't get stale
    const pickupRef = useRef(pickup);
    const dropRef   = useRef(drop);
    pickupRef.current = pickup;
    dropRef.current   = drop;

    // ── Init ────────────────────────────────────────────────────────────────
    useEffect(() => {
      if (Platform.OS !== "web") {
        setTimeout(() => onReady?.(), 200);
        return;
      }
      getMapsApiKey().then(key => {
        if (!key) { setTimeout(() => onReady?.(), 200); return; }
        loadGoogleMaps(key, () => {
          if (!divRef.current) return;
          const G = (window as any).google.maps;

          mapInst.current = new G.Map(divRef.current, {
            center: { lat: 30.9, lng: 75.85 },
            zoom: 9,
            mapTypeId: "roadmap",
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "cooperative",
          });

          dirSvc.current  = new G.DirectionsService();
          dirRend.current = new G.DirectionsRenderer({
            map: mapInst.current,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: "#FF7A18",
              strokeWeight: 5,
              strokeOpacity: 0.95,
            },
          });

          setReady(true);
          onReady?.();
        });
      });
    }, []);

    // ── Marker helpers ───────────────────────────────────────────────────────
    const upsertMarker = (
      mRef: React.MutableRefObject<any>,
      pos: LatLng,
      color: string,
      title: string,
      scale = 10,
    ) => {
      const G = (window as any).google?.maps;
      if (!G || !mapInst.current) return;
      if (mRef.current) {
        mRef.current.setPosition(pos);
      } else {
        mRef.current = new G.Marker({
          map: mapInst.current,
          position: pos,
          icon: makeCircleIcon(G, color, scale),
          title,
        });
      }
    };

    const removeMarker = (mRef: React.MutableRefObject<any>) => {
      if (mRef.current) { mRef.current.setMap(null); mRef.current = null; }
    };

    // ── Route drawing ────────────────────────────────────────────────────────
    const drawRoute = (pu: { lat: number; lng: number }, dp: { lat: number; lng: number }) => {
      if (!dirSvc.current) return;
      const G = (window as any).google.maps;
      dirSvc.current.route(
        {
          origin: { lat: pu.lat, lng: pu.lng },
          destination: { lat: dp.lat, lng: dp.lng },
          travelMode: G.TravelMode.DRIVING,
        },
        (result: any, status: string) => {
          if (status === "OK") {
            dirRend.current?.setDirections(result);
            const leg = result.routes[0].legs[0];
            const km  = +(leg.distance.value / 1000).toFixed(2);
            const min = Math.round(leg.duration.value / 60);
            onRouteCalculated?.(km, min);

            // Fit both markers in view
            const G2 = (window as any).google.maps;
            const bounds = new G2.LatLngBounds();
            bounds.extend({ lat: pu.lat, lng: pu.lng });
            bounds.extend({ lat: dp.lat, lng: dp.lng });
            mapInst.current?.fitBounds(bounds, 80);
          }
        },
      );
    };

    // ── Sync pickup marker ───────────────────────────────────────────────────
    useEffect(() => {
      if (!ready || !pickup) return;
      upsertMarker(puMarker, { lat: pickup.lat, lng: pickup.lng }, "#22C55E", pickup.address, 10);
      if (!drop) {
        mapInst.current?.panTo({ lat: pickup.lat, lng: pickup.lng });
        mapInst.current?.setZoom(13);
      }
    }, [ready, pickup?.lat, pickup?.lng]);

    // ── Sync drop marker + route ─────────────────────────────────────────────
    useEffect(() => {
      if (!ready) return;
      if (!drop) {
        removeMarker(dpMarker);
        try { dirRend.current?.setDirections({ routes: [] }); } catch {}
        // Re-center on pickup
        if (pickup) {
          mapInst.current?.panTo({ lat: pickup.lat, lng: pickup.lng });
          mapInst.current?.setZoom(13);
        }
        return;
      }
      upsertMarker(dpMarker, { lat: drop.lat, lng: drop.lng }, "#FF7A18", drop.address, 10);
      if (pickup) drawRoute({ lat: pickup.lat, lng: pickup.lng }, { lat: drop.lat, lng: drop.lng });
    }, [ready, drop?.lat, drop?.lng]);

    // ── Driver marker ────────────────────────────────────────────────────────
    useEffect(() => {
      if (!ready || !driverCoords) return;
      if (!["accepted", "ongoing"].includes(status ?? "")) { removeMarker(drMarker); return; }
      upsertMarker(drMarker, { lat: driverCoords.lat, lng: driverCoords.lng }, "#6366F1", "Driver", 9);
    }, [ready, driverCoords?.lat, driverCoords?.lng, status]);

    // ── Imperative API ───────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      setPickup(lat, lng, address) {
        upsertMarker(puMarker, { lat, lng }, "#22C55E", address, 10);
        if (!dropRef.current) { mapInst.current?.panTo({ lat, lng }); mapInst.current?.setZoom(13); }
      },
      setDrop(lat, lng, address) {
        upsertMarker(dpMarker, { lat, lng }, "#FF7A18", address, 10);
        const pu = pickupRef.current;
        if (pu) drawRoute({ lat: pu.lat, lng: pu.lng }, { lat, lng });
      },
      clearDrop() {
        removeMarker(dpMarker);
        try { dirRend.current?.setDirections({ routes: [] }); } catch {}
        const pu = pickupRef.current;
        if (pu) { mapInst.current?.panTo({ lat: pu.lat, lng: pu.lng }); mapInst.current?.setZoom(13); }
      },
      setDriver(lat, lng) {
        upsertMarker(drMarker, { lat, lng }, "#6366F1", "Driver", 9);
      },
      setMode() {},
      getCurrentLocation() {},
      fitBounds() {
        const G = (window as any).google?.maps;
        if (!G || !mapInst.current) return;
        const pu = pickupRef.current;
        const dp = dropRef.current;
        if (!pu) return;
        const bounds = new G.LatLngBounds();
        bounds.extend({ lat: pu.lat, lng: pu.lng });
        if (dp) bounds.extend({ lat: dp.lat, lng: dp.lng });
        mapInst.current.fitBounds(bounds, 80);
      },
    }));

    // On web, render a raw <div> so google.maps.Map() gets a true DOM element.
    // In Expo Web, View refs resolve to React component instances, not DOM nodes.
    if (Platform.OS === "web") {
      return (
        <div
          ref={divRef}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#e8ddd0",
            display: "flex",
            flex: 1,
          } as any}
        />
      );
    }

    return <View style={[styles.container, style]} />;
  },
);

export default LeafletMapView;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e8ddd0" },
});
