import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingCard } from "@/components/ListingCard";
import { ReportForm } from "@/components/ReportForm";
import { StarRating } from "@/components/StarRating";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Listing, Review } from "@/types";

const C = Colors.light;

export default function ProviderProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get } = useApi();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [l, r] = await Promise.all([
        get<Listing[]>(`/listings?providerId=${id}`),
        get<Review[]>(`/reviews?providerId=${id}`),
      ]);
      setListings(l);
      setReviews(r);
      if (l.length > 0) setProviderName(l[0].providerName);
      if (r.length > 0) setAvgRating(r.reduce((s, rv) => s + rv.rating, 0) / r.length);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Provider Profile</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Provider card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{(providerName || "P")[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.providerName}>{providerName || "Provider"}</Text>
          {avgRating != null && (
            <View style={styles.ratingRow}>
              <StarRating rating={Math.round(avgRating)} size={18} />
              <Text style={styles.ratingText}>{avgRating.toFixed(1)} ({reviews.length} reviews)</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{listings.length}</Text>
              <Text style={styles.statLabel}>Listings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{reviews.length}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={C.tint} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Listings */}
            {listings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Listings</Text>
                {listings.map((l) => <ListingCard key={l.id} listing={l} style={styles.card} />)}
              </View>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                {reviews.map((r) => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewTop}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>{(r.userName || "U")[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewUser}>{r.userName || "User"}</Text>
                        <StarRating rating={r.rating} size={13} />
                      </View>
                      <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString("en-IN")}</Text>
                    </View>
                    {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {!loading && id && !(listings.length > 0 && user?.id === listings[0].providerId) && (
          <Pressable onPress={() => setShowReport(true)} style={styles.reportAction} testID="report-provider">
            <Ionicons name="flag-outline" size={18} color={C.textSecondary} />
            <Text style={styles.reportActionText}>Report Provider</Text>
          </Pressable>
        )}

        <View style={{ height: isWeb ? 34 : 80 }} />
      </ScrollView>
      {!!id && <ReportForm visible={showReport} onClose={() => setShowReport(false)} targetType="provider" targetId={id} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.backgroundSecondary,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  scroll: { flex: 1 },
  profileCard: {
    margin: 20,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${C.tint}20`,
    borderWidth: 3, borderColor: `${C.tint}40`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  avatarLetter: { fontSize: 32, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  providerName: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", paddingTop: 12, gap: 32 },
  statItem: { alignItems: "center", gap: 3 },
  statNum: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.tint },
  statLabel: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, backgroundColor: C.border },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text, marginBottom: 14 },
  card: { marginBottom: 14 },
  reviewCard: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder,
    padding: 12, marginBottom: 8, gap: 8,
  },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
  },
  reviewAvatarText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  reviewUser: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  reviewDate: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  reviewComment: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20 },
  reportAction: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  reportActionText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textSecondary },
});
