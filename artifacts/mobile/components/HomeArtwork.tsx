import React from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

// Source art is 1024x640; the tractor's wheels sit at ~62% of image height,
// spanning ~80%-97.5% of image width.
const FARM_ASPECT = 640 / 1024;
const TRACTOR_BOTTOM = 0.62;

type CountrysideHeaderArtProps = {
  /**
   * Opt-in: when set, the art is rendered at full header width (never cropped
   * horizontally) and bottom-anchored so the tractor's wheels sit this many px
   * above the header's bottom edge. Omit to keep the original cover behaviour.
   */
  tractorBottomOffset?: number;
};

export function CountrysideHeaderArt({ tractorBottomOffset }: CountrysideHeaderArtProps = {}) {
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const anchored = tractorBottomOffset != null && box.w > 0;
  const imgH = box.w * FARM_ASPECT;
  const imgTop = box.h - tractorBottomOffset! - imgH * TRACTOR_BOTTOM;
  return (
    <View
      pointerEvents="none"
      onLayout={tractorBottomOffset != null ? (e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }) : undefined}
      style={[StyleSheet.absoluteFillObject, { borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: "hidden" }]}
    >
      <Image
        source={require("../assets/images/home-farm-background.jpg")}
        style={anchored ? { position: "absolute", left: 0, width: box.w, top: imgTop, height: imgH } : StyleSheet.absoluteFillObject}
        contentFit="cover"
        contentPosition={anchored ? "center" : "right center"}
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
  plough: require("../assets/images/categories/plough.jpg"),
  cultivator: require("../assets/images/categories/cultivator.jpg"),
  jcb: require("../assets/images/categories/jcb.jpg"),
  excavator: require("../assets/images/categories/excavator.jpg"),
  poclain: require("../assets/images/categories/poclain.jpg"),
  "chhota hathi": require("../assets/images/categories/chhota-hathi.jpg"),
  "mobile crane": require("../assets/images/categories/mobile-crane.jpg"),
  plumbing: require("../assets/images/categories/plumbing.jpg"),
  electrician: require("../assets/images/categories/electrician.jpg"),
  beauty: require("../assets/images/categories/beauty.jpg"),
  carpenter: require("../assets/images/categories/carpenter.jpg"),
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
