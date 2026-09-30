import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { AutoScrollSpeed } from "../types";

const SPEED_OPTIONS: { key: AutoScrollSpeed; label: string }[] = [
  { key: "slow", label: "Slow" },
  { key: "medium", label: "Medium" },
  { key: "fast", label: "Fast" },
];

// The on-screen quick-access "WAY Button" (feature: right-middle floating
// control). Today it only drives feed auto-scroll; it's built to later take
// on other assigned functions without moving from this spot.
export function WayButton({ speed, onChange }: { speed: AutoScrollSpeed; onChange: (speed: AutoScrollSpeed) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = speed !== "off";

  function handlePress() {
    if (active) {
      onChange("off");
      setMenuOpen(false);
    } else {
      setMenuOpen((v) => !v);
    }
  }

  function selectSpeed(next: AutoScrollSpeed) {
    onChange(next);
    setMenuOpen(false);
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {menuOpen && (
        <View style={styles.menu}>
          {SPEED_OPTIONS.map((opt) => (
            <Pressable key={opt.key} style={styles.menuItem} onPress={() => selectSpeed(opt.key)}>
              <Text style={styles.menuLabel}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable
        style={[styles.button, active && styles.buttonActive]}
        onPress={handlePress}
        hitSlop={12}
        accessibilityLabel="WAY Button — auto-scroll"
      >
        <Text style={[styles.buttonText, active && styles.buttonTextActive]}>{active ? "▐▐" : "W"}</Text>
      </Pressable>
    </View>
  );
}

const SIZE = 52;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: spacing.md,
    top: "50%",
    marginTop: -(SIZE / 2),
    alignItems: "flex-end",
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: colors.horizon,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.warning,
  },
  buttonText: { ...typography.h3, color: colors.primaryDark },
  buttonTextActive: { color: colors.warning },
  menu: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  menuItem: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  menuLabel: { ...typography.body, color: colors.textPrimary, textAlign: "right" },
});
