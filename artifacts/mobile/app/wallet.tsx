import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import GlowButton from "@/components/GlowButton";

const C = Colors.light;
const ORANGE = "#FF7A18";
const ORANGE2 = "#FF9F43";

type WalletTx = {
  id: string; type: string; amount: number; balanceAfter: number;
  description: string; referenceId?: string; status: string; createdAt: string;
};
type PayMethod = {
  id: string; type: string; label: string; maskedDisplay: string;
  isDefault: boolean; createdAt: string;
};

const TX_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  topup:          { icon: "arrow-down-circle",  color: "#22C55E", label: "Top-up"  },
  earning:        { icon: "cash",               color: "#22C55E", label: "Earning" },
  payment:        { icon: "arrow-up-circle",    color: "#EF4444", label: "Payment" },
  payout:         { icon: "send",              color: "#6366F1", label: "Payout"  },
  refund:         { icon: "refresh-circle",    color: "#F59E0B", label: "Refund"  },
  gold_membership:{ icon: "trophy",            color: "#F5C518", label: "Gold Membership" },
};

const TYPE_ICON: Record<string, string> = {
  upi: "phone-portrait-outline", card: "card-outline", bank: "business-outline",
};

export default function WalletScreen() {
  const { get, post, put, del } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGoldMember, setIsGoldMember] = useState(false);
  const [goldSaved, setGoldSaved] = useState(0);

  // Top-up sheet
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [topping, setTopping] = useState(false);

  // Add payment method form
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [addType, setAddType] = useState<"upi" | "card" | "bank">("upi");
  const [addLabel, setAddLabel] = useState("");
  const [addUpi, setAddUpi] = useState("");
  const [addCard, setAddCard] = useState("");
  const [addCardName, setAddCardName] = useState("");
  const [addCardExpiry, setAddCardExpiry] = useState("");
  const [addBank, setAddBank] = useState("");
  const [addAccount, setAddAccount] = useState("");
  const [addIfsc, setAddIfsc] = useState("");
  const [addingMethod, setAddingMethod] = useState(false);

  async function fetchWallet() {
    try {
      const [walletData, methodData, goldData] = await Promise.all([
        get<{ balance: number; transactions: WalletTx[] }>("/wallet"),
        get<{ methods: PayMethod[] }>("/wallet/payment-methods").catch(() => ({ methods: [] })),
        get<{ isGoldMember: boolean; totalSaved: number }>("/membership/status").catch(() => ({ isGoldMember: false, totalSaved: 0 })),
      ]);
      setBalance(walletData.balance || 0);
      setTransactions(walletData.transactions || []);
      setMethods(methodData.methods || []);
      setIsGoldMember(Boolean(goldData.isGoldMember));
      setGoldSaved(Number(goldData.totalSaved || 0));
      const def = methodData.methods?.find(m => m.isDefault);
      if (def && !selectedMethodId) setSelectedMethodId(def.id);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { fetchWallet(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchWallet(); }, []);

  async function handleTopup() {
    const amt = parseFloat(topupAmount);
    if (!amt || amt < 1) { Alert.alert("Invalid amount", "Minimum top-up is ₹1"); return; }
    if (amt > 100000) { Alert.alert("Invalid amount", "Maximum top-up is ₹1,00,000"); return; }
    if (!selectedMethodId && methods.length > 0) {
      Alert.alert("Select method", "Please select a payment method to continue."); return;
    }
    if (methods.length === 0) {
      Alert.alert(
        "No Payment Method",
        "Please add a payment method (UPI, card, or bank) to top up your wallet.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add Method", onPress: () => { setShowTopup(false); setShowAddMethod(true); } },
        ]
      );
      return;
    }
    setTopping(true);
    try {
      const m = methods.find(x => x.id === selectedMethodId);
      const data = await post<{ balance: number; message: string }>("/wallet/topup", {
        amount: amt,
        method: m?.type || "upi",
        paymentMethodId: selectedMethodId,
      });
      setBalance(data.balance);
      setShowTopup(false);
      setTopupAmount("");
      Alert.alert("Success!", `₹${amt.toLocaleString("en-IN")} added to your wallet securely.`);
      fetchWallet();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Top-up failed. Please try again.");
    } finally { setTopping(false); }
  }

  async function handleAddMethod() {
    if (!addLabel.trim()) { Alert.alert("Label required", "Give this method a name."); return; }
    if (addType === "upi" && !addUpi.trim()) { Alert.alert("UPI required"); return; }
    if (addType === "card" && addCard.replace(/\s/g, "").length < 12) { Alert.alert("Card number", "Enter a valid card number."); return; }
    if (addType === "bank" && (!addAccount.trim() || !addIfsc.trim())) { Alert.alert("Bank details required"); return; }

    setAddingMethod(true);
    try {
      const payload: Record<string, string> = { type: addType, label: addLabel.trim() };
      if (addType === "upi") payload.upiId = addUpi.trim();
      if (addType === "card") { payload.cardNumber = addCard.replace(/\s/g, ""); payload.cardName = addCardName; payload.cardExpiry = addCardExpiry; }
      if (addType === "bank") { payload.bankName = addBank; payload.accountNumber = addAccount; payload.ifsc = addIfsc; }

      await post("/wallet/payment-methods", payload);
      Alert.alert("Method added!", "Your payment method is securely saved (AES-256 encrypted).");
      setShowAddMethod(false);
      resetAddForm();
      fetchWallet();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save payment method.");
    } finally { setAddingMethod(false); }
  }

  function resetAddForm() {
    setAddLabel(""); setAddUpi(""); setAddCard(""); setAddCardName("");
    setAddCardExpiry(""); setAddBank(""); setAddAccount(""); setAddIfsc("");
  }

  async function handleDeleteMethod(id: string) {
    Alert.alert("Remove method?", "This payment method will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await del(`/wallet/payment-methods/${id}`);
              fetchWallet();
            } catch { Alert.alert("Error", "Could not remove method."); }
          },
        },
      ]
    );
  }

  async function handleSetDefault(id: string) {
    try {
      await put(`/wallet/payment-methods/${id}/default`, {});
      fetchWallet();
    } catch { Alert.alert("Error", "Could not update default."); }
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
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Balance Card */}
            <LinearGradient colors={[ORANGE, ORANGE2]} style={s.balanceCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={s.balanceCardInner}>
                <Text style={s.balanceLabel}>Available Balance</Text>
                <Text style={s.balanceAmount}>₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text>
                <View style={s.balanceMeta}>
                  <Ionicons name="shield-checkmark" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={s.balanceMetaText}>Secure · AES-256 Encrypted</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Gold Membership Banner */}
            <Pressable style={[s.goldBanner, isGoldMember && s.goldBannerActive]}
              onPress={() => router.push("/gold-membership")}>
              <View style={s.goldBannerLeft}>
                <Ionicons name="trophy" size={22} color="#F5C518" />
                {isGoldMember ? (
                  <View>
                    <Text style={s.goldBannerTitle}>Gold Member ✦</Text>
                    {goldSaved > 0 && <Text style={s.goldBannerSub}>Total saved: ₹{goldSaved.toFixed(2)}</Text>}
                  </View>
                ) : (
                  <View>
                    <Text style={s.goldBannerTitle}>Go Gold — ₹2.49</Text>
                    <Text style={s.goldBannerSub}>Get 4% off every booking, lifetime</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#F5C518" />
            </Pressable>

            {/* Add Money Button */}
            <GlowButton
              title="Add Money"
              color={ORANGE}
              onPress={() => setShowTopup(v => !v)}
              iconLeft={<Ionicons name="add-circle-outline" size={20} color="#fff" />}
              fullWidth
              height={48}
              fontSize={15}
              borderRadius={12}
              glowStrength={0.5}
              style={{ marginTop: 16 }}
            />

            {/* Top-up Sheet */}
            {showTopup && (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={s.sheet}>
                  <Text style={s.sheetTitle}>Add Money to Wallet</Text>

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

                  <Text style={s.fieldLabel}>Amount</Text>
                  <View style={s.amtRow}>
                    <Text style={s.rupeeSign}>₹</Text>
                    <TextInput style={s.amtInput} value={topupAmount}
                      onChangeText={v => setTopupAmount(v.replace(/[^0-9]/g, ""))}
                      placeholder="Enter amount" placeholderTextColor={C.textTertiary}
                      keyboardType="number-pad" />
                  </View>

                  {/* Payment Method Selection */}
                  <Text style={[s.fieldLabel, { marginTop: 14 }]}>Pay via</Text>
                  {methods.length === 0 ? (
                    <Pressable style={s.addMethodPrompt} onPress={() => { setShowTopup(false); setShowAddMethod(true); }}>
                      <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
                      <Text style={s.addMethodPromptText}>Add a payment method first</Text>
                    </Pressable>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 2 }}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {methods.map(m => (
                          <Pressable key={m.id}
                            style={[s.methodChip, selectedMethodId === m.id && s.methodChipActive]}
                            onPress={() => setSelectedMethodId(m.id)}>
                            <Ionicons name={TYPE_ICON[m.type] as any} size={14} color={selectedMethodId === m.id ? ORANGE : C.textSecondary} />
                            <View>
                              <Text style={[s.methodChipLabel, selectedMethodId === m.id && { color: ORANGE }]}>{m.label}</Text>
                              <Text style={s.methodChipMasked} numberOfLines={1}>{m.maskedDisplay}</Text>
                            </View>
                            {m.isDefault && <View style={s.defaultDot} />}
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  )}

                  <View style={s.sheetActions}>
                    <Pressable style={s.cancelBtn} onPress={() => { setShowTopup(false); setTopupAmount(""); }}>
                      <Text style={s.cancelText}>Cancel</Text>
                    </Pressable>
                    <GlowButton
                      title={`Add ₹${parseFloat(topupAmount || "0").toLocaleString("en-IN") || "0"}`}
                      color={ORANGE}
                      onPress={handleTopup}
                      loading={topping}
                      disabled={topping}
                      iconLeft={<Ionicons name="lock-closed" size={15} color="#fff" />}
                      height={44}
                      fontSize={14}
                      borderRadius={10}
                      glowStrength={0.55}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}

            {/* ── Payment Methods Section ── */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Payment Methods</Text>
              <Pressable onPress={() => setShowAddMethod(v => !v)} style={s.sectionAction}>
                <Ionicons name="add" size={16} color={ORANGE} />
                <Text style={s.sectionActionText}>Add</Text>
              </Pressable>
            </View>

            {methods.length === 0 && !showAddMethod && (
              <Pressable style={s.emptyMethods} onPress={() => setShowAddMethod(true)}>
                <Ionicons name="card-outline" size={28} color={C.textTertiary} />
                <Text style={s.emptyMethodsText}>No payment methods yet</Text>
                <Text style={s.emptyMethodsSub}>Add UPI, card, or bank account</Text>
              </Pressable>
            )}

            {methods.map(m => (
              <View key={m.id} style={s.methodRow}>
                <View style={s.methodIconWrap}>
                  <Ionicons name={TYPE_ICON[m.type] as any} size={18} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.methodLabel}>{m.label}</Text>
                  <Text style={s.methodMasked}>{m.maskedDisplay}</Text>
                </View>
                {m.isDefault
                  ? <View style={s.defaultBadge}><Text style={s.defaultBadgeText}>Default</Text></View>
                  : (
                    <Pressable onPress={() => handleSetDefault(m.id)} hitSlop={8}>
                      <Text style={s.setDefaultText}>Set default</Text>
                    </Pressable>
                  )
                }
                <Pressable onPress={() => handleDeleteMethod(m.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>
            ))}

            {/* Add Method Form */}
            {showAddMethod && (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={s.sheet}>
                  <Text style={s.sheetTitle}>Add Payment Method</Text>

                  {/* Type Tabs */}
                  <View style={s.typeTabs}>
                    {(["upi", "card", "bank"] as const).map(t => (
                      <Pressable key={t} style={[s.typeTab, addType === t && s.typeTabActive]} onPress={() => setAddType(t)}>
                        <Ionicons name={TYPE_ICON[t] as any} size={15} color={addType === t ? ORANGE : C.textSecondary} />
                        <Text style={[s.typeTabText, addType === t && { color: ORANGE }]}>
                          {t === "upi" ? "UPI" : t === "card" ? "Card" : "Bank"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={s.fieldLabel}>Label / Nickname</Text>
                  <TextInput style={s.input} value={addLabel} onChangeText={setAddLabel}
                    placeholder={addType === "upi" ? "e.g. My PhonePe" : addType === "card" ? "e.g. SBI Debit" : "e.g. HDFC Savings"}
                    placeholderTextColor={C.textTertiary} />

                  {addType === "upi" && (
                    <>
                      <Text style={s.fieldLabel}>UPI ID</Text>
                      <TextInput style={s.input} value={addUpi} onChangeText={setAddUpi}
                        placeholder="name@upi or phone@paytm" placeholderTextColor={C.textTertiary}
                        autoCapitalize="none" keyboardType="email-address" />
                    </>
                  )}
                  {addType === "card" && (
                    <>
                      <Text style={s.fieldLabel}>Card Number</Text>
                      <TextInput style={s.input} value={addCard} onChangeText={setAddCard}
                        placeholder="•••• •••• •••• 1234" placeholderTextColor={C.textTertiary}
                        keyboardType="number-pad" maxLength={19} />
                      <Text style={s.fieldLabel}>Cardholder Name</Text>
                      <TextInput style={s.input} value={addCardName} onChangeText={setAddCardName}
                        placeholder="Name on card" placeholderTextColor={C.textTertiary}
                        autoCapitalize="words" />
                      <Text style={s.fieldLabel}>Expiry (MM/YY)</Text>
                      <TextInput style={s.input} value={addCardExpiry} onChangeText={setAddCardExpiry}
                        placeholder="MM/YY" placeholderTextColor={C.textTertiary} maxLength={5} keyboardType="number-pad" />
                    </>
                  )}
                  {addType === "bank" && (
                    <>
                      <Text style={s.fieldLabel}>Bank Name</Text>
                      <TextInput style={s.input} value={addBank} onChangeText={setAddBank}
                        placeholder="State Bank of India" placeholderTextColor={C.textTertiary} />
                      <Text style={s.fieldLabel}>Account Number</Text>
                      <TextInput style={s.input} value={addAccount} onChangeText={setAddAccount}
                        placeholder="Account number" placeholderTextColor={C.textTertiary}
                        keyboardType="number-pad" />
                      <Text style={s.fieldLabel}>IFSC Code</Text>
                      <TextInput style={s.input} value={addIfsc} onChangeText={t => setAddIfsc(t.toUpperCase())}
                        placeholder="SBIN0001234" placeholderTextColor={C.textTertiary}
                        autoCapitalize="characters" />
                    </>
                  )}

                  <View style={s.securityNote}>
                    <Ionicons name="lock-closed" size={13} color="#6366F1" />
                    <Text style={s.securityNoteText}>Stored with AES-256-GCM encryption. Card numbers are never shown again.</Text>
                  </View>

                  <View style={s.sheetActions}>
                    <Pressable style={s.cancelBtn} onPress={() => { setShowAddMethod(false); resetAddForm(); }}>
                      <Text style={s.cancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={[s.confirmBtn, addingMethod && { opacity: 0.6 }]} onPress={handleAddMethod} disabled={addingMethod}>
                      {addingMethod ? <ActivityIndicator color="#fff" size="small" /> : (
                        <>
                          <Ionicons name="shield-checkmark" size={15} color="#fff" />
                          <Text style={s.confirmText}>Save Securely</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}

            {/* Transactions header */}
            <View style={[s.sectionHeader, { marginTop: 8 }]}>
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

  sheet: { margin: 16, backgroundColor: "#fff", borderRadius: 18, padding: 20, elevation: 3 },
  sheetTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#2C2C2C", marginBottom: 16 },

  quickRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  quickBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center" },
  quickBtnActive: { borderColor: ORANGE, backgroundColor: ORANGE + "12" },
  quickBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  quickBtnTextActive: { color: ORANGE },

  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 6 },
  amtRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "#F9FAFB" },
  rupeeSign: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#374151", marginRight: 4 },
  amtInput: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#2C2C2C", paddingVertical: 10 },

  addMethodPrompt: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: ORANGE, borderRadius: 12, borderStyle: "dashed", padding: 14, marginBottom: 4 },
  addMethodPromptText: { fontSize: 13, fontFamily: "Inter_500Medium", color: ORANGE },

  methodChip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#FAFAFA", marginBottom: 4 },
  methodChipActive: { borderColor: ORANGE, backgroundColor: ORANGE + "0D" },
  methodChipLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151" },
  methodChipMasked: { fontSize: 10, fontFamily: "Inter_400Regular", color: C.textSecondary, maxWidth: 120 },
  defaultDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE, marginLeft: 4 },

  sheetActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  confirmBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: ORANGE },
  confirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#2C2C2C" },
  sectionCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: ORANGE },

  emptyMethods: { marginHorizontal: 16, marginBottom: 4, alignItems: "center", paddingVertical: 20, borderWidth: 1.5, borderColor: "#E5E7EB", borderStyle: "dashed", borderRadius: 14, gap: 4 },
  emptyMethodsText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textSecondary },
  emptyMethodsSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textTertiary },

  methodRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 6, borderRadius: 14 },
  methodIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: ORANGE + "15", justifyContent: "center", alignItems: "center" },
  methodLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#2C2C2C" },
  methodMasked: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 1 },
  defaultBadge: { backgroundColor: ORANGE + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  defaultBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: ORANGE },
  setDefaultText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary },

  typeTabs: { flexDirection: "row", gap: 8, marginBottom: 14 },
  typeTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB" },
  typeTabActive: { borderColor: ORANGE, backgroundColor: ORANGE + "10" },
  typeTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary },

  input: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#2C2C2C", backgroundColor: "#F9FAFB", marginBottom: 10 },

  securityNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#EEF2FF", borderRadius: 10, padding: 10, marginTop: 4, marginBottom: 2 },
  securityNoteText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#4338CA", lineHeight: 16 },

  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 8, borderRadius: 14 },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  txLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#2C2C2C", marginBottom: 2 },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary },
  txAmount: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  txBalance: { fontSize: 10, fontFamily: "Inter_400Regular", color: C.textSecondary },

  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textTertiary },

  goldBanner: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1A1A0D",
    borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", borderWidth: 1.5, borderColor: "#F5C518",
    elevation: 3, shadowColor: "#F5C518", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6,
  },
  goldBannerActive: { backgroundColor: "#12120A", borderColor: "#FFE066" },
  goldBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  goldBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#F5C518" },
  goldBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#B8A040", marginTop: 1 },
});
