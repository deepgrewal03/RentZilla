import { BlurView } from "expo-blur";
import { Tabs, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;

export default function TabLayout() {
  const { user, activeMode } = useAuth();
  const { t } = useLang();
  const { get } = useApi();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

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
        tabBarInactiveTintColor: C.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: isDark ? "#333" : C.border,
          elevation: 0,
          ...(isWeb ? { height: 64, paddingBottom: 8 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#000" : "#fff" }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
      }}
    >
      {/* ── Dashboard: FIRST for providers ── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t.dashboard,
          href: inProviderMode ? undefined : null,
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />

      {/* ── Home: FIRST for customers ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: t.home,
          href: inCustomerMode ? undefined : null,
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />

      {/* ── Search: customers only ── */}
      <Tabs.Screen
        name="search"
        options={{
          title: t.search,
          href: inCustomerMode ? undefined : null,
          tabBarIcon: ({ color }) => <Feather name="search" size={22} color={color} />,
        }}
      />

      {/* ── Bookings: everyone ── */}
      <Tabs.Screen
        name="bookings"
        options={{
          title: t.bookings,
          tabBarIcon: ({ color }) => <Feather name="calendar" size={22} color={color} />,
        }}
      />

      {/* ── Cars: always for customers; providers only if they have car listings ── */}
      <Tabs.Screen
        name="cars"
        options={{
          title: "Cars",
          href: carsHref,
          tabBarIcon: ({ color }) => <Feather name="truck" size={22} color={color} />,
        }}
      />

      {/* ── Hidden tabs (accessible via side drawer) ── */}
      <Tabs.Screen
        name="favorites"
        options={{
          title: t.favourites,
          href: null,
          tabBarIcon: ({ color }) => <Feather name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t.messages,
          href: null,
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile,
          href: null,
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />

      {/* ── Settings: everyone ── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
