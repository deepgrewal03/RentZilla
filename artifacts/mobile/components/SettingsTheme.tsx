import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DrawerTokens as D } from "@/constants/drawerTokens";

const FARM_BG = require("@/assets/images/home-farm-background.jpg");

/** Warm farm-market accent palette shared by both Settings screens. */
export const SettingsPalette = {
  page: "#FBF6EE",
  card: D.surface,
  cardBorder: D.creamBorder,
  divider: D.divider,
  primary: D.primary,
  text: D.text,
  textSecondary: D.textSecondary,
  pressed: D.activeBg,
  chevronBg: D.chevronBg,
};

type Accent = { fg: string; bg: string };
const ACCENTS: Record<string, Accent> = {
  orange: { fg: "#E8660F", bg: "#FFE7D1" },
  sky: { fg: "#2F80C9", bg: "#E3F0FB" },
  leaf: { fg: "#2E9A57", bg: "#E1F4E7" },
  gold: { fg: "#B98100", bg: "#FFF1C7" },
  berry: { fg: "#C2417A", bg: "#FBE3EE" },
  plum: { fg: "#7B57C2", bg: "#EEE7FA" },
  teal: { fg: "#13897F", bg: "#DDF3F0" },
  red: { fg: "#E23A55", bg: "#FDE5E9" },
};

const ICON_ACCENT: Record<string, keyof typeof ACCENTS> = {
  person: "orange", create: "orange", mail: "sky", shield: "leaf", lock: "plum", key: "plum",
  notifications: "gold", eye: "teal", globe: "sky", call: "leaf", ban: "red", flag: "berry",
  language: "sky", location: "berry", settings: "teal", moon: "plum", alert: "gold",
  ribbon: "gold", help: "teal", document: "orange", warning: "red", trash: "red",
  swap: "orange", briefcase: "teal", cart: "orange", volume: "berry", musical: "berry",
  phone: "leaf", chatbubble: "sky", information: "sky", star: "gold", log: "red",
};

export function accentFor(icon: string, override?: string): Accent {
  if (override) return { fg: override, bg: `${override}1F` };
  const key = icon.split("-")[0];
  const name = ICON_ACCENT[key];
  if (name) return ACCENTS[name];
  const keys = Object.keys(ACCENTS);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ACCENTS[keys[h % keys.length]];
}

/** Farmland hero header matching the SideDrawer, with optional back button. */
export function SettingsHero({ topPad, title, subtitle, onBack }: {
  topPad: number; title: string; subtitle?: string; onBack?: () => void;
}) {
  return (
    <View style={[hs.hero, { paddingTop: topPad + 10 }]}>
      <Image source={FARM_BG} contentFit="cover" accessible={false} style={StyleSheet.absoluteFill} />
      <View style={hs.tint} pointerEvents="none" />
      <View style={hs.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [hs.back, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="arrow-back" size={22} color={D.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <View style={hs.brandRow}>
            <Ionicons name="leaf" size={14} color={D.white} />
            <Text style={hs.brand}>RentZilla</Text>
          </View>
          <Text style={hs.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={hs.sub}>{subtitle}</Text> : null}
        </View>
        <View style={hs.gear}>
          <Ionicons name="settings" size={22} color={D.primary} />
        </View>
      </View>
    </View>
  );
}

const shadow = "rgba(80,30,0,0.4)";
const hs = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingBottom: 46, backgroundColor: D.primary, overflow: "hidden" },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,122,24,0.28)" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: D.closeBg, alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  brand: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: D.white, letterSpacing: 0.6, textTransform: "uppercase",
    textShadowColor: shadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  title: {
    fontSize: 28, fontFamily: "Inter_700Bold", fontWeight: "700", color: D.white, letterSpacing: -0.5, marginTop: 2,
    textShadowColor: shadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  sub: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: D.white, marginTop: 2,
    textShadowColor: shadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  gear: { width: 46, height: 46, borderRadius: 16, backgroundColor: D.cream, borderWidth: 1, borderColor: D.creamBorder, alignItems: "center", justifyContent: "center" },
});
