import React from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

export function CountrysideHeaderArt() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: "hidden" }]}>
      <Image
        source={require("../assets/images/home-farm-background.jpg")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        contentPosition="right center"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const CATEGORY_IMAGES: Record<string, number> = {
  tractor: require("../assets/images/categories/tractor.jpg"),
  harvester: require("../assets/images/categories/harvester.jpg"),
  rotavator: require("../assets/images/categories/rotavator.jpg"),
  sprayer: require("../assets/images/categories/sprayer.jpg"),
  plough: require("../assets/images/categories/plough.jpg"),
  cultivator: require("../assets/images/categories/cultivator.jpg"),
  jcb: require("../assets/images/categories/jcb.jpg"),
  excavator: require("../assets/images/categories/excavator.jpg"),
  poclain: require("../assets/images/categories/poclain.jpg"),
  "rock breaker": require("../assets/images/categories/rock-breaker.jpg"),
  bulldozer: require("../assets/images/categories/bulldozer.jpg"),
  "wheel loader": require("../assets/images/categories/wheel-loader.jpg"),
  "chhota hathi": require("../assets/images/categories/chhota-hathi.jpg"),
  plumbing: require("../assets/images/categories/plumbing.jpg"),
  electrician: require("../assets/images/categories/electrician.jpg"),
  beauty: require("../assets/images/categories/beauty.jpg"),
  carpenter: require("../assets/images/categories/carpenter.jpg"),
  painter: require("../assets/images/categories/painter.jpg"),
  "ac repair": require("../assets/images/categories/ac-repair.jpg"),
};

type CategoryArtworkProps = {
  kind: "equipment" | "service";
  name: string;
  color: string;
};

export function CategoryArtwork({ kind, name, color }: CategoryArtworkProps) {
  const source = CATEGORY_IMAGES[name.trim().toLowerCase()];
  if (!source) {
    throw new Error(`Missing ${kind} category image: ${name}`);
  }
  return (
    <Image
      source={source}
      style={{ width: "100%", height: "100%", backgroundColor: color === "#fff" ? "transparent" : undefined }}
      contentFit="cover"
      contentPosition="center"
      transition={150}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
