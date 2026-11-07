import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

// A periodic full-screen glow wash — fires on a timer, breathes in and out
// for a few seconds, then disappears entirely. Each time it fires it picks
// a random color from the palette below (all 5 candidates from the color
// review were kept, rather than settling on one). Earlier versions tried
// an edge-traced border light (static and/or a traveling arc); that read
// as "a light moving around the screen", which wasn't the ask — this is
// plainly a glow over the whole screen, stationary.
// Real cadence is ~1 hour, randomized (re-rolled each time, not a fixed
// interval); __DEV__ forces a flat 5 minutes so it's still observable
// while building without waiting a full hour. Mounted once at the root
// layout.
const PALETTE = [
  "#E24B4A", // red
  "#0A4554", // WAY teal
  "#E6B655", // gold
  "#378ADD", // blue
  "#7F77DD", // purple
];
const DISPLAY_MS = 4500; // how long one glow event stays on screen
const DEV_INTERVAL_MS = 5 * 60_000;
const PROD_MIN_INTERVAL_MS = 60 * 60_000;
const PROD_INTERVAL_JITTER_MS = 20 * 60_000; // prod delay = 1h + up to 20min more
const BREATHE_LEG_MS = 1300;
const PEAK_OPACITY = 0.35; // a wash, not a solid-color screen — content underneath stays legible

function nextDelayMs(): number {
  if (__DEV__) return DEV_INTERVAL_MS;
  return PROD_MIN_INTERVAL_MS + Math.random() * PROD_INTERVAL_JITTER_MS;
}

function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

export function EdgeGlow() {
  const [visible, setVisible] = useState(false);
  const [color, setColor] = useState(PALETTE[0]);
  const [fade] = useState(() => new Animated.Value(0));
  const [breathe] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function fire() {
      setColor(randomColor());
      setVisible(true);
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => {
        if (cancelled) return;
        Animated.timing(fade, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
          if (!cancelled) setVisible(false);
        });
      }, DISPLAY_MS);
    }

    function schedule() {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        fire();
        schedule();
      }, nextDelayMs());
    }

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [fade]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: BREATHE_LEG_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: BREATHE_LEG_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, breathe]);

  if (!visible) return null;

  const breathOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [PEAK_OPACITY * 0.4, PEAK_OPACITY] });
  const opacity = Animated.multiply(fade, breathOpacity);

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity }]} />;
}
