import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  FlatList, Animated, Keyboard, ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";

const C = Colors.light;
const ORANGE = "#E8742A";
const GREEN = "#22C55E";

export interface LocationResult {
  label: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

// API base — same pattern as useApi.ts, works in both native and web
// (window.location.origin fails in React Native; process.env is substituted at build time)
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

// Popular Punjab fallback list (shown when no search query)
const POPULAR: LocationResult[] = [
  { label: "Chandigarh", address: "Chandigarh, Punjab, India", lat: 30.7333, lng: 76.7794 },
  { label: "Ludhiana", address: "Ludhiana, Punjab, India", lat: 30.9009, lng: 75.8573 },
  { label: "Amritsar", address: "Amritsar, Punjab, India", lat: 31.6340, lng: 74.8723 },
  { label: "Mohali", address: "SAS Nagar, Mohali, Punjab", lat: 30.7046, lng: 76.7179 },
  { label: "Patiala", address: "Patiala, Punjab, India", lat: 30.3398, lng: 76.3869 },
  { label: "Jalandhar", address: "Jalandhar, Punjab, India", lat: 31.3260, lng: 75.5762 },
  { label: "Bathinda", address: "Bathinda, Punjab, India", lat: 30.2099, lng: 74.9455 },
  { label: "Firozpur", address: "Firozpur, Punjab, India", lat: 30.9252, lng: 74.6100 },
  { label: "Hoshiarpur", address: "Hoshiarpur, Punjab, India", lat: 31.5143, lng: 75.9115 },
  { label: "Gurdaspur", address: "Gurdaspur, Punjab, India", lat: 32.0372, lng: 75.4083 },
  { label: "Golden Temple", address: "Harmandir Sahib, Amritsar, Punjab", lat: 31.6200, lng: 74.8765 },
  { label: "Wagah Border", address: "Wagah Border, Amritsar, Punjab", lat: 31.6036, lng: 74.5720 },
  { label: "Chandigarh Airport", address: "Shaheed Bhagat Singh Intl Airport", lat: 30.6735, lng: 76.7885 },
  { label: "Amritsar Airport", address: "Sri Guru Ram Dass Jee Airport", lat: 31.7096, lng: 74.7973 },
  { label: "Ludhiana Railway Stn", address: "Ludhiana Junction, Punjab", lat: 30.9037, lng: 75.8588 },
];

const RECENT_KEY = "rides_recent_v3";

// ── Google Places via our server proxy ────────────────────────────────────────
interface GPlace {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

async function searchGooglePlaces(query: string, lat?: number, lng?: number): Promise<LocationResult[]> {
  const params = new URLSearchParams({ q: query });
  if (lat != null && lng != null) { params.set("lat", String(lat)); params.set("lng", String(lng)); }
  const res = await fetch(`${API_BASE}/api/maps/places?${params}`);
  if (!res.ok) throw new Error("places api failed");
  const data: { predictions: GPlace[] } = await res.json();

  return data.predictions.map((p) => ({
    label: p.structured_formatting?.main_text || p.description.split(",")[0],
    address: p.description,
    lat: 0, // resolved lazily in getPlaceDetails
    lng: 0,
    placeId: p.place_id,
  }));
}

async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number; address: string }> {
  const res = await fetch(`${API_BASE}/api/maps/place-details?place_id=${encodeURIComponent(placeId)}`);
  if (!res.ok) throw new Error("place details failed");
  const d = await res.json();
  // Use the most precise available address string
  const address = d.formatted_address || d.name || "";
  return { lat: d.lat, lng: d.lng, address };
}

// ── Nominatim fallback ────────────────────────────────────────────────────────
const PUNJAB_VIEWBOX = "73.8,34.0,76.9,29.5";
async function searchNominatim(query: string): Promise<LocationResult[]> {
  const q = encodeURIComponent(query.trim() + " Punjab India");
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=8&accept-language=en&countrycodes=in&viewbox=${PUNJAB_VIEWBOX}&bounded=0`;
  const res = await fetch(url, { headers: { "User-Agent": "RentZilla/1.0 (rentzilla.app)" } });
  if (!res.ok) throw new Error("search failed");
  const data: any[] = await res.json();
  return data.map((r) => {
    const parts = r.display_name.split(",").map((s: string) => s.trim());
    return { label: parts[0] || r.display_name, address: parts.slice(0, 4).join(", "), lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
  });
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (loc: LocationResult) => void;
  title: string;
  color?: string;
  showCurrentLocation?: boolean;
  onCurrentLocation?: () => void;
  userLat?: number;
  userLng?: number;
}

export function LocationSearchModal({
  visible, onClose, onSelect, title,
  color = ORANGE, showCurrentLocation, onCurrentLocation,
  userLat, userLng,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [recents, setRecents] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingGoogle, setUsingGoogle] = useState(false);
  const slideAnim = useRef(new Animated.Value(900)).current;
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery(""); setResults([]); setError(null); setUsingGoogle(false);
      Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 15, useNativeDriver: true }).start();
      setTimeout(() => inputRef.current?.focus(), 250);
      loadRecents();
    } else {
      Animated.timing(slideAnim, { toValue: 900, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const loadRecents = async () => {
    try { const raw = await AsyncStorage.getItem(RECENT_KEY); if (raw) setRecents(JSON.parse(raw)); } catch {}
  };
  const saveRecent = async (loc: LocationResult) => {
    try {
      const updated = [loc, ...recents.filter((r) => r.address !== loc.address)].slice(0, 6);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      setRecents(updated);
    } catch {}
  };

  const handleSelect = async (loc: LocationResult) => {
    // If it's a Google Place with no coords yet, resolve them first
    if (loc.placeId && (loc.lat === 0 || loc.lng === 0)) {
      setResolving(true);
      try {
        const details = await getPlaceDetails(loc.placeId);
        const resolved = { ...loc, lat: details.lat, lng: details.lng, address: details.address };
        saveRecent(resolved);
        Keyboard.dismiss();
        onSelect(resolved);
        onClose();
      } catch {
        // Fallback: close without coords — caller must handle gracefully
        Keyboard.dismiss();
        onSelect(loc);
        onClose();
      } finally {
        setResolving(false);
      }
      return;
    }
    saveRecent(loc);
    Keyboard.dismiss();
    onSelect(loc);
    onClose();
  };

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        // Try Google Places first (via our proxy)
        const res = await searchGooglePlaces(text, userLat, userLng);
        setResults(res);
        setUsingGoogle(true);
        setError(res.length === 0 ? "No results found" : null);
      } catch {
        // Fallback to Nominatim
        setUsingGoogle(false);
        try {
          const res = await searchNominatim(text);
          setResults(res);
          setError(res.length === 0 ? "No results found" : null);
        } catch {
          setError("Search unavailable — showing local results");
          const q = text.toLowerCase();
          setResults(POPULAR.filter((p) => p.label.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)));
        }
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [userLat, userLng]);

  const clearQuery = () => { setQuery(""); setResults([]); setError(null); inputRef.current?.focus(); };

  const renderRow = (item: LocationResult, type: "recent" | "popular" | "result") => {
    const iconName = type === "recent" ? "clock" : type === "result" ? "map-pin" : "navigation";
    const iconColor = type === "recent" ? C.textTertiary : type === "result" ? color : ORANGE;
    const iconBg = type === "recent" ? `${C.textTertiary}18` : type === "result" ? `${color}18` : `${ORANGE}18`;
    return (
      <TouchableOpacity key={`${item.address}-${item.placeId || type}`} style={styles.row} onPress={() => handleSelect(item)} activeOpacity={0.7}>
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <Feather name={iconName as any} size={16} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.rowAddr} numberOfLines={1}>{item.address}</Text>
        </View>
        <Feather name="arrow-up-left" size={13} color={C.textTertiary} />
      </TouchableOpacity>
    );
  };

  const showingQuery = query.trim().length >= 2;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        {resolving && (
          <View style={styles.resolvingOverlay}>
            <ActivityIndicator color={ORANGE} size="large" />
            <Text style={styles.resolvingText}>Getting location…</Text>
          </View>
        )}
        <Animated.View style={[styles.sheet, { paddingTop: insets.top + 8, transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <Feather name="arrow-left" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            {usingGoogle && showingQuery && (
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>G</Text>
              </View>
            )}
          </View>

          {/* Search input */}
          <View style={[styles.searchBar, { borderColor: query ? color : C.border }]}>
            <View style={[styles.searchDot, { backgroundColor: color }]} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Street, house no., shop, landmark…"
              placeholderTextColor={C.textTertiary}
              value={query}
              onChangeText={onChangeText}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
            {loading ? (
              <ActivityIndicator size="small" color={color} />
            ) : query.length > 0 ? (
              <TouchableOpacity onPress={clearQuery} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={16} color={C.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Use current location */}
          {showCurrentLocation && onCurrentLocation && !showingQuery && (
            <TouchableOpacity style={styles.currentLocBtn} onPress={() => { onCurrentLocation(); onClose(); }}>
              <View style={[styles.rowIcon, { backgroundColor: `${GREEN}22` }]}>
                <Feather name="crosshair" size={16} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: GREEN }]}>Use Current Location</Text>
                <Text style={styles.rowAddr}>Auto-detect via GPS</Text>
              </View>
              <Feather name="chevron-right" size={16} color={GREEN} />
            </TouchableOpacity>
          )}

          <FlatList
            data={[]}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={() => (
              <View>
                {error && !loading && showingQuery && results.length > 0 && (
                  <View style={styles.errorBanner}>
                    <Feather name="wifi-off" size={13} color={ORANGE} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {showingQuery && results.length > 0 && (
                  <View>
                    <View style={styles.sectionRow}>
                      <Text style={styles.section}>Results ({results.length})</Text>
                      {usingGoogle && <Text style={styles.poweredBy}>Powered by Google</Text>}
                    </View>
                    {results.map((item) => renderRow(item, "result"))}
                  </View>
                )}

                {showingQuery && !loading && results.length === 0 && !error && (
                  <View style={styles.empty}>
                    <Feather name="search" size={32} color={C.textTertiary} />
                    <Text style={styles.emptyTitle}>No places found</Text>
                    <Text style={styles.emptyText}>Try a different spelling or search for a nearby city</Text>
                  </View>
                )}

                {showingQuery && !loading && results.length === 0 && error && (
                  <View style={styles.empty}>
                    <Feather name="wifi-off" size={32} color={C.textTertiary} />
                    <Text style={styles.emptyTitle}>Search unavailable</Text>
                    <Text style={styles.emptyText}>Check your connection or pick from popular places below</Text>
                  </View>
                )}

                {!showingQuery && recents.length > 0 && (
                  <View>
                    <Text style={styles.section}>Recent</Text>
                    {recents.map((item) => renderRow(item, "recent"))}
                  </View>
                )}

                {!showingQuery && (
                  <View>
                    <Text style={styles.section}>Popular in Punjab</Text>
                    {POPULAR.map((item) => renderRow(item, "popular"))}
                  </View>
                )}
              </View>
            )}
            renderItem={() => null}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    flex: 1, backgroundColor: C.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  resolvingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", zIndex: 999, gap: 12,
  },
  resolvingText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  googleBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#4285F4", alignItems: "center", justifyContent: "center" },
  googleBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5,
  },
  searchDot: { width: 10, height: 10, borderRadius: 5 },
  searchInput: { flex: 1, fontSize: 15, color: C.text, fontFamily: "Inter_400Regular" },
  currentLocBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: "#22C55E10", borderRadius: 14, borderWidth: 1, borderColor: "#22C55E30",
  },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  section: { fontSize: 11, fontWeight: "700", color: C.textTertiary, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  poweredBy: { fontSize: 10, color: "#4285F4", fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border + "50" },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  rowAddr: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 1 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginTop: 8, backgroundColor: `${ORANGE}15`, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  errorText: { fontSize: 12, color: ORANGE, fontFamily: "Inter_400Regular", flex: 1 },
  empty: { padding: 48, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
});
