import React from "react";
import { Image } from "expo-image";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { View } from "react-native";

export function CountrysideHeaderArt() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 52, right: 0, top: 28, height: 140, overflow: "hidden", opacity: 0.7 }}>
      <Svg width="100%" height="100%" viewBox="0 0 400 110" preserveAspectRatio="xMidYMid slice">
        <Circle cx="344" cy="22" r="27" fill="#FFE98A" opacity="0.42" />
        <Path d="M0 70 Q72 26 152 65 Q240 20 400 60 L400 110 L0 110Z" fill="#F8C74B" opacity="0.62" />
        <Path d="M0 82 Q88 39 190 77 Q292 39 400 72 L400 110 L0 110Z" fill="#D6B642" opacity="0.64" />
        <Path d="M0 94 Q118 69 226 94 Q320 61 400 85 L400 110 L0 110Z" fill="#80943D" opacity="0.7" />
        <Path d="M187 67 L212 49 L238 67 V88 H187Z" fill="#9D552C" />
        <Path d="M182 68 L212 43 L244 68 L238 70 L212 49 L187 72Z" fill="#6E3D28" />
        <Rect x="198" y="70" width="12" height="18" rx="1" fill="#F5D38A" />
        <Rect x="218" y="68" width="12" height="10" rx="1" fill="#F1C878" />
        <Path d="M281 79V37 M272 45L281 36L290 45 M273 55H289" stroke="#684D2F" strokeWidth="2.3" strokeLinecap="round" />
        <Circle cx="281" cy="36" r="2.6" fill="#684D2F" />
        <Path d="M320 77H363L373 85V93H317V84Z" fill="#427635" />
        <Rect x="334" y="65" width="24" height="19" rx="3" fill="#4C8737" />
        <Path d="M338 68H354V78H338Z" fill="#BFE0D1" />
        <Circle cx="330" cy="92" r="8" fill="#28372B" />
        <Circle cx="363" cy="92" r="6" fill="#28372B" />
        <Circle cx="330" cy="92" r="3" fill="#D9D2B8" />
        <Circle cx="363" cy="92" r="2.2" fill="#D9D2B8" />
        <Path d="M0 103 Q65 93 120 104 M245 101 Q270 95 300 102" stroke="#A9B25A" strokeWidth="2" opacity=".75" />
      </Svg>
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
