import { Tabs, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import HomeVisual from "@/constants/homeVisualTokens";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;

function TabIcon({ name, color, focused }: { name: keyof typeof Feather.glyphMap; color: string; focused: boolean }) {
  return (
    <View style={styles.tabIconWrap}>
      <Feather name={name} size={22} color={color} />
      <View style={[styles.activeMark, focused && styles.activeMarkVisible]} />
    </View>
  );
}

export default function TabLayout() {
  const { user, activeMode } = useAuth();
  const { t } = useLang();
  const { get } = useApi();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "android" ? insets.bottom : 0;

  const isPureProvider = user?.role === "provider";
  const isBoth = user?.role === "both";
  const inProviderMode = isPureProvider || (isBoth && activeMode === "provider");
  const inCustomerMode = !inProviderMode;

  // Track current tab path so we re-check when provider switches tabs
  const pathname = usePathname();

  // null = still loading, true/false = confirmed
  const [hasCars, setHasCars] = useState<boolean | null>(null);

  useEffect(() => {
    if (!inProviderMode || !user) {
      setHasCars(null);
      return;
    }
    let cancelled = false;
    get<{ hasCars: boolean }>("/provider/has-cars")
      .then(res => { if (!cancelled) setHasCars(res.hasCars); })
      .catch(() => { if (!cancelled) setHasCars(false); });
    return () => { cancelled = true; };
    // Re-check on every tab switch so adding/deleting a car listing is reflected instantly
  }, [inProviderMode, user?.id, pathname]);

  // For providers: show Cars tab only when confirmed true (null = loading = hide to prevent flicker for those without cars)
  // For customers: always show
  const carsHref = inProviderMode
    ? (hasCars === true ? undefined : null)
    : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.tint,
        tabBarInactiveTintColor: isDark ? "#888888" : "#999999",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: isDark ? "#353A32" : "#ECEAE3",
          elevation: 12,
          shadowColor: "#404C34",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          height: isWeb ? 68 : 66 + bottomInset,
          paddingBottom: isIOS ? 8 : bottomInset + 6,
          paddingTop: 7,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF" }]} />
        ),
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10.5,
          marginTop: 1,
        },
        tabBarItemStyle: { paddingTop: 1 },
      }}
    >
      {/* ── Dashboard: FIRST for providers ── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t.dashboard,
          href: inProviderMode ? undefined : null,
          tabBarIcon: ({ color, focused }) => <TabIcon name="bar-chart-2" color={color} focused={focused} />,
        }}
      />

      {/* ── Home: FIRST for customers ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: t.home,
          href: inCustomerMode ? undefined : null,
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />

      {/* ── Search: customers only ── */}
      <Tabs.Screen
        name="search"
        options={{
          title: t.search,
          href: inCustomerMode ? undefined : null,
          tabBarIcon: ({ color, focused }) => <TabIcon name="search" color={color} focused={focused} />,
        }}
      />

      {/* ── Bookings: everyone ── */}
      <Tabs.Screen
        name="bookings"
        options={{
          title: t.bookings,
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" color={color} focused={focused} />,
        }}
      />

      {/* ── Cars: always for customers; providers only if they have car listings ── */}
      <Tabs.Screen
        name="cars"
        options={{
          title: "Rides",
          href: carsHref,
          tabBarIcon: ({ color, focused }) => <TabIcon name="truck" color={color} focused={focused} />,
        }}
      />

      {/* ── Wallet: providers only ── */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          href: inProviderMode ? undefined : null,
          tabBarIcon: ({ color, focused }) => <TabIcon name="credit-card" color={color} focused={focused} />,
        }}
      />

      {/* ── Hidden tabs (accessible via side drawer) ── */}
      <Tabs.Screen
        name="favorites"
        options={{
          title: t.favourites,
          href: null,
          tabBarIcon: ({ color, focused }) => <TabIcon name="heart" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t.messages,
          href: null,
          tabBarIcon: ({ color, focused }) => <TabIcon name="message-circle" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile,
          href: null,
          tabBarIcon: ({ color, focused }) => <TabIcon name="user" color={color} focused={focused} />,
        }}
      />

      {/* ── Settings: everyone ── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: { alignItems: "center", justifyContent: "flex-start", height: 28, gap: 1 },
  activeMark: { width: 14, height: 3, borderRadius: 3, backgroundColor: "transparent" },
  activeMarkVisible: { backgroundColor: HomeVisual.orange },
});
