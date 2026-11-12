import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/theme";
import type { NearbyResult } from "../types";
import { formatDistance } from "../lib/formatDistance";
import { Avatar } from "./Avatar";

export function ConnectionRow({
  result,
  onPress,
  hasActiveStatus,
}: {
  result: NearbyResult;
  onPress: () => void;
  hasActiveStatus?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar uri={result.displayPictureUrl} displayName={result.displayName} size={48} hasActiveStatus={hasActiveStatus} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{result.displayName}</Text>
        <Text style={styles.way} numberOfLines={1}>{result.wayId}</Text>
        {result.whichWay && <Text style={styles.teaser} numberOfLines={1}>{result.whichWay}</Text>}
      </View>
      <Text style={styles.distance}>{formatDistance(result.distanceMeters)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  info: { flex: 1, marginLeft: spacing.sm },
  name: { ...typography.h3, color: colors.textPrimary },
  way: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  teaser: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  distance: { ...typography.body, color: colors.primaryDark, fontWeight: "600" },
});
