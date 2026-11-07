import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../theme/theme";

// Purely decorative — this does NOT read the audio's actual waveform or
// amplitude (profile-kind episode phase 4 design note: "non-reactive").
// Three rings pulse outward around the cover art on a fixed loop while
// `playing` is true, and simply hold still — no rings — when paused.
const RING_COUNT = 3;
const CYCLE_MS = 2200;
const MAX_SCALE = 1.6;

interface Props {
  playing: boolean;
  size: number;
  color?: string;
  children: React.ReactNode;
}

export function PodcastVisualizer({ playing, size, color = colors.primary, children }: Props) {
  const [progressRefs] = useState(() => Array.from({ length: RING_COUNT }, () => new Animated.Value(0)));

  useEffect(() => {
    if (!playing) {
      progressRefs.forEach((v) => v.setValue(0));
      return;
    }
    const loops = progressRefs.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((CYCLE_MS / RING_COUNT) * i),
          Animated.timing(value, { toValue: 1, duration: CYCLE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {playing &&
        progressRefs.map((progress, i) => {
          const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, MAX_SCALE] });
          const opacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.35, 0.12, 0] });
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.ring,
                { width: size, height: size, borderRadius: size / 2, borderColor: color, opacity, transform: [{ scale }] },
              ]}
            />
          );
        })}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 2 },
});
