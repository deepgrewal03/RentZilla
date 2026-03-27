import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  FlatList, Animated, Keyboard, ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
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

// ── Runtime API server URL detection ─────────────────────────────────────────
// Works across ALL bundle versions — doesn't rely on build-time env vars.
function getServerCandidates(): string[] {
  const urls: string[] = [];

  // 1. Build-time env var (fastest — works when freshly bundled)
  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (envDomain && envDomain !== "undefined") {
    urls.push(`https://${envDomain}`);
  }

  // 2. Constants.expoConfig.hostUri — Expo Go sets this at runtime to the
  //    Metro packager address. In Replit, Metro is at xxx.expo.worf.replit.dev
  //    and the API is at xxx.worf.replit.dev — remove the ".expo." segment.
  try {
    const hostUri: string = (Constants.expoConfig as any)?.hostUri || "";
    if (hostUri) {
      const host = hostUri.split(":")[0]; // strip port
      const apiHost = host.replace(".expo.", "."); // Replit-specific transform
      const candidate = `https://${apiHost}`;
      if (!urls.includes(candidate)) urls.push(candidate);
      // Also try the raw host without transform (in case of non-Replit env)
      const rawCandidate = `https://${host}`;
      if (!urls.includes(rawCandidate)) urls.push(rawCandidate);
    }
  } catch {}

  // 3. Web origin fallback
  if (typeof window !== "undefined" && (window as any).location?.origin) {
    const origin: string = (window as any).location.origin;
    if (!urls.includes(origin)) urls.push(origin);
  }

  return urls;
}

// ── Lazy-loaded Google Maps key ───────────────────────────────────────────────
// Fetches from server at runtime — works even if EXPO_PUBLIC_GMAPS_KEY wasn't
// set during bundle compilation.
let _mapsKey: string = process.env.EXPO_PUBLIC_GMAPS_KEY || "";
let _serverBase: string = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
let _keyFetchPromise: Promise<string> | null = null;

async function getMapsKey(): Promise<string> {
  if (_mapsKey) return _mapsKey;
  if (_keyFetchPromise) return _keyFetchPromise;
  _keyFetchPromise = (async () => {
    for (const base of getServerCandidates()) {
      try {
        const r = await fetch(`${base}/api/maps/key`, {
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) {
          const d: any = await r.json();
          if (d.key) {
            _mapsKey = d.key;
            _serverBase = base; // remember working server URL
            return d.key;
          }
        }
      } catch {}
    }
    return "";
  })();
  return _keyFetchPromise;
}

// Eagerly start key fetch when module loads (so it's ready when user opens search)
getMapsKey().catch(() => {});

// ── Web proxy base URL ────────────────────────────────────────────────────────
function getProxyBase(): string {
  if (_serverBase) return _serverBase;
  const candidates = getServerCandidates();
  return candidates[0] || "";
}

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

// ── Google Places via server proxy ────────────────────────────────────────────
interface GPlace {
  place_id: string;
  description: string;
  structured_formatting: { main_text: string; secondary_text: string };
}

function parsePredictions(predictions: GPlace[]): LocationResult[] {
  return predictions.map((p) => ({
    label: p.structured_formatting?.main_text || p.description.split(",")[0],
    address: p.description,
    lat: 0,
    lng: 0,
    placeId: p.place_id,
  }));
}

/**
 * On NATIVE: calls Google Places API directly (no CORS restriction in React Native).
 * On WEB: calls our server proxy (no CORS since same origin).
 * 4 rounds: address+establishment → geocode → no-type → city-enhanced query.
 * Final fallback: Geocoding API (handles bare house numbers like "1792").
 * Uses getMapsKey() which fetches at runtime — works in ANY bundle, even cached ones.
 */
async function searchGooglePlaces(
  query: string,
  lat?: number,
  lng?: number
): Promise<LocationResult[]> {
  const isNative = Platform.OS !== "web";
  const locationBias = lat != null && lng != null
    ? { location: `${lat},${lng}`, radius: "50000" }
    : { location: "30.7333,76.7794", radius: "250000" };

  // Fetch key at runtime (cached after first call)
  const key = await getMapsKey();

  if (isNative && key) {
    // ── Direct Google Places API (React Native — no CORS) ──────────────────
    // NOTE: NO types filter as primary — types:"address" is unreliable in India
    // for house-number level results. No-type gives the broadest coverage.
    const base = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
    const common: Record<string, string> = {
      key,
      language: "en",
      components: "country:in",
      strictbounds: "false",
      ...locationBias,
    };

    const callPlaces = async (input: string, extraParams: Record<string, string> = {}) => {
      try {
        const p = new URLSearchParams({ ...common, input, ...extraParams });
        const r = await fetch(`${base}?${p}`);
        const d = await r.json();
        return (d.predictions || []) as GPlace[];
      } catch { return [] as GPlace[]; }
    };

    const dedup = (list: GPlace[]): GPlace[] => {
      const seen = new Set<string>();
      return list.filter((p) => { if (seen.has(p.place_id)) return false; seen.add(p.place_id); return true; });
    };

    if (isShortOrNumeric(query)) {
      // House-number query: run no-type + Punjab-wide enhanced + establishments in parallel
      // Use "Punjab India" — NOT a single city — so results span all of Punjab
      const enhanced = `${query.trim()} Punjab India`;
      // Punjab-wide location bias for the enhanced call (300 km from Chandigarh centre)
      const punjabWide = { location: "30.7333,76.7794", radius: "300000", strictbounds: "false" };
      const callPlacesPunjab = async (input: string, extra: Record<string, string> = {}) => {
        try {
          const p = new URLSearchParams({ ...common, ...punjabWide, input, ...extra });
          const r = await fetch(`${base}?${p}`);
          const d = await r.json();
          return (d.predictions || []) as GPlace[];
        } catch { return [] as GPlace[]; }
      };
      const [noType, enhancedP, estP, geoResults] = await Promise.all([
        callPlaces(query),
        callPlacesPunjab(enhanced),
        callPlaces(query, { types: "establishment" }),
        geocodeQuery(enhanced, key, lat, lng, query),
      ]);
      const merged = dedup([...noType, ...enhancedP, ...estP]);
      if (merged.length > 0) return parsePredictions(merged.slice(0, 8));
      if (geoResults.length > 0) return geoResults;
      return [];
    }

    // Normal query: no-type (broadest) + establishments in parallel
    const [noType, estP] = await Promise.all([
      callPlaces(query),
      callPlaces(query, { types: "establishment" }),
    ]);
    const merged = dedup([...noType, ...estP]);
    if (merged.length > 0) return parsePredictions(merged.slice(0, 8));

    // Geocoding fallback
    const geoResults = await geocodeQuery(query, key, lat, lng, query);
    if (geoResults.length > 0) return geoResults;

    return [];
  }

  // ── Server proxy (web or native without key) ──────────────────────────────
  const serverBase = getProxyBase();
  if (!serverBase) return [];
  const params = new URLSearchParams({ q: query });
  if (lat != null && lng != null) { params.set("lat", String(lat)); params.set("lng", String(lng)); }
  try {
    const res = await fetch(`${serverBase}/api/maps/places?${params}`);
    if (!res.ok) return [];
    const data: { predictions: GPlace[] } = await res.json();
    return parsePredictions(data.predictions);
  } catch { return []; }
}

/**
 * Fetch precise lat/lng + full formatted address for a place_id.
 * Native: calls Google directly. Web: uses server proxy.
 */
async function getPlaceDetails(
  placeId: string
): Promise<{ lat: number; lng: number; address: string }> {
  const isNative = Platform.OS !== "web";
  const key = await getMapsKey();

  if (isNative && key) {
    const params = new URLSearchParams({
      place_id: placeId,
      key,
      fields: "geometry,formatted_address,name,address_components",
      language: "en",
    });
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    );
    const d = await res.json();
    if (d.status === "OK" && d.result) {
      const loc = d.result.geometry?.location;
      const address = buildAddress(d.result.address_components, d.result.formatted_address);
      return { lat: loc.lat, lng: loc.lng, address };
    }
  }

  // Server proxy fallback
  const serverBase = getProxyBase();
  if (!serverBase) throw new Error("no server URL available");
  const res = await fetch(
    `${serverBase}/api/maps/place-details?place_id=${encodeURIComponent(placeId)}`
  );
  if (!res.ok) throw new Error("place details failed");
  const d = await res.json();
  return { lat: d.lat, lng: d.lng, address: d.formatted_address || d.name || "" };
}

/** Build a detailed address string from Google address_components */
function buildAddress(
  components: Array<{ long_name: string; types: string[] }> = [],
  fallback: string
): string {
  const c: Record<string, string> = {};
  for (const comp of components) {
    for (const type of comp.types) c[type] = comp.long_name;
  }
  const streetNum = c["street_number"] || "";
  const route = c["route"] || "";
  const sub = c["sublocality_level_1"] || c["sublocality"] || c["neighborhood"] || "";
  const city = c["locality"] || c["administrative_area_level_2"] || "";
  const state = c["administrative_area_level_1"] || "";

  const parts: string[] = [];
  if (streetNum && route) parts.push(`${streetNum} ${route}`);
  else if (route) parts.push(route);
  if (sub) parts.push(sub);
  if (city) parts.push(city);
  if (state) parts.push(state);

  return parts.length >= 2 ? parts.join(", ") : fallback;
}

// ── Nearest Punjab city helper ────────────────────────────────────────────────
const PUNJAB_CITIES = [
  { name: "Ludhiana", lat: 30.9009, lng: 75.8573 },
  { name: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { name: "Amritsar", lat: 31.6340, lng: 74.8723 },
  { name: "Jalandhar", lat: 31.3260, lng: 75.5762 },
  { name: "Mohali", lat: 30.7046, lng: 76.7179 },
  { name: "Patiala", lat: 30.3398, lng: 76.3869 },
  { name: "Bathinda", lat: 30.2099, lng: 74.9455 },
];

function getNearestCity(lat?: number, lng?: number): string {
  if (lat == null || lng == null) return "Ludhiana";
  let nearest = PUNJAB_CITIES[0];
  let minDist = Infinity;
  for (const c of PUNJAB_CITIES) {
    const d = Math.abs(c.lat - lat) + Math.abs(c.lng - lng);
    if (d < minDist) { minDist = d; nearest = c; }
  }
  return nearest.name;
}

/** Returns true if the query looks like a bare house number / short code */
function isShortOrNumeric(q: string) {
  const t = q.trim();
  return t.length <= 8 && /^\d/.test(t) && !/[a-zA-Z]{3,}/.test(t);
}

// ── Geocoding API fallback (for bare house numbers that Autocomplete misses) ──
// queryToken: the original user input — used to filter out irrelevant results
async function geocodeQuery(
  query: string,
  key: string,
  lat?: number,
  lng?: number,
  queryToken?: string
): Promise<LocationResult[]> {
  const base = "https://maps.googleapis.com/maps/api/geocode/json";
  const params: Record<string, string> = {
    address: query,
    key,
    language: "en",
    components: "country:in",
  };
  if (lat != null && lng != null) {
    params.bounds = `${lat - 0.5},${lng - 0.5}|${lat + 0.5},${lng + 0.5}`;
  }
  try {
    const r = await fetch(`${base}?${new URLSearchParams(params)}`);
    const d = await r.json();
    if (!["OK", "ZERO_RESULTS"].includes(d.status)) return [];
    const token = queryToken?.toLowerCase();
    return (d.results || [])
      .filter((result: any) => {
        // Only include results whose formatted_address contains the original token
        if (token && !result.formatted_address?.toLowerCase().includes(token)) return false;
        return true;
      })
      .slice(0, 6)
      .map((result: any) => {
        const loc = result.geometry?.location;
        const c: Record<string, string> = {};
        for (const comp of result.address_components || []) {
          for (const type of comp.types as string[]) c[type] = comp.long_name;
        }
        const streetNum = c["street_number"] || "";
        const route     = c["route"] || "";
        const sub       = c["sublocality_level_2"] || c["sublocality_level_1"] || c["sublocality"] || c["neighborhood"] || "";
        const city2     = c["locality"] || c["administrative_area_level_2"] || "";

        // Always lead with house number when available
        let label: string;
        if (streetNum && route)      label = `${streetNum}, ${route}`;
        else if (streetNum && sub)   label = `${streetNum}, ${sub}`;
        else if (streetNum && city2) label = `${streetNum}, ${city2}`;
        else if (streetNum)          label = streetNum;
        else if (route)              label = route;
        else if (sub)                label = sub;
        else                         label = result.formatted_address.split(",")[0];

        const addr = buildAddress(result.address_components, result.formatted_address);
        return {
          label,
          address: addr || result.formatted_address,
          lat: loc?.lat || 0,
          lng: loc?.lng || 0,
        };
      });
  } catch { return []; }
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
  const nearestCity = getNearestCity(userLat, userLng);
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
    if (text.trim().length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchGooglePlaces(text, userLat, userLng);
        setResults(res);
        setUsingGoogle(true);
        setError(null);
      } catch {
        setUsingGoogle(false);
        try {
          const res = await searchNominatim(text);
          setResults(res);
          setError(null);
        } catch {
          setError(null);
          const q = text.toLowerCase();
          setResults(POPULAR.filter((p) => p.label.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)));
        }
      } finally {
        setLoading(false);
      }
    }, 400);
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
          <Text style={styles.rowAddr} numberOfLines={2}>{item.address}</Text>
        </View>
        <Feather name="arrow-up-left" size={13} color={C.textTertiary} />
      </TouchableOpacity>
    );
  };

  const showingQuery = query.trim().length >= 1;

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
              placeholder="House no., street, shop, landmark…"
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
                {showingQuery && results.length > 0 && (
                  <View>
                    <View style={styles.sectionRow}>
                      <Text style={styles.section}>Results ({results.length})</Text>
                      {usingGoogle && <Text style={styles.poweredBy}>Powered by Google</Text>}
                    </View>
                    {results.map((item) => renderRow(item, "result"))}
                  </View>
                )}

                {showingQuery && loading && (
                  <View style={styles.searchingNear}>
                    <ActivityIndicator size="small" color={color} />
                    <Text style={styles.searchingNearText}>Searching across Punjab…</Text>
                  </View>
                )}

                {showingQuery && !loading && results.length === 0 && (
                  <View style={styles.empty}>
                    <Feather name="search" size={32} color={C.textTertiary} />
                    <Text style={styles.emptyTitle}>No results found in Punjab</Text>
                    <Text style={styles.emptyText}>
                      Try adding a street name or area.{"\n"}
                      e.g. "{query.trim()} Street 4, Model Town"
                    </Text>
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
  empty: { padding: 48, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  searchingNear: { flexDirection: "row", alignItems: "center", gap: 10, padding: 20, paddingLeft: 24 },
  searchingNearText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
});
