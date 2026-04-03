import React from "react";
import { StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import { BookingStatus } from "@/types";

const C = Colors.light;

const STATUS_CONFIG: Record<BookingStatus, { label: string; bg: string; text: string }> = {
  pending:     { label: "Pending",     bg: "#FFF9EC", text: "#D97706" },
  confirmed:   { label: "Confirmed",   bg: "#ECFDF5", text: "#059669" },
  in_progress: { label: "In Progress", bg: "#FFF3E0", text: "#FF7A18" },
  completed:   { label: "Completed",   bg: "#EFF6FF", text: "#2563EB" },
  cancelled:   { label: "Cancelled",   bg: "#FEF2F2", text: "#DC2626" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
