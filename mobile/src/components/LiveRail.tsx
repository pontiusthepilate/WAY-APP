import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { LiveSession } from "../types";

export function LiveRail({ sessions, onSelect }: { sessions: LiveSession[]; onSelect: (session: LiveSession) => void }) {
  if (sessions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Live Now</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => onSelect(item)}>
            <View style={styles.avatarRing}>
              {item.profile.displayPictureUrl ? (
                <Image source={{ uri: item.profile.displayPictureUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{item.profile.displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {item.profile.displayName}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
  item: { alignItems: "center", width: 72, marginRight: spacing.sm },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 56, height: 56, borderRadius: radii.pill, backgroundColor: colors.primaryLight },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700", fontSize: 18 },
  liveBadge: {
    position: "absolute",
    bottom: -4,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveBadgeText: { color: colors.textOnPrimary, fontSize: 9, fontWeight: "800" },
  name: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.xs, textAlign: "center" },
});
