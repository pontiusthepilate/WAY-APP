import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/theme";
import type { Post } from "../types";

const GAP = 2;

export function PostGridItem({ post, size, onPress }: { post: Post; size: number; onPress: () => void }) {
  return (
    <Pressable style={[styles.tile, { width: size, height: size }]} onPress={onPress}>
      {post.type === "text" ? (
        <View style={styles.textTile}>
          <Text style={styles.textTileBody} numberOfLines={4}>
            {post.caption}
          </Text>
        </View>
      ) : (
        <Image source={{ uri: post.mediaUrl ?? undefined }} style={styles.media} resizeMode="cover" />
      )}
      {post.type === "video" && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>▶</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { margin: GAP / 2, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  media: { width: "100%", height: "100%" },
  textTile: { flex: 1, backgroundColor: colors.primaryLight, padding: spacing.xs, justifyContent: "center" },
  textTileBody: { ...typography.caption, color: colors.primaryDark, textAlign: "center" },
  badge: { position: "absolute", top: 4, right: 4 },
  badgeText: { color: colors.surface, fontSize: 12 },
});
