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
}

// Punjab bounding box: SW ~73.8°E 29.5°N  NE ~76.9°E 34.0°N
const PUNJAB_VIEWBOX = "73.8,34.0,76.9,29.5";

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

const RECENT_KEY = "rides_recent_v2";

async function searchNominatim(query: string): Promise<LocationResult[]> {
  const q = encodeURIComponent(query.trim() + " Punjab India");
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${q}&format=json&limit=8&accept-language=en` +
    `&countrycodes=in&viewbox=${PUNJAB_VIEWBOX}&bounded=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "RentZilla/1.0 (rentzilla.app)" },
  });
  if (!res.ok) throw new Error("search failed");
  const data: any[] = await res.json();
  return data.map((r) => {
    const parts = r.display_name.split(",").map((s: string) => s.trim());
    const label = parts[0] || r.display_name;
    const addr = parts.slice(0, 4).join(", ");
    return { label, address: addr, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
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
}

export function LocationSearchModal({
  visible, onClose, onSelect, title,
  color = ORANGE, showCurrentLocation, onCurrentLocation,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [recents, setRecents] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(900)).current;
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setResults([]);
      setError(null);
      Animated.spring(slideAnim, {
        toValue: 0, tension: 100, friction: 15, useNativeDriver: true,
      }).start();
      setTimeout(() => inputRef.current?.focus(), 250);
      loadRecents();
    } else {
      Animated.timing(slideAnim, {
        toValue: 900, duration: 220, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadRecents = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_KEY);
      if (raw) setRecents(JSON.parse(raw));
    } catch {}
  };

  const saveRecent = async (loc: LocationResult) => {
    try {
      const updated = [loc, ...recents.filter((r) => r.address !== loc.address)].slice(0, 6);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      setRecents(updated);
    } catch {}
  };

  const handleSelect = (loc: LocationResult) => {
    saveRecent(loc);
    Keyboard.dismiss();
    onSelect(loc);
    onClose();
  };

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchNominatim(text);
        setResults(res);
        setError(res.length === 0 ? "No results found" : null);
      } catch {
        setError("Search unavailable — showing local results");
        const q = text.toLowerCase();
        setResults(
          POPULAR.filter(
            (p) => p.label.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
          )
        );
      } finally {
        setLoading(false);
      }
    }, 380);
  }, [recents]);

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setError(null);
    inputRef.current?.focus();
  };

  const renderRow = (
    item: LocationResult,
    type: "recent" | "popular" | "result"
  ) => {
    const iconName =
      type === "recent"
        ? "clock"
        : type === "result"
        ? "map-pin"
        : "navigation";
    const iconColor =
      type === "recent" ? C.textTertiary : type === "result" ? color : ORANGE;
    const iconBg =
      type === "recent"
        ? `${C.textTertiary}18`
        : type === "result"
        ? `${color}18`
        : `${ORANGE}18`;

    return (
      <TouchableOpacity
        key={`${item.address}-${type}`}
        style={styles.row}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <Feather name={iconName as any} size={16} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={styles.rowAddr} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        <Feather name="arrow-up-left" size={13} color={C.textTertiary} />
      </TouchableOpacity>
    );
  };

  const showingQuery = query.trim().length >= 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { paddingTop: insets.top + 8, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <Feather name="arrow-left" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          {/* Search input */}
          <View style={[styles.searchBar, { borderColor: query ? color : C.border }]}>
            <View style={[styles.searchDot, { backgroundColor: color }]} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search city, village, landmark…"
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
            <TouchableOpacity
              style={styles.currentLocBtn}
              onPress={() => {
                onCurrentLocation();
                onClose();
              }}
            >
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
                {/* Error notice */}
                {error && !loading && showingQuery && results.length > 0 && (
                  <View style={styles.errorBanner}>
                    <Feather name="wifi-off" size={13} color={ORANGE} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Search results */}
                {showingQuery && results.length > 0 && (
                  <View>
                    <Text style={styles.section}>Results ({results.length})</Text>
                    {results.map((item) => renderRow(item, "result"))}
                  </View>
                )}

                {/* No results */}
                {showingQuery && !loading && results.length === 0 && !error && (
                  <View style={styles.empty}>
                    <Feather name="search" size={32} color={C.textTertiary} />
                    <Text style={styles.emptyTitle}>No places found</Text>
                    <Text style={styles.emptyText}>
                      Try a different spelling or search for a nearby city
                    </Text>
                  </View>
                )}

                {/* Error with no results */}
                {showingQuery && !loading && results.length === 0 && error && (
                  <View style={styles.empty}>
                    <Feather name="wifi-off" size={32} color={C.textTertiary} />
                    <Text style={styles.emptyTitle}>Search unavailable</Text>
                    <Text style={styles.emptyText}>
                      Check your connection or pick from popular places below
                    </Text>
                  </View>
                )}

                {/* Recent locations */}
                {!showingQuery && recents.length > 0 && (
                  <View>
                    <Text style={styles.section}>Recent</Text>
                    {recents.map((item) => renderRow(item, "recent"))}
                  </View>
                )}

                {/* Popular places */}
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
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end",
  },
  sheet: {
    flex: 1, backgroundColor: C.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backgroundSecondary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18, fontWeight: "700", color: C.text,
    fontFamily: "Inter_700Bold",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5,
  },
  searchDot: { width: 10, height: 10, borderRadius: 5 },
  searchInput: {
    flex: 1, fontSize: 15, color: C.text, fontFamily: "Inter_400Regular",
  },
  currentLocBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: "#22C55E10",
    borderRadius: 14, borderWidth: 1, borderColor: "#22C55E30",
  },
  section: {
    fontSize: 11, fontWeight: "700", color: C.textTertiary,
    fontFamily: "Inter_700Bold", textTransform: "uppercase",
    letterSpacing: 0.8, paddingHorizontal: 16,
    paddingTop: 16, paddingBottom: 8,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border + "50",
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: {
    fontSize: 15, fontWeight: "600", color: C.text,
    fontFamily: "Inter_600SemiBold",
  },
  rowAddr: {
    fontSize: 12, color: C.textSecondary,
    fontFamily: "Inter_400Regular", marginTop: 1,
  },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: `${ORANGE}15`,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  errorText: {
    fontSize: 12, color: ORANGE, fontFamily: "Inter_400Regular", flex: 1,
  },
  empty: {
    padding: 48, alignItems: "center", gap: 10,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: "600", color: C.text,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 13, color: C.textSecondary,
    fontFamily: "Inter_400Regular", textAlign: "center",
  },
});
