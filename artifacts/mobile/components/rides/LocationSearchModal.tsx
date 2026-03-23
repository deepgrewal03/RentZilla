import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  FlatList, Animated, Keyboard, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";

const C = Colors.light;
const ORANGE = "#E8742A";
const NAVY = "#0F1F3D";
const GREEN = "#22C55E";

export interface LocationResult {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

const PUNJAB_CITIES: LocationResult[] = [
  { label: "Chandigarh", address: "Chandigarh, Punjab", lat: 30.7333, lng: 76.7794 },
  { label: "Ludhiana", address: "Ludhiana, Punjab", lat: 30.9009, lng: 75.8573 },
  { label: "Amritsar", address: "Amritsar, Punjab", lat: 31.634, lng: 74.8723 },
  { label: "Mohali", address: "SAS Nagar (Mohali), Punjab", lat: 30.7046, lng: 76.7179 },
  { label: "Patiala", address: "Patiala, Punjab", lat: 30.3398, lng: 76.3869 },
  { label: "Jalandhar", address: "Jalandhar, Punjab", lat: 31.3260, lng: 75.5762 },
  { label: "Bathinda", address: "Bathinda, Punjab", lat: 30.2099, lng: 74.9455 },
  { label: "Firozpur", address: "Firozpur, Punjab", lat: 30.9252, lng: 74.6100 },
  { label: "Hoshiarpur", address: "Hoshiarpur, Punjab", lat: 31.5143, lng: 75.9115 },
  { label: "Gurdaspur", address: "Gurdaspur, Punjab", lat: 32.0372, lng: 75.4083 },
  { label: "Ropar", address: "Ropar (Rupnagar), Punjab", lat: 30.9645, lng: 76.5256 },
  { label: "Sangrur", address: "Sangrur, Punjab", lat: 30.2444, lng: 75.8441 },
  { label: "Moga", address: "Moga, Punjab", lat: 30.8161, lng: 75.1736 },
  { label: "Kapurthala", address: "Kapurthala, Punjab", lat: 31.3802, lng: 75.3800 },
  { label: "Fatehgarh Sahib", address: "Fatehgarh Sahib, Punjab", lat: 30.6479, lng: 76.3924 },
];

const PUNJAB_LANDMARKS: LocationResult[] = [
  { label: "Golden Temple", address: "Harmandir Sahib, Amritsar, Punjab", lat: 31.6200, lng: 74.8765 },
  { label: "Wagah Border", address: "Wagah Border, Amritsar, Punjab", lat: 31.6036, lng: 74.5720 },
  { label: "Rock Garden", address: "Rock Garden, Chandigarh", lat: 30.7499, lng: 76.8105 },
  { label: "Sukhna Lake", address: "Sukhna Lake, Chandigarh", lat: 30.7427, lng: 76.8182 },
  { label: "Qila Mubarak", address: "Qila Mubarak, Patiala, Punjab", lat: 30.3432, lng: 76.4008 },
  { label: "Phillaur Fort", address: "Phillaur Fort, Jalandhar, Punjab", lat: 31.0218, lng: 75.7882 },
  { label: "Punjab Agricultural University", address: "PAU, Ludhiana, Punjab", lat: 30.9014, lng: 75.8125 },
  { label: "Chandigarh Railway Station", address: "Chandigarh Railway Station", lat: 30.7080, lng: 76.7871 },
  { label: "Ludhiana Railway Station", address: "Ludhiana Junction, Punjab", lat: 30.9037, lng: 75.8588 },
  { label: "Amritsar Airport", address: "Sri Guru Ram Dass Jee Airport, Amritsar", lat: 31.7096, lng: 74.7973 },
];

const RECENT_KEY = "rides_recent_locations";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (loc: LocationResult) => void;
  title: string;
  color?: string;
}

export function LocationSearchModal({ visible, onClose, onSelect, title, color = ORANGE }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<LocationResult[]>([]);
  const slideAnim = useRef(new Animated.Value(800)).current;
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 15, useNativeDriver: true }).start();
      setTimeout(() => inputRef.current?.focus(), 200);
      loadRecents();
    } else {
      Animated.timing(slideAnim, { toValue: 800, duration: 250, useNativeDriver: true }).start();
      setQuery("");
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
      const updated = [loc, ...recents.filter(r => r.address !== loc.address)].slice(0, 5);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleSelect = (loc: LocationResult) => {
    saveRecent(loc);
    Keyboard.dismiss();
    onSelect(loc);
    onClose();
  };

  const debouncedQuery = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const filtered = (() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return [...PUNJAB_CITIES, ...PUNJAB_LANDMARKS].filter(
      l => l.label.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    );
  })();

  const renderItem = (item: LocationResult, type: "city" | "landmark" | "recent") => (
    <TouchableOpacity key={item.address} style={styles.suggestion} onPress={() => handleSelect(item)}>
      <View style={[styles.suggestionIcon, { backgroundColor: type === "recent" ? `${C.textTertiary}22` : type === "landmark" ? `${ORANGE}22` : `${color}22` }]}>
        <Feather
          name={type === "recent" ? "clock" : type === "landmark" ? "star" : "map-pin"}
          size={16}
          color={type === "recent" ? C.textTertiary : type === "landmark" ? ORANGE : color}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.suggestionLabel}>{item.label}</Text>
        <Text style={styles.suggestionAddress} numberOfLines={1}>{item.address}</Text>
      </View>
      <Feather name="arrow-up-left" size={14} color={C.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { paddingTop: insets.top + 8, transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          {/* Search Input */}
          <View style={styles.searchBar}>
            <View style={[styles.searchDot, { backgroundColor: color }]} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search city or landmark in Punjab…"
              placeholderTextColor={C.textTertiary}
              value={query}
              onChangeText={debouncedQuery}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Feather name="x" size={16} color={C.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={[]}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 60 }}
            ListHeaderComponent={() => (
              <View>
                {/* Search results */}
                {filtered && filtered.length > 0 && (
                  <View>
                    <Text style={styles.sectionLabel}>Search Results</Text>
                    {filtered.map(item => renderItem(item, item.label.includes("Temple") || item.label.includes("Lake") || item.label.includes("Garden") || item.label.includes("Station") || item.label.includes("Airport") || item.label.includes("Fort") || item.label.includes("University") || item.label.includes("Border") ? "landmark" : "city"))}
                  </View>
                )}
                {filtered && filtered.length === 0 && (
                  <View style={styles.noResults}>
                    <Text style={styles.noResultsText}>No results for "{query}"</Text>
                    <Text style={styles.noResultsSub}>Try another city or landmark in Punjab</Text>
                  </View>
                )}

                {/* Recent locations */}
                {!filtered && recents.length > 0 && (
                  <View>
                    <Text style={styles.sectionLabel}>Recent</Text>
                    {recents.map(item => renderItem(item, "recent"))}
                  </View>
                )}

                {/* Popular cities */}
                {!filtered && (
                  <View>
                    <Text style={styles.sectionLabel}>Cities in Punjab</Text>
                    {PUNJAB_CITIES.slice(0, 8).map(item => renderItem(item, "city"))}
                  </View>
                )}

                {/* Landmarks */}
                {!filtered && (
                  <View>
                    <Text style={styles.sectionLabel}>Popular Landmarks</Text>
                    {PUNJAB_LANDMARKS.slice(0, 6).map(item => renderItem(item, "landmark"))}
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" },
  sheet: { flex: 1, backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.backgroundSecondary, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: C.border,
  },
  searchDot: { width: 10, height: 10, borderRadius: 5 },
  searchInput: { flex: 1, fontSize: 15, color: C.text, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: C.textTertiary, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border + "60" },
  suggestionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  suggestionLabel: { fontSize: 15, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  suggestionAddress: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  noResults: { padding: 40, alignItems: "center", gap: 8 },
  noResultsText: { fontSize: 16, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  noResultsSub: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
});
