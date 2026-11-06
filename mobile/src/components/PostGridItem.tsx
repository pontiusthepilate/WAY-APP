import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/theme";
import type { Post } from "../types";

const GAP = 2;

export function PostGridItem({ post, size, onPress }: { post: Post; size: number; onPress: () => void }) {
  // A repost's own type/caption/mediaUrl are null — show the original's.
  const content = post.type === "repost" && post.sharedFromPost ? post.sharedFromPost : post;
  return (
    <Pressable style={[styles.tile, { width: size, height: size }]} onPress={onPress}>
      {content.type === "text" ? (
        <View style={styles.textTile}>
          <Text style={styles.textTileBody} numberOfLines={4}>
            {content.caption}
          </Text>
        </View>
      ) : (
        <Image source={{ uri: content.mediaUrl ?? undefined }} style={styles.media} resizeMode="cover" />
      )}
      {content.type === "video" && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>▶</Text>
        </View>
      )}
      {post.type === "repost" && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🔁</Text>
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
