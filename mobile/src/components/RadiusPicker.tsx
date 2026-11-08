import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { colors, radii, spacing, typography } from "../theme/theme";

type RadiusUnit = "m" | "km" | "mi" | "ft";

// Ordered by magnitude (1 ft < 1 m < 1 km < 1 mi), not by how common each
// unit is — the default selection is still "m" (see useState below), this
// only controls the chips' left-to-right order.
const UNITS: RadiusUnit[] = ["ft", "m", "km", "mi"];
const UNIT_LABELS: Record<RadiusUnit, string> = { m: "m", km: "km", mi: "mi", ft: "ft" };

// Meters-per-unit, so every value below can be stored/sent as meters (the
// one unit the backend and RadarView actually use) while still being shown
// to the person in whichever unit they picked.
const METERS_PER_UNIT: Record<RadiusUnit, number> = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048 };

// Each unit's selectable range and its five preset stops along that range —
// not just the same five numbers relabeled, since "10 ft" and "10 km" aren't
// comparable starting points.
const UNIT_RANGE: Record<RadiusUnit, { min: number; max: number; step: number; presets: number[] }> = {
  m: { min: 10, max: 1000, step: 10, presets: [10, 50, 200, 500, 1000] },
  km: { min: 1, max: 10, step: 0.5, presets: [1, 3, 5, 7, 10] },
  ft: { min: 10, max: 1000, step: 10, presets: [10, 100, 300, 600, 1000] },
  mi: { min: 1, max: 10, step: 0.5, presets: [1, 3, 5, 7, 10] },
};

function toMeters(display: number, unit: RadiusUnit): number {
  return Math.round(display * METERS_PER_UNIT[unit] * 100) / 100;
}

function fromMeters(meters: number, unit: RadiusUnit): number {
  const range = UNIT_RANGE[unit];
  const display = meters / METERS_PER_UNIT[unit];
  return Math.min(range.max, Math.max(range.min, display));
}

function label(display: number, unit: RadiusUnit): string {
  const rounded = Number.isInteger(display) ? display : Math.round(display * 10) / 10;
  return `${rounded} ${UNIT_LABELS[unit]}`;
}

export function RadiusPicker({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const [unit, setUnit] = useState<RadiusUnit>("m");
  const range = UNIT_RANGE[unit];
  const sliderValue = fromMeters(value, unit);

  function handleUnitChange(next: RadiusUnit) {
    setUnit(next);
    // Land on that unit's middle preset so a chip (and the slider) is always
    // on a sensible value right after switching units.
    onChange(toMeters(UNIT_RANGE[next].presets[2], next));
  }

  return (
    <View>
      <View style={styles.unitRow}>
        {UNITS.map((u) => (
          <Pressable key={u} style={[styles.unitChip, unit === u && styles.unitChipActive]} onPress={() => handleUnitChange(u)}>
            <Text style={[styles.unitLabel, unit === u && styles.unitLabelActive]}>{UNIT_LABELS[u]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.presetRow}>
        {range.presets.map((p) => {
          const meters = toMeters(p, unit);
          const active = meters === value;
          return (
            <Pressable key={p} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(meters)}>
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {label(p, unit)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.sliderBound}>{label(range.min, unit)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={range.min}
          maximumValue={range.max}
          step={range.step}
          value={sliderValue}
          onValueChange={(v) => onChange(toMeters(v, unit))}
          minimumTrackTintColor={colors.horizon}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <Text style={styles.sliderBound}>{label(range.max, unit)}</Text>
      </View>
      <Text style={styles.currentValue}>{label(sliderValue, unit)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unitRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  unitChip: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  unitChipActive: { backgroundColor: colors.horizon },
  unitLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", fontSize: 11 },
  unitLabelActive: { color: colors.textOnPrimary },
  presetRow: { flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.xs },
  chip: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  labelActive: { color: colors.textOnPrimary },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  slider: { flex: 1, height: 36 },
  sliderBound: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
  currentValue: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", textAlign: "center" },
});
