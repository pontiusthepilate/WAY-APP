import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { PlaceSuggestion } from "../api/mapbox";

// A live, as-you-type suggestion dropdown anchored directly under a search
// field — unlike CountryCodePicker's CountryPickerSheet (a full-screen
// slide-up Modal that takes over input focus), this stays in-flow so the
// text field underneath it keeps focus while the person keeps typing.
// Mirrors CountryPickerSheet's row/empty-state styling, not its logic
// (that one filters a static in-memory list; this one is network-backed).
interface Props {
  suggestions: PlaceSuggestion[];
  loading: boolean;
  onSelect: (suggestion: PlaceSuggestion) => void;
}

export function PlaceSuggestions({ suggestions, loading, onSelect }: Props) {
  if (!loading && suggestions.length === 0) return null;

  return (
    <View style={styles.dropdown}>
      {loading && suggestions.length === 0 ? (
        <ActivityIndicator style={styles.loading} color={colors.textSecondary} size="small" />
      ) : (
        suggestions.map((s) => (
          <Pressable key={s.mapboxId} style={styles.row} onPress={() => onSelect(s)}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {s.name}
              </Text>
              {!!(s.placeFormatted ?? s.fullAddress) && (
                <Text style={styles.detail} numberOfLines={1}>
                  {s.placeFormatted ?? s.fullAddress}
                </Text>
              )}
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  loading: { paddingVertical: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowText: { flex: 1 },
  name: { ...typography.body, color: colors.textPrimary },
  detail: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
});
