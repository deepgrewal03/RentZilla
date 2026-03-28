import { useRef, useEffect } from "react";
import { Animated } from "react-native";

const SPRING = { useNativeDriver: false, tension: 340, friction: 12 };

/** Fade the element in on mount. Returns an `opacity` Animated.Value. */
export function useFadeIn(duration = 280, delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: false,
    }).start();
  }, []);
  return opacity;
}

/** Spring scale on press — returns `{ scale, onPressIn, onPressOut }`. */
export function useScalePress(pressedScale = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: pressedScale, ...SPRING }).start();
  }

  function onPressOut() {
    Animated.spring(scale, { toValue: 1, ...SPRING }).start();
  }

  return { scale, onPressIn, onPressOut };
}

/** One-shot bounce — call `trigger()` on press. */
export function useBounce(pressedScale = 0.92) {
  const scale = useRef(new Animated.Value(1)).current;

  function trigger() {
    Animated.sequence([
      Animated.spring(scale, { toValue: pressedScale, ...SPRING, tension: 420 }),
      Animated.spring(scale, { toValue: 1.05,         ...SPRING, tension: 260, friction: 7 }),
      Animated.spring(scale, { toValue: 1,            ...SPRING }),
    ]).start();
  }

  return { scale, trigger };
}

/** Shake / wiggle — call `shake()` to trigger a quick left-right jiggle. */
export function useShake() {
  const x = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(x, { toValue: -5, duration: 55, useNativeDriver: false }),
      Animated.timing(x, { toValue:  5, duration: 55, useNativeDriver: false }),
      Animated.timing(x, { toValue: -4, duration: 45, useNativeDriver: false }),
      Animated.timing(x, { toValue:  4, duration: 45, useNativeDriver: false }),
      Animated.timing(x, { toValue:  0, duration: 35, useNativeDriver: false }),
    ]).start();
  }

  return { x, shake };
}
