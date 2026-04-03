import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { Category, PriceUnit } from "@/types";

const C = Colors.light;

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "cars", label: "Cars" },
  { id: "equipment", label: "Equipment" },
  { id: "services", label: "Services" },
];

const SUBCATEGORIES: Record<Category, string[]> = {
  cars: ["Sedan", "Hatchback", "SUV"],
  equipment: [
    "Tractor", "Harvester", "Rotavator", "Sprayer", "Plough", "Cultivator",
    "JCB", "Excavator", "Bulldozer", "Poclain", "Rock Breaker", "Wheel Loader", "Chhota Hathi",
    "Loader", "Backhoe", "Roller", "Crane", "Dump Truck",
  ],
  services: ["Plumbing", "Electrician", "Beauty", "Carpenter", "Painter", "AC Repair"],
};

// Engine sizes: 0.8L → 3.0L in 0.1 steps
const ENGINE_SIZES = Array.from({ length: 23 }, (_, i) =>
  Math.round((0.8 + i * 0.1) * 10) / 10
);

function engineToVehicleType(size: number): string {
  if (size <= 1.6) return "Car";
  if (size <= 2.4) return "SUV";
  return "Van";
}

function engineToTier(size: number): { label: string; color: string; bg: string } {
  if (size <= 1.6) return { label: "Economical",  color: "#FF7A18", bg: "#FFF4EC" };
  if (size <= 2.4) return { label: "Comfortable", color: "#7C3AED", bg: "#F5F3FF" };
  return                  { label: "Luxurious",   color: "#EC4899", bg: "#FDF2F8" };
}

const EARTH_MOVER_TYPES = new Set([
  "JCB", "Excavator", "Bulldozer", "Poclain", "Rock Breaker", "Wheel Loader", "Chhota Hathi",
  "Loader", "Backhoe", "Roller", "Crane", "Dump Truck",
]);

const PRICE_UNITS: { id: PriceUnit; label: string }[] = [
  { id: "per_day", label: "Per Day" },
  { id: "per_hour", label: "Per Hour" },
];

const LOCATIONS = [
  "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda",
  "Mohali", "Hoshiarpur", "Gurdaspur", "Firozpur", "Moga",
];

export default function AddListingScreen() {
  const { post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [category, setCategory] = useState<Category>("cars");
  const [subcategory, setSubcategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("per_day");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [operatorIncluded, setOperatorIncluded] = useState(false);
  const [fuelIncluded, setFuelIncluded] = useState(false);
  const [deliveryCharges, setDeliveryCharges] = useState("");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [engineSize, setEngineSize] = useState<number | null>(null);
  const [showEnginePicker, setShowEnginePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEarthMover = category === "equipment" && EARTH_MOVER_TYPES.has(subcategory);

  const topPad = isWeb ? 67 : insets.top;

  async function handleSave() {
    if (!title.trim() || !expectedPrice || !location) {
      Alert.alert("Missing Info", "Please fill in title, your expected rate, and location.");
      return;
    }
    if (category === "cars" && engineSize === null) {
      Alert.alert("Missing Info", "Please select the engine size for your car.");
      return;
    }
    setSaving(true);
    try {
      const newListing: any = await post("/listings", {
        category,
        subcategory: subcategory || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        price: Number(expectedPrice),
        priceUnit,
        location,
        images: imageUrl ? [imageUrl] : [],
        isAvailable: true,
        ...(isEarthMover && {
          operatorIncluded,
          fuelIncluded,
          deliveryCharges: deliveryCharges ? Number(deliveryCharges) : null,
        }),
        ...(category === "cars" && engineSize !== null && {
          engineSize,
          vehicleType: engineToVehicleType(engineSize),
        }),
      });

      // Save provider expected price reference (non-car categories only)
      if (category !== "cars" && expectedPrice && Number(expectedPrice) > 0) {
        try {
          await post("/provider/price-reference", {
            category,
            subcategory: subcategory || title.trim(),
            listing_id: newListing?.id ?? null,
            provider_price: Number(expectedPrice),
          });
        } catch { /* non-blocking — don't fail listing creation if this fails */ }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Could not create listing. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 10 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>New Listing</Text>
        <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator color="#FF7A18" size="small" /> : <Text style={styles.saveBtnText}>Post</Text>}
        </Pressable>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Category *</Text>
            <View style={styles.optionRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setCategory(c.id); setSubcategory(""); setEngineSize(null); setShowEnginePicker(false); }}
                  style={[styles.optionBtn, category === c.id && styles.optionBtnActive]}
                >
                  <Text style={[styles.optionText, category === c.id && styles.optionTextActive]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Subcategory */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUBCATEGORIES[category].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSubcategory(s === subcategory ? "" : s)}
                  style={[styles.chipBtn, subcategory === s && styles.chipBtnActive]}
                >
                  <Text style={[styles.chipText, subcategory === s && styles.chipTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Engine Size — cars only */}
          {category === "cars" && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Engine Size *</Text>
              <Pressable
                onPress={() => setShowEnginePicker((v) => !v)}
                style={styles.dropdownBtn}
              >
                <Text style={engineSize ? styles.dropdownValue : styles.dropdownPlaceholder}>
                  {engineSize ? `${engineSize}L` : "Select engine size"}
                </Text>
                <Ionicons
                  name={showEnginePicker ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={C.textSecondary}
                />
              </Pressable>

              {showEnginePicker && (
                <View style={styles.dropdownList}>
                  {ENGINE_SIZES.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => { setEngineSize(s); setShowEnginePicker(false); }}
                      style={[styles.dropdownItem, engineSize === s && styles.dropdownItemActive]}
                    >
                      <Text style={[styles.dropdownItemText, engineSize === s && { color: "#FF7A18", fontFamily: "Inter_700Bold" }]}>
                        {s.toFixed(1)}L
                      </Text>
                      <Text style={styles.dropdownItemHint}>
                        {engineToTier(s).label}
                      </Text>
                      {engineSize === s && (
                        <Ionicons name="checkmark-circle" size={16} color="#FF7A18" />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

              {engineSize !== null && (
                <View style={[styles.tierBadge, { backgroundColor: engineToTier(engineSize).bg }]}>
                  <Ionicons name="car-sport-outline" size={15} color={engineToTier(engineSize).color} />
                  <Text style={[styles.tierLabel, { color: engineToTier(engineSize).color }]}>
                    Listed under: {engineToTier(engineSize).label}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Mahindra 575 Tractor – Well Maintained"
              placeholderTextColor={C.textTertiary}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your listing in detail..."
              placeholderTextColor={C.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Expected Rate — replaces old "Price" field */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Your Expected Rate (₹) *</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceInputWrap}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.priceInput}
                  value={expectedPrice}
                  onChangeText={setExpectedPrice}
                  placeholder={category === "equipment" ? "e.g. 1200" : category === "cars" ? "e.g. 2500" : "e.g. 350"}
                  placeholderTextColor={C.textTertiary}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.unitRow}>
                {PRICE_UNITS.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setPriceUnit(u.id)}
                    style={[styles.unitBtn, priceUnit === u.id && styles.unitBtnActive]}
                  >
                    <Text style={[styles.unitText, priceUnit === u.id && styles.unitTextActive]}>{u.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Location *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {LOCATIONS.map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLocation(l === location ? "" : l)}
                  style={[styles.chipBtn, location === l && styles.chipBtnActive]}
                >
                  <Text style={[styles.chipText, location === l && styles.chipTextActive]}>{l}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Or type your city/village"
              placeholderTextColor={C.textTertiary}
            />
          </View>

          {/* Earth Mover specific options */}
          {isEarthMover && (
            <View style={styles.section}>
              <View style={styles.earthMoverBanner}>
                <Ionicons name="construct" size={15} color="#BF360C" />
                <Text style={styles.earthMoverBannerText}>Earth Mover Options</Text>
              </View>

              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setOperatorIncluded((v) => !v); }}
                  style={[styles.toggleBtn, operatorIncluded && styles.toggleBtnOn]}
                >
                  <Ionicons
                    name={operatorIncluded ? "person" : "person-outline"}
                    size={16}
                    color={operatorIncluded ? "#fff" : C.textSecondary}
                  />
                  <Text style={[styles.toggleText, operatorIncluded && styles.toggleTextOn]}>
                    Operator Included
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setFuelIncluded((v) => !v); }}
                  style={[styles.toggleBtn, fuelIncluded && styles.toggleBtnOn]}
                >
                  <Ionicons
                    name={fuelIncluded ? "flame" : "flame-outline"}
                    size={16}
                    color={fuelIncluded ? "#fff" : C.textSecondary}
                  />
                  <Text style={[styles.toggleText, fuelIncluded && styles.toggleTextOn]}>
                    Fuel Included
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Delivery Charges (₹, optional)</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.priceInput}
                  value={deliveryCharges}
                  onChangeText={setDeliveryCharges}
                  placeholder="0"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {/* Image URL */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Image URL (optional)</Text>
            <TextInput
              style={styles.input}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://example.com/photo.jpg"
              placeholderTextColor={C.textTertiary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={{ height: isWeb ? 34 : 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  saveBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: "center",
  },
  saveBtnText: { color: "#FF7A18", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    marginBottom: 10,
  },
  input: {
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  textArea: {
    minHeight: 90,
    paddingTop: 12,
  },
  optionRow: { flexDirection: "row", gap: 10 },
  optionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.backgroundSecondary,
    alignItems: "center",
  },
  optionBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  optionText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  optionTextActive: { color: "#fff" },
  chipBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.backgroundSecondary,
  },
  chipBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  chipText: { fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium", color: C.text },
  chipTextActive: { color: "#fff" },
  priceRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  priceInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
  },
  rupee: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.textSecondary, marginRight: 4 },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
    paddingVertical: 12,
  },
  unitRow: { gap: 6 },
  unitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.backgroundSecondary,
  },
  unitBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  unitText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  unitTextActive: { color: "#fff" },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  dropdownList: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.backgroundSecondary,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dropdownItemActive: {
    backgroundColor: "#FFF4EC",
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.text,
    width: 48,
  },
  dropdownItemHint: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginLeft: 8,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tierLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  earthMoverBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FBE9E7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FFCCBC",
  },
  earthMoverBannerText: {
    fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#BF360C",
  },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.backgroundSecondary,
  },
  toggleBtnOn: { backgroundColor: "#BF360C", borderColor: "#BF360C" },
  toggleText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  toggleTextOn: { color: "#fff" },
});
