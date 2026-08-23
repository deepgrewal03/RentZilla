import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useApi } from "@/hooks/useApi";

interface VaultPromo {
  id: string;
  type: string;
  discountValue: number;
  discountType: string;
  description: string;
  expiryDate: string;
  createdAt: string;
}

const DISCOUNT_COLORS: Record<number, { bg: string; border: string; text: string; grad: [string, string] }> = {
  5:  { bg: "#FFF0F2", border: "#FF8FA3", text: "#880018", grad: ["#FFB3BA", "#FF8FA3"] },
  10: { bg: "#FFF8EE", border: "#FFBA4D", text: "#7A3D00", grad: ["#FFD9A0", "#FFBA4D"] },
  15: { bg: "#FFFEF0", border: "#E0DC00", text: "#5A5000", grad: ["#FEFFC0", "#E0DC00"] },
  20: { bg: "#F0FFF0", border: "#48C748", text: "#1A5A1A", grad: ["#C8F5C8", "#48C748"] },
  25: { bg: "#F0FCFF", border: "#2ECBF5", text: "#0A5A75", grad: ["#BFF0FF", "#2ECBF5"] },
  30: { bg: "#F5F0FF", border: "#9D6FFF", text: "#3D0099", grad: ["#E0D0FF", "#9D6FFF"] },
};

function daysLeft(isoDate: string): string {
  const diff = Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000);
  if (diff <= 0) return "Expired";
  if (diff === 1) return "Expires today!";
  return `${diff} days left`;
}

export default function PromoVault() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { get } = useApi();
  const [promos,     setPromos]     = useState<VaultPromo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await get<{ promos: VaultPromo[] }>("/promos/vault");
      setPromos(data.promos || []);
    } catch { /* silent */ } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [get]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const typeIcon = (t: string) => t === "wheel" ? "🎡" : t === "referral" ? "👥" : "🎉";

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.hTitle}>Promo Vault</Text>
          <Text style={s.hSub}>{promos.length} active discount{promos.length !== 1 ? "s" : ""}</Text>
        </View>
        <View style={s.vaultIcon}>
          <Text style={{ fontSize: 24 }}>🏆</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#FF7A18" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF7A18" />}
          showsVerticalScrollIndicator={false}
        >
          {promos.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 52 }}>🎁</Text>
              <Text style={s.emptyTitle}>No promos yet</Text>
              <Text style={s.emptySub}>Your referral bonuses and earned discounts will appear here.</Text>
            </View>
          ) : (
            <>
              <Text style={s.sectionLabel}>Use during checkout · Best discount shown first</Text>
              {promos.map(p => {
                const c = DISCOUNT_COLORS[p.discountValue] || DISCOUNT_COLORS[5];
                const urgency = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
                return (
                  <View key={p.id} style={[s.card, { borderColor: c.border }]}>
                    <LinearGradient
                      colors={[c.grad[0] + "55", c.grad[1] + "22"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.cardGrad}
                    >
                      <View style={s.cardLeft}>
                        <View style={[s.discBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
                          <Text style={[s.discPct, { color: c.text }]}>{p.discountValue}%</Text>
                          <Text style={[s.discOff, { color: c.text }]}>OFF</Text>
                        </View>
                        <View style={s.cardInfo}>
                          <View style={s.typeRow}>
                            <Text style={s.typeEmoji}>{typeIcon(p.type)}</Text>
                            <Text style={s.typeLabel}>{p.type === "wheel" ? "Wheel Reward" : p.type === "referral" ? "Referral Bonus" : "Festive Reward"}</Text>
                          </View>
                          <Text style={s.cardDesc}>{p.description}</Text>
                          <Text style={s.cardSub}>Applies to first ₹100 of booking</Text>
                        </View>
                      </View>
                      <View style={s.cardRight}>
                        <View style={[s.expiryBadge, urgency <= 3 ? s.expiryUrgent : s.expiryNormal]}>
                          <Ionicons name="time-outline" size={11} color={urgency <= 3 ? "#C0392B" : "#555"} />
                          <Text style={[s.expiryTxt, urgency <= 3 ? { color: "#C0392B" } : {}]}>{daysLeft(p.expiryDate)}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                );
              })}
              <View style={s.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color="#888" />
                <Text style={s.infoTxt}>Promos are auto-applied at checkout. Max 2 discounts per booking (Gold counts as 1).</Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 20 },
  backBtn:{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: 18, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  hSub:   { fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular" },
  vaultIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body:   { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, color: "#888", fontFamily: "Inter_400Regular", marginBottom: 12, textAlign: "center" },

  empty:      { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  emptySub:   { fontSize: 13, color: "#888", fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },

  card:     { borderRadius: 18, borderWidth: 1.5, overflow: "hidden", marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardGrad: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  cardInfo: { flex: 1, gap: 3 },
  typeRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  typeEmoji: { fontSize: 13 },
  typeLabel: { fontSize: 11, fontWeight: "600", color: "#555", fontFamily: "Inter_600SemiBold" },
  cardDesc:  { fontSize: 13, fontWeight: "700", color: "#2C2C2C", fontFamily: "Inter_700Bold" },
  cardSub:   { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular" },

  discBadge: { width: 56, height: 56, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  discPct:   { fontSize: 18, fontWeight: "900", fontFamily: "Inter_700Bold" },
  discOff:   { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", marginTop: -2 },

  cardRight:   { alignItems: "flex-end", gap: 4 },
  expiryBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  expiryNormal: { backgroundColor: "#F2F2F2" },
  expiryUrgent: { backgroundColor: "#FEE9E7" },
  expiryTxt:   { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#555" },

  infoBox: { flexDirection: "row", gap: 8, backgroundColor: "#F0F0F0", borderRadius: 12, padding: 12, marginTop: 4, alignItems: "flex-start" },
  infoTxt: { flex: 1, fontSize: 12, color: "#666", fontFamily: "Inter_400Regular", lineHeight: 17 },
});
