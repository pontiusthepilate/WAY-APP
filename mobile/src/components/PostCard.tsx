import React, { useEffect, useRef } from "react";
import { Image, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { Post } from "../types";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { registerShare, registerView, toggleLike } from "../api/posts";

interface Props {
  post: Post;
  onChange: (post: Post) => void;
  onOpenComments: (post: Post) => void;
}

export function PostCard({ post, onChange, onOpenComments }: Props) {
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    registerView(post.id).catch(() => {});
  }, [post.id]);

  async function handleLike() {
    const optimistic = { ...post, viewerLiked: !post.viewerLiked, likesCount: post.likesCount + (post.viewerLiked ? -1 : 1) };
    onChange(optimistic);
    try {
      const result = await toggleLike(post.id, post.profileId);
      onChange({ ...optimistic, viewerLiked: result.liked, likesCount: result.likesCount });
    } catch {
      onChange(post);
    }
  }

  async function handleShare() {
    try {
      await Share.share({ message: post.caption ? `${post.caption}\n\nvia WAY/${post.profile.wayId}` : `WAY/${post.profile.wayId}` });
      const result = await registerShare(post.id);
      onChange({ ...post, sharesCount: result.sharesCount });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {post.profile.displayPictureUrl ? (
          <Image source={{ uri: post.profile.displayPictureUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{post.profile.displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {post.profile.displayName}
            {post.profile.isVerified ? " ✓" : ""}
          </Text>
          <Text style={styles.way} numberOfLines={1}>
            WAY/{post.profile.wayId} · {formatRelativeTime(post.createdAt)}
          </Text>
        </View>
      </View>

      {post.type === "text" ? (
        <View style={styles.textPost}>
          <Text style={styles.textPostBody}>{post.caption}</Text>
        </View>
      ) : (
        <>
          {post.caption && <Text style={styles.caption}>{post.caption}</Text>}
          {post.type === "image" && post.mediaUrl && (
            <Image source={{ uri: post.mediaUrl }} style={styles.media} resizeMode="cover" />
          )}
          {post.type === "video" && post.mediaUrl && <VideoPost uri={post.mediaUrl} />}
        </>
      )}

      <View style={styles.actionRow}>
        <Pressable style={styles.action} onPress={handleLike}>
          <Text style={[styles.actionIcon, post.viewerLiked && styles.actionIconActive]}>{post.viewerLiked ? "♥" : "♡"}</Text>
          <Text style={styles.actionCount}>{post.likesCount}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => onOpenComments(post)}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.commentsCount}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={handleShare}>
          <Text style={styles.actionIcon}>↗</Text>
          <Text style={styles.actionCount}>{post.sharesCount}</Text>
        </Pressable>
        <View style={styles.action}>
          <Text style={styles.actionIcon}>◎</Text>
          <Text style={styles.actionCount}>{post.viewsCount}</Text>
        </View>
      </View>
    </View>
  );
}

function VideoPost({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={styles.media} nativeControls />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.primaryLight },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700" },
  headerText: { marginLeft: spacing.sm, flex: 1 },
  name: { ...typography.h3, color: colors.textPrimary },
  way: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  caption: { ...typography.body, color: colors.textPrimary, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  media: { width: "100%", aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  textPost: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  textPostBody: { ...typography.h3, color: colors.primaryDark, textAlign: "center" },
  actionRow: { flexDirection: "row", paddingHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.lg },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionIcon: { fontSize: 20, color: colors.textSecondary },
  actionIconActive: { color: colors.danger },
  actionCount: { ...typography.caption, color: colors.textSecondary },
});
