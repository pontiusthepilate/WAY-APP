import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { NearbyResult } from "../types";
import { formatDistance } from "../lib/formatDistance";

export function ConnectionGridItem({ result, onPress }: { result: NearbyResult; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {result.displayPictureUrl ? (
        <Image source={{ uri: result.displayPictureUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Text style={styles.fallbackText}>{result.displayName.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>{result.displayName}</Text>
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
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.xs,
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  fallbackText: { color: colors.primaryDark, fontWeight: "700", fontSize: 22 },
  name: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  distance: { ...typography.caption, color: colors.primaryDark, marginTop: 2 },
});
