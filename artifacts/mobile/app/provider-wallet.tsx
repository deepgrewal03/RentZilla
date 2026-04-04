import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;
const ORANGE  = "#FF7A18";
const ORANGE2 = "#FF9F43";
const GREEN   = "#22C55E";
const PURPLE  = "#6366F1";

type Tx = {
  id: string; type: string; amount: number; balanceAfter: number;
  description: string; referenceId?: string; status: string; createdAt: string;
};
type Payout = {
  id: string; amount: number; method: string; upiId?: string;
  status: string; processedAt?: string; createdAt: string; notes?: string;
};
type ProviderWallet = {
  balance: number; payoutPreference: string; upiId?: string;
  monthEarnings: number; totalEarnings: number; pendingPayouts: number;
  transactions: Tx[]; payouts: Payout[];
};

const TX_ICONS: Record<string, { icon: string; color: string }> = {
  earning: { icon: "cash",              color: GREEN   },
  payout:  { icon: "send",             color: PURPLE  },
  topup:   { icon: "arrow-down-circle", color: GREEN   },
  refund:  { icon: "refresh-circle",   color: "#F59E0B" },
};

const PREF_OPTIONS = [
  { id: "instant", label: "Instant Payout", sub: "Pay to UPI immediately", icon: "flash-outline" },
  { id: "weekly",  label: "Weekly Payout",  sub: "Every Monday 9 AM",      icon: "calendar-outline" },
  { id: "wallet",  label: "Keep in Wallet", sub: "Accumulate earnings",    icon: "wallet-outline" },
];

const STATUS_COLORS: Record<string, string> = {
  pending:    "#F59E0B",
  processing: "#6366F1",
  completed:  GREEN,
  failed:     "#EF4444",
};

export default function ProviderWalletScreen() {
  const { get, post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [wallet, setWallet] = useState<ProviderWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"transactions" | "payouts">("transactions");

  // Payout fields
  const [payoutUpi, setPayoutUpi] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payingOut, setPayingOut] = useState(false);
  const [savingPref, setSavingPref] = useState(false);

  async function fetchWallet() {
    try {
      const data = await get<ProviderWallet>("/wallet/provider");
      setWallet(data);
      if (data.upiId) setPayoutUpi(data.upiId);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { fetchWallet(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchWallet(); }, []);

  async function handleInstantPayout() {
    const amt = parseFloat(payoutAmount);
    if (!amt || amt <= 0) { Alert.alert("Invalid amount", "Enter the amount to withdraw"); return; }
    if (!payoutUpi.trim()) { Alert.alert("UPI ID required", "Enter your UPI ID to receive the payout"); return; }
    if (wallet && amt > wallet.balance) {
      Alert.alert("Insufficient balance", `You have ₹${wallet.balance.toLocaleString("en-IN")} available`); return;
    }
    setPayingOut(true);
    try {
      const data = await post<{ newBalance: number; message: string }>("/wallet/provider/payout/instant", {
        amount: amt, upiId: payoutUpi.trim(),
      });
      Alert.alert("Payout Initiated!", data.message);
      setPayoutAmount("");
      fetchWallet();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Payout failed. Try again.");
    } finally { setPayingOut(false); }
  }

  async function handleSetPreference(pref: string) {
    if (!wallet) return;
    setSavingPref(true);
    try {
      await post("/wallet/provider/payout/schedule", { preference: pref, upiId: payoutUpi.trim() || undefined });
      setWallet({ ...wallet, payoutPreference: pref });
      Alert.alert("Saved", `Payout preference updated to: ${pref}`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save preference.");
    } finally { setSavingPref(false); }
  }

  function TxRow({ item }: { item: Tx }) {
    const meta = TX_ICONS[item.type] || { icon: "ellipse-outline", color: C.textSecondary };
    const isCredit = ["earning", "topup", "refund"].includes(item.type);
    const d = new Date(item.createdAt);
    return (
      <View style={s.txRow}>
        <View style={[s.txIcon, { backgroundColor: meta.color + "18" }]}>
          <Ionicons name={meta.icon as any} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.txLabel} numberOfLines={1}>{item.description || item.type}</Text>
          <Text style={s.txDate}>{d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Text>
        </View>
        <Text style={[s.txAmount, { color: isCredit ? GREEN : "#EF4444" }]}>
          {isCredit ? "+" : "-"}₹{Math.abs(item.amount).toLocaleString("en-IN")}
        </Text>
      </View>
    );
  }

  function PayoutRow({ item }: { item: Payout }) {
    const statusColor = STATUS_COLORS[item.status] || C.textSecondary;
    const d = new Date(item.createdAt);
    return (
      <View style={s.txRow}>
        <View style={[s.txIcon, { backgroundColor: PURPLE + "18" }]}>
          <Ionicons name="send-outline" size={18} color={PURPLE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.txLabel}>Payout {item.method === "instant" ? "· Instant" : "· Weekly"}</Text>
          {item.upiId ? <Text style={s.txDate}>UPI: {item.upiId}</Text> : null}
          <Text style={s.txDate}>{d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[s.txAmount, { color: "#EF4444" }]}>-₹{item.amount.toLocaleString("en-IN")}</Text>
          <View style={[s.statusBadge, { backgroundColor: statusColor + "18" }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: topPad, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    );
  }

  const w = wallet!;

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>Earnings & Payouts</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={activeTab === "transactions" ? w.transactions : w.payouts}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        ListHeaderComponent={
          <>
            {/* Balance Card */}
            <LinearGradient colors={["#0F1F3D", "#1a3a6b"]} style={s.balanceCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={s.balanceLabel}>Wallet Balance</Text>
              <Text style={s.balanceAmount}>₹{w.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text>
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={s.statValue}>₹{w.monthEarnings.toLocaleString("en-IN")}</Text>
                  <Text style={s.statLabel}>This Month</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statValue}>₹{w.totalEarnings.toLocaleString("en-IN")}</Text>
                  <Text style={s.statLabel}>All Time</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: "#F59E0B" }]}>₹{w.pendingPayouts.toLocaleString("en-IN")}</Text>
                  <Text style={s.statLabel}>Pending</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Instant Payout Panel */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="flash-outline" size={18} color={ORANGE} />
                <Text style={s.cardTitle}>Instant Payout</Text>
              </View>
              <Text style={s.cardSub}>Withdraw to your UPI instantly</Text>

              <Text style={s.fieldLabel}>UPI ID</Text>
              <TextInput
                style={s.input}
                value={payoutUpi}
                onChangeText={setPayoutUpi}
                placeholder="name@upi or phone@paytm"
                placeholderTextColor={C.textTertiary}
                autoCapitalize="none"
              />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Amount</Text>
              <View style={s.amtRow}>
                <Text style={s.rupee}>₹</Text>
                <TextInput
                  style={[s.input, { flex: 1, borderWidth: 0, paddingLeft: 0 }]}
                  value={payoutAmount}
                  onChangeText={v => setPayoutAmount(v.replace(/[^0-9.]/g, ""))}
                  placeholder={`Max ₹${w.balance.toLocaleString("en-IN")}`}
                  placeholderTextColor={C.textTertiary}
                  keyboardType="decimal-pad"
                />
                <Pressable style={s.maxBtn} onPress={() => setPayoutAmount(String(w.balance))}>
                  <Text style={s.maxBtnText}>MAX</Text>
                </Pressable>
              </View>

              <Pressable style={[s.payoutBtn, payingOut && { opacity: 0.6 }]} onPress={handleInstantPayout} disabled={payingOut}>
                {payingOut ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#fff" />
                    <Text style={s.payoutBtnText}>Withdraw Now</Text>
                  </>
                )}
              </Pressable>
              <Text style={s.payoutNote}>Typically arrives within 30 minutes • 1% instant fee applies</Text>
            </View>

            {/* Payout Preference */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="settings-outline" size={18} color={ORANGE} />
                <Text style={s.cardTitle}>Payout Schedule</Text>
                {savingPref && <ActivityIndicator size="small" color={ORANGE} style={{ marginLeft: "auto" }} />}
              </View>
              <Text style={s.cardSub}>How should earnings be released after each job?</Text>
              {PREF_OPTIONS.map(opt => (
                <Pressable key={opt.id}
                  style={[s.prefCard, w.payoutPreference === opt.id && s.prefCardActive]}
                  onPress={() => handleSetPreference(opt.id)}>
                  <Ionicons name={opt.icon as any} size={20} color={w.payoutPreference === opt.id ? ORANGE : C.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.prefLabel, w.payoutPreference === opt.id && { color: ORANGE }]}>{opt.label}</Text>
                    <Text style={s.prefSub}>{opt.sub}</Text>
                  </View>
                  {w.payoutPreference === opt.id && (
                    <Ionicons name="checkmark-circle" size={20} color={ORANGE} />
                  )}
                </Pressable>
              ))}
            </View>

            {/* Tab selector */}
            <View style={s.tabs}>
              <Pressable style={[s.tab, activeTab === "transactions" && s.tabActive]} onPress={() => setActiveTab("transactions")}>
                <Text style={[s.tabText, activeTab === "transactions" && s.tabTextActive]}>Transactions ({w.transactions.length})</Text>
              </Pressable>
              <Pressable style={[s.tab, activeTab === "payouts" && s.tabActive]} onPress={() => setActiveTab("payouts")}>
                <Text style={[s.tabText, activeTab === "payouts" && s.tabTextActive]}>Payouts ({w.payouts.length})</Text>
              </Pressable>
            </View>

            {((activeTab === "transactions" && w.transactions.length === 0) ||
              (activeTab === "payouts" && w.payouts.length === 0)) && (
              <View style={s.emptyWrap}>
                <Ionicons name={activeTab === "transactions" ? "receipt-outline" : "send-outline"} size={36} color={C.textTertiary} />
                <Text style={s.emptyText}>No {activeTab} yet</Text>
                <Text style={s.emptySub}>Complete jobs to start earning</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) =>
          activeTab === "transactions"
            ? <TxRow item={item as Tx} />
            : <PayoutRow item={item as Payout} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#0F1F3D",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },

  balanceCard: { margin: 16, borderRadius: 20, padding: 24 },
  balanceLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium", marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -1, marginBottom: 20 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 2 },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  statDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },

  card: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: "#fff",
    borderRadius: 16, padding: 18,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, marginBottom: 14 },

  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    fontFamily: "Inter_400Regular", color: "#2C2C2C", backgroundColor: "#F9FAFB",
  },
  amtRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 12, backgroundColor: "#F9FAFB",
  },
  rupee: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#374151", marginRight: 4 },
  maxBtn: { backgroundColor: ORANGE + "18", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  maxBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", color: ORANGE },
  payoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 13, marginTop: 14,
  },
  payoutBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  payoutNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", marginTop: 6 },

  prefCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
    borderColor: "#E5E7EB", marginBottom: 8,
  },
  prefCardActive: { borderColor: ORANGE, backgroundColor: ORANGE + "08" },
  prefLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  prefSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary },

  tabs: { flexDirection: "row", marginHorizontal: 16, marginTop: 8, marginBottom: 2, backgroundColor: "#E5E7EB", borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  tabTextActive: { color: "#2C2C2C" },

  txRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16,
    paddingVertical: 14, backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 8, borderRadius: 14,
  },
  txIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  txLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#2C2C2C", marginBottom: 2 },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  emptyWrap: { alignItems: "center", paddingVertical: 36, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textTertiary },
});
