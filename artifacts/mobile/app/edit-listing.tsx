import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { Category, PriceUnit } from "@/types";

const C = Colors.light;
const ORANGE = "#FF7A18";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "cars", label: "Cars" },
  { id: "equipment", label: "Equipment" },
  { id: "services", label: "Services" },
];

const SUBCATEGORIES: Record<Category, string[]> = {
  cars: ["Sedan", "SUV", "Truck", "Van", "Tempo"],
  equipment: [
    "Tractor", "Harvester", "Rotavator", "Sprayer", "Plough", "Cultivator",
    "JCB", "Excavator", "Bulldozer", "Loader", "Backhoe", "Roller", "Crane", "Dump Truck",
  ],
  services: ["Plumber", "Electrician", "Beauty", "Carpenter", "Painter", "AC Repair"],
};

const EARTH_MOVER_TYPES = new Set([
  "JCB", "Excavator", "Bulldozer", "Loader", "Backhoe", "Roller", "Crane", "Dump Truck",
]);

const PRICE_UNITS: { id: PriceUnit; label: string }[] = [
  { id: "per_day", label: "Per Day" },
  { id: "per_hour", label: "Per Hour" },
];

const LOCATIONS = [
  "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda",
  "Mohali", "Hoshiarpur", "Gurdaspur", "Firozpur", "Moga",
];

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, put } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<Category>("cars");
  const [subcategory, setSubcategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("per_day");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [operatorIncluded, setOperatorIncluded] = useState(false);
  const [fuelIncluded, setFuelIncluded] = useState(false);
  const [deliveryCharges, setDeliveryCharges] = useState("");

  const isEarthMover = category === "equipment" && EARTH_MOVER_TYPES.has(subcategory);

  useEffect(() => {
    if (id) loadListing();
  }, [id]);

  async function loadListing() {
    try {
      const listing = await get<any>(`/listings/${id}`);
      setCategory(listing.category || "cars");
      setSubcategory(listing.subcategory || "");
      setTitle(listing.title || "");
      setDescription(listing.description || "");
      setPrice(listing.price?.toString() || "");
      setPriceUnit(listing.priceUnit || "per_day");
      setLocation(listing.location || "");
      setImageUrl(listing.images?.[0] || "");
      setIsAvailable(listing.isAvailable !== false);
      setOperatorIncluded(listing.operatorIncluded || false);
      setFuelIncluded(listing.fuelIncluded || false);
      setDeliveryCharges(listing.deliveryCharges?.toString() || "");
    } catch {
      Alert.alert("Error", "Could not load listing details.");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!title.trim() || !price || !location) {
      Alert.alert("Missing Info", "Please fill in title, price, and location.");
      return;
    }
    setSaving(true);
    try {
      await put(`/listings/${id}`, {
        category,
        subcategory: subcategory || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        priceUnit,
        location,
        images: imageUrl ? [imageUrl] : [],
        isAvailable,
        ...(isEarthMover && {
          operatorIncluded,
          fuelIncluded,
          deliveryCharges: deliveryCharges ? Number(deliveryCharges) : null,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Your listing has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not update listing. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={ORANGE} size="large" />
        <Text style={{ marginTop: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>Loading listing...</Text>
      </View>
    );
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
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Listing</Text>
        <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? (
            <ActivityIndicator color={ORANGE} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </Pressable>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Availability toggle */}
          <View style={styles.section}>
            <View style={styles.availRow}>
              <View>
                <Text style={styles.fieldLabel}>Availability</Text>
                <Text style={[styles.availHint, { color: isAvailable ? "#059669" : C.error }]}>
                  {isAvailable ? "Currently available for booking" : "Hidden from search results"}
                </Text>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={(v) => { Haptics.selectionAsync(); setIsAvailable(v); }}
                trackColor={{ false: C.border, true: "#D1FAE5" }}
                thumbColor={isAvailable ? "#059669" : "#ccc"}
              />
            </View>
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Category *</Text>
            <View style={styles.optionRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setCategory(c.id); setSubcategory(""); }}
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

          {/* Price */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Price (₹) *</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceInputWrap}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.priceInput}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0"
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

          {/* Image URL */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Image URL</Text>
            <TextInput
              style={styles.input}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://... (optional)"
              placeholderTextColor={C.textTertiary}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Earth Mover Options */}
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
                  <Ionicons name={operatorIncluded ? "person" : "person-outline"} size={15} color={operatorIncluded ? "#fff" : C.textSecondary} />
                  <Text style={[styles.toggleBtnText, operatorIncluded && styles.toggleBtnTextOn]}>
                    {operatorIncluded ? "Operator Included" : "Operator Not Included"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setFuelIncluded((v) => !v); }}
                  style={[styles.toggleBtn, fuelIncluded && styles.toggleBtnOn]}
                >
                  <Ionicons name={fuelIncluded ? "flame" : "flame-outline"} size={15} color={fuelIncluded ? "#fff" : C.textSecondary} />
                  <Text style={[styles.toggleBtnText, fuelIncluded && styles.toggleBtnTextOn]}>
                    {fuelIncluded ? "Fuel Included" : "Fuel Not Included"}
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Delivery Charges (₹)</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.priceInput}
                  value={deliveryCharges}
                  onChangeText={setDeliveryCharges}
                  placeholder="0 for free delivery"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.bottomSaveBtn, { opacity: pressed || saving ? 0.8 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.bottomSaveBtnText}>Save Changes</Text>
              </>
            )}
          </Pressable>

          <View style={{ height: isWeb ? 40 : 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    flex: 1, fontSize: 20, fontWeight: "700",
    fontFamily: "Inter_700Bold", color: "#fff",
  },
  saveBtn: {
    backgroundColor: "#fff",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 60, alignItems: "center",
  },
  saveBtnText: {
    color: ORANGE, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold",
  },
  scroll: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 20 },
  fieldLabel: {
    fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5,
  },
  availRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  availHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  optionRow: { flexDirection: "row", gap: 10 },
  optionBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 2, borderColor: C.border,
    backgroundColor: "#fff", alignItems: "center",
  },
  optionBtnActive: { borderColor: ORANGE, backgroundColor: "#FFF3E9" },
  optionText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  optionTextActive: { color: ORANGE },
  chipBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: "#fff",
  },
  chipBtnActive: { borderColor: ORANGE, backgroundColor: "#FFF3E9" },
  chipText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },
  chipTextActive: { color: ORANGE, fontFamily: "Inter_600SemiBold" },
  input: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  priceRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  priceInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14,
  },
  rupee: { fontSize: 18, fontWeight: "700", color: ORANGE, marginRight: 6 },
  priceInput: {
    flex: 1, fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold",
    color: C.text, paddingVertical: 12,
  },
  unitRow: { flexDirection: "row", gap: 6 },
  unitBtn: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: "#fff",
  },
  unitBtnActive: { borderColor: ORANGE, backgroundColor: "#FFF3E9" },
  unitText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  unitTextActive: { color: ORANGE },
  earthMoverBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FBE9E7", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 14,
  },
  earthMoverBannerText: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#BF360C" },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: "#fff",
  },
  toggleBtnOn: { borderColor: ORANGE, backgroundColor: ORANGE },
  toggleBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary, flexShrink: 1 },
  toggleBtnTextOn: { color: "#fff" },
  bottomSaveBtn: {
    marginTop: 28, marginHorizontal: 0, backgroundColor: ORANGE,
    borderRadius: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  bottomSaveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
