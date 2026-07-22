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
  Modal,
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

const C     = Colors.light;
const NAVY  = "#0F1F3D";
const NAVY2 = "#1a3a6b";
const ORANGE = "#FF7A18";
const ORANGE2 = "#FF9F43";
const GREEN  = "#22C55E";
const PURPLE = "#6366F1";
const GOLD   = "#F5C518";
const INSTANT_FEE = 5;

type PayMethod = {
  id: string; type: string; label: string; maskedDisplay: string;
  isDefault: boolean; createdAt: string;
};
type Tx = {
  id: string; type: string; amount: number; balanceAfter: number;
  description: string; referenceId?: string; status: string; createdAt: string;
};
type Payout = {
  id: string; amount: number; fee: number; method: string;
  maskedDisplay?: string; upiId?: string;
  status: string; processedAt?: string; createdAt: string; notes?: string;
};
type ProviderWallet = {
  balance: number; payoutPreference: string; upiId?: string;
  monthEarnings: number; totalEarnings: number; pendingPayouts: number;
  transactions: Tx[]; payouts: Payout[];
};
type PayoutInfo = {
  nextMondayPayout: string;
  nextMondayLabel: string;
  instantFee: number;
  defaultMethod: PayMethod | null;
};

const TX_META: Record<string, { icon: string; color: string }> = {
  earning: { icon: "cash",              color: GREEN   },
  payout:  { icon: "send",             color: PURPLE  },
  fee:     { icon: "pricetag",         color: "#F59E0B" },
  topup:   { icon: "arrow-down-circle", color: GREEN   },
  refund:  { icon: "refresh-circle",   color: "#F59E0B" },
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", processing: PURPLE, completed: GREEN, failed: "#EF4444",
};
const TYPE_ICON: Record<string, string> = {
  upi: "phone-portrait-outline", card: "card-outline", bank: "business-outline",
};
const PREF_OPTIONS = [
  { id: "weekly",  label: "Every Monday (Auto)",  sub: "Full balance → default method, 9 AM IST",  icon: "calendar-outline" as const, color: GREEN  },
  { id: "wallet",  label: "Keep in Wallet",       sub: "Accumulate — withdraw whenever you want",  icon: "wallet-outline"   as const, color: PURPLE },
];

function nextMondayFromNow(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });
}

export default function ProviderWalletScreen() {
  const { get, post, put, del } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb  = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [wallet,     setWallet]     = useState<ProviderWallet | null>(null);
  const [methods,    setMethods]    = useState<PayMethod[]>([]);
  const [payoutInfo, setPayoutInfo] = useState<PayoutInfo | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<"transactions" | "payouts">("transactions");

  // Payout state
  const [showPayoutModal, setShowPayoutModal]   = useState(false);
  const [selectedMethod,  setSelectedMethod]    = useState<PayMethod | null>(null);
  const [adHocUpi,        setAdHocUpi]          = useState("");
  const [payoutAmount,    setPayoutAmount]       = useState("");
  const [payingOut,       setPayingOut]          = useState(false);
  const [savingPref,      setSavingPref]         = useState(false);

  // Add method state
  const [showAddMethod,  setShowAddMethod]  = useState(false);
  const [addType,        setAddType]        = useState<"upi"|"card"|"bank">("upi");
  const [addLabel,       setAddLabel]       = useState("");
  const [addUpi,         setAddUpi]         = useState("");
  const [addCard,        setAddCard]        = useState("");
  const [addCardName,    setAddCardName]    = useState("");
  const [addCardExpiry,  setAddCardExpiry]  = useState("");
  const [addBank,        setAddBank]        = useState("");
  const [addAccount,     setAddAccount]     = useState("");
  const [addIfsc,        setAddIfsc]        = useState("");
  const [addingMethod,   setAddingMethod]   = useState(false);

  async function fetchAll() {
    try {
      const [data, methodData, infoData] = await Promise.all([
        get<ProviderWallet>("/wallet/provider"),
        get<{ methods: PayMethod[] }>("/wallet/payment-methods").catch(() => ({ methods: [] })),
        get<PayoutInfo>("/wallet/provider/payout/info").catch(() => null),
      ]);
      setWallet(data);
      const meths = methodData.methods || [];
      setMethods(meths);
      if (infoData) setPayoutInfo(infoData);
      // Auto-select default method for payout
      const def = meths.find(m => m.isDefault);
      if (def && !selectedMethod) setSelectedMethod(def);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { fetchAll(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, []);

  /* ── Add Payment Method ── */
  async function handleAddMethod() {
    if (!addLabel.trim()) { Alert.alert("Label required"); return; }
    if (addType === "upi" && !addUpi.trim()) { Alert.alert("UPI ID required"); return; }
    if (addType === "card" && addCard.replace(/\s/g,"").length < 12) { Alert.alert("Valid card number required"); return; }
    if (addType === "bank" && (!addAccount.trim() || !addIfsc.trim())) { Alert.alert("Account number and IFSC required"); return; }
    setAddingMethod(true);
    try {
      const payload: Record<string,string> = { type: addType, label: addLabel.trim() };
      if (addType === "upi")  payload.upiId = addUpi.trim();
      if (addType === "card") { payload.cardNumber = addCard.replace(/\s/g,""); payload.cardName = addCardName; payload.cardExpiry = addCardExpiry; }
      if (addType === "bank") { payload.bankName = addBank; payload.accountNumber = addAccount; payload.ifsc = addIfsc; }
      await post("/wallet/payment-methods", payload);
      Alert.alert("Saved!", "Method encrypted with AES-256 & stored securely.");
      setShowAddMethod(false);
      setAddLabel(""); setAddUpi(""); setAddCard(""); setAddCardName("");
      setAddCardExpiry(""); setAddBank(""); setAddAccount(""); setAddIfsc("");
      fetchAll();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save method.");
    } finally { setAddingMethod(false); }
  }

  async function handleDeleteMethod(id: string) {
    Alert.alert("Remove method?", "This payout method will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await del(`/wallet/payment-methods/${id}`); fetchAll(); }
        catch { Alert.alert("Error", "Could not remove."); }
      }},
    ]);
  }

  async function handleSetDefault(id: string) {
    try {
      await put(`/wallet/payment-methods/${id}/default`, {});
      const updated = methods.map(m => ({ ...m, isDefault: m.id === id }));
      setMethods(updated);
      setSelectedMethod(updated.find(m => m.id === id) || null);
    } catch { Alert.alert("Error", "Could not set default."); }
  }

  /* ── Instant Payout ── */
  async function handleInstantPayout() {
    const amt = parseFloat(payoutAmount);
    if (!amt || amt <= 0) { Alert.alert("Enter amount"); return; }
    if (amt < INSTANT_FEE + 1) {
      Alert.alert("Minimum ₹6", `Amount must be at least ₹6 (₹5 fee + ₹1 payout).`); return;
    }
    if (!selectedMethod && !adHocUpi.trim()) {
      Alert.alert("No method selected", "Select a saved method or enter a UPI ID."); return;
    }
    const totalNeeded = amt + INSTANT_FEE;
    if (wallet && totalNeeded > wallet.balance) {
      Alert.alert(
        "Insufficient balance",
        `You need ₹${totalNeeded.toFixed(2)} (₹${amt} + ₹${INSTANT_FEE} fee).\nAvailable: ₹${wallet.balance.toLocaleString("en-IN")}`
      ); return;
    }

    Alert.alert(
      "Confirm Payout",
      `Send ₹${amt.toFixed(2)} to ${selectedMethod?.label || adHocUpi}?\n\n• ₹${INSTANT_FEE} instant transfer fee will be charged\n• Total deducted: ₹${totalNeeded.toFixed(2)}\n• Arrives in ~30 minutes`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm & Send", onPress: doInstantPayout },
      ]
    );
  }

  async function doInstantPayout() {
    setPayingOut(true);
    try {
      const body: Record<string, any> = { amount: parseFloat(payoutAmount) };
      if (selectedMethod) body.paymentMethodId = selectedMethod.id;
      else if (adHocUpi.trim()) body.upiId = adHocUpi.trim();

      const data = await post<{ newBalance: number; message: string; amount: number; fee: number }>(
        "/wallet/provider/payout/instant", body
      );
      setShowPayoutModal(false);
      setPayoutAmount("");
      Alert.alert(
        "✅ Payout Sent!",
        `₹${data.amount?.toFixed(2)} initiated.\n₹${data.fee || INSTANT_FEE} fee charged.\n\n${data.message || "Arrives in ~30 min."}`
      );
      fetchAll();
    } catch (e: any) {
      Alert.alert("Payout Failed", e?.message || "Try again.");
    } finally { setPayingOut(false); }
  }

  async function handleSetPreference(pref: string) {
    if (!wallet) return;
    setSavingPref(true);
    try {
      await post("/wallet/provider/payout/schedule", { preference: pref });
      setWallet({ ...wallet, payoutPreference: pref });
      const label = pref === "weekly" ? "Every Monday 9 AM" : "Keep in Wallet";
      Alert.alert("Saved", `Payout schedule: ${label}`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save.");
    } finally { setSavingPref(false); }
  }

  /* ── Sub-components ── */
  function TxRow({ item }: { item: Tx }) {
    const meta     = TX_META[item.type] || { icon: "ellipse-outline", color: C.textSecondary };
    const isCredit = ["earning","topup","refund"].includes(item.type);
    const d        = new Date(item.createdAt);
    return (
      <View style={s.txRow}>
        <View style={[s.txIcon, { backgroundColor: meta.color + "18" }]}>
          <Ionicons name={meta.icon as any} size={17} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.txLabel} numberOfLines={1}>{item.description || item.type}</Text>
          <Text style={s.txDate}>{d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</Text>
        </View>
        <Text style={[s.txAmount, { color: isCredit ? GREEN : "#EF4444" }]}>
          {isCredit ? "+" : "-"}₹{Math.abs(item.amount).toLocaleString("en-IN")}
        </Text>
      </View>
    );
  }

  function PayoutRow({ item }: { item: Payout }) {
    const sc = STATUS_COLOR[item.status] || C.textSecondary;
    const d  = new Date(item.createdAt);
    const dest = item.maskedDisplay || item.upiId || "";
    return (
      <View style={s.txRow}>
        <View style={[s.txIcon, { backgroundColor: PURPLE + "18" }]}>
          <Ionicons name="send-outline" size={17} color={PURPLE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.txLabel}>
            {item.method === "weekly" ? "Weekly Auto-Payout" : "Instant Payout"}
            {dest ? ` → ${dest}` : ""}
          </Text>
          {Number(item.fee) > 0 && (
            <Text style={[s.txDate, { color: "#F59E0B" }]}>₹{item.fee} fee</Text>
          )}
          <Text style={s.txDate}>{d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={[s.txAmount, { color: "#EF4444" }]}>-₹{item.amount.toLocaleString("en-IN")}</Text>
          <View style={[s.badge, { backgroundColor: sc + "20" }]}>
            <Text style={[s.badgeText, { color: sc }]}>{item.status}</Text>
          </View>
        </View>
      </View>
    );
  }

  /* ── Payout Method Card ── */
  function MethodCard({ m }: { m: PayMethod }) {
    const selected = selectedMethod?.id === m.id;
    return (
      <Pressable
        style={[s.methodCard, selected && s.methodCardSelected]}
        onPress={() => setSelectedMethod(m)}
      >
        <View style={[s.methodIconWrap, { backgroundColor: selected ? ORANGE + "18" : "#F5F6FA" }]}>
          <Ionicons name={TYPE_ICON[m.type] as any} size={18} color={selected ? ORANGE : C.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.methodLabel, selected && { color: ORANGE }]}>{m.label}</Text>
          <Text style={s.methodMasked}>{m.maskedDisplay}</Text>
        </View>
        {m.isDefault && (
          <View style={s.defaultPill}>
            <Text style={s.defaultPillText}>Default</Text>
          </View>
        )}
        {selected && <Ionicons name="checkmark-circle" size={20} color={ORANGE} style={{ marginLeft: 4 }} />}
        <Pressable onPress={() => handleDeleteMethod(m.id)} hitSlop={10} style={{ marginLeft: 6 }}>
          <Ionicons name="trash-outline" size={14} color="#EF4444" />
        </Pressable>
        {!m.isDefault && (
          <Pressable onPress={() => handleSetDefault(m.id)} hitSlop={10} style={{ marginLeft: 6 }}>
            <Ionicons name="star-outline" size={14} color={ORANGE} />
          </Pressable>
        )}
      </Pressable>
    );
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <View style={[s.root, { paddingTop: topPad, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={ORANGE} size="large" />
        <Text style={{ color: C.textSecondary, marginTop: 12, fontFamily: "Inter_400Regular" }}>Loading wallet…</Text>
      </View>
    );
  }

  const w = wallet!;
  const nextMonday = payoutInfo?.nextMondayLabel || nextMondayFromNow();
  const defaultMethodForWeekly = methods.find(m => m.isDefault);

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <LinearGradient colors={[NAVY, NAVY2]} style={s.header} start={{ x:0,y:0 }} end={{ x:1,y:1 }}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>Earnings & Payouts</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <FlatList
        data={activeTab === "transactions" ? w.transactions : w.payouts}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ── Balance Card ── */}
            <LinearGradient colors={[NAVY, NAVY2]} style={s.balanceCard} start={{x:0,y:0}} end={{x:1,y:1}}>
              <Text style={s.balanceLabel}>Wallet Balance</Text>
              <Text style={s.balanceAmount}>₹{w.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text>
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={s.statVal}>₹{w.monthEarnings.toLocaleString("en-IN")}</Text>
                  <Text style={s.statLbl}>This Month</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.statItem}>
                  <Text style={s.statVal}>₹{w.totalEarnings.toLocaleString("en-IN")}</Text>
                  <Text style={s.statLbl}>All Time</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: "#F59E0B" }]}>₹{w.pendingPayouts.toLocaleString("en-IN")}</Text>
                  <Text style={s.statLbl}>Pending</Text>
                </View>
              </View>
            </LinearGradient>

            {/* ── Quick Actions ── */}
            <View style={s.quickRow}>
              <Pressable
                style={[s.quickBtn, { borderColor: ORANGE }]}
                onPress={() => setShowPayoutModal(true)}
              >
                <LinearGradient colors={[ORANGE, ORANGE2]} style={s.quickGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <View>
                    <Text style={s.quickBtnText}>Withdraw Now</Text>
                    <Text style={s.quickBtnSub}>₹5 instant fee</Text>
                  </View>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={[s.quickBtn, { borderColor: GREEN }]}
                onPress={() => setShowAddMethod(v => !v)}
              >
                <LinearGradient colors={["#16A34A","#22C55E"]} style={s.quickGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <View>
                    <Text style={s.quickBtnText}>Add Method</Text>
                    <Text style={s.quickBtnSub}>Bank / UPI / Card</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>

            {/* ── Saved Payout Methods ── */}
            <View style={s.section}>
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>Payout Methods</Text>
                <Text style={s.sectionSub}>{methods.length} saved</Text>
              </View>

              {methods.length === 0 && !showAddMethod && (
                <Pressable style={s.emptyMethods} onPress={() => setShowAddMethod(true)}>
                  <Ionicons name="card-outline" size={28} color={C.textTertiary} />
                  <Text style={s.emptyMethodsText}>No payout methods yet</Text>
                  <Text style={s.emptyMethodsSub}>Add your bank account, UPI, or card to withdraw earnings</Text>
                </Pressable>
              )}

              {methods.map(m => <MethodCard key={m.id} m={m} />)}
            </View>

            {/* ── Add Method Form ── */}
            {showAddMethod && (
              <View style={s.card}>
                <Text style={[s.cardTitle, { marginBottom: 12 }]}>Add Payout Method</Text>
                <View style={s.typeTabs}>
                  {(["upi","card","bank"] as const).map(t => (
                    <Pressable
                      key={t}
                      style={[s.typeTab, addType === t && s.typeTabActive]}
                      onPress={() => setAddType(t)}
                    >
                      <Ionicons name={TYPE_ICON[t] as any} size={14} color={addType===t ? ORANGE : C.textSecondary} />
                      <Text style={[s.typeTabText, addType===t && { color: ORANGE }]}>
                        {t === "upi" ? "UPI" : t === "card" ? "Card" : "Bank"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <MLabel>Nickname</MLabel>
                <MInput value={addLabel} onChange={setAddLabel}
                  placeholder={addType==="upi" ? "e.g. My PhonePe" : addType==="card" ? "e.g. SBI Debit" : "e.g. HDFC Savings"} />
                {addType === "upi" && <>
                  <MLabel>UPI ID</MLabel>
                  <MInput value={addUpi} onChange={setAddUpi} placeholder="name@upi or 9876543210@paytm" lower />
                </>}
                {addType === "card" && <>
                  <MLabel>Card Number</MLabel>
                  <MInput value={addCard} onChange={setAddCard} placeholder="•••• •••• •••• 1234" numeric maxLen={19} />
                  <MLabel>Cardholder Name</MLabel>
                  <MInput value={addCardName} onChange={setAddCardName} placeholder="Name on card" words />
                  <MLabel>Expiry (MM/YY)</MLabel>
                  <MInput value={addCardExpiry} onChange={setAddCardExpiry} placeholder="MM/YY" numeric maxLen={5} />
                </>}
                {addType === "bank" && <>
                  <MLabel>Bank Name</MLabel>
                  <MInput value={addBank} onChange={setAddBank} placeholder="State Bank of India" words />
                  <MLabel>Account Number</MLabel>
                  <MInput value={addAccount} onChange={setAddAccount} placeholder="Account number" numeric />
                  <MLabel>IFSC Code</MLabel>
                  <MInput value={addIfsc} onChange={t => setAddIfsc(t.toUpperCase())} placeholder="SBIN0001234" upper />
                </>}
                <View style={s.secNote}>
                  <Ionicons name="lock-closed" size={11} color={PURPLE} />
                  <Text style={s.secNoteText}>AES-256-GCM encrypted · Numbers never shown again</Text>
                </View>
                <View style={{ flexDirection:"row", gap:10, marginTop:14 }}>
                  <Pressable style={s.cancelBtn} onPress={() => setShowAddMethod(false)}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[s.saveBtn, addingMethod && { opacity: 0.6 }]} onPress={handleAddMethod} disabled={addingMethod}>
                    {addingMethod ? <ActivityIndicator color="#fff" size="small" /> : (
                      <>
                        <Ionicons name="shield-checkmark" size={14} color="#fff" />
                        <Text style={s.saveBtnText}>Save Securely</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Payout Schedule ── */}
            <View style={s.section}>
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>Payout Schedule</Text>
                {savingPref && <ActivityIndicator size="small" color={ORANGE} />}
              </View>

              {/* Monday auto-payout info banner */}
              {w.payoutPreference === "weekly" && (
                <LinearGradient
                  colors={["#14532D", "#166534"]}
                  style={s.mondayBanner}
                  start={{x:0,y:0}} end={{x:1,y:0}}
                >
                  <Ionicons name="calendar" size={20} color="#4ADE80" />
                  <View style={{ flex:1 }}>
                    <Text style={s.mondayTitle}>Next auto-payout: {nextMonday}</Text>
                    <Text style={s.mondaySub}>
                      {defaultMethodForWeekly
                        ? `→ ${defaultMethodForWeekly.label} (${defaultMethodForWeekly.maskedDisplay})`
                        : "⚠️ No default method — add one below"}
                    </Text>
                    <Text style={s.mondaySub}>Full balance transferred, no fee.</Text>
                  </View>
                </LinearGradient>
              )}

              {PREF_OPTIONS.map(opt => (
                <Pressable
                  key={opt.id}
                  style={[s.prefCard, w.payoutPreference === opt.id && s.prefCardActive]}
                  onPress={() => handleSetPreference(opt.id)}
                >
                  <View style={[s.prefIconWrap, { backgroundColor: opt.color + "18" }]}>
                    <Ionicons name={opt.icon} size={20} color={opt.color} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={[s.prefLabel, w.payoutPreference === opt.id && { color: ORANGE }]}>{opt.label}</Text>
                    <Text style={s.prefSub}>{opt.sub}</Text>
                  </View>
                  {w.payoutPreference === opt.id
                    ? <Ionicons name="checkmark-circle" size={22} color={ORANGE} />
                    : <View style={s.prefRadio} />
                  }
                </Pressable>
              ))}
            </View>

            {/* ── Transaction / Payout Tabs ── */}
            <View style={s.tabs}>
              {(["transactions","payouts"] as const).map(tab => (
                <Pressable key={tab} style={[s.tab, activeTab===tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
                  <Text style={[s.tabText, activeTab===tab && s.tabTextActive]}>
                    {tab === "transactions" ? `Transactions (${w.transactions.length})` : `Payouts (${w.payouts.length})`}
                  </Text>
                </Pressable>
              ))}
            </View>

            {((activeTab==="transactions" && w.transactions.length===0) ||
              (activeTab==="payouts" && w.payouts.length===0)) && (
              <View style={s.emptyWrap}>
                <Ionicons name={activeTab==="transactions" ? "receipt-outline" : "send-outline"} size={36} color={C.textTertiary} />
                <Text style={s.emptyText}>No {activeTab} yet</Text>
                <Text style={s.emptyHint}>Complete jobs to start earning</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) =>
          activeTab === "transactions"
            ? <TxRow item={item as Tx} />
            : <PayoutRow item={item as Payout} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      />

      {/* ══ Instant Payout Modal ══ */}
      <Modal
        visible={showPayoutModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayoutModal(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowPayoutModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%" }}
          >
            <Pressable style={[s.modalSheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
              <View style={s.sheetHandle} />
              <Text style={s.modalTitle}>Instant Withdrawal</Text>
              <Text style={s.modalSub}>₹5 flat fee · Arrives in ~30 minutes</Text>

              {/* Balance display */}
              <View style={s.balancePill}>
                <Ionicons name="wallet-outline" size={14} color={NAVY} />
                <Text style={s.balancePillText}>
                  Available: <Text style={{ fontFamily: "Inter_700Bold" }}>₹{w.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text>
                </Text>
              </View>

              {/* Method selector */}
              <Text style={[s.fieldLbl, { marginTop: 16 }]}>Send to</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {methods.map(m => (
                  <Pressable
                    key={m.id}
                    style={[s.methodChip, selectedMethod?.id === m.id && s.methodChipActive]}
                    onPress={() => { setSelectedMethod(m); setAdHocUpi(""); }}
                  >
                    <Ionicons name={TYPE_ICON[m.type] as any} size={14} color={selectedMethod?.id===m.id ? "#fff" : ORANGE} />
                    <View>
                      <Text style={[s.chipLabel, selectedMethod?.id===m.id && { color:"#fff" }]}>{m.label}</Text>
                      <Text style={[s.chipMasked, selectedMethod?.id===m.id && { color:"rgba(255,255,255,0.8)" }]}>{m.maskedDisplay}</Text>
                    </View>
                  </Pressable>
                ))}
                <Pressable
                  style={[s.methodChip, !selectedMethod && s.methodChipActive, { borderStyle: "dashed" }]}
                  onPress={() => setSelectedMethod(null)}
                >
                  <Ionicons name="phone-portrait-outline" size={14} color={!selectedMethod ? "#fff" : ORANGE} />
                  <Text style={[s.chipLabel, !selectedMethod && { color:"#fff" }]}>Other UPI</Text>
                </Pressable>
              </ScrollView>

              {!selectedMethod && (
                <>
                  <Text style={s.fieldLbl}>UPI ID</Text>
                  <TextInput
                    style={s.modalInput}
                    value={adHocUpi}
                    onChangeText={setAdHocUpi}
                    placeholder="name@upi or phone@paytm"
                    placeholderTextColor={C.textTertiary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </>
              )}

              {/* Amount */}
              <Text style={[s.fieldLbl, { marginTop: 12 }]}>Amount</Text>
              <View style={s.amtRow}>
                <Text style={s.rupee}>₹</Text>
                <TextInput
                  style={[s.modalInput, { flex:1, borderWidth:0, paddingLeft:0 }]}
                  value={payoutAmount}
                  onChangeText={v => setPayoutAmount(v.replace(/[^0-9.]/g,""))}
                  placeholder={`Max ₹${Math.max(0, w.balance - INSTANT_FEE).toLocaleString("en-IN")}`}
                  placeholderTextColor={C.textTertiary}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  style={s.maxBtn}
                  onPress={() => setPayoutAmount(String(Math.max(0, w.balance - INSTANT_FEE)))}
                >
                  <Text style={s.maxBtnText}>MAX</Text>
                </Pressable>
              </View>

              {/* Fee summary */}
              {payoutAmount.length > 0 && parseFloat(payoutAmount) > 0 && (
                <View style={s.feeSummary}>
                  <View style={s.feeRow}>
                    <Text style={s.feeLbl}>You receive</Text>
                    <Text style={s.feeVal}>₹{parseFloat(payoutAmount||"0").toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={s.feeRow}>
                    <Text style={s.feeLbl}>Instant fee</Text>
                    <Text style={[s.feeVal, { color:"#F59E0B" }]}>-₹{INSTANT_FEE}</Text>
                  </View>
                  <View style={[s.feeRow, s.feeTotalRow]}>
                    <Text style={s.feeTotalLbl}>Total deducted</Text>
                    <Text style={s.feeTotalVal}>₹{(parseFloat(payoutAmount||"0") + INSTANT_FEE).toLocaleString("en-IN")}</Text>
                  </View>
                </View>
              )}

              <Pressable
                style={[s.payBtn, payingOut && { opacity:0.6 }]}
                onPress={handleInstantPayout}
                disabled={payingOut}
              >
                <LinearGradient colors={[ORANGE, ORANGE2]} style={s.payBtnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                  {payingOut ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={s.payBtnText}>Withdraw Now</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => setShowPayoutModal(false)} style={{ marginTop: 12, alignItems:"center" }}>
                <Text style={{ color: C.textSecondary, fontFamily:"Inter_400Regular", fontSize:14 }}>Cancel</Text>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── Helper sub-components ── */
function MLabel({ children }: { children: string }) {
  return <Text style={s.fieldLbl}>{children}</Text>;
}
function MInput({ value, onChange, placeholder, lower, upper, words, numeric, maxLen }:
  { value:string; onChange:(v:string)=>void; placeholder:string; lower?:boolean; upper?:boolean; words?:boolean; numeric?:boolean; maxLen?:number }) {
  return (
    <TextInput
      style={s.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#AEAEAE"
      autoCapitalize={upper ? "characters" : words ? "words" : lower ? "none" : "none"}
      keyboardType={numeric ? "number-pad" : "default"}
      maxLength={maxLen}
    />
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:"#F5F6FA" },
  header: {
    flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    paddingHorizontal:16, paddingBottom:14,
  },
  backBtn: { width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.15)", justifyContent:"center", alignItems:"center" },
  headerTitle: { fontSize:17, fontFamily:"Inter_700Bold", color:"#fff" },

  balanceCard: { margin:16, borderRadius:20, padding:24 },
  balanceLabel: { fontSize:12, color:"rgba(255,255,255,0.7)", fontFamily:"Inter_500Medium", marginBottom:4 },
  balanceAmount: { fontSize:36, fontFamily:"Inter_700Bold", color:"#fff", letterSpacing:-1, marginBottom:20 },
  statsRow: { flexDirection:"row", alignItems:"center" },
  statItem: { flex:1, alignItems:"center" },
  statVal: { fontSize:14, fontFamily:"Inter_700Bold", color:"#fff" },
  statLbl: { fontSize:10, color:"rgba(255,255,255,0.6)", fontFamily:"Inter_400Regular", marginTop:2 },
  statDiv: { width:1, height:32, backgroundColor:"rgba(255,255,255,0.2)" },

  quickRow: { flexDirection:"row", paddingHorizontal:16, gap:12, marginBottom:4 },
  quickBtn: { flex:1, borderRadius:14, overflow:"hidden", borderWidth:1.5 },
  quickGrad: { flexDirection:"row", alignItems:"center", gap:10, paddingHorizontal:14, paddingVertical:13 },
  quickBtnText: { fontSize:13, fontFamily:"Inter_700Bold", color:"#fff" },
  quickBtnSub: { fontSize:10, color:"rgba(255,255,255,0.8)", fontFamily:"Inter_400Regular" },

  section: { marginHorizontal:16, marginTop:16, marginBottom:4 },
  sectionRow: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  sectionTitle: { fontSize:14, fontFamily:"Inter_700Bold", color:"#2C2C2C" },
  sectionSub: { fontSize:12, color:"#AEAEAE", fontFamily:"Inter_400Regular" },

  methodCard: {
    flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
    borderRadius:12, padding:12, marginBottom:8, gap:10,
    borderWidth:1.5, borderColor:"transparent",
    elevation:1, shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:3,
  },
  methodCardSelected: { borderColor: ORANGE },
  methodIconWrap: { width:36, height:36, borderRadius:18, alignItems:"center", justifyContent:"center" },
  methodLabel: { fontSize:13, fontFamily:"Inter_600SemiBold", color:"#2C2C2C" },
  methodMasked: { fontSize:11, color:"#AEAEAE", fontFamily:"Inter_400Regular" },
  defaultPill: { backgroundColor: ORANGE + "18", borderRadius:8, paddingHorizontal:6, paddingVertical:2 },
  defaultPillText: { fontSize:10, color: ORANGE, fontFamily:"Inter_600SemiBold" },

  emptyMethods: { alignItems:"center", padding:24, backgroundColor:"#fff", borderRadius:14, gap:8, borderWidth:1.5, borderColor:"#F0F0F0", borderStyle:"dashed" },
  emptyMethodsText: { fontSize:14, fontFamily:"Inter_600SemiBold", color:"#2C2C2C" },
  emptyMethodsSub: { fontSize:12, color:"#AEAEAE", fontFamily:"Inter_400Regular", textAlign:"center" },

  mondayBanner: { borderRadius:14, padding:14, flexDirection:"row", gap:12, marginBottom:12, alignItems:"flex-start" },
  mondayTitle: { fontSize:13, fontFamily:"Inter_700Bold", color:"#4ADE80" },
  mondaySub: { fontSize:11, color:"rgba(74,222,128,0.8)", fontFamily:"Inter_400Regular", marginTop:2 },

  prefCard: {
    flexDirection:"row", alignItems:"center", gap:12,
    backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:8,
    borderWidth:1.5, borderColor:"transparent",
    elevation:1, shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:3,
  },
  prefCardActive: { borderColor: ORANGE },
  prefIconWrap: { width:40, height:40, borderRadius:20, alignItems:"center", justifyContent:"center" },
  prefLabel: { fontSize:13, fontFamily:"Inter_600SemiBold", color:"#2C2C2C" },
  prefSub: { fontSize:11, color:"#AEAEAE", fontFamily:"Inter_400Regular", marginTop:2 },
  prefRadio: { width:20, height:20, borderRadius:10, borderWidth:2, borderColor:"#D1D5DB" },

  card: { backgroundColor:"#fff", borderRadius:16, padding:16, marginHorizontal:16, marginTop:16, elevation:1 },
  cardTitle: { fontSize:15, fontFamily:"Inter_700Bold", color:"#2C2C2C" },
  typeTabs: { flexDirection:"row", gap:8, marginBottom:14 },
  typeTab: { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingVertical:9, borderRadius:10, borderWidth:1.5, borderColor:"#E5E7EB", backgroundColor:"#F9FAFB" },
  typeTabActive: { borderColor: ORANGE, backgroundColor: ORANGE + "10" },
  typeTabText: { fontSize:12, fontFamily:"Inter_600SemiBold", color:"#6B7280" },
  fieldLbl: { fontSize:12, fontFamily:"Inter_600SemiBold", color:"#6B7280", marginBottom:6, marginTop:10 },
  input: { borderWidth:1.5, borderColor:"#E5E7EB", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, fontFamily:"Inter_400Regular", color:"#2C2C2C", backgroundColor:"#FAFAFA" },
  secNote: { flexDirection:"row", alignItems:"center", gap:5, marginTop:12, padding:10, backgroundColor:"#F5F3FF", borderRadius:8 },
  secNoteText: { fontSize:11, color:PURPLE, fontFamily:"Inter_400Regular", flex:1 },
  cancelBtn: { flex:1, borderWidth:1.5, borderColor:"#E5E7EB", borderRadius:10, paddingVertical:12, alignItems:"center" },
  cancelBtnText: { fontSize:14, fontFamily:"Inter_600SemiBold", color:"#6B7280" },
  saveBtn: { flex:2, backgroundColor: ORANGE, borderRadius:10, paddingVertical:12, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:7 },
  saveBtnText: { fontSize:14, fontFamily:"Inter_700Bold", color:"#fff" },

  tabs: { flexDirection:"row", marginHorizontal:16, marginTop:16, backgroundColor:"#F0F0F0", borderRadius:12, padding:3 },
  tab: { flex:1, alignItems:"center", paddingVertical:9, borderRadius:10 },
  tabActive: { backgroundColor:"#fff", elevation:1, shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:3 },
  tabText: { fontSize:12, fontFamily:"Inter_500Medium", color:"#AEAEAE" },
  tabTextActive: { color:"#2C2C2C", fontFamily:"Inter_700Bold" },

  txRow: { flexDirection:"row", alignItems:"center", gap:12, paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:"#F5F5F5" },
  txIcon: { width:36, height:36, borderRadius:18, alignItems:"center", justifyContent:"center" },
  txLabel: { fontSize:13, fontFamily:"Inter_500Medium", color:"#2C2C2C" },
  txDate: { fontSize:11, color:"#AEAEAE", fontFamily:"Inter_400Regular", marginTop:2 },
  txAmount: { fontSize:14, fontFamily:"Inter_700Bold" },
  badge: { borderRadius:6, paddingHorizontal:7, paddingVertical:2 },
  badgeText: { fontSize:10, fontFamily:"Inter_600SemiBold", textTransform:"capitalize" },

  emptyWrap: { alignItems:"center", paddingVertical:48, gap:8 },
  emptyText: { fontSize:15, fontFamily:"Inter_600SemiBold", color:"#6B7280" },
  emptyHint: { fontSize:12, color:"#AEAEAE", fontFamily:"Inter_400Regular" },

  /* Modal */
  overlay: { flex:1, backgroundColor:"rgba(0,0,0,0.45)", justifyContent:"flex-end" },
  modalSheet: { backgroundColor:"#fff", borderTopLeftRadius:24, borderTopRightRadius:24, padding:20 },
  sheetHandle: { width:36, height:4, backgroundColor:"#E5E7EB", borderRadius:2, alignSelf:"center", marginBottom:16 },
  modalTitle: { fontSize:20, fontFamily:"Inter_700Bold", color:"#2C2C2C", textAlign:"center" },
  modalSub: { fontSize:13, color:"#AEAEAE", fontFamily:"Inter_400Regular", textAlign:"center", marginTop:4, marginBottom:8 },
  balancePill: { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#F5F6FA", borderRadius:10, paddingHorizontal:12, paddingVertical:8, alignSelf:"center", marginTop:8 },
  balancePillText: { fontSize:13, color:"#2C2C2C", fontFamily:"Inter_400Regular" },
  methodChip: {
    flexDirection:"row", alignItems:"center", gap:7,
    backgroundColor:"#F5F6FA", borderRadius:12, paddingHorizontal:12, paddingVertical:9,
    marginRight:8, borderWidth:1.5, borderColor:"#E5E7EB",
  },
  methodChipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  chipLabel: { fontSize:12, fontFamily:"Inter_600SemiBold", color:"#2C2C2C" },
  chipMasked: { fontSize:10, color:"#AEAEAE", fontFamily:"Inter_400Regular" },
  modalInput: { borderWidth:1.5, borderColor:"#E5E7EB", borderRadius:10, paddingHorizontal:12, paddingVertical:11, fontSize:14, fontFamily:"Inter_400Regular", color:"#2C2C2C", marginTop:4 },
  amtRow: { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderColor:"#E5E7EB", borderRadius:10, marginTop:4, backgroundColor:"#FAFAFA" },
  rupee: { fontSize:18, fontFamily:"Inter_700Bold", color:"#2C2C2C", paddingLeft:12 },
  maxBtn: { backgroundColor: ORANGE + "18", borderRadius:8, paddingHorizontal:10, paddingVertical:6, margin:6 },
  maxBtnText: { fontSize:11, fontFamily:"Inter_700Bold", color: ORANGE },
  feeSummary: { backgroundColor:"#F9FAFB", borderRadius:12, padding:12, marginTop:12 },
  feeRow: { flexDirection:"row", justifyContent:"space-between", marginBottom:6 },
  feeLbl: { fontSize:13, color:"#6B7280", fontFamily:"Inter_400Regular" },
  feeVal: { fontSize:13, color:"#2C2C2C", fontFamily:"Inter_600SemiBold" },
  feeTotalRow: { borderTopWidth:1, borderTopColor:"#E5E7EB", paddingTop:8, marginTop:4 },
  feeTotalLbl: { fontSize:14, fontFamily:"Inter_700Bold", color:"#2C2C2C" },
  feeTotalVal: { fontSize:14, fontFamily:"Inter_700Bold", color: NAVY },
  payBtn: { marginTop:16, borderRadius:14, overflow:"hidden" },
  payBtnGrad: { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:10, paddingVertical:16 },
  payBtnText: { fontSize:16, fontFamily:"Inter_700Bold", color:"#fff" },
});
