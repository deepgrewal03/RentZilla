import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
  cars: ["Sedan", "SUV", "Truck", "Van", "Tempo"],
  equipment: ["Tractor", "Harvester", "Rotavator", "Sprayer", "Plough", "Cultivator"],
  services: ["Plumber", "Electrician", "Beauty", "Carpenter", "Painter", "AC Repair"],
};

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
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("per_day");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  async function handleSave() {
    if (!title.trim() || !price || !location) {
      Alert.alert("Missing Info", "Please fill in title, price, and location.");
      return;
    }
    setSaving(true);
    try {
      await post("/listings", {
        category,
        subcategory: subcategory || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        priceUnit,
        location,
        images: imageUrl ? [imageUrl] : [],
        isAvailable: true,
      });
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
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Listing</Text>
        <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Post</Text>}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
    backgroundColor: C.backgroundSecondary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  saveBtn: {
    backgroundColor: C.tint,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
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
});
