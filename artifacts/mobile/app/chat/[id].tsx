import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Chat, Message } from "@/types";

const C = Colors.light;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { get, post } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    loadChat();
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [id]);

  async function loadChat() {
    try {
      const [chats, msgs] = await Promise.all([
        get<Chat[]>("/chats"),
        get<Message[]>(`/chats/${id}/messages`),
      ]);
      const found = chats.find((c) => c.id === id) || null;
      setChat(found);
      setMessages(msgs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    try {
      const msgs = await get<Message[]>(`/chats/${id}/messages`);
      setMessages(msgs);
    } catch {}
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    try {
      const msg = await post<Message>(`/chats/${id}/messages`, { content });
      setMessages((prev) => [msg, ...prev]);
      Haptics.selectionAsync();
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  const topPad = isWeb ? 67 : insets.top;

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  // Inverted list — newest at bottom
  const sortedMessages = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Header */}
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 10 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(chat?.otherUserName || "U")[0].toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{chat?.otherUserName || "User"}</Text>
            {chat?.listingTitle && (
              <Text style={styles.headerListing} numberOfLines={1}>Re: {chat.listingTitle}</Text>
            )}
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatRef}
          data={sortedMessages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={40} color={C.textTertiary} />
              <Text style={styles.emptyChatText}>Say hello!</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.id;
            return (
              <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapRight]}>
                {!isMe && (
                  <View style={styles.smallAvatar}>
                    <Text style={styles.smallAvatarText}>{(item.senderName || "U")[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
                    {new Date(item.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: (isWeb ? 34 : insets.bottom) + 8 }]}>
          <TextInput
            style={styles.inputField}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={C.textTertiary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <Pressable
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  headerName: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#fff" },
  headerListing: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular" },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexGrow: 1,
  },
  bubbleWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "85%",
  },
  bubbleWrapRight: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  smallAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
  },
  smallAvatarText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 3,
    maxWidth: "100%",
  },
  bubbleMe: { backgroundColor: C.tint, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: C.backgroundSecondary, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", color: C.text, lineHeight: 20 },
  bubbleTextMe: { color: "#fff" },
  bubbleTime: { fontSize: 10, color: C.textTertiary, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  bubbleTimeMe: { color: "rgba(255,255,255,0.7)" },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 60 },
  emptyChatText: { fontSize: 15, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  inputBar: {
    backgroundColor: C.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
  },
  inputField: {
    flex: 1,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.tint,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.textTertiary },
});
