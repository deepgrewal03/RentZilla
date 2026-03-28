import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { BookingCardSkeleton } from "@/components/SkeletonLoader";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Booking } from "@/types";

const C = Colors.light;

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.cardLeft}>
        {booking.listingImage ? (
          <Image source={{ uri: booking.listingImage }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Ionicons name="cube-outline" size={24} color={C.textTertiary} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{booking.listingTitle || "Booking"}</Text>
        <Text style={styles.cardDates}>
          {new Date(booking.startDate).toLocaleDateString("en-IN")} –{" "}
          {new Date(booking.endDate).toLocaleDateString("en-IN")}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardAmount}>₹{booking.totalAmount.toLocaleString("en-IN")}</Text>
          <BookingStatusBadge status={booking.status} />
        </View>
      </View>
    </Pressable>
  );
}

export default function BookingsScreen() {
  const { user } = useAuth();
  const { get } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    fetchBookings();
  }, []);

  async function fetchBookings() {
    try {
      const role = user?.role === "provider" ? "provider" : "customer";
      const data = await get<Booking[]>(`/bookings?role=${role}`);
      setBookings(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerSub}>{user?.role === "provider" ? "Requests for your listings" : "Your rental history"}</Text>
      </LinearGradient>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} tintColor={C.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.list}>
            <BookingCardSkeleton delay={0} />
            <BookingCardSkeleton delay={110} />
            <BookingCardSkeleton delay={220} />
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="calendar-outline" size={56} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>
              {user?.role === "provider" ? "Bookings will appear when customers rent your listings" : "Browse listings to make your first booking"}
            </Text>
            {user?.role === "customer" && (
              <Pressable onPress={() => router.push("/(tabs)/search")} style={styles.browseBtn}>
                <Text style={styles.browseBtnText}>Browse Listings</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {bookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onPress={() => router.push({ pathname: "/booking/[id]", params: { id: b.id } })}
              />
            ))}
          </View>
        )}
        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_400Regular",
  },
  scroll: { flex: 1 },
  list: { padding: 20, gap: 14 },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: {},
  cardImage: {
    width: 100,
    height: 110,
  },
  cardImagePlaceholder: {
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    padding: 12,
    gap: 6,
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    lineHeight: 20,
  },
  cardDates: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.tint,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  browseBtn: {
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  browseBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
