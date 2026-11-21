import Button3D from "@/components/Button3D";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator, Alert, Animated, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/hooks/useApi";
import Colors from "@/constants/colors";

const C = Colors.light;
const ORANGE = "#FF7A18";
const GOLD = "#F5C842";
const GREEN = "#22C55E";
const NAVY = "#0F1F3D";
const THRESHOLD = 5;

type ReferralStatus = {
  referralCode: string;
  referredBy: string | null;
  totalReferred: number;
  totalCompleted: number;
  progressInCycle: number;
  threshold: number;
  rewardPercent: number;
  pendingReward: boolean;
  totalRewards: number;
  referrals: Array<{
    id: string; name: string; email: string; role: string;
    firstCompletionDone: boolean; createdAt: string;
  }>;
};

export default function ReferralScreen() {
  const { returnBookingId } = useLocalSearchParams<{ returnBookingId?: string }>();
  function returnFromReferral() {
    if (returnBookingId) router.replace({ pathname: "/booking/[id]", params: { id: returnBookingId } });
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }
  const { get, post } = useApi();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyCode, setApplyCode] = useState("");
  const [applying, setApplying] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (status) {
      Animated.timing(progressAnim, {
        toValue: Math.min(status.progressInCycle / THRESHOLD, 1),
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [status]);

  async function fetchStatus() {
    try {
      const data = await get<ReferralStatus>("/referral/status");
      setStatus(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function copyCode() {
    if (!status?.referralCode) return;
    Clipboard.setStringAsync(status.referralCode);
    Alert.alert("Copied!", `Code "${status.referralCode}" copied to clipboard.`);
  }

  async function shareWhatsApp() {
    if (!status?.referralCode) return;
    const msg = `🎁 Join RentZilla — Punjab's #1 Rental App!\n\nUse my referral code *${status.referralCode}* when you sign up to get started.\n\nDownload: https://rent-organizer.replit.app`;
    try {
      await Share.share({ message: msg, title: "Join RentZilla!" });
    } catch { /* ignore */ }
  }

  async function handleApplyCode() {
    if (!applyCode.trim()) return;
    if (status?.referredBy) {
      Alert.alert("Already Applied", "You have already used a referral code."); return;
    }
    setApplying(true);
    try {
      const res = await post<{ message: string }>("/referral/apply", { code: applyCode.trim() });
      Alert.alert("Success! 🎉", res.message);
      setApplyCode("");
      await fetchStatus();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Invalid referral code.");
    } finally { setApplying(false); }
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  if (loading) {
    return (
      <View style={[ss.root, { justifyContent: "center", alignItems: "center" }]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    );
  }

  const prog = status?.progressInCycle ?? 0;
  const remaining = THRESHOLD - prog;

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={ss.header}>
        <Pressable onPress={returnFromReferral} style={ss.backBtn} accessibilityRole="button" accessibilityLabel={returnBookingId ? "Return to booking" : "Go back"}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={ss.headerTitle}>Refer a Friend 🎁</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[ss.scroll, { paddingBottom: insets.bottom + 40 }]}>

        {/* Hero */}
        <LinearGradient colors={[ORANGE, "#FF9F43"]} style={ss.hero}>
          <Ionicons name="gift-outline" size={44} color="#fff" />
          <Text style={ss.heroTitle}>Earn Rewards Together</Text>
          <Text style={ss.heroSub}>Refer 5 friends → unlock 10% off your next booking</Text>
        </LinearGradient>

        {/* Code Card */}
        <View style={ss.card}>
          <Text style={ss.cardLabel}>Your Referral Code</Text>
          <View style={ss.codeRow}>
            <Text style={ss.code}>{status?.referralCode ?? "———"}</Text>
            <Button3D onPress={copyCode} faceStyle={ss.copyBtn}>
              <Ionicons name="copy-outline" size={20} color={ORANGE} />
              <Text style={ss.copyText}>Copy</Text>
            </Button3D>
          </View>
          <Button3D onPress={shareWhatsApp} faceStyle={ss.shareBtn}>
            <Ionicons name="share-social-outline" size={20} color="#fff" />
            <Text style={ss.shareBtnText}>Share via WhatsApp / SMS</Text>
          </Button3D>
        </View>

        {/* Progress */}
        <View style={ss.card}>
          <View style={ss.progressHeader}>
            <Text style={ss.cardLabel}>Progress This Cycle</Text>
            <Text style={ss.progressCount}>{prog} / {THRESHOLD}</Text>
          </View>
          <View style={ss.progressTrack}>
            <Animated.View style={[ss.progressFill, { width: progressWidth }]} />
          </View>
          {status?.pendingReward ? (
            <View style={ss.rewardBadge}>
              <Ionicons name="trophy" size={18} color={GOLD} />
              <Text style={ss.rewardBadgeText}>🏆 10% reward unlocked — applies on next booking!</Text>
            </View>
          ) : (
            <Text style={ss.progressMsg}>
              {remaining > 0
                ? `${remaining} more friend${remaining > 1 ? "s" : ""} needed to unlock 10% reward`
                : "Reward unlocked! 🎉"}
            </Text>
          )}
        </View>

        {/* Stats Row */}
        <View style={ss.statsRow}>
          <View style={ss.statBox}>
            <Text style={ss.statNum}>{status?.totalReferred ?? 0}</Text>
            <Text style={ss.statLabel}>Referred</Text>
          </View>
          <View style={[ss.statBox, ss.statBorder]}>
            <Text style={ss.statNum}>{status?.totalCompleted ?? 0}</Text>
            <Text style={ss.statLabel}>Completed</Text>
          </View>
          <View style={ss.statBox}>
            <Text style={ss.statNum}>{status?.totalRewards ?? 0}</Text>
            <Text style={ss.statLabel}>Rewards Earned</Text>
          </View>
        </View>

        {/* Referred Users List */}
        {(status?.referrals?.length ?? 0) > 0 && (
          <View style={ss.card}>
            <Text style={ss.cardLabel}>Friends You've Referred</Text>
            {status!.referrals.map((r) => (
              <View key={r.id} style={ss.referralRow}>
                <View style={[ss.referralDot, { backgroundColor: r.firstCompletionDone ? GREEN : "#E5E5E5" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={ss.referralName}>{r.name}</Text>
                  <Text style={ss.referralMeta}>
                    {r.firstCompletionDone ? "✅ First booking done" : "⏳ Awaiting first booking"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Apply Referral Code (if not referred yet) */}
        {!status?.referredBy && (
          <View style={ss.card}>
            <Text style={ss.cardLabel}>Were You Referred?</Text>
            <Text style={ss.applyHint}>Enter the referral code you received from a friend</Text>
            <View style={ss.applyRow}>
              <TextInput
                style={ss.applyInput}
                placeholder="Enter referral code"
                placeholderTextColor="#999"
                value={applyCode}
                onChangeText={setApplyCode}
                autoCapitalize="characters"
                returnKeyType="done"
              />
              <Button3D
                onPress={handleApplyCode}
                disabled={applying || !applyCode.trim()}
                faceStyle={[ss.applyBtn, (!applyCode.trim() || applying) && { opacity: 0.5 }]}
              >
                {applying
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={ss.applyBtnText}>Apply</Text>}
              </Button3D>
            </View>
          </View>
        )}

        {status?.referredBy && (
          <View style={ss.referredByBadge}>
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
            <Text style={ss.referredByText}>You were referred by code: {status.referredBy}</Text>
          </View>
        )}

        {/* How it works */}
        <View style={ss.card}>
          <Text style={ss.cardLabel}>How It Works</Text>
          {[
            { n: "1", t: "Share your code", d: "Send your unique code to friends via WhatsApp or SMS" },
            { n: "2", t: "Friends sign up", d: "They register on RentZilla and apply your code" },
            { n: "3", t: "They complete first booking", d: "Your friend finishes their first rental successfully" },
            { n: "4", t: "Progress tracks", d: "Each completion counts — reach 5 to unlock your reward" },
            { n: "5", t: "Get 10% off", d: "Reward auto-applies on your next booking. Cycle resets!" },
          ].map((s) => (
            <View key={s.n} style={ss.stepRow}>
              <View style={ss.stepNum}><Text style={ss.stepNumText}>{s.n}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={ss.stepTitle}>{s.t}</Text>
                <Text style={ss.stepDesc}>{s.d}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5F6FA", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: NAVY, fontFamily: "Inter_700Bold" },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  hero: { borderRadius: 20, padding: 28, alignItems: "center", marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 12, textAlign: "center" },
  heroSub: { fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 6, textAlign: "center", lineHeight: 20 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, elevation: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardLabel: { fontSize: 13, fontWeight: "700", color: "#888", letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" },

  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  code: { fontSize: 28, fontWeight: "900", color: NAVY, letterSpacing: 4, fontFamily: "Inter_700Bold" },
  copyBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF0E5", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  copyText: { color: ORANGE, fontWeight: "700", marginLeft: 4, fontSize: 13 },
  shareBtn: { backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  progressCount: { fontSize: 18, fontWeight: "800", color: NAVY },
  progressTrack: { height: 12, backgroundColor: "#F0F0F0", borderRadius: 6, overflow: "hidden", marginBottom: 10 },
  progressFill: { height: "100%", backgroundColor: ORANGE, borderRadius: 6 },
  progressMsg: { fontSize: 13, color: "#666", lineHeight: 18 },
  rewardBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFBEA", borderRadius: 10, padding: 10, gap: 8, borderWidth: 1, borderColor: GOLD },
  rewardBadgeText: { fontSize: 13, color: "#92400E", fontWeight: "600", flex: 1 },

  statsRow: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, marginBottom: 14, elevation: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#F0F0F0" },
  statNum: { fontSize: 24, fontWeight: "900", color: NAVY },
  statLabel: { fontSize: 11, color: "#888", marginTop: 3, textAlign: "center" },

  referralRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  referralDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  referralName: { fontSize: 14, fontWeight: "600", color: NAVY },
  referralMeta: { fontSize: 12, color: "#888", marginTop: 2 },

  applyHint: { fontSize: 13, color: "#888", marginBottom: 10 },
  applyRow: { flexDirection: "row", gap: 10 },
  applyInput: { flex: 1, minWidth: 0, borderWidth: 1.5, borderColor: "#E5E5E5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, fontWeight: "700", letterSpacing: 2, color: NAVY },
  applyBtn: { flexShrink: 0, minHeight: 44, backgroundColor: ORANGE, borderRadius: 12, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  referredByBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, marginBottom: 14, gap: 8, borderWidth: 1, borderColor: "#BBF7D0" },
  referredByText: { fontSize: 13, color: "#166534", fontWeight: "600", flex: 1 },

  stepRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", marginRight: 12, marginTop: 1 },
  stepNumText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  stepTitle: { fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: 3 },
  stepDesc: { fontSize: 12, color: "#888", lineHeight: 17 },
});
