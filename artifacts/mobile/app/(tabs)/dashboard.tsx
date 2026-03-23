import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookingStatusBadge } from "@/components/BookingStatusBadge";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Booking, Listing } from "@/types";

const C = Colors.light;

export default function DashboardScreen() {
  const { user } = useAuth();
  const { get, put, del } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [l, b] = await Promise.all([
        get<Listing[]>(`/listings?providerId=${user?.id}`),
        get<Booking[]>("/bookings?role=provider"),
      ]);
      setListings(l);
      setBookings(b.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function updateBookingStatus(bookingId: string, status: string) {
    try {
      await put(`/bookings/${bookingId}`, { status });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchData();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function deleteListing(id: string) {
    Alert.alert("Delete Listing", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await del(`/listings/${id}`);
          fetchData();
        },
      },
    ]);
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const totalRevenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.totalAmount, 0);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>Manage your listings & bookings</Text>
        </View>
        <Pressable onPress={() => router.push("/add-listing")} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={C.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: `${C.tint}15`, borderColor: `${C.tint}30` }]}>
            <Ionicons name="list-outline" size={24} color={C.tint} />
            <Text style={styles.statNum}>{listings.length}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#EBF4FF", borderColor: "#BFDBFE" }]}>
            <Ionicons name="calendar-outline" size={24} color="#2563EB" />
            <Text style={[styles.statNum, { color: "#2563EB" }]}>{pendingBookings.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#F0FFF4", borderColor: "#BBF7D0" }]}>
            <Ionicons name="cash-outline" size={24} color="#059669" />
            <Text style={[styles.statNum, { color: "#059669" }]}>₹{(totalRevenue / 1000).toFixed(0)}K</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>

        {/* Pending Bookings */}
        {pendingBookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Requests</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingBookings.length}</Text>
              </View>
            </View>
            {pendingBookings.map((b) => (
              <View key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingTitle}>{b.listingTitle}</Text>
                  <Text style={styles.bookingCustomer}>{b.customerName} · {b.customerPhone}</Text>
                  <Text style={styles.bookingDates}>
                    {new Date(b.startDate).toLocaleDateString("en-IN")} – {new Date(b.endDate).toLocaleDateString("en-IN")} ({b.totalDays}d)
                  </Text>
                  <Text style={styles.bookingAmount}>₹{b.totalAmount.toLocaleString("en-IN")}</Text>
                </View>
                <View style={styles.bookingActions}>
                  <Pressable
                    onPress={() => updateBookingStatus(b.id, "confirmed")}
                    style={[styles.actionBtn, styles.confirmBtn]}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={() => updateBookingStatus(b.id, "cancelled")}
                    style={[styles.actionBtn, styles.rejectBtn]}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* My Listings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Listings</Text>
            <Pressable onPress={() => router.push("/add-listing")} style={styles.addTextBtn}>
              <Text style={styles.addTextBtnText}>+ Add New</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={C.tint} style={{ marginTop: 20 }} />
          ) : listings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={40} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyText}>Create your first listing to start earning</Text>
              <Pressable onPress={() => router.push("/add-listing")} style={styles.createBtn}>
                <Text style={styles.createBtnText}>Create Listing</Text>
              </Pressable>
            </View>
          ) : (
            listings.map((l) => (
              <View key={l.id} style={styles.listingRow}>
                {l.images?.[0] ? (
                  <Image source={{ uri: l.images[0] }} style={styles.listingThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.listingThumb, styles.thumbPlaceholder]}>
                    <Ionicons name="cube-outline" size={20} color={C.textTertiary} />
                  </View>
                )}
                <View style={styles.listingInfo}>
                  <Text style={styles.listingTitle} numberOfLines={2}>{l.title}</Text>
                  <Text style={styles.listingPrice}>₹{l.price.toLocaleString("en-IN")}/{l.priceUnit === "per_day" ? "day" : "hr"}</Text>
                  <View style={[styles.availBadge, { backgroundColor: l.isAvailable ? "#F0FFF4" : "#FEF2F2" }]}>
                    <Text style={[styles.availText, { color: l.isAvailable ? "#059669" : "#DC2626" }]}>
                      {l.isAvailable ? "Available" : "Unavailable"}
                    </Text>
                  </View>
                </View>
                <View style={styles.listingActions}>
                  <Pressable onPress={() => router.push({ pathname: "/listing/[id]", params: { id: l.id } })} style={styles.iconBtn}>
                    <Ionicons name="eye-outline" size={18} color={C.tint} />
                  </Pressable>
                  <Pressable onPress={() => deleteListing(l.id)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color={C.error} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.backgroundSecondary,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  headerSub: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  scroll: { flex: 1 },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  statNum: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  statLabel: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  badge: {
    backgroundColor: C.tint,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },
  addTextBtn: {},
  addTextBtnText: { fontSize: 14, color: C.tint, fontFamily: "Inter_600SemiBold" },
  bookingCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  bookingInfo: { flex: 1, gap: 3 },
  bookingTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  bookingCustomer: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  bookingDates: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  bookingAmount: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  bookingActions: { gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  confirmBtn: { backgroundColor: "#059669" },
  rejectBtn: { backgroundColor: C.error },
  listingRow: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
    marginBottom: 10,
    alignItems: "center",
  },
  listingThumb: { width: 80, height: 80 },
  thumbPlaceholder: { backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center" },
  listingInfo: { flex: 1, padding: 12, gap: 4 },
  listingTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  listingPrice: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  availBadge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  availText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold" },
  listingActions: { paddingRight: 12, gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  emptyText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
  createBtn: {
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 11,
    marginTop: 8,
  },
  createBtnText: { color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
