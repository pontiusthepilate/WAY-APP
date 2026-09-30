import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";

const PRESETS_METERS = [1000, 5000, 20000, 50000, 100000];

function label(m: number): string {
  return m < 1000 ? `${m} m` : `${m / 1000} km`;
}

export function RadiusPicker({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {PRESETS_METERS.map((m) => {
        const active = m === value;
        return (
          <Pressable key={m} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(m)}>
            <Text style={[styles.label, active && styles.labelActive]}>{label(m)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  labelActive: { color: colors.textOnPrimary },
});
