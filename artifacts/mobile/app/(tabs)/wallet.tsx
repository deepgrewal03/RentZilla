import Button3D from "@/components/Button3D";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
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
import { useAuth } from "@/context/AuthContext";
import CustomerWallet from "../wallet";
import * as AudioService from "@/services/AudioService";

const C      = Colors.light;
const NAVY   = "#0F1F3D";
const NAVY2  = "#1A3A6B";
const ORANGE = "#FF7A18";
const ORANGE2= "#FF9F43";
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
  maskedDisplay?: string; status: string; processedAt?: string; createdAt: string; notes?: string;
};
type ProviderWallet = {
  balance: number; payoutPreference: string;
  monthEarnings: number; totalEarnings: number; pendingPayouts: number;
  transactions: Tx[]; payouts: Payout[];
};
type PayoutInfo = {
  nextMondayLabel: string; instantFee: number; defaultMethod: PayMethod | null;
};

const TX_META: Record<string, { icon: string; color: string }> = {
  earning: { icon: "cash",               color: GREEN   },
  payout:  { icon: "send",              color: PURPLE  },
  fee:     { icon: "pricetag",          color: "#F59E0B" },
  topup:   { icon: "arrow-down-circle", color: GREEN   },
  refund:  { icon: "refresh-circle",    color: "#F59E0B" },
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", processing: PURPLE, completed: GREEN, failed: "#EF4444",
};
const TYPE_ICON: Record<string, string> = {
  upi: "phone-portrait-outline", card: "card-outline", bank: "business-outline",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtCurrency(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function TxRow({ item }: { item: Tx }) {
  const meta = TX_META[item.type] || { icon: "ellipse", color: C.textSecondary };
  const isCredit = item.amount > 0;
  return (
    <View style={s.txRow}>
      <View style={[s.txIcon, { backgroundColor: `${meta.color}18` }]}>
        <Ionicons name={`${meta.icon}-outline` as any} size={18} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.txDesc} numberOfLines={1}>{item.description}</Text>
        <Text style={s.txDate}>{fmtDate(item.createdAt)}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.txAmount, { color: isCredit ? GREEN : "#EF4444" }]}>
          {isCredit ? "+" : "-"}{fmtCurrency(item.amount)}
        </Text>
        <Text style={s.txBalance}>Bal: {fmtCurrency(item.balanceAfter)}</Text>
      </View>
    </View>
  );
}

function PayoutRow({ item }: { item: Payout }) {
  const statusColor = STATUS_COLOR[item.status] || C.textSecondary;
  return (
    <View style={s.txRow}>
      <View style={[s.txIcon, { backgroundColor: `${PURPLE}18` }]}>
        <Ionicons name="send-outline" size={18} color={PURPLE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.txDesc}>{item.method === "upi" ? "UPI Payout" : item.method === "instant" ? "Instant Payout" : "Weekly Payout"}</Text>
        {item.maskedDisplay && <Text style={s.txDate}>{item.maskedDisplay}</Text>}
        <Text style={s.txDate}>{fmtDate(item.createdAt)}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.txAmount, { color: PURPLE }]}>-{fmtCurrency(item.amount)}</Text>
        <View style={[s.statusBadge, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[s.statusText, { color: statusColor }]}>{item.status}</Text>
        </View>
      </View>
    </View>
  );
}

export default function WalletTab() {
  const { user } = useAuth();
  return user?.role === "provider" || user?.role === "both"
    ? <ProviderWalletTab />
    : <CustomerWallet />;
}

function ProviderWalletTab() {
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

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedMethod,  setSelectedMethod]  = useState<PayMethod | null>(null);
  const [adHocUpi,        setAdHocUpi]        = useState("");
  const [payingOut,       setPayingOut]       = useState(false);
  const [savingPref,      setSavingPref]      = useState(false);

  const [showAddMethod, setShowAddMethod]   = useState(false);
  const [addType,       setAddType]         = useState<"upi"|"card"|"bank">("upi");
  const [addLabel,      setAddLabel]        = useState("");
  const [addUpi,        setAddUpi]          = useState("");
  const [addCard,       setAddCard]         = useState("");
  const [addCardName,   setAddCardName]     = useState("");
  const [addCardExpiry, setAddCardExpiry]   = useState("");
  const [addBank,       setAddBank]         = useState("");
  const [addAccount,    setAddAccount]      = useState("");
  const [addIfsc,       setAddIfsc]         = useState("");
  const [addingMethod,  setAddingMethod]    = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [w, methodsRes, pi] = await Promise.all([
        get<ProviderWallet>("/wallet/provider"),
        get<{ methods: PayMethod[] } | PayMethod[]>("/wallet/provider/methods"),
        get<PayoutInfo>("/wallet/provider/payout/info").catch(() => null),
      ]);
      setWallet(w);
      // API returns { methods: [...] } — unwrap safely
      const methodList = Array.isArray(methodsRes)
        ? methodsRes
        : (methodsRes as any).methods ?? [];
      setMethods(methodList);
      if (pi) setPayoutInfo(pi);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load wallet");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  function onRefresh() { setRefreshing(true); fetchData(); }

  async function handleInstantPayout() {
    const balance = wallet?.balance ?? 0;
    if (balance <= INSTANT_FEE) {
      Alert.alert("Insufficient Balance", `You need more than ₹${INSTANT_FEE} to request an instant payout.`);
      return;
    }
    const net = balance - INSTANT_FEE;
    const defaultM = selectedMethod ?? payoutInfo?.defaultMethod;
    if (!defaultM && !adHocUpi.trim()) {
      Alert.alert("No Payout Method", "Please add a payment method first, or enter a UPI ID below.");
      return;
    }
    Alert.alert(
      "Confirm Instant Payout",
      `Payout: ₹${net.toFixed(2)}\nFee: ₹${INSTANT_FEE}\nTo: ${defaultM ? defaultM.maskedDisplay : adHocUpi}\n\nProceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm", onPress: async () => {
            setPayingOut(true);
            try {
              await post("/wallet/provider/payout/instant", {
                amount: net,
                paymentMethodId: selectedMethod?.id || defaultM?.id,
                upiId: !selectedMethod && !defaultM ? adHocUpi.trim() : undefined,
              });
              AudioService.playPayoutSuccess().catch(() => {});
              Alert.alert("Payout Requested", "Your payout has been initiated.");
              setShowPayoutModal(false);
              setAdHocUpi("");
              fetchData();
            } catch (e: any) {
              AudioService.playPaymentFail().catch(() => {});
              Alert.alert("Error", e?.message || "Payout failed");
            } finally {
              setPayingOut(false);
            }
          }
        }
      ]
    );
  }

  async function handleSavePref(pref: string) {
    setSavingPref(true);
    try {
      await put("/wallet/provider/payout-preference", { preference: pref });
      setWallet(prev => prev ? { ...prev, payoutPreference: pref } : prev);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save preference");
    } finally {
      setSavingPref(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await put(`/wallet/provider/methods/${id}/default`, {});
      setMethods(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to set default");
    }
  }

  async function handleDeleteMethod(id: string) {
    Alert.alert("Delete Method", "Remove this payment method?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await del(`/wallet/provider/methods/${id}`);
          setMethods(prev => prev.filter(m => m.id !== id));
        } catch (e: any) {
          Alert.alert("Error", e?.message || "Failed to delete");
        }
      }},
    ]);
  }

  function resetAddForm() {
    setAddLabel(""); setAddUpi(""); setAddCard(""); setAddCardName("");
    setAddCardExpiry(""); setAddBank(""); setAddAccount(""); setAddIfsc("");
    setAddType("upi");
  }

  async function handleAddMethod() {
    if (!addLabel.trim()) { Alert.alert("Required", "Please enter a label for this method."); return; }
    if (addType === "upi" && !addUpi.trim()) { Alert.alert("Required", "Enter your UPI ID."); return; }
    if (addType === "card" && !addCard.trim()) { Alert.alert("Required", "Enter your card number."); return; }
    if (addType === "bank" && (!addBank.trim() || !addAccount.trim() || !addIfsc.trim())) {
      Alert.alert("Required", "Please fill in all bank details."); return;
    }
    setAddingMethod(true);
    try {
      const payload: any = { type: addType, label: addLabel.trim() };
      if (addType === "upi") payload.upiId = addUpi.trim();
      if (addType === "card") { payload.cardNumber = addCard.replace(/\s/g, ""); payload.cardholderName = addCardName; payload.expiry = addCardExpiry; }
      if (addType === "bank") { payload.bankName = addBank; payload.accountNumber = addAccount; payload.ifsc = addIfsc; }
      await post("/wallet/provider/methods", payload);
      setShowAddMethod(false);
      resetAddForm();
      // Reload fresh list instead of appending partial API response
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to add method");
    } finally {
      setAddingMethod(false);
    }
  }

  const balance      = wallet?.balance ?? 0;
  const monthEarn    = wallet?.monthEarnings ?? 0;
  const totalEarn    = wallet?.totalEarnings ?? 0;
  const txList       = wallet?.transactions ?? [];
  const payoutList   = wallet?.payouts ?? [];
  const currentPref  = wallet?.payoutPreference ?? "wallet";
  const defaultMethod= payoutInfo?.defaultMethod ?? methods.find(m => m.isDefault) ?? null;

  const listData: (Tx | Payout)[] = activeTab === "transactions" ? txList : payoutList;

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      {/* ── Instant Payout Modal ── */}
      <Modal visible={showPayoutModal} transparent animationType="slide" onRequestClose={() => setShowPayoutModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Instant Payout</Text>

            <View style={s.feeBreakdown}>
              <View style={s.feeRow}>
                <Text style={s.feeLabel}>Wallet Balance</Text>
                <Text style={s.feeValue}>{fmtCurrency(balance)}</Text>
              </View>
              <View style={s.feeRow}>
                <Text style={s.feeLabel}>Instant Fee</Text>
                <Text style={[s.feeValue, { color: "#EF4444" }]}>- ₹{INSTANT_FEE}.00</Text>
              </View>
              <View style={[s.feeRow, s.feeTotalRow]}>
                <Text style={s.feeTotalLabel}>You Receive</Text>
                <Text style={s.feeTotalValue}>{fmtCurrency(Math.max(0, balance - INSTANT_FEE))}</Text>
              </View>
            </View>

            <Text style={s.modalSubhead}>Payout to</Text>
            {methods.length > 0 ? (
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                {methods.map(m => (
                  <Pressable key={m.id} style={[s.methodChip, selectedMethod?.id === m.id && s.methodChipActive]}
                    onPress={() => setSelectedMethod(m)}>
                    <Ionicons name={TYPE_ICON[m.type] as any} size={16} color={selectedMethod?.id === m.id ? ORANGE : C.textSecondary} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={s.chipLabel}>{m.label}</Text>
                      <Text style={s.chipSub}>{m.maskedDisplay}</Text>
                    </View>
                    {m.isDefault && <View style={s.defaultPill}><Text style={s.defaultPillText}>Default</Text></View>}
                    {selectedMethod?.id === m.id && <Ionicons name="checkmark-circle" size={18} color={ORANGE} />}
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={{ marginBottom: 8 }}>
                <Text style={s.noMethodText}>No saved methods — enter UPI ID:</Text>
                <TextInput style={s.input} value={adHocUpi} onChangeText={setAdHocUpi}
                  placeholder="yourname@upi" placeholderTextColor={C.textTertiary}
                  autoCapitalize="none" keyboardType="email-address" />
              </View>
            )}

            <View style={s.modalActions}>
              <Button3D faceStyle={s.cancelBtn} onPress={() => { setShowPayoutModal(false); setSelectedMethod(null); setAdHocUpi(""); }}>
                <Text style={s.cancelText}>Cancel</Text>
              </Button3D>
              <Button3D faceStyle={[s.payoutConfirmBtn, payingOut && { opacity: 0.6 }]}
                onPress={handleInstantPayout} disabled={payingOut}>
                {payingOut
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="flash" size={16} color="#fff" /><Text style={s.payoutConfirmText}>Confirm Payout</Text></>}
              </Button3D>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Header ── */}
      <LinearGradient colors={[NAVY, NAVY2]} style={s.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={s.headerCircle1} />
        <View style={s.headerCircle2} />
        <Text style={s.headerTitle}>Earnings & Wallet</Text>

        {/* Balance row */}
        {loading ? (
          <View style={s.balancePlaceholder} />
        ) : (
          <View style={s.balanceWrap}>
            <Text style={s.balanceLabel}>Available Balance</Text>
            <Text style={s.balanceAmount}>{fmtCurrency(balance)}</Text>
            <View style={s.balanceMeta}>
              <View style={s.metaChip}>
                <Ionicons name="trending-up-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={s.metaChipText}>This month: {fmtCurrency(monthEarn)}</Text>
              </View>
              <View style={s.metaChip}>
                <Ionicons name="wallet-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={s.metaChipText}>Total: {fmtCurrency(totalEarn)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Payout action buttons */}
        <Button3D faceStyle={s.actionBtn} onPress={() => router.push("/customer-wallet")}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={s.actionBtnText}>Add Money</Text>
        </Button3D>
        <View style={s.actionRow}>
          <Button3D faceStyle={s.actionBtn}
            onPress={() => { setSelectedMethod(defaultMethod); setShowPayoutModal(true); }}>
            <Ionicons name="flash-outline" size={18} color="#fff" />
            <Text style={s.actionBtnText}>Instant{"\n"}Payout</Text>
          </Button3D>
          <View style={s.actionDivider} />
          <Button3D faceStyle={s.actionBtn} onPress={() => setShowAddMethod(v => !v)}>
            <Ionicons name="card-outline" size={18} color="#fff" />
            <Text style={s.actionBtnText}>Payment{"\n"}Methods</Text>
          </Button3D>
          <View style={s.actionDivider} />
          <Button3D faceStyle={s.actionBtn}
            onPress={() => handleSavePref(currentPref === "weekly" ? "wallet" : "weekly")}>
            {savingPref
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="calendar-outline" size={18} color="#fff" />}
            <Text style={s.actionBtnText}>
              {currentPref === "weekly" ? "Weekly\nAuto ✓" : "Weekly\nAuto"}
            </Text>
          </Button3D>
        </View>

        {/* Monday payout banner */}
        {currentPref === "weekly" && payoutInfo?.nextMondayLabel && (
          <View style={s.mondayBanner}>
            <Ionicons name="alarm-outline" size={13} color={GOLD} />
            <Text style={s.mondayText}>Next auto-payout: {payoutInfo.nextMondayLabel} @ 9 AM IST</Text>
          </View>
        )}
      </LinearGradient>

      {/* ── Payment Methods (collapsible) ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {/* Add Method Form */}
              {showAddMethod && (
                <View style={s.sheet}>
                  <View style={s.sheetTitleRow}>
                    <Text style={s.sheetTitle}>Payment Methods</Text>
                    <Pressable onPress={() => { setShowAddMethod(false); resetAddForm(); }}>
                      <Ionicons name="close" size={20} color={C.textSecondary} />
                    </Pressable>
                  </View>

                  {/* Existing methods */}
                  {methods.map(m => (
                    <View key={m.id} style={s.methodRow}>
                      <View style={s.methodIconWrap}>
                        <Ionicons name={TYPE_ICON[m.type] as any} size={16} color={ORANGE} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.methodLabel}>{m.label}</Text>
                        <Text style={s.methodMasked}>{m.maskedDisplay}</Text>
                      </View>
                      {m.isDefault
                        ? <View style={s.defaultBadge}><Text style={s.defaultBadgeText}>Default</Text></View>
                        : <Pressable onPress={() => handleSetDefault(m.id)} hitSlop={8}>
                            <Text style={s.setDefaultText}>Set default</Text>
                          </Pressable>}
                      <Pressable onPress={() => handleDeleteMethod(m.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </Pressable>
                    </View>
                  ))}

                  {/* Add new method form */}
                  <Text style={[s.sheetTitle, { fontSize: 13, marginTop: 12, marginBottom: 8 }]}>Add New Method</Text>
                  <View style={s.typeTabs}>
                    {(["upi", "card", "bank"] as const).map(t => (
                      <Pressable key={t} style={[s.typeTab, addType === t && s.typeTabActive]} onPress={() => setAddType(t)}>
                        <Ionicons name={TYPE_ICON[t] as any} size={14} color={addType === t ? ORANGE : C.textSecondary} />
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
                        placeholder="name@upi" placeholderTextColor={C.textTertiary}
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
                        placeholder="Name on card" placeholderTextColor={C.textTertiary} autoCapitalize="words" />
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
                        placeholder="Account number" placeholderTextColor={C.textTertiary} keyboardType="number-pad" />
                      <Text style={s.fieldLabel}>IFSC Code</Text>
                      <TextInput style={s.input} value={addIfsc} onChangeText={t => setAddIfsc(t.toUpperCase())}
                        placeholder="SBIN0001234" placeholderTextColor={C.textTertiary} autoCapitalize="characters" />
                    </>
                  )}

                  <View style={s.securityNote}>
                    <Ionicons name="lock-closed" size={12} color={PURPLE} />
                    <Text style={s.securityNoteText}>Stored with AES-256-GCM encryption. Card numbers are never shown again.</Text>
                  </View>

                  <View style={s.sheetActions}>
                    <Button3D faceStyle={s.cancelBtn} onPress={() => { setShowAddMethod(false); resetAddForm(); }}>
                      <Text style={s.cancelText}>Cancel</Text>
                    </Button3D>
                    <Button3D faceStyle={[s.confirmBtn, addingMethod && { opacity: 0.6 }]}
                      onPress={handleAddMethod} disabled={addingMethod}>
                      {addingMethod
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <><Ionicons name="shield-checkmark" size={14} color="#fff" /><Text style={s.confirmText}>Save Securely</Text></>}
                    </Button3D>
                  </View>
                </View>
              )}

              {/* Tab switcher */}
              <View style={s.tabSwitcher}>
                <Pressable style={[s.switchTab, activeTab === "transactions" && s.switchTabActive]}
                  onPress={() => setActiveTab("transactions")}>
                  <Ionicons name="receipt-outline" size={15} color={activeTab === "transactions" ? ORANGE : C.textSecondary} />
                  <Text style={[s.switchTabText, activeTab === "transactions" && { color: ORANGE }]}>
                    Earnings ({txList.length})
                  </Text>
                </Pressable>
                <Pressable style={[s.switchTab, activeTab === "payouts" && s.switchTabActive]}
                  onPress={() => setActiveTab("payouts")}>
                  <Ionicons name="send-outline" size={15} color={activeTab === "payouts" ? ORANGE : C.textSecondary} />
                  <Text style={[s.switchTabText, activeTab === "payouts" && { color: ORANGE }]}>
                    Payouts ({payoutList.length})
                  </Text>
                </Pressable>
              </View>

              {loading && (
                <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
              )}

              {!loading && listData.length === 0 && (
                <View style={s.emptyWrap}>
                  <Ionicons name="receipt-outline" size={40} color={C.textTertiary} />
                  <Text style={s.emptyText}>
                    {activeTab === "transactions" ? "No earnings yet" : "No payouts yet"}
                  </Text>
                  <Text style={s.emptySub}>
                    {activeTab === "transactions"
                      ? "Completed bookings will credit your wallet"
                      : "Request a payout once you have a balance"}
                  </Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) =>
            activeTab === "transactions"
              ? <TxRow item={item as Tx} />
              : <PayoutRow item={item as Payout} />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6FA" },

  header: { paddingHorizontal: 20, paddingBottom: 20, overflow: "hidden" },
  headerCircle1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)", top: -60, right: -50 },
  headerCircle2: { position: "absolute", width: 140, height: 140, borderRadius: 70,  backgroundColor: "rgba(255,255,255,0.04)", bottom: -40, left: 30 },
  headerTitle: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },

  balancePlaceholder: { height: 90, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 16 },
  balanceWrap: { marginBottom: 16 },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" },
  balanceAmount: { color: "#fff", fontSize: 36, fontFamily: "Inter_700Bold", marginTop: 2 },
  balanceMeta: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  metaChipText: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_500Medium" },

  actionRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" },
  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 4 },
  actionDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 10 },
  actionBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },

  mondayBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "rgba(245,197,24,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  mondayText: { color: GOLD, fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },

  sheet: { backgroundColor: "#fff", margin: 16, borderRadius: 16, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  sheetTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 14 },

  tabSwitcher: { flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  switchTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11 },
  switchTabActive: { borderBottomWidth: 2, borderBottomColor: ORANGE },
  switchTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },

  txRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 12, gap: 10, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  txIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  txDesc: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  txDate: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txBalance: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginTop: 4 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },

  emptyWrap: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptySub: { fontSize: 13, color: C.textTertiary, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },

  methodRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, marginBottom: 8 },
  methodIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${ORANGE}18`, alignItems: "center", justifyContent: "center", marginRight: 10 },
  methodLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  methodMasked: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  defaultBadge: { backgroundColor: `${GREEN}18`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  defaultBadgeText: { color: GREEN, fontSize: 10, fontFamily: "Inter_600SemiBold" },
  setDefaultText: { color: ORANGE, fontSize: 11, fontFamily: "Inter_500Medium" },

  typeTabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  typeTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: "#F9FAFB" },
  typeTabActive: { borderColor: ORANGE, backgroundColor: `${ORANGE}0D` },
  typeTabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },

  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },

  securityNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: `${PURPLE}0D`, padding: 10, borderRadius: 8 },
  securityNoteText: { fontSize: 11, color: PURPLE, fontFamily: "Inter_400Regular", flex: 1 },

  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: "#fff" },
  cancelText: { color: C.textSecondary, fontSize: 14, fontFamily: "Inter_500Medium" },
  confirmBtn: { flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: NAVY },
  confirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 16, textAlign: "center" },
  modalSubhead: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 10, marginTop: 4 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },

  feeBreakdown: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginBottom: 16, gap: 8 },
  feeRow: { flexDirection: "row", justifyContent: "space-between" },
  feeLabel: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  feeValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  feeTotalRow: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: C.border },
  feeTotalLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text },
  feeTotalValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: GREEN },

  methodChip: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  methodChipActive: { borderColor: ORANGE, backgroundColor: `${ORANGE}08` },
  chipLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  chipSub: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  defaultPill: { backgroundColor: `${GREEN}18`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginRight: 8 },
  defaultPillText: { color: GREEN, fontSize: 10, fontFamily: "Inter_600SemiBold" },
  noMethodText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginBottom: 8 },

  payoutConfirmBtn: { flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: NAVY },
  payoutConfirmText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
