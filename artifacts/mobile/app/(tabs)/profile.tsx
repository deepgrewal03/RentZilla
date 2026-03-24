import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StarRating } from "@/components/StarRating";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;

interface MenuItemProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  color?: string;
  rightIcon?: string;
}

function MenuItem({ icon, label, value, onPress, color = C.text, rightIcon = "chevron-forward" }: MenuItemProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.menuIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
      </View>
      <Text style={[styles.menuLabel, { color }]} numberOfLines={1}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      {onPress && <Ionicons name={rightIcon as keyof typeof Ionicons.glyphMap} size={18} color={C.textTertiary} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const { put } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [location, setLocation] = useState(user?.location || "");
  const [saving, setSaving] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await put<{ id: string; name: string | null; location: string | null }>("/users/me", { name, location });
      updateUser({ name: updated.name, location: updated.location });
      setEditMode(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/sign-in");
        },
      },
    ]);
  }

  if (!user) return null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable onPress={() => { Haptics.selectionAsync(); setEditMode(!editMode); }}>
          <Text style={styles.editText}>{editMode ? "Cancel" : "Edit"}</Text>
        </Pressable>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        {/* Avatar & Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{(user.name || user.phone)[0].toUpperCase()}</Text>
          </View>
          {editMode ? (
            <View style={styles.editFields}>
              <TextInput
                style={styles.editInput}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={C.textTertiary}
              />
              <TextInput
                style={styles.editInput}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Ludhiana, Punjab"
                placeholderTextColor={C.textTertiary}
              />
              <Pressable onPress={saveProfile} disabled={saving} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.userName}>{user.name || "Set your name"}</Text>
              <Text style={styles.userPhone}>{user.phone}</Text>
              {user.location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={C.textSecondary} />
                  <Text style={styles.locationText}>{user.location}</Text>
                </View>
              ) : null}
              <View style={styles.roleBadge}>
                <Ionicons name={user.role === "provider" ? "storefront-outline" : "search-outline"} size={13} color={C.tint} />
                <Text style={styles.roleText}>{user.role === "provider" ? "Provider" : "Customer"}</Text>
              </View>
              {user.rating != null && (
                <View style={styles.ratingRow}>
                  <StarRating rating={Math.round(user.rating)} size={16} />
                  <Text style={styles.ratingText}>{user.rating.toFixed(1)} ({user.reviewCount} reviews)</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={22} color={C.tint} />
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={22} color={C.tint} />
            <Text style={styles.statLabel}>Chats</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="star-outline" size={22} color={C.tint} />
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSection}>Activity</Text>
          <MenuItem icon="calendar-outline" label="My Bookings" color={C.tint} onPress={() => router.push("/(tabs)/bookings")} />
          <MenuItem icon="chatbubble-outline" label="Messages" color="#3B82F6" onPress={() => router.push("/(tabs)/messages")} />
          {user.role === "provider" && (
            <MenuItem icon="list-outline" label="My Listings" color="#22C55E" onPress={() => router.push("/(tabs)/dashboard")} />
          )}
        </View>

        <View style={styles.menuCard}>
          <Text style={styles.menuSection}>Account</Text>
          <MenuItem
            icon="phone-portrait-outline"
            label="Phone Number"
            value={user.phone}
            color={C.textSecondary}
          />
          <MenuItem
            icon="location-outline"
            label="Location"
            value={user.location || "Not set"}
            color={C.textSecondary}
            onPress={() => setEditMode(true)}
          />
          <MenuItem
            icon="log-out-outline"
            label="Logout"
            color={C.error}
            onPress={handleLogout}
          />
        </View>

        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  editText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
  scroll: { flex: 1 },
  profileCard: {
    margin: 20,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${C.tint}20`,
    borderWidth: 3,
    borderColor: `${C.tint}40`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.tint,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  userPhone: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${C.tint}15`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.tint,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  editFields: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  editInput: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  saveBtn: {
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  statsRow: {
    marginHorizontal: 20,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    flexDirection: "row",
    paddingVertical: 20,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  statDivider: {
    width: 1,
    backgroundColor: C.border,
  },
  menuCard: {
    marginHorizontal: 20,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
    marginBottom: 14,
  },
  menuSection: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.textTertiary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  menuValue: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
});
