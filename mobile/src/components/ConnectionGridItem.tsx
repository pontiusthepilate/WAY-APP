import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { NearbyResult } from "../types";
import { formatDistance } from "../lib/formatDistance";
import { Avatar } from "./Avatar";

export function ConnectionGridItem({
  result,
  onPress,
  hasActiveStatus,
}: {
  result: NearbyResult;
  onPress: () => void;
  hasActiveStatus?: boolean;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Avatar uri={result.displayPictureUrl} displayName={result.displayName} size={64} hasActiveStatus={hasActiveStatus} />
      <Text style={[styles.name, styles.nameSpacing]} numberOfLines={1}>{result.displayName}</Text>
      <Text style={styles.distance}>{formatDistance(result.distanceMeters)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    margin: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  nameSpacing: { marginTop: spacing.xs },
  distance: { ...typography.caption, color: colors.primaryDark, marginTop: 2 },
});
