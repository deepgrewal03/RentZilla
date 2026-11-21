import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { DrawerTokens as D } from "@/constants/drawerTokens";

const C = Colors.light;
const currency = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BookingPriceComparison({ normal, gold, active, historical = false }: {
  normal: number; gold: number; active: boolean; historical?: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (active || reduceMotion || historical || gold >= normal) { pulse.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.78, duration: 1400, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: Platform.OS !== "web" }),
    ]));
    animation.start();
    return () => { animation.stop(); pulse.setValue(1); };
  }, [active, reduceMotion, historical, gold, normal, pulse]);
  return (
    <View style={s.wrap} testID="booking-price-comparison">
      <View style={s.row}>
        <Text style={s.label}>Normal price{!active ? " · payable" : ""}</Text>
        <Text style={[s.price, active && s.strike]}>{currency(normal)}</Text>
      </View>
      <Animated.View style={[s.gold, { opacity: pulse }]}>
        <View style={s.row}>
          <View style={s.title}>
            <MaterialCommunityIcons name="crown" size={22} color={D.goldText} />
            <Text style={s.goldLabel}>Gold member price</Text>
          </View>
          <Text style={s.goldPrice}>{currency(gold)}</Text>
        </View>
        <Text style={s.note}>{active
          ? `${historical ? "Gold applied to this booking" : "Your payable price"} · Save ${currency(Math.max(0, normal - gold))}`
          : "Gold membership required · Not applied to your total"}</Text>
      </Animated.View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { gap: 10, marginVertical: 14 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text },
  price: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  strike: { textDecorationLine: "line-through", color: C.textSecondary },
  gold: { padding: 14, borderRadius: 16, backgroundColor: D.goldBg, borderWidth: 1, borderColor: D.goldBorder, gap: 6 },
  title: { flexDirection: "row", alignItems: "center", gap: 6 },
  goldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: D.goldText },
  goldPrice: { fontFamily: "Inter_700Bold", fontSize: 22, color: D.goldText },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, color: D.goldText },
});
