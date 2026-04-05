import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
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

import Colors from "@/constants/colors";
import { StarRating } from "@/components/StarRating";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { DocumentsDrawer } from "@/components/DocumentsDrawer";

const C = Colors.light;
const ORANGE = "#E8742A";
const NAVY = "#0F1F3D";
const GOLD = "#F5C842";

type Summary = {
  earnings: {
    total: number;
    rentalEarnings: number;
    rideEarnings: number;
    thisMonth: number;
    lastMonth: number;
    growthPct: number;
    todayRideEarnings: number;
  };
  bookings: { total: number; pending: number; active: number; customers: number };
  listings: { total: number; active: number };
  rides: { totalTrips: number; todayEarnings: number };
};

type RecentBooking = {
  id: string;
  status: string;
  total_amount: number;
  final_amount?: number;
  service_fee?: number;
  extra_charges?: string | null;
  service_type?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  created_at: string;
  listing_title: string;
  listing_images: string[] | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
};

function SkeletonRect({ w, h, r = 8, mt = 0 }: { w: number | string; h: number; r?: number; mt?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: false }),
    ])).start();
  }, []);
  return (
    <Animated.View
      style={{ width: w as any, height: h, borderRadius: r, backgroundColor: "#E5E7EB", opacity: anim, marginTop: mt }}
    />
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pending:     { bg: "#FFF3CD", fg: "#856404",  label: "Pending" },
    confirmed:   { bg: "#D1FAE5", fg: "#065F46",  label: "Confirmed" },
    in_progress: { bg: "#FEF3C7", fg: "#B45309",  label: "In Progress" },
    completed:   { bg: "#DBEAFE", fg: "#1D4ED8",  label: "Completed" },
    cancelled:   { bg: "#FEE2E2", fg: "#991B1B",  label: "Cancelled" },
  };
  const s = map[status] ?? { bg: "#F3F4F6", fg: "#374151", label: status };
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Text style={[styles.chipText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function displayAmount(b: RecentBooking): number {
  const fa = Number(b.final_amount ?? 0);
  return fa > 0 ? fa : Number(b.total_amount);
}

export default function DashboardScreen() {
  const { user, activeMode, setActiveMode } = useAuth();
  const { get, put, del } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDocsDrawer, setShowDocsDrawer] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  // Determine if user can switch roles
  const roles: string[] = (user as any)?.roles ?? [];
  const isBoth = roles.includes("customer") && roles.includes("provider");
  const isPureProvider = user?.role === "provider";
  const inProviderMode = isPureProvider || (isBoth && activeMode === "provider");

  // When user switches to customer mode, leave the dashboard and go to Home
  useEffect(() => {
    if (user && !inProviderMode) {
      router.replace("/(tabs)/");
    }
  }, [inProviderMode, user]);

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  async function fetchData() {
    try {
      const [sum, recent, lists, revs, tripsData] = await Promise.all([
        get<Summary>("/provider/summary"),
        get<RecentBooking[]>("/provider/recent-bookings"),
        get<any[]>(`/listings?providerId=${user?.id}`),
        get<any[]>(`/reviews?providerId=${user?.id}`),
        get<any[]>("/rides/history").catch(() => []),
      ]);
      setSummary(sum);
      setRecentBookings(recent);
      setListings(lists);
      setReviews([...revs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setTrips(tripsData.filter((t: any) => t.status === "completed" && t.driver_id === user?.id));
    } catch {
      // best-effort
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function updateBookingStatus(id: string, status: string) {
    try {
      await put(`/bookings/${id}`, { status });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchData();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function deleteListing(id: string) {
    Alert.alert("Delete Listing", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await del(`/listings/${id}`); fetchData(); } },
    ]);
  }

  function fmtCurrency(n: number) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toLocaleString("en-IN")}`;
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const pending = recentBookings.filter((b) => b.status === "pending");

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ──────────── HEADER ──────────── */}
      <LinearGradient
        colors={[NAVY, "#1A3260"]}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.nameText}>{firstName} 👋</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push("/add-listing")} style={styles.addListingBtn}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addListingBtnText}>Add Listing</Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setShowDocsDrawer(true); }}
              style={[styles.menuBtn, { backgroundColor: "rgba(232,116,42,0.2)" }]}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={ORANGE} />
            </Pressable>
          </View>
        </View>

        {/* Role toggle — only for "both" role users */}
        {isBoth && (
          <View style={styles.roleToggle}>
            <Pressable
              onPress={() => {
                setActiveMode("customer");
                Haptics.selectionAsync();
                router.replace("/(tabs)/");
              }}
              style={[styles.roleBtn, activeMode === "customer" && styles.roleBtnActive]}
            >
              <Ionicons name="person-outline" size={13} color={activeMode === "customer" ? ORANGE : "rgba(255,255,255,0.55)"} />
              <Text style={[styles.roleBtnText, activeMode === "customer" && styles.roleBtnTextActive]}>Customer</Text>
            </Pressable>
            <Pressable
              onPress={() => { setActiveMode("provider"); Haptics.selectionAsync(); }}
              style={[styles.roleBtn, activeMode === "provider" && styles.roleBtnActive]}
            >
              <Ionicons name="briefcase-outline" size={13} color={activeMode === "provider" ? ORANGE : "rgba(255,255,255,0.55)"} />
              <Text style={[styles.roleBtnText, activeMode === "provider" && styles.roleBtnTextActive]}>Provider</Text>
            </Pressable>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={ORANGE} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ──────────── EARNINGS HERO CARD ──────────── */}
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={[ORANGE, "#C8521A"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Background decorative circles */}
            <View style={styles.heroCircle1} />
            <View style={styles.heroCircle2} />

            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>Total Earnings</Text>
                {loading ? (
                  <SkeletonRect w={140} h={40} r={8} mt={6} />
                ) : (
                  <Text style={styles.heroAmount}>
                    {fmtCurrency(summary?.earnings.total ?? 0)}
                  </Text>
                )}
              </View>
              <View style={styles.heroIconBox}>
                <Ionicons name="wallet-outline" size={28} color="rgba(255,255,255,0.9)" />
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroBottom}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>This Month</Text>
                {loading ? (
                  <SkeletonRect w={70} h={18} r={6} mt={4} />
                ) : (
                  <Text style={styles.heroStatValue}>{fmtCurrency(summary?.earnings.thisMonth ?? 0)}</Text>
                )}
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>vs Last Month</Text>
                {loading ? (
                  <SkeletonRect w={60} h={18} r={6} mt={4} />
                ) : (
                  <View style={styles.growthRow}>
                    <Ionicons
                      name={(summary?.earnings.growthPct ?? 0) >= 0 ? "trending-up" : "trending-down"}
                      size={15}
                      color={(summary?.earnings.growthPct ?? 0) >= 0 ? GOLD : "#FCA5A5"}
                    />
                    <Text style={[
                      styles.heroStatValue,
                      { color: (summary?.earnings.growthPct ?? 0) >= 0 ? GOLD : "#FCA5A5" },
                    ]}>
                      {summary?.earnings.growthPct ?? 0}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Today (Rides)</Text>
                {loading ? (
                  <SkeletonRect w={60} h={18} r={6} mt={4} />
                ) : (
                  <Text style={styles.heroStatValue}>{fmtCurrency(summary?.earnings.todayRideEarnings ?? 0)}</Text>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ──────────── STATS GRID ──────────── */}
        <View style={styles.statsGrid}>
          {[
            { icon: "list-outline",     color: ORANGE,    bg: `${ORANGE}18`, label: "Active Listings",  value: summary?.listings.active ?? 0 },
            { icon: "calendar-outline", color: "#2563EB", bg: "#EFF6FF",     label: "Pending Requests", value: summary?.bookings.pending ?? 0 },
            { icon: "checkmark-circle-outline", color: "#059669", bg: "#F0FFF4", label: "Total Bookings", value: summary?.bookings.total ?? 0 },
            { icon: "people-outline",   color: "#7C3AED", bg: "#F5F3FF",     label: "Customers",        value: summary?.bookings.customers ?? 0 },
          ].map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: s.bg }]}>
              {loading ? (
                <>
                  <SkeletonRect w={28} h={28} r={14} />
                  <SkeletonRect w={40} h={26} r={6} mt={8} />
                  <SkeletonRect w={70} h={12} r={4} mt={6} />
                </>
              ) : (
                <>
                  <View style={[styles.statIconBox, { backgroundColor: `${s.color}22` }]}>
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* ──────────── REFER A FRIEND BANNER ──────────── */}
        <Pressable onPress={() => router.push("/referral" as any)} activeOpacity={0.9} style={styles.referBanner}>
          <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.referBannerGrad}>
            <View style={styles.referBannerIcon}><Text style={{ fontSize: 24 }}>🎁</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.referBannerTitle}>Refer Providers, Earn Rewards</Text>
              <Text style={styles.referBannerSub}>Invite 5 colleagues → unlock 10% off your next job</Text>
            </View>
            <View style={styles.referBannerCta}>
              <Text style={styles.referBannerCtaTxt}>Refer</Text>
              <Ionicons name="chevron-forward" size={13} color="#fff" />
            </View>
          </LinearGradient>
        </Pressable>

        {/* ──────────── DRIVER STATS (if any trips) ──────────── */}
        {!loading && (summary?.rides.totalTrips ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver Stats</Text>
            <View style={[styles.driverCard]}>
              <LinearGradient colors={[NAVY, "#1A3260"]} style={styles.driverGrad}>
                <View style={styles.driverRow}>
                  <View style={styles.driverStat}>
                    <Ionicons name="car-outline" size={22} color={GOLD} />
                    <Text style={styles.driverStatNum}>{summary?.rides.totalTrips}</Text>
                    <Text style={styles.driverStatLabel}>Total Trips</Text>
                  </View>
                  <View style={styles.driverDivider} />
                  <View style={styles.driverStat}>
                    <Ionicons name="cash-outline" size={22} color={GOLD} />
                    <Text style={styles.driverStatNum}>{fmtCurrency(summary?.rides.todayEarnings ?? 0)}</Text>
                    <Text style={styles.driverStatLabel}>Today Earned</Text>
                  </View>
                  <View style={styles.driverDivider} />
                  <View style={styles.driverStat}>
                    <Ionicons name="wallet-outline" size={22} color={GOLD} />
                    <Text style={styles.driverStatNum}>{fmtCurrency(summary?.earnings.rideEarnings ?? 0)}</Text>
                    <Text style={styles.driverStatLabel}>All-Time Rides</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* ──────────── QUICK ACTIONS ──────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            {/* Add Listing */}
            <Pressable onPress={() => router.push("/add-listing")} style={styles.actionCard}>
              <View style={[styles.actionIconBox, { backgroundColor: `${ORANGE}18` }]}>
                <Ionicons name="add-circle-outline" size={22} color={ORANGE} />
              </View>
              <Text style={styles.actionLabel}>Add Listing</Text>
            </Pressable>

            {/* Go Online — only enabled if provider has at least one car listing */}
            {(() => {
              const hasCarListing = !loading && listings.some((l: any) => l.category === "cars");
              return (
                <Pressable
                  onPress={() => {
                    if (!hasCarListing) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      Alert.alert(
                        "No Car Listed",
                        "You need to add at least one car listing before you can go online and accept rides.",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Add Car", onPress: () => router.push("/add-listing") },
                        ]
                      );
                      return;
                    }
                    router.push("/(tabs)/cars");
                  }}
                  style={[styles.actionCard, !hasCarListing && styles.actionCardDisabled]}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: hasCarListing ? "#05996918" : "#9CA3AF18" }]}>
                    <Ionicons name="car-outline" size={22} color={hasCarListing ? "#059669" : "#9CA3AF"} />
                  </View>
                  <Text style={[styles.actionLabel, !hasCarListing && { color: "#9CA3AF" }]}>Go Online</Text>
                  {!hasCarListing && !loading && (
                    <Text style={styles.actionDisabledHint}>No car listed</Text>
                  )}
                </Pressable>
              );
            })()}

            {/* Messages */}
            <Pressable onPress={() => router.push("/(tabs)/messages")} style={styles.actionCard}>
              <View style={[styles.actionIconBox, { backgroundColor: "#2563EB18" }]}>
                <Ionicons name="chatbubbles-outline" size={22} color="#2563EB" />
              </View>
              <Text style={styles.actionLabel}>Messages</Text>
            </Pressable>

            {/* Reviews count badge */}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                // Scroll to reviews section handled by user seeing it below
              }}
              style={styles.actionCard}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#7C3AED18", position: "relative" }]}>
                <Ionicons name="star-outline" size={22} color="#7C3AED" />
                {reviews.length > 0 && (
                  <View style={styles.reviewsBadge}>
                    <Text style={styles.reviewsBadgeText}>{reviews.length}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionLabel}>Reviews</Text>
            </Pressable>
          </View>
        </View>

        {/* ──────────── PENDING REQUESTS ──────────── */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Requests</Text>
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>{pending.length} new</Text>
              </View>
            </View>
            {pending.map((b) => (
              <View key={b.id} style={[styles.bookingCard, styles.pendingBorder]}>
                <View style={styles.bookingLeft}>
                  {b.listing_images?.[0] ? (
                    <Image source={{ uri: b.listing_images[0] }} style={styles.bookingThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.bookingThumb, styles.thumbPlaceholder]}>
                      <Ionicons name="cube-outline" size={18} color={C.textTertiary} />
                    </View>
                  )}
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>{b.listing_title}</Text>
                  {!!b.service_type && (
                    <View style={styles.serviceTypeRow}>
                      <Ionicons name="pricetag-outline" size={11} color="#FF7A18" />
                      <Text style={styles.serviceTypeText}>{b.service_type}</Text>
                    </View>
                  )}
                  <View style={styles.bookingCustomerRow}>
                    <Ionicons name="person-circle-outline" size={13} color={C.textSecondary} />
                    <Text style={styles.bookingCustomer}>{b.customer_name}</Text>
                  </View>
                  <Text style={styles.bookingDates}>
                    {new Date(b.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {" – "}
                    {new Date(b.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {" · "}{b.total_days}d
                  </Text>
                  <Text style={styles.bookingAmount}>₹{displayAmount(b).toLocaleString("en-IN")}</Text>
                </View>
                <View style={styles.bookingBtns}>
                  <Pressable onPress={() => updateBookingStatus(b.id, "confirmed")} style={styles.confirmBtn}>
                    <Ionicons name="checkmark" size={17} color="#fff" />
                  </Pressable>
                  <Pressable onPress={() => updateBookingStatus(b.id, "cancelled")} style={styles.rejectBtn}>
                    <Ionicons name="close" size={17} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ──────────── RECENT BOOKINGS ──────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <Pressable onPress={() => router.push("/(tabs)/bookings")} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={13} color={ORANGE} />
            </Pressable>
          </View>

          {loading ? (
            [0, 1, 2].map((i) => (
              <View key={i} style={[styles.bookingCard, { marginBottom: 10 }]}>
                <SkeletonRect w={60} h={60} r={10} />
                <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                  <SkeletonRect w="80%" h={14} r={6} />
                  <SkeletonRect w="55%" h={11} r={5} />
                  <SkeletonRect w="65%" h={11} r={5} />
                </View>
              </View>
            ))
          ) : recentBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={44} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptyText}>Bookings from customers will appear here</Text>
            </View>
          ) : (
            recentBookings.filter((b) => b.status !== "pending").slice(0, 6).map((b) => {
              const needsAction = b.status === "confirmed" || b.status === "in_progress";
              const actionLabel = needsAction ? "Tap to complete job" : null;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/booking/${b.id}` as any)}
                  style={({ pressed }) => [
                    styles.bookingCard,
                    { marginBottom: 10 },
                    needsAction && { borderLeftWidth: 3, borderLeftColor: "#FF7A18" },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {b.listing_images?.[0] ? (
                    <Image source={{ uri: b.listing_images[0] }} style={styles.bookingThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.bookingThumb, styles.thumbPlaceholder]}>
                      <Ionicons name="cube-outline" size={18} color={C.textTertiary} />
                    </View>
                  )}
                  <View style={styles.bookingInfo}>
                    <View style={styles.bookingTitleRow}>
                      <Text style={[styles.bookingTitle, { flex: 1 }]} numberOfLines={1}>{b.listing_title}</Text>
                      <StatusChip status={b.status} />
                    </View>
                    {!!b.service_type && (
                      <View style={styles.serviceTypeRow}>
                        <Ionicons name="pricetag-outline" size={11} color="#FF7A18" />
                        <Text style={styles.serviceTypeText}>{b.service_type}</Text>
                      </View>
                    )}
                    <View style={styles.bookingCustomerRow}>
                      <Ionicons name="person-circle-outline" size={13} color={C.textSecondary} />
                      <Text style={styles.bookingCustomer}>{b.customer_name}</Text>
                    </View>
                    <View style={styles.bookingBottomRow}>
                      <Text style={styles.bookingDates}>
                        {new Date(b.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(b.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.bookingAmount}>₹{displayAmount(b).toLocaleString("en-IN")}</Text>
                        {actionLabel && (
                          <Text style={{ fontSize: 10, color: "#FF7A18", fontFamily: "Inter_500Medium" }}>{actionLabel}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  {needsAction && (
                    <Ionicons name="chevron-forward" size={16} color="#FF7A18" style={{ alignSelf: "center", marginLeft: 2 }} />
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* ──────────── MY LISTINGS ──────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Listings</Text>
            <Pressable onPress={() => router.push("/add-listing")} style={styles.seeAllBtn}>
              <Ionicons name="add" size={14} color={ORANGE} />
              <Text style={styles.seeAllText}>Add New</Text>
            </Pressable>
          </View>

          {loading ? (
            [0, 1].map((i) => (
              <View key={i} style={[styles.listingRow, { marginBottom: 10 }]}>
                <SkeletonRect w={76} h={76} r={0} />
                <View style={{ flex: 1, padding: 12, gap: 6 }}>
                  <SkeletonRect w="80%" h={14} r={6} />
                  <SkeletonRect w="40%" h={13} r={5} />
                  <SkeletonRect w="30%" h={20} r={6} />
                </View>
              </View>
            ))
          ) : listings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={44} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyText}>Create your first listing to start earning</Text>
              <Pressable onPress={() => router.push("/add-listing")} style={styles.createBtn}>
                <Text style={styles.createBtnText}>+ Create Listing</Text>
              </Pressable>
            </View>
          ) : (
            listings.map((l) => (
              <View key={l.id} style={styles.listingRow}>
                {l.images?.[0] ? (
                  <Image source={{ uri: l.images[0] }} style={styles.listingThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.listingThumb, styles.thumbPlaceholder]}>
                    <Ionicons name="cube-outline" size={22} color={C.textTertiary} />
                  </View>
                )}
                <View style={styles.listingInfo}>
                  <Text style={styles.listingTitle} numberOfLines={2}>{l.title}</Text>
                  <Text style={styles.listingPrice}>₹{l.price?.toLocaleString("en-IN")}/{l.priceUnit === "per_day" ? "day" : "hr"}</Text>
                  <View style={[styles.availBadge, { backgroundColor: l.isAvailable ? "#D1FAE5" : "#FEE2E2" }]}>
                    <View style={[styles.availDot, { backgroundColor: l.isAvailable ? "#059669" : "#DC2626" }]} />
                    <Text style={[styles.availText, { color: l.isAvailable ? "#059669" : "#DC2626" }]}>
                      {l.isAvailable ? "Available" : "Unavailable"}
                    </Text>
                  </View>
                </View>
                <View style={styles.listingActions}>
                  <Pressable
                    onPress={() => router.push({ pathname: "/listing/[id]", params: { id: l.id } })}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="eye-outline" size={17} color={ORANGE} />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push({ pathname: "/edit-listing", params: { id: l.id } })}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="create-outline" size={17} color="#3B82F6" />
                  </Pressable>
                  <Pressable onPress={() => deleteListing(l.id)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={17} color={C.error} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
        {/* ──────────── MY REVIEWS ──────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Reviews</Text>

          {/* Rating summary card */}
          {!loading && reviews.length > 0 && (() => {
            const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
            return (
              <View style={styles.ratingCard}>
                <View style={styles.ratingCardLeft}>
                  <Text style={styles.ratingBigNum}>{avg.toFixed(1)}</Text>
                  <StarRating rating={Math.round(avg)} size={20} />
                  <Text style={styles.ratingCardCount}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</Text>
                </View>
                <View style={styles.ratingBarWrap}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => r.rating === star).length;
                    const pct = reviews.length > 0 ? count / reviews.length : 0;
                    return (
                      <View key={star} style={styles.ratingBarRow}>
                        <Text style={styles.ratingBarLabel}>{star}</Text>
                        <Ionicons name="star" size={10} color={GOLD} />
                        <View style={styles.ratingBarTrack}>
                          <View style={[styles.ratingBarFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                        </View>
                        <Text style={styles.ratingBarCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

          {/* Review cards */}
          {loading ? (
            [0, 1].map((i) => (
              <View key={i} style={[styles.reviewCard, { marginBottom: 8 }]}>
                <SkeletonRect w={36} h={36} r={18} />
                <View style={{ flex: 1, gap: 6, marginLeft: 10 }}>
                  <SkeletonRect w="50%" h={13} r={6} />
                  <SkeletonRect w="80%" h={11} r={5} />
                </View>
              </View>
            ))
          ) : reviews.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="star-outline" size={44} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptyText}>Completed bookings will generate customer reviews here</Text>
            </View>
          ) : (
            reviews.slice(0, 10).map((r) => (
              <View key={r.id} style={[styles.reviewCard, { marginBottom: 8 }]}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>{(r.userName || "C")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.reviewTopRow}>
                    <Text style={styles.reviewUserName}>{r.userName || "Customer"}</Text>
                    <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</Text>
                  </View>
                  <StarRating rating={r.rating} size={13} />
                  {r.comment ? <Text style={styles.reviewComment} numberOfLines={3}>{r.comment}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* ──────────── TRIP HISTORY ──────────── */}
        {(trips.length > 0 || (!loading && summary && summary.rides.totalTrips > 0)) && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Trip History</Text>
              <View style={[styles.countBadge, { backgroundColor: "#7C3AED18" }]}>
                <Text style={[styles.countBadgeText, { color: "#7C3AED" }]}>{trips.length}</Text>
              </View>
            </View>

            {/* Earnings summary card */}
            {summary && (
              <View style={[styles.ratingCard, { marginBottom: 12 }]}>
                <View style={styles.ratingCardLeft}>
                  <Text style={[styles.ratingBigNum, { color: "#059669" }]}>
                    ₹{summary.earnings.rideEarnings?.toLocaleString("en-IN") ?? 0}
                  </Text>
                  <Text style={[styles.ratingCardCount, { marginTop: 4 }]}>Total Ride Earnings</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="car-outline" size={18} color="#7C3AED" />
                    <Text style={{ fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#7C3AED" }}>
                      {summary.rides.totalTrips}
                    </Text>
                  </View>
                  <Text style={styles.ratingCardCount}>Completed Trips</Text>
                </View>
              </View>
            )}

            {/* Trip cards */}
            {trips.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="car-outline" size={40} color={C.textTertiary} />
                <Text style={styles.emptyTitle}>No completed trips yet</Text>
                <Text style={styles.emptyText}>Go online and accept rides to see your trip history here</Text>
              </View>
            ) : (
              trips.slice(0, 10).map((trip: any) => (
                <View key={trip.id} style={[styles.reviewCard, { marginBottom: 8 }]}>
                  <View style={[styles.reviewAvatar, { backgroundColor: "#7C3AED20" }]}>
                    <Ionicons name="car-outline" size={18} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.reviewTopRow}>
                      <Text style={styles.reviewUserName}>{trip.other_name || "Rider"}</Text>
                      <Text style={[styles.reviewDate]}>
                        {new Date(trip.completed_at || trip.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>
                      {trip.pickup_address ? `${trip.pickup_address.substring(0, 25)}… → ` : ""}
                      {trip.drop_address?.substring(0, 25)}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="navigate-outline" size={12} color={C.textTertiary} />
                        <Text style={{ fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" }}>
                          {trip.distance_km ? `${Number(trip.distance_km).toFixed(1)} km` : "–"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="cash-outline" size={12} color="#059669" />
                        <Text style={{ fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#059669" }}>
                          ₹{Number(trip.fare || 0).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>

      <DocumentsDrawer visible={showDocsDrawer} onClose={() => setShowDocsDrawer(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F3F4F6" },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  greetingText: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular" },
  nameText: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  addListingBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  addListingBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  menuBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },

  // Role toggle
  roleToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: 3,
    marginTop: 14,
    alignSelf: "flex-start",
  },
  roleBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
  },
  roleBtnActive: { backgroundColor: "#fff" },
  roleBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  roleBtnTextActive: { color: ORANGE },

  scroll: { flex: 1 },

  // Earnings hero
  heroWrap: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  heroCard: {
    borderRadius: 22, padding: 22, overflow: "hidden",
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  heroCircle1: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -40,
  },
  heroCircle2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)", bottom: -30, left: -20,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular" },
  heroAmount: { fontSize: 40, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", marginTop: 4 },
  heroIconBox: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 14 },
  heroBottom: { flexDirection: "row", alignItems: "center" },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular" },
  heroStatValue: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff", marginTop: 3 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  growthRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },

  // Stats grid
  statsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 16, paddingTop: 12, gap: 10,
  },
  statCard: {
    width: "47.5%", borderRadius: 16, padding: 16,
    alignItems: "flex-start", gap: 6,
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statNum: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, color: "#6B7280", fontFamily: "Inter_400Regular" },

  // Driver stats
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  countBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
  driverCard: { borderRadius: 18, overflow: "hidden", shadowColor: NAVY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  driverGrad: { padding: 20 },
  referBanner:     { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: "hidden", elevation: 4, shadowColor: "#FF7A18", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
  referBannerGrad: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  referBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  referBannerTitle: { fontSize: 14, fontWeight: "800", fontFamily: "Inter_700Bold", color: "#fff" },
  referBannerSub:   { fontSize: 11, color: "rgba(255,255,255,0.88)", fontFamily: "Inter_400Regular", marginTop: 2 },
  referBannerCta:   { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  referBannerCtaTxt: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  driverRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  driverStat: { alignItems: "center", gap: 5 },
  driverStatNum: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  driverStatLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular" },
  driverDivider: { width: 1, height: 44, backgroundColor: "rgba(255,255,255,0.18)" },

  // Quick actions
  actionsRow: { flexDirection: "row", gap: 10 },
  actionCard: {
    flex: 1, alignItems: "center", gap: 6, padding: 12,
    backgroundColor: "#fff", borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  actionCardDisabled: { backgroundColor: "#F9FAFB", opacity: 0.75 },
  actionIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#374151", textAlign: "center" },
  actionDisabledHint: { fontSize: 9, color: "#9CA3AF", fontFamily: "Inter_400Regular", textAlign: "center" },
  reviewsBadge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: "#7C3AED", borderRadius: 8,
    minWidth: 16, height: 16, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  reviewsBadgeText: { fontSize: 9, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },

  // Urgent badge
  urgentBadge: { backgroundColor: "#FEF2F2", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  urgentBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#DC2626" },

  // See all btn
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: ORANGE },

  // Booking cards
  bookingCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  pendingBorder: { borderLeftWidth: 3, borderLeftColor: ORANGE, marginBottom: 10 },
  bookingLeft: {},
  bookingThumb: { width: 60, height: 60, borderRadius: 10 },
  thumbPlaceholder: { backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  bookingInfo: { flex: 1, gap: 3 },
  bookingTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bookingTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#111827" },
  bookingCustomerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  bookingCustomer: { fontSize: 12, color: "#6B7280", fontFamily: "Inter_400Regular" },
  serviceTypeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  serviceTypeText: { fontSize: 11, color: "#FF7A18", fontFamily: "Inter_500Medium" },
  bookingDates: { fontSize: 11, color: "#9CA3AF", fontFamily: "Inter_400Regular" },
  bookingBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 1 },
  bookingAmount: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  bookingBtns: { gap: 6 },
  confirmBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: "#059669",
    alignItems: "center", justifyContent: "center",
  },
  rejectBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
  },

  // Status chip
  chip: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Listings
  listingRow: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 14,
    overflow: "hidden", marginBottom: 10, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  listingThumb: { width: 76, height: 76 },
  listingInfo: { flex: 1, padding: 12, gap: 4 },
  listingTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#111827" },
  listingPrice: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  availBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 10, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  listingActions: { paddingRight: 12, gap: 6 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: "#F9FAFB",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#E5E7EB",
  },

  // Empty state
  emptyCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 32,
    alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#111827" },
  emptyText: { fontSize: 13, color: "#6B7280", fontFamily: "Inter_400Regular", textAlign: "center" },
  createBtn: { backgroundColor: ORANGE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11, marginTop: 8 },
  createBtnText: { color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Rating summary card
  ratingCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 18,
    flexDirection: "row", alignItems: "center", gap: 16,
    marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  ratingCardLeft: { alignItems: "center", gap: 4, minWidth: 68 },
  ratingBigNum: { fontSize: 44, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE, lineHeight: 52 },
  ratingCardCount: { fontSize: 11, color: "#6B7280", fontFamily: "Inter_400Regular", textAlign: "center" },
  ratingBarWrap: { flex: 1, gap: 5 },
  ratingBarRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  ratingBarLabel: { fontSize: 11, color: "#374151", fontFamily: "Inter_600SemiBold", width: 9, textAlign: "right" },
  ratingBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#F3F4F6", overflow: "hidden" },
  ratingBarFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
  ratingBarCount: { fontSize: 11, color: "#9CA3AF", fontFamily: "Inter_400Regular", width: 16, textAlign: "right" },

  // Review cards
  reviewCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  reviewAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: `${ORANGE}18`,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reviewAvatarText: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: ORANGE },
  reviewTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  reviewUserName: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#111827" },
  reviewDate: { fontSize: 11, color: "#9CA3AF", fontFamily: "Inter_400Regular" },
  reviewComment: { fontSize: 13, color: "#6B7280", fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 5 },
});
