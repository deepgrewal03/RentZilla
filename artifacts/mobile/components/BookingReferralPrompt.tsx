import React from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { DrawerTokens as D } from "@/constants/drawerTokens";
import Button3D from "@/components/Button3D";

const C = Colors.light;
export default function BookingReferralPrompt({ visible, onClose, onRefer }: {
  visible: boolean; onClose: () => void; onRefer: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.backdrop, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), paddingBottom: insets.bottom + 34 }]}>
        <ScrollView contentContainerStyle={s.scroll} style={{ width: "100%" }}>
          <View style={s.card} accessibilityViewIsModal testID="booking-referral-prompt">
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close referral invitation" style={s.close}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
            <LinearGradient colors={[C.tint, C.tintEnd]} style={s.gift}>
              <Ionicons name="gift" size={64} color={D.white} />
            </LinearGradient>
            <Text style={s.eyebrow}>BOOKING SUCCESSFUL</Text>
            <Text accessibilityRole="header" style={s.title}>Good things are{"\n"}better shared.</Text>
            <Text style={s.body}>Invite a friend to RentZilla and explore your referral rewards.</Text>
            <Button3D onPress={onRefer} color={C.tint} faceStyle={s.button} accessibilityLabel="Refer a Friend">
              <Ionicons name="gift-outline" size={22} color={D.white} />
              <Text style={s.buttonText}>Refer a Friend</Text>
            </Button3D>
            <Pressable onPress={onClose} accessibilityRole="button" style={s.dismiss}>
              <Text style={s.dismissText}>Close · View booking</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: D.backdrop, justifyContent: "center", alignItems: "center", paddingHorizontal: 22 },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  card: { width: "100%", maxWidth: 420, backgroundColor: D.cream, borderRadius: 28, padding: 26, alignItems: "center", gap: 14 },
  close: { alignSelf: "flex-end", minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  gift: { width: 108, height: 108, borderRadius: 30, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  eyebrow: { fontFamily: "Inter_700Bold", letterSpacing: 1.5, fontSize: 11, color: C.tintDark, marginTop: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 27, lineHeight: 34, textAlign: "center", color: C.text },
  body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23, textAlign: "center", color: C.textSecondary },
  button: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, padding: 16, width: "100%", borderRadius: 16 },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 16, color: D.white },
  dismiss: { padding: 12, minHeight: 44 },
  dismissText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
});
