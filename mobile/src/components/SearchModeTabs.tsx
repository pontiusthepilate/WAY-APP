import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { SearchMode } from "../types";

// "Find" is one tab over three underlying modes — address, location, and
// WAY ID/phone are no longer separate tabs with separate fields; typing (or
// tapping a suggestion) into the one merged field decides which of the
// three actually runs, see search.tsx's handleFindSearch/selectFindSuggestion.
export const FIND_MODES: SearchMode[] = ["address", "location", "wayid"];

const OPTIONS: { key: "all" | "nearby" | "find"; label: string }[] = [
  { key: "all", label: "Search" },
  { key: "nearby", label: "Nearby" },
  { key: "find", label: "Find" },
];

export function SearchModeTabs({ value, onChange }: { value: SearchMode; onChange: (v: SearchMode) => void }) {
  const activeKey = FIND_MODES.includes(value) ? "find" : value;
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = opt.key === activeKey;
        return (
          <Pressable
            key={opt.key}
            style={[styles.tab, active && styles.tabActive]}
            // Re-picking "Find" keeps whichever of the 3 underlying modes was
            // last resolved (so it doesn't forget a prior address/wayid
            // search); landing on it fresh defaults to "location" — a
            // neutral starting point, not a commitment to any one of the 3.
            onPress={() => onChange(opt.key === "find" ? (FIND_MODES.includes(value) ? value : "location") : opt.key)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tab: {
    flexGrow: 1,
    minWidth: "30%",
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.horizonDeep },
  label: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
  labelActive: { color: colors.textOnPrimary },
});
