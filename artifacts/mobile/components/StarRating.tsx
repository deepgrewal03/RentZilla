import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Colors from "@/constants/colors";

const C = Colors.light;

interface Props {
  rating: number;
  maxRating?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export function StarRating({ rating, maxRating = 5, size = 20, interactive = false, onRate }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: maxRating }, (_, i) => {
        const filled = i < rating;
        if (interactive) {
          return (
            <Pressable
              key={i}
              onPress={() => {
                Haptics.selectionAsync();
                onRate?.(i + 1);
              }}
              style={{ padding: 2 }}
            >
              <Ionicons name={filled ? "star" : "star-outline"} size={size} color={filled ? C.gold : C.border} />
            </Pressable>
          );
        }
        return (
          <Ionicons key={i} name={filled ? "star" : "star-outline"} size={size} color={filled ? C.gold : C.border} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
});
