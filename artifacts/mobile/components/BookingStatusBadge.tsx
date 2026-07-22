import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { BookingStatus } from "@/types";

const STATUS_CONFIG: Record<BookingStatus, { label: string; bg: string; text: string }> = {
  pending:          { label: "Pending",          bg: "#FFF9EC", text: "#D97706" },
  confirmed:        { label: "Confirmed",        bg: "#ECFDF5", text: "#059669" },
  accepted:         { label: "Accepted",         bg: "#ECFDF5", text: "#059669" },
  in_progress:      { label: "In Progress",      bg: "#FFF3E0", text: "#FF7A18" },
  started:          { label: "Started",          bg: "#FFF3E0", text: "#FF7A18" },
  scheduled:        { label: "Scheduled",        bg: "#EDE9FE", text: "#7C3AED" },
  completed:        { label: "Completed",        bg: "#EFF6FF", text: "#2563EB" },
  closed:           { label: "Closed",           bg: "#EFF6FF", text: "#2563EB" },
  cancelled:        { label: "Cancelled",        bg: "#FEF2F2", text: "#DC2626" },
  cancel_requested: { label: "Cancel Requested", bg: "#FEF2F2", text: "#DC2626" },
  refund_pending:   { label: "Refund Pending",   bg: "#FFF7ED", text: "#EA580C" },
  refunded:         { label: "Refunded",         bg: "#F0FDF4", text: "#16A34A" },
  disputed:         { label: "Disputed",         bg: "#FFF1F2", text: "#BE123C" },
  draft:            { label: "Draft",            bg: "#F3F4F6", text: "#6B7280" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, bg: "#F3F4F6", text: "#6B7280" };
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
