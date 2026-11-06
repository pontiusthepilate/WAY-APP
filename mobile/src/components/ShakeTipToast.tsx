import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { getHasSeenShakeTip, markShakeTipSeen } from "../lib/shakeTip";

const AUTO_DISMISS_MS = 5000;
const FADE_MS = 250;

// A one-time toast telling people the auto-scroll controls (the WAY Button)
// are hidden behind a shake gesture — shown once ever (see lib/shakeTip),
// then auto-dismisses, or dismisses immediately on tap.
export function ShakeTipToast({ topOffset = 0 }: { topOffset?: number }) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    getHasSeenShakeTip().then((seen) => {
      if (seen) return;
      markShakeTipSeen();
      setVisible(true);
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      dismissTimer = setTimeout(dismiss, AUTO_DISMISS_MS);
    });
    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => setVisible(false));
  }

  if (!visible) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity, top: spacing.xl + topOffset }]} pointerEvents="box-none">
      <Pressable style={styles.toast} onPress={dismiss}>
        <Ionicons name="phone-portrait-outline" size={18} color={colors.textOnPrimary} />
        <Text style={styles.text}>Shake your phone to show playback controls</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryDark,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: "100%",
  },
  text: { ...typography.caption, color: colors.textOnPrimary, fontWeight: "600", flexShrink: 1 },
});
