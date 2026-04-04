import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;
const ORANGE = "#FF7A18";
const ORANGE2 = "#FF9F43";

type WalletTx = {
  id: string; type: string; amount: number; balanceAfter: number;
  description: string; referenceId?: string; status: string; createdAt: string;
};

const TX_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  topup:   { icon: "arrow-down-circle",   color: "#22C55E", label: "Top-up" },
  earning: { icon: "cash",                color: "#22C55E", label: "Earning" },
  payment: { icon: "arrow-up-circle",     color: "#EF4444", label: "Payment" },
  payout:  { icon: "send",               color: "#6366F1", label: "Payout" },
  refund:  { icon: "refresh-circle",      color: "#F59E0B", label: "Refund" },
};

const PAY_METHODS = [
  { id: "upi",    label: "UPI",           icon: "phone-portrait-outline" },
  { id: "card",   label: "Debit/Credit",  icon: "card-outline" },
  { id: "netbanking", label: "Net Banking", icon: "business-outline" },
];

export default function WalletScreen() {
  const { get, post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Top-up sheet
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [payMethod, setPayMethod] = useState("upi");
  const [topping, setTopping] = useState(false);

  async function fetchWallet() {
    try {
      const data = await get<{ balance: number; transactions: WalletTx[] }>("/wallet");
      setBalance(data.balance || 0);
      setTransactions(data.transactions || []);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { fetchWallet(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchWallet(); }, []);

  async function handleTopup() {
    const amt = parseFloat(topupAmount);
    if (!amt || amt < 1) { Alert.alert("Invalid amount", "Minimum top-up is ₹1"); return; }
    if (amt > 100000) { Alert.alert("Invalid amount", "Maximum top-up is ₹1,00,000"); return; }
    setTopping(true);
    try {
      const data = await post<{ balance: number; message: string }>("/wallet/topup", {
        amount: amt, method: payMethod,
      });
      setBalance(data.balance);
      setShowTopup(false);
      setTopupAmount("");
      Alert.alert("Success!", `₹${amt.toLocaleString("en-IN")} added to your wallet.`);
      fetchWallet();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Top-up failed. Please try again.");
    } finally { setTopping(false); }
  }

  const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

  function TxRow({ item }: { item: WalletTx }) {
    const meta = TX_ICONS[item.type] || { icon: "ellipse-outline", color: C.textSecondary, label: item.type };
    const isCredit = ["topup", "earning", "refund"].includes(item.type);
    const d = new Date(item.createdAt);
    return (
      <View style={s.txRow}>
        <View style={[s.txIconWrap, { backgroundColor: meta.color + "18" }]}>
          <Ionicons name={meta.icon as any} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.txLabel}>{item.description || meta.label}</Text>
          <Text style={s.txDate}>{d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[s.txAmount, { color: isCredit ? "#22C55E" : "#EF4444" }]}>
            {isCredit ? "+" : "-"}₹{Math.abs(item.amount).toLocaleString("en-IN")}
          </Text>
          <Text style={s.txBalance}>Bal: ₹{item.balanceAfter.toLocaleString("en-IN")}</Text>
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

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>My Wallet</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={t => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        ListHeaderComponent={
          <>
            {/* Balance Card */}
            <LinearGradient colors={[ORANGE, ORANGE2]} style={s.balanceCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={s.balanceCardInner}>
                <Text style={s.balanceLabel}>Available Balance</Text>
                <Text style={s.balanceAmount}>₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text>
                <View style={s.balanceMeta}>
                  <Ionicons name="shield-checkmark" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={s.balanceMetaText}>Secure RentZilla Wallet</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Add Money Button */}
            <Pressable style={s.topupBtn} onPress={() => setShowTopup(true)}>
              <Ionicons name="add-circle-outline" size={20} color={ORANGE} />
              <Text style={s.topupBtnText}>Add Money</Text>
            </Pressable>

            {/* Top-up Sheet */}
            {showTopup && (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={s.topupSheet}>
                  <Text style={s.topupTitle}>Add Money to Wallet</Text>

                  {/* Quick amounts */}
                  <View style={s.quickRow}>
                    {QUICK_AMOUNTS.map(a => (
                      <Pressable key={a} style={[s.quickBtn, topupAmount === String(a) && s.quickBtnActive]}
                        onPress={() => setTopupAmount(String(a))}>
                        <Text style={[s.quickBtnText, topupAmount === String(a) && s.quickBtnTextActive]}>
                          ₹{a.toLocaleString("en-IN")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={s.topupFieldLabel}>Or enter amount</Text>
                  <View style={s.topupInputRow}>
                    <Text style={s.topupRupee}>₹</Text>
                    <TextInput style={s.topupInput} value={topupAmount}
                      onChangeText={v => setTopupAmount(v.replace(/[^0-9]/g, ""))}
                      placeholder="Enter amount" placeholderTextColor={C.textTertiary}
                      keyboardType="number-pad" />
                  </View>

                  <Text style={[s.topupFieldLabel, { marginTop: 14 }]}>Payment method</Text>
                  <View style={s.methodRow}>
                    {PAY_METHODS.map(m => (
                      <Pressable key={m.id} style={[s.methodBtn, payMethod === m.id && s.methodBtnActive]}
                        onPress={() => setPayMethod(m.id)}>
                        <Ionicons name={m.icon as any} size={16} color={payMethod === m.id ? ORANGE : C.textSecondary} />
                        <Text style={[s.methodBtnText, payMethod === m.id && { color: ORANGE }]}>{m.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={s.topupActions}>
                    <Pressable style={s.topupCancelBtn} onPress={() => { setShowTopup(false); setTopupAmount(""); }}>
                      <Text style={s.topupCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={[s.topupConfirmBtn, topping && { opacity: 0.6 }]} onPress={handleTopup} disabled={topping}>
                      {topping ? <ActivityIndicator color="#fff" size="small" /> : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                          <Text style={s.topupConfirmText}>Add ₹{parseFloat(topupAmount || "0").toLocaleString("en-IN") || "0"}</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}

            {/* Transactions header */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Transactions</Text>
              {transactions.length > 0 && (
                <Text style={s.sectionCount}>{transactions.length} records</Text>
              )}
            </View>
            {transactions.length === 0 && (
              <View style={s.emptyWrap}>
                <Ionicons name="receipt-outline" size={40} color={C.textTertiary} />
                <Text style={s.emptyText}>No transactions yet</Text>
                <Text style={s.emptySub}>Add money to get started</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => <TxRow item={item} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: ORANGE,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },

  balanceCard: { margin: 16, borderRadius: 20, overflow: "hidden", elevation: 4, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  balanceCardInner: { padding: 28, alignItems: "center" },
  balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_500Medium", marginBottom: 8 },
  balanceAmount: { fontSize: 38, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -1 },
  balanceMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  balanceMetaText: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular" },

  topupBtn: {
    marginHorizontal: 16, marginBottom: 4, backgroundColor: "#fff",
    borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: ORANGE,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  topupBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: ORANGE },

  topupSheet: { margin: 16, backgroundColor: "#fff", borderRadius: 18, padding: 20, elevation: 3 },
  topupTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#2C2C2C", marginBottom: 16 },
  quickRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  quickBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center" },
  quickBtnActive: { borderColor: ORANGE, backgroundColor: ORANGE + "12" },
  quickBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  quickBtnTextActive: { color: ORANGE },
  topupFieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 6 },
  topupInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "#F9FAFB" },
  topupRupee: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#374151", marginRight: 4 },
  topupInput: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#2C2C2C", paddingVertical: 10 },
  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: { flex: 1, flexDirection: "column", alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB", gap: 4 },
  methodBtnActive: { borderColor: ORANGE, backgroundColor: ORANGE + "10" },
  methodBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary },
  topupActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  topupCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center" },
  topupCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  topupConfirmBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: ORANGE },
  topupConfirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  sectionCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary },

  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 8, borderRadius: 14 },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  txLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#2C2C2C", marginBottom: 2 },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary },
  txAmount: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  txBalance: { fontSize: 10, fontFamily: "Inter_400Regular", color: C.textSecondary },

  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textTertiary },
});
