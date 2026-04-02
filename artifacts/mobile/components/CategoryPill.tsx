import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import { Category } from "@/types";

const C = Colors.light;

interface CategoryItem {
  id: Category | "all";
  label: string;
  icon: string;
  lib: "ion" | "mci";
  color: string;
  bg: string;
}

export const CATEGORIES: CategoryItem[] = [
  { id: "all", label: "All", icon: "grid-outline", lib: "ion", color: C.navy, bg: `${C.navy}12` },
  { id: "cars", label: "Cars", icon: "car-outline", lib: "ion", color: "#3B82F6", bg: "#EBF4FF" },
  { id: "equipment", label: "Equipment", icon: "tractor", lib: "mci", color: "#22C55E", bg: "#F0FFF4" },
  { id: "services", label: "Services", icon: "briefcase-outline", lib: "ion", color: "#A855F7", bg: "#F5F0FF" },
];

export const SUBCATEGORIES: Record<string, { id: string; label: string }[]> = {
  cars: [
    { id: "sedan", label: "Sedan" },
    { id: "suv", label: "SUV" },
    { id: "truck", label: "Truck" },
    { id: "van", label: "Van" },
  ],
  equipment: [
    { id: "tractor",      label: "Tractor" },
    { id: "harvester",    label: "Harvester" },
    { id: "rotavator",    label: "Rotavator" },
    { id: "sprayer",      label: "Sprayer" },
    { id: "plough",       label: "Plough" },
    { id: "cultivator",   label: "Cultivator" },
    { id: "jcb",          label: "JCB" },
    { id: "excavator",    label: "Excavator" },
    { id: "bulldozer",    label: "Bulldozer" },
    { id: "poclain",      label: "Poclain" },
    { id: "rock_breaker", label: "Rock Breaker" },
    { id: "wheel_loader", label: "Wheel Loader" },
    { id: "chhota_hathi", label: "Chhota Hathi" },
    { id: "loader",       label: "Loader" },
    { id: "backhoe",      label: "Backhoe" },
    { id: "roller",       label: "Roller" },
    { id: "crane",        label: "Crane" },
    { id: "dump_truck",   label: "Dump Truck" },
  ],
  services: [
    { id: "plumbing",    label: "Plumbing" },
    { id: "electrician", label: "Electrician" },
    { id: "beauty",      label: "Beauty" },
    { id: "carpenter",   label: "Carpenter" },
    { id: "painter",     label: "Painter" },
    { id: "ac_repair",   label: "AC Repair" },
  ],
};

interface Props {
  category: CategoryItem;
  selected: boolean;
  onPress: () => void;
}

export function CategoryPill({ category, selected, onPress }: Props) {
  function handlePress() {
    Haptics.selectionAsync();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillSelected,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: selected ? "rgba(255,255,255,0.25)" : category.bg }]}>
        {category.lib === "ion" ? (
          <Ionicons name={category.icon as keyof typeof Ionicons.glyphMap} size={18} color={selected ? "#fff" : category.color} />
        ) : (
          <MaterialCommunityIcons name={category.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={18} color={selected ? "#fff" : category.color} />
        )}
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>{category.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  pillSelected: {
    backgroundColor: C.tint,
    borderColor: C.tint,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  labelSelected: {
    color: "#fff",
  },
});
