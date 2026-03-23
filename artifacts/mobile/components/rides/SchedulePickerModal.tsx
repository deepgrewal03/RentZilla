import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.light;
const ORANGE = "#E8742A";
const NAVY = "#0F1F3D";

export interface ScheduledTime {
  date: Date;
  label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (time: ScheduledTime) => void;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

export function SchedulePickerModal({ visible, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const now = new Date();

  // Build available dates (today + next 6 days)
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Build available times (next 30-min slot to 23:30, every 30 min)
  const timeSlots: Date[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const t = new Date(now);
      t.setHours(h, m, 0, 0);
      timeSlots.push(t);
    }
  }

  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function isSlotValid(slot: Date) {
    const combined = new Date(selectedDate);
    combined.setHours(slot.getHours(), slot.getMinutes(), 0, 0);
    return combined.getTime() > now.getTime() + 15 * 60000;
  }

  function handleConfirm() {
    if (!selectedTime) return;
    const combined = new Date(selectedDate);
    combined.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    const isToday = selectedDate.toDateString() === now.toDateString();
    const isTomorrow = (() => {
      const tom = new Date(now); tom.setDate(tom.getDate() + 1);
      return selectedDate.toDateString() === tom.toDateString();
    })();
    const dayStr = isToday ? "Today" : isTomorrow ? "Tomorrow" : `${DAY_NAMES[combined.getDay()]}, ${combined.getDate()} ${MONTH_NAMES[combined.getMonth()]}`;
    const timeStr = `${pad(combined.getHours())}:${pad(combined.getMinutes())}`;
    onConfirm({ date: combined, label: `${dayStr} at ${timeStr}` });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Schedule a Ride</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* Date selector */}
          <Text style={styles.sectionLabel}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {dates.map((d, i) => {
              const isToday = i === 0;
              const isTomorrow = i === 1;
              const isSelected = d.toDateString() === selectedDate.toDateString();
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dateChip, isSelected && styles.dateChipActive]}
                  onPress={() => { setSelectedDate(d); setSelectedTime(null); }}
                >
                  <Text style={[styles.dateDayName, isSelected && styles.dateChipActiveText]}>
                    {isToday ? "Today" : isTomorrow ? "Tomorrow" : DAY_NAMES[d.getDay()]}
                  </Text>
                  <Text style={[styles.dateNum, isSelected && styles.dateChipActiveText]}>
                    {d.getDate()} {MONTH_NAMES[d.getMonth()]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time selector */}
          <Text style={styles.sectionLabel}>Select Time</Text>
          <ScrollView style={styles.timeGrid} contentContainerStyle={styles.timeGridContent}>
            {timeSlots.map((slot, i) => {
              const valid = isSlotValid(slot);
              const isSelected = selectedTime?.getHours() === slot.getHours() && selectedTime?.getMinutes() === slot.getMinutes();
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.timeChip, isSelected && styles.timeChipActive, !valid && styles.timeChipDisabled]}
                  onPress={() => valid && setSelectedTime(slot)}
                  disabled={!valid}
                >
                  <Text style={[styles.timeText, isSelected && styles.timeChipActiveText, !valid && styles.timeChipDisabledText]}>
                    {pad(slot.getHours())}:{pad(slot.getMinutes())}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.confirmBtn, !selectedTime && { opacity: 0.4 }]}
            onPress={handleConfirm}
            disabled={!selectedTime}
          >
            <Feather name="clock" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>
              {selectedTime
                ? `Schedule for ${pad(selectedTime.getHours())}:${pad(selectedTime.getMinutes())}`
                : "Select a time above"
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "85%" },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: C.textTertiary, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 16, marginBottom: 10 },
  dateRow: { gap: 8, paddingRight: 8 },
  dateChip: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.backgroundSecondary, borderWidth: 1.5, borderColor: "transparent", minWidth: 72 },
  dateChipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  dateDayName: { fontSize: 11, fontWeight: "600", color: C.textSecondary, fontFamily: "Inter_600SemiBold" },
  dateNum: { fontSize: 13, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold", marginTop: 2 },
  dateChipActiveText: { color: "#fff" },
  timeGrid: { maxHeight: 180 },
  timeGridContent: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.backgroundSecondary, borderWidth: 1, borderColor: "transparent" },
  timeChipActive: { backgroundColor: ORANGE },
  timeChipDisabled: { backgroundColor: C.backgroundSecondary, opacity: 0.35 },
  timeText: { fontSize: 14, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  timeChipActiveText: { color: "#fff" },
  timeChipDisabledText: { color: C.textTertiary },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16, marginTop: 16 },
  confirmBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
});
