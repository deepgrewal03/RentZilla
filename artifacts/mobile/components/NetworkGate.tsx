import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_BASE_URL } from "@/constants/apiUrl";

const USE_NATIVE_DRIVER = Platform.OS !== "web";
const ORANGE = "#FF7A18";
const ORANGE2 = "#FF9F43";
const BG = "#F5F6FA";

const STARTUP_GRACE_MS = 5000;
const POLL_INTERVAL_MS = 8000;
const FAILURES_TO_SHOW = 2;

async function checkRealConnectivity(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${API_BASE_URL}/api/healthz`, {
      method: "GET",
      signal: ctrl.signal,
      headers: { "Cache-Control": "no-cache" },
    });
    clearTimeout(timer);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

interface Props {
  children: React.ReactNode;
}

export default function NetworkGate({ children }: Props) {
  const [isOffline, setIsOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const offlineRef = useRef(false);
  const failCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOverlay = useCallback((offline: boolean) => {
    Animated.timing(fadeAnim, {
      toValue: offline ? 1 : 0,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    setIsOffline(offline);
    offlineRef.current = offline;
  }, [fadeAnim]);

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();
  }, [pulseAnim]);

  const markOnline = useCallback(() => {
    failCount.current = 0;
    if (offlineRef.current) {
      showOverlay(false);
    }
  }, [showOverlay]);

  const doConnectivityCheck = useCallback(async () => {
    const reachable = await checkRealConnectivity();
    if (reachable) {
      markOnline();
    } else {
      failCount.current += 1;
      if (failCount.current >= FAILURES_TO_SHOW) {
        showOverlay(true);
      }
    }
  }, [markOnline, showOverlay]);

  const schedulePoll = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(async () => {
      await doConnectivityCheck();
      if (offlineRef.current) {
        schedulePoll();
      }
    }, POLL_INTERVAL_MS);
  }, [doConnectivityCheck]);

  useEffect(() => {
    startPulse();

    const graceTimer = setTimeout(async () => {
      await doConnectivityCheck();
      if (offlineRef.current) {
        schedulePoll();
      }
    }, STARTUP_GRACE_MS);

    return () => {
      clearTimeout(graceTimer);
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [doConnectivityCheck, schedulePoll, startPulse]);

  const handleRetry = async () => {
    setChecking(true);
    failCount.current = 0;
    const real = await checkRealConnectivity();
    setChecking(false);
    if (real) {
      markOnline();
    } else {
      failCount.current = FAILURES_TO_SHOW;
      showOverlay(true);
      schedulePoll();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {children}

      {isOffline && (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity: fadeAnim }]}>
          <StatusBar barStyle="light-content" backgroundColor={ORANGE} />
          <LinearGradient
            colors={[ORANGE, ORANGE2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.topSection}>
            <Animated.View style={[styles.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.iconEmoji}>📡</Text>
            </Animated.View>
            <Text style={styles.brandName}>RentZilla</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.title}>No Internet Connection</Text>
            <Text style={styles.subtitle}>
              RentZilla needs WiFi or mobile data to work.{"\n"}
              Please check your connection and try again.
            </Text>

            <View style={styles.tipRow}>
              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>📶</Text>
                <Text style={styles.tipText}>Turn on WiFi</Text>
              </View>
              <View style={styles.tipDivider} />
              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>📱</Text>
                <Text style={styles.tipText}>Enable Mobile Data</Text>
              </View>
              <View style={styles.tipDivider} />
              <View style={styles.tipItem}>
                <Text style={styles.tipIcon}>✈️</Text>
                <Text style={styles.tipText}>Disable Airplane Mode</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.retryPressed]}
              onPress={handleRetry}
              disabled={checking}
            >
              <LinearGradient
                colors={[ORANGE, ORANGE2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.retryGradient}
              >
                <Text style={styles.retryText}>
                  {checking ? "Checking…" : "🔄  Try Again"}
                </Text>
              </LinearGradient>
            </Pressable>

            <Text style={styles.autoNote}>
              Will reconnect automatically when connection is restored
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 10000,
    backgroundColor: BG,
  },
  topSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconEmoji: { fontSize: 48 },
  brandName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  card: {
    margin: 20,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    marginBottom: 40,
  },
  errorIcon: { fontSize: 36, marginBottom: 12 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    width: "100%",
  },
  tipItem: { flex: 1, alignItems: "center", gap: 6 },
  tipIcon: { fontSize: 22 },
  tipText: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "500",
  },
  tipDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 4,
  },
  retryBtn: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
  },
  retryPressed: { opacity: 0.85 },
  retryGradient: { paddingVertical: 16, alignItems: "center" },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  autoNote: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
