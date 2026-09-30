import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { SearchMode } from "../types";

const OPTIONS: { key: SearchMode; label: string }[] = [
  { key: "nearby", label: "Nearby" },
  { key: "address", label: "Address" },
  { key: "location", label: "Location" },
];

export function SearchModeTabs({ value, onChange }: { value: SearchMode; onChange: (v: SearchMode) => void }) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable key={opt.key} style={[styles.tab, active && styles.tabActive]} onPress={() => onChange(opt.key)}>
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.horizonDeep },
  label: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
  labelActive: { color: colors.textOnPrimary },
});
