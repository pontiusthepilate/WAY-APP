import React, { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { Post, ReactionType } from "../types";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { getReactionBreakdown, registerShare, registerView, toggleLike } from "../api/posts";
import { Avatar } from "./Avatar";

const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "❤️",
  love: "😍",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
};
const REACTION_ORDER: ReactionType[] = ["like", "love", "haha", "wow", "sad", "angry"];

interface Props {
  post: Post;
  onChange: (post: Post) => void;
  onOpenComments: (post: Post) => void;
  hasActiveStatus?: boolean;
}

export function PostCard({ post, onChange, onOpenComments, hasActiveStatus }: Props) {
  const router = useRouter();
  const viewedRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    registerView(post.id).catch(() => {});
  }, [post.id]);

  async function handleReact(type: ReactionType) {
    setPickerOpen(false);
    const wasSameType = post.viewerReactionType === type;
    const optimistic = {
      ...post,
      viewerLiked: !wasSameType,
      viewerReactionType: wasSameType ? null : type,
      likesCount: post.likesCount + (wasSameType ? -1 : post.viewerLiked ? 0 : 1),
    };
    onChange(optimistic);
    try {
      const result = await toggleLike(post.id, post.profileId, type);
      onChange({ ...optimistic, viewerLiked: result.liked, viewerReactionType: result.reactionType, likesCount: result.likesCount });
    } catch {
      onChange(post);
    }
  }

  async function handleShowBreakdown() {
    try {
      const breakdown = await getReactionBreakdown(post.id);
      const lines = REACTION_ORDER.filter((t) => breakdown[t]).map((t) => `${REACTION_EMOJI[t]} ${breakdown[t]}`);
      Alert.alert("Reactions", lines.length ? lines.join("   ") : "No reactions yet.");
    } catch {
      // ignore — not worth surfacing an error for a secondary info view
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
        <Avatar
          uri={post.profile.displayPictureUrl}
          displayName={post.profile.displayName}
          size={40}
          hasActiveStatus={hasActiveStatus}
          onPress={
            hasActiveStatus
              ? () =>
                  router.push({
                    pathname: "/status/[profileId]",
                    params: { profileId: post.profile.id, displayName: post.profile.displayName },
                  })
              : undefined
          }
        />
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

      {pickerOpen && (
        <View style={styles.reactionPicker}>
          {REACTION_ORDER.map((type) => (
            <Pressable key={type} style={styles.reactionPickerItem} onPress={() => handleReact(type)}>
              <Text style={styles.reactionPickerEmoji}>{REACTION_EMOJI[type]}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actionRow}>
        <View style={styles.action}>
          <Pressable onPress={() => handleReact("like")} onLongPress={() => setPickerOpen(true)}>
            <Text style={styles.actionIcon}>{post.viewerReactionType ? REACTION_EMOJI[post.viewerReactionType] : "♡"}</Text>
          </Pressable>
          <Pressable onPress={handleShowBreakdown} hitSlop={6}>
            <Text style={styles.actionCount}>{post.likesCount}</Text>
          </Pressable>
        </View>
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
  actionCount: { ...typography.caption, color: colors.textSecondary },
  reactionPicker: {
    flexDirection: "row",
    alignSelf: "flex-start",
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    gap: spacing.xs,
  },
  reactionPickerItem: { padding: 4 },
  reactionPickerEmoji: { fontSize: 22 },
});
