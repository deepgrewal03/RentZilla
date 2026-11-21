import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.light;
export function CatalogLocationSelect({ label, value, options, allLabel, disabled = false, onChange }: {
  label: string; value: string; options: string[]; allLabel: string; disabled?: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable testID={`catalog-${label === "District" ? "district" : "town"}`} accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || allLabel}`} accessibilityState={{ disabled, expanded: open }}
        disabled={disabled} onPress={() => setOpen(true)} style={[styles.select, disabled && { opacity: 0.5 }]}>
        <Text style={styles.value}>{disabled ? "Select a district first" : value || allLabel}</Text>
        <Ionicons name="chevron-down" size={18} color={C.tint} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[styles.overlay, { paddingTop: Math.max(insets.top, Platform.OS === "web" ? 67 : 20), paddingBottom: Math.max(insets.bottom, 34) }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close location choices" />
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.heading}>
              <Text style={styles.title}>Select {label.toLowerCase()}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close" style={styles.close}>
                <Ionicons name="close" size={24} color={C.text} />
              </Pressable>
            </View>
            <Text style={styles.hint}>{options.length} {label === "District" ? "districts" : "towns / cities"} · Scroll to see the full list</Text>
            <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar
              contentContainerStyle={{ paddingBottom: 16 }}>
              {["", ...options].map(item => (
                <Pressable key={item || "__all__"} accessibilityRole="radio" accessibilityState={{ checked: item === value }}
                  style={styles.option} onPress={() => { onChange(item); setOpen(false); }}>
                  <Text style={[styles.value, item === value && { color: C.tint }]}>{item || allLabel}</Text>
                  {item === value && <Ionicons name="checkmark" size={20} color={C.tint} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: 7 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  select: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  value: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: C.text },
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: "center", paddingHorizontal: 20 },
  sheet: { height: "80%", backgroundColor: C.card, borderRadius: 22, overflow: "hidden" },
  heading: { flexDirection: "row", alignItems: "center", paddingLeft: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  close: { padding: 16 },
  list: { flex: 1, minHeight: 0 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, paddingHorizontal: 20, paddingVertical: 10 },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight },
});
