import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { ResultView } from "../types";

const OPTIONS: { key: ResultView; label: string }[] = [
  { key: "radar", label: "Radar" },
  { key: "list", label: "List" },
  { key: "grid", label: "Grid" },
];

export function ViewToggle({ value, onChange }: { value: ResultView; onChange: (v: ResultView) => void }) {
  return (
    <View style={styles.wrap}>
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    padding: 4,
    alignSelf: "center",
  },
  pill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  labelActive: { color: colors.textOnPrimary },
});
