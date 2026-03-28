import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

// ─── Shimmer atom ─────────────────────────────────────────────────────────────
function useShimmer(delay = 0) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 650,
          delay,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return opacity;
}

function Bone({
  w, h, r = 8, opacity, style,
}: {
  w: number | string; h: number; r?: number;
  opacity: Animated.Value; style?: object;
}) {
  return (
    <Animated.View
      style={[
        {
          width: w as any,
          height: h,
          borderRadius: r,
          backgroundColor: "#E0E0E0",
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── Listing card skeleton ────────────────────────────────────────────────────
// Mirrors the shape of ListingCard: full-width card, 160 h image, info rows below

export function ListingCardSkeleton({ delay = 0 }: { delay?: number }) {
  const opacity = useShimmer(delay);
  return (
    <View style={styles.listCard}>
      {/* Image */}
      <Bone w="100%" h={160} r={0} opacity={opacity} />
      {/* Info */}
      <View style={styles.listInfo}>
        <Bone w="65%" h={14} opacity={opacity} />
        <Bone w="45%" h={11} opacity={opacity} style={{ marginTop: 2 }} />
        <View style={styles.listFooter}>
          <Bone w={64} h={11} r={6} opacity={opacity} />
          <Bone w={72} h={14} r={6} opacity={opacity} />
        </View>
        <Bone w="30%" h={10} opacity={opacity} />
      </View>
    </View>
  );
}

// ─── Booking card skeleton ────────────────────────────────────────────────────
// Mirrors BookingCard: horizontal card with left image + right body

export function BookingCardSkeleton({ delay = 0 }: { delay?: number }) {
  const opacity = useShimmer(delay);
  return (
    <View style={styles.bookCard}>
      {/* Left image */}
      <Bone w={82} h={82} r={10} opacity={opacity} />
      {/* Right body */}
      <View style={styles.bookBody}>
        <Bone w="75%" h={13} r={6} opacity={opacity} />
        <Bone w="55%" h={11} r={6} opacity={opacity} style={{ marginTop: 4 }} />
        <View style={styles.bookFooter}>
          <Bone w={56} h={13} r={6} opacity={opacity} />
          <Bone w={64} h={20} r={10} opacity={opacity} />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Listing card
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EAEAEA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  listInfo: {
    padding: 14,
    gap: 8,
  },
  listFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },

  // Booking card
  bookCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  bookBody: {
    flex: 1,
    gap: 6,
  },
  bookFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
});
