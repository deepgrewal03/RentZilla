import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Chat } from "@/types";

const C = Colors.light;

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Avatar({ name }: { name: string | null }) {
  const letter = (name || "?")[0].toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{letter}</Text>
    </View>
  );
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const { get } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => {
    fetchChats();
  }, []);

  async function fetchChats() {
    try {
      const data = await get<Chat[]>("/chats");
      setChats(data.sort((a, b) => {
        const at = a.lastMessageAt || a.createdAt;
        const bt = b.lastMessageAt || b.createdAt;
        return new Date(bt).getTime() - new Date(at).getTime();
      }));
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <Text style={styles.headerTitle}>Messages</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChats(); }} tintColor={C.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={C.tint} size="large" />
          </View>
        ) : chats.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="chatbubbles-outline" size={56} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No conversations</Text>
            <Text style={styles.emptyText}>Start a chat by tapping "Message" on any listing</Text>
          </View>
        ) : (
          chats.map((chat) => (
            <Pressable
              key={chat.id}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: chat.id } })}
              style={({ pressed }) => [styles.chatRow, { backgroundColor: pressed ? C.backgroundTertiary : C.backgroundSecondary }]}
            >
              <Avatar name={chat.otherUserName} />
              <View style={styles.chatBody}>
                <View style={styles.chatTop}>
                  <Text style={styles.chatName} numberOfLines={1}>{chat.otherUserName || "User"}</Text>
                  <Text style={styles.chatTime}>{chat.lastMessageAt ? timeAgo(chat.lastMessageAt) : ""}</Text>
                </View>
                {chat.listingTitle && (
                  <Text style={styles.chatListing} numberOfLines={1}>Re: {chat.listingTitle}</Text>
                )}
                <Text style={styles.chatLastMsg} numberOfLines={1}>
                  {chat.lastMessage || "Start the conversation..."}
                </Text>
              </View>
              {chat.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{chat.unreadCount}</Text>
                </View>
              )}
            </Pressable>
          ))
        )}
        <View style={{ height: isWeb ? 34 : 80 + insets.bottom }} />
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  scroll: { flex: 1 },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${C.tint}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.tint,
  },
  chatBody: { flex: 1, gap: 2 },
  chatTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    flex: 1,
  },
  chatTime: {
    fontSize: 11,
    color: C.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  chatListing: {
    fontSize: 11,
    color: C.tint,
    fontFamily: "Inter_500Medium",
  },
  chatLastMsg: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
