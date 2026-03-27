import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";

const C = Colors.light;

export default function TabLayout() {
  const { user, activeMode } = useAuth();
  const { t } = useLang();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const roles: string[] = (user as any)?.roles ?? [];
  const isPureProvider = user?.role === "provider";
  const isBoth = user?.role === "both";
  // In "provider" mode = pure provider OR "both" user currently in provider mode
  const inProviderMode = isPureProvider || (isBoth && activeMode === "provider");
  const inCustomerMode = !inProviderMode;

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

      {/* ── Cars: hidden for customers, shown for providers/drivers ── */}
      <Tabs.Screen
        name="cars"
        options={{
          title: "Cars",
          href: inCustomerMode ? null : undefined,
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
