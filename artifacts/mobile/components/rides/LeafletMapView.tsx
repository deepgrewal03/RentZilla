import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width: SW, height: SH } = Dimensions.get("window");
const ORANGE = "#E8742A";
const GREEN = "#22C55E";
const NAVY = "#0F1F3D";
const GOLD = "#F5C842";

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
  onLocationSelected?: (
    mode: "pickup" | "drop",
    lat: number,
    lng: number,
    address: string
  ) => void;
  onRouteCalculated?: (distanceKm: number, durationMin: number) => void;
  style?: object;
}

const DISTRICTS = [
  { x: 0.22, y: 0.35, label: "Amritsar" },
  { x: 0.48, y: 0.28, label: "Gurdaspur" },
  { x: 0.55, y: 0.55, label: "Chandigarh" },
  { x: 0.30, y: 0.62, label: "Ludhiana" },
  { x: 0.72, y: 0.70, label: "Patiala" },
  { x: 0.18, y: 0.72, label: "Firozpur" },
  { x: 0.65, y: 0.40, label: "Hoshiarpur" },
  { x: 0.42, y: 0.78, label: "Bathinda" },
];

const LeafletMapView = forwardRef<MapRef, Props>(
  ({ pickup, drop, driverCoords, status, onReady, style }, ref) => {
    const driverAnim = useRef(new Animated.Value(0)).current;
    const pickupPulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pickupPulse, { toValue: 1.3, duration: 900, useNativeDriver: false }),
          Animated.timing(pickupPulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(driverAnim, { toValue: 1, duration: 2500, useNativeDriver: false }),
          Animated.timing(driverAnim, { toValue: 0, duration: 2500, useNativeDriver: false }),
        ])
      ).start();
      setTimeout(() => onReady?.(), 400);
    }, []);

    useImperativeHandle(ref, () => ({
      setPickup: () => {},
      setDrop: () => {},
      clearDrop: () => {},
      setDriver: () => {},
      setMode: () => {},
      getCurrentLocation: () => {},
      fitBounds: () => {},
    }));

    const mapHeight = style ? undefined : "100%";

    return (
      <LinearGradient
        colors={["#0a1628", "#0d1f3e", "#091525"]}
        style={[styles.canvas, style, mapHeight ? { flex: 1 } : {}]}
      >
        {[...Array(12)].map((_, i) => (
          <View key={`h${i}`} style={[styles.gridH, { top: `${(i + 1) * 8}%` as any }]} />
        ))}
        {[...Array(8)].map((_, i) => (
          <View key={`v${i}`} style={[styles.gridV, { left: `${(i + 1) * 12}%` as any }]} />
        ))}
        {DISTRICTS.map((d) => (
          <View
            key={d.label}
            style={[styles.dot, { left: `${d.x * 100}%` as any, top: `${d.y * 100}%` as any }]}
          >
            <View style={styles.dotCircle} />
            <Text style={styles.dotLabel}>{d.label}</Text>
          </View>
        ))}
        {pickup && drop && (
          <LinearGradient
            colors={[GREEN + "cc", ORANGE + "cc"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.route, { left: SW * 0.2, top: "45%", width: SW * 0.55 }]}
          />
        )}
        {pickup && (
          <View style={styles.pickupPin}>
            <Animated.View
              style={[styles.pickupRing, { transform: [{ scale: pickupPulse }] }]}
            />
            <View style={styles.pickupDot} />
            <View style={styles.bubble}>
              <Text style={styles.bubbleText} numberOfLines={1}>
                {pickup.address.split(",")[0]}
              </Text>
            </View>
          </View>
        )}
        {drop && (
          <View style={styles.dropPin}>
            <View style={styles.dropDot} />
            <View style={[styles.bubble, { backgroundColor: ORANGE + "ee", borderColor: ORANGE }]}>
              <Text style={styles.bubbleText} numberOfLines={1}>
                {drop.address.split(",")[0]}
              </Text>
            </View>
          </View>
        )}
        {driverCoords && ["accepted", "ongoing"].includes(status ?? "") && (
          <Animated.View
            style={[
              styles.driverPin,
              {
                left: driverAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SW * 0.3, SW * 0.55],
                }),
                top: "40%",
              },
            ]}
          >
            <Text style={{ fontSize: 26 }}>🚗</Text>
          </Animated.View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(8,15,30,0.45)"]}
          style={styles.overlay}
          pointerEvents="none"
        />
        {pickup && (
          <View style={styles.coordBadge}>
            <Text style={styles.coordText}>
              {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
            </Text>
          </View>
        )}
      </LinearGradient>
    );
  }
);

export default LeafletMapView;

const styles = StyleSheet.create({
  canvas: { flex: 1, overflow: "hidden" },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  dot: { position: "absolute", alignItems: "center" },
  dotCircle: { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD, opacity: 0.7 },
  dotLabel: { fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 2, fontWeight: "600" },
  route: {
    position: "absolute", height: 3, borderRadius: 2,
    transform: [{ rotate: "-15deg" }], opacity: 0.8,
  },
  pickupPin: { position: "absolute", left: "22%", top: "35%", alignItems: "center" },
  pickupRing: {
    position: "absolute", width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: GREEN + "80",
  },
  pickupDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: GREEN, borderWidth: 2, borderColor: "#fff" },
  dropPin: { position: "absolute", right: "22%", top: "55%", alignItems: "center" },
  dropDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: ORANGE, borderWidth: 2, borderColor: "#fff" },
  bubble: {
    marginTop: 4, backgroundColor: "rgba(15,31,61,0.9)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    maxWidth: 120,
  },
  bubbleText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  driverPin: { position: "absolute" },
  overlay: { ...StyleSheet.absoluteFillObject },
  coordBadge: {
    position: "absolute", bottom: 8, left: 8,
    backgroundColor: "rgba(15,31,61,0.8)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  coordText: { fontSize: 10, color: GOLD, fontWeight: "600" },
});
