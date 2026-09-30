import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { NearbyResult } from "../types";
import { formatDistance } from "../lib/formatDistance";

export function ConnectionRow({ result, onPress }: { result: NearbyResult; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {result.displayPictureUrl ? (
        <Image source={{ uri: result.displayPictureUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Text style={styles.fallbackText}>{result.displayName.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{result.displayName}</Text>
        <Text style={styles.way} numberOfLines={1}>WAY/{result.wayId}</Text>
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryLight,
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  fallbackText: { color: colors.primaryDark, fontWeight: "700", fontSize: 18 },
  info: { flex: 1, marginLeft: spacing.sm },
  name: { ...typography.h3, color: colors.textPrimary },
  way: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  distance: { ...typography.body, color: colors.primaryDark, fontWeight: "600" },
});
