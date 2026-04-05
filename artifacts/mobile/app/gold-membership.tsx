import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Pressable,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import GlowButton from "@/components/GlowButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/hooks/useApi";

const GOLD = "#F5C518";
const GOLD2 = "#FFE066";
const GOLD3 = "#B8860B";
const DARK = "#0D0D0D";
const DARK2 = "#1A1A1A";
const DARK3 = "#242424";

type MembershipStatus = {
  isGoldMember: boolean;
  activatedAt: string | null;
  totalSaved: number;
  purchaseAmount: number;
  discountPercent: number;
};

const BENEFITS = [
  { icon: "pricetag", title: "4% Off Every Booking", desc: "Automatic discount applied at checkout — no codes needed." },
  { icon: "trophy", title: "Gold Badge", desc: "Exclusive badge on your profile, wallet and listings." },
  { icon: "flash", title: "Lifetime Access", desc: "One-time payment. Never pay again. Forever yours." },
  { icon: "star", title: "Priority Support", desc: "Your queries jump to the front of the queue." },
  { icon: "shield-checkmark", title: "Member-Only Offers", desc: "Exclusive deals and early access to new features." },
];

export default function GoldMembershipScreen() {
  const { get, post } = useApi();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const shimmer = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchStatus();
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  async function fetchStatus() {
    try {
      const data = await get<MembershipStatus>("/membership/status");
      setStatus(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handlePurchase() {
    if (!status) return;
    if (status.isGoldMember) {
      Alert.alert("Already Gold! 🏆", "You already have the Gold Membership. Enjoy your 4% discount on every booking!");
      return;
    }
    Alert.alert(
      "Unlock Gold Membership",
      `Only ₹${status.purchaseAmount} will be deducted from your wallet. This is a one-time lifetime purchase!`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlock for ₹" + status.purchaseAmount,
          onPress: async () => {
            setPurchasing(true);
            try {
              const res = await post<{ message: string; newWalletBalance: number }>("/membership/purchase", {});
              await fetchStatus();
              Alert.alert("🏆 You're Gold!", res.message || "Gold Membership activated. Enjoy 4% off every booking!");
            } catch (e: any) {
              const msg = e?.message || "Purchase failed";
              if (e?.code === "INSUFFICIENT_BALANCE" || msg.includes("Insufficient")) {
                Alert.alert(
                  "Insufficient Balance",
                  `You need ₹${status.purchaseAmount} in your wallet. Please top up and try again.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Top Up Wallet", onPress: () => { router.back(); router.push("/wallet"); } },
                  ]
                );
              } else {
                Alert.alert("Error", msg);
              }
            } finally { setPurchasing(false); }
          },
        },
      ]
    );
  }

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  if (loading) {
    return (
      <View style={[ss.root, { justifyContent: "center", alignItems: "center" }]}>
        <StatusBar style="light" />
        <ActivityIndicator color={GOLD} size="large" />
      </View>
    );
  }

  const isGold = status?.isGoldMember ?? false;

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={ss.header}>
        <Pressable onPress={() => router.back()} style={ss.backBtn}>
          <Ionicons name="arrow-back" size={22} color={GOLD} />
        </Pressable>
        <Text style={ss.headerTitle}>Gold Membership</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scroll}>

        {/* Hero Card */}
        <Animated.View style={[ss.heroWrap, { opacity: shimmerOpacity }]}>
          <LinearGradient
            colors={[GOLD3, GOLD, GOLD2, GOLD]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={ss.heroGrad}
          >
            {/* Crown */}
            <View style={ss.crownWrap}>
              <Ionicons name="trophy" size={52} color={DARK} />
            </View>

            {isGold ? (
              <>
                <Text style={ss.heroStatus}>ACTIVE MEMBER</Text>
                <Text style={ss.heroTitle}>You're Gold! 🏆</Text>
                <Text style={ss.heroSub}>4% off automatically applied to every booking</Text>
                {(status?.totalSaved ?? 0) > 0 && (
                  <View style={ss.savingsBadge}>
                    <Text style={ss.savingsText}>Total Saved: ₹{(status?.totalSaved ?? 0).toFixed(2)}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={ss.heroStatus}>LIFETIME ACCESS</Text>
                <Text style={ss.heroTitle}>Go Gold</Text>
                <Text style={ss.heroPriceRow}>
                  <Text style={ss.heroPrice}>₹{status?.purchaseAmount ?? "2.49"}</Text>
                  <Text style={ss.heroPriceNote}> one-time</Text>
                </Text>
                <Text style={ss.heroSub}>Never pay again — discount on every booking, forever.</Text>
              </>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Benefits */}
        <Text style={ss.sectionTitle}>What You Get</Text>
        {BENEFITS.map((b, i) => (
          <View key={i} style={ss.benefitRow}>
            <LinearGradient colors={[GOLD3, GOLD]} style={ss.benefitIcon}>
              <Ionicons name={b.icon as any} size={20} color={DARK} />
            </LinearGradient>
            <View style={ss.benefitText}>
              <Text style={ss.benefitTitle}>{b.title}</Text>
              <Text style={ss.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}

        {/* Social proof */}
        <View style={ss.proofCard}>
          <Text style={ss.proofQuote}>"Paid for itself in the first booking. Best ₹2.49 ever spent."</Text>
          <Text style={ss.proofAuthor}>— Harpreet S., Ludhiana</Text>
        </View>

        {/* CTA */}
        {!isGold ? (
          <GlowButton
            title={`Unlock Lifetime Gold for ₹${status?.purchaseAmount ?? "2.49"}`}
            color={GOLD}
            onPress={handlePurchase}
            loading={purchasing}
            disabled={purchasing}
            iconLeft={<Ionicons name="trophy" size={20} color={DARK} />}
            fullWidth
            height={58}
            fontSize={15}
            borderRadius={16}
            glowStrength={0.7}
            textStyle={{ color: DARK, fontWeight: "800" }}
            style={{ marginBottom: 12 }}
          />
        ) : (
          <View style={ss.activeChip}>
            <Ionicons name="checkmark-circle" size={20} color={GOLD} style={{ marginRight: 6 }} />
            <Text style={ss.activeChipText}>Gold Membership Active</Text>
          </View>
        )}

        {!isGold && (
          <Text style={ss.note}>Amount deducted from your RentZilla wallet. Top up if needed.</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#222",
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: GOLD },
  scroll: { paddingHorizontal: 16, paddingTop: 24 },

  heroWrap: { borderRadius: 24, overflow: "hidden", marginBottom: 32, elevation: 12,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16 },
  heroGrad: { padding: 32, alignItems: "center" },
  crownWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroStatus: { fontSize: 11, fontWeight: "800", letterSpacing: 3, color: DARK3, marginBottom: 8 },
  heroTitle: { fontSize: 36, fontWeight: "900", color: DARK, marginBottom: 8 },
  heroPriceRow: { marginBottom: 8 },
  heroPrice: { fontSize: 48, fontWeight: "900", color: DARK },
  heroPriceNote: { fontSize: 18, fontWeight: "600", color: DARK3 },
  heroSub: { fontSize: 14, fontWeight: "500", color: DARK3, textAlign: "center", lineHeight: 20 },
  savingsBadge: { marginTop: 16, backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  savingsText: { fontSize: 14, fontWeight: "700", color: DARK },

  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#FFF", marginBottom: 16 },

  benefitRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  benefitIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 15, fontWeight: "700", color: "#FFF", marginBottom: 3 },
  benefitDesc: { fontSize: 13, color: "#999", lineHeight: 19 },

  proofCard: { backgroundColor: DARK2, borderRadius: 16, padding: 20, marginVertical: 24,
    borderLeftWidth: 3, borderLeftColor: GOLD },
  proofQuote: { fontSize: 14, color: "#CCC", fontStyle: "italic", lineHeight: 22, marginBottom: 10 },
  proofAuthor: { fontSize: 12, color: GOLD, fontWeight: "600" },

  ctaWrap: { borderRadius: 16, overflow: "hidden", marginBottom: 12,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12 },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18 },
  ctaText: { fontSize: 16, fontWeight: "800", color: DARK },

  activeChip: { flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1A1A0D", borderWidth: 1.5, borderColor: GOLD,
    borderRadius: 16, paddingVertical: 16, marginBottom: 12 },
  activeChipText: { fontSize: 16, fontWeight: "700", color: GOLD },

  note: { fontSize: 12, color: "#666", textAlign: "center", lineHeight: 18 },
});
