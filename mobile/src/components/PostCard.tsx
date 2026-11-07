import React, { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { Post, ReactionType } from "../types";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { getReactionBreakdown, registerShare, registerView, shareToProfile, toggleLike } from "../api/posts";
import { Avatar } from "./Avatar";
import { useSession } from "../context/SessionContext";

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
  const { profiles, activeProfile } = useSession();
  const viewedRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // For a repost, the header/body below render the ORIGINAL author's
  // content; the action row (like/comment/share/views) still acts on this
  // repost's own row, which has its own independent counts.
  const content = post.type === "repost" && post.sharedFromPost ? post.sharedFromPost : post;
  const canReshare = activeProfile?.id === post.profileId && profiles.length > 1;
  const resharesSiblings = profiles.filter((p) => p.id !== post.profileId);

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
      await Share.share({ message: content.caption ? `${content.caption}\n\nvia WAY/${content.profile.wayId}` : `WAY/${content.profile.wayId}` });
      const result = await registerShare(post.id);
      onChange({ ...post, sharesCount: result.sharesCount });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  function handleReshare() {
    Alert.alert("Share to another profile", "Post this to one of your other profiles", [
      ...resharesSiblings.map((p) => ({ text: `WAY/${p.wayId}`, onPress: () => doReshare(p.id) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  async function doReshare(targetProfileId: string) {
    try {
      await shareToProfile(post.id, targetProfileId);
      Alert.alert("Shared", "Posted to your other profile.");
    } catch {
      Alert.alert("Couldn't share", "Something went wrong. Try again.");
    }
  }

  return (
    <View style={styles.card}>
      {post.type === "repost" && post.sharedFromPost && (
        <Text style={styles.repostBanner}>🔁 WAY/{post.profile.wayId} shared this</Text>
      )}
      <View style={styles.header}>
        <Avatar
          uri={content.profile.displayPictureUrl}
          displayName={content.profile.displayName}
          size={40}
          hasActiveStatus={hasActiveStatus}
          onPress={
            hasActiveStatus
              ? () =>
                  router.push({
                    pathname: "/status/[profileId]",
                    params: { profileId: content.profile.id, displayName: content.profile.displayName },
                  })
              : undefined
          }
        />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {content.profile.displayName}
            {content.profile.isVerified ? " ✓" : ""}
          </Text>
          <Text style={styles.way} numberOfLines={1}>
            WAY/{content.profile.wayId} · {formatRelativeTime(post.createdAt)}
          </Text>
        </View>
      </View>

      {content.type === "text" ? (
        <View style={styles.textPost}>
          <Text style={styles.textPostBody}>{content.caption}</Text>
        </View>
      ) : content.type === "event" ? (
        <View style={styles.eventCard}>
          {content.mediaUrl &&
            (content.eventMediaType === "video" ? (
              <VideoPost uri={content.mediaUrl} style={styles.eventPhoto} />
            ) : (
              <Image source={{ uri: content.mediaUrl }} style={styles.eventPhoto} resizeMode="cover" />
            ))}
          <View style={styles.eventBody}>
            <Text style={styles.eventTitle}>{content.eventTitle}</Text>
            {content.eventStartsAt && (
              <View style={styles.eventRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.eventRowText}>{new Date(content.eventStartsAt).toLocaleString()}</Text>
              </View>
            )}
            {content.eventLocation && (
              <View style={styles.eventRow}>
                <Ionicons name="location-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.eventRowText} numberOfLines={2}>
                  {content.eventLocation}
                </Text>
              </View>
            )}
            {content.eventCategories.length > 0 && (
              <View style={styles.eventCategoryRow}>
                {content.eventCategories.map((c) => (
                  <View key={c} style={styles.eventCategoryPill}>
                    <Text style={styles.eventCategoryLabel}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
            {content.caption && <Text style={styles.eventDescription}>{content.caption}</Text>}
          </View>
        </View>
      ) : (
        <>
          {content.caption && <Text style={styles.caption}>{content.caption}</Text>}
          {content.type === "image" && content.mediaUrl && (
            <Image source={{ uri: content.mediaUrl }} style={styles.media} resizeMode="cover" />
          )}
          {content.type === "video" && content.mediaUrl && <VideoPost uri={content.mediaUrl} />}
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
        {canReshare && (
          <Pressable style={styles.action} onPress={handleReshare} hitSlop={6}>
            <Text style={styles.actionIcon}>🔁</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function VideoPost({ uri, style }: { uri: string; style?: object }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={style ?? styles.media} nativeControls />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  repostBanner: { ...typography.caption, color: colors.textSecondary, fontWeight: "600", paddingHorizontal: spacing.md, marginBottom: spacing.xs },
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
  eventCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  eventPhoto: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceAlt },
  eventBody: { padding: spacing.md },
  eventTitle: { ...typography.h3, color: colors.primaryDark, marginBottom: spacing.xs },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  eventRowText: { ...typography.caption, color: colors.primaryDark, flex: 1 },
  eventCategoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.xs },
  eventCategoryPill: { backgroundColor: colors.surface, borderRadius: radii.pill, paddingVertical: 2, paddingHorizontal: spacing.sm },
  eventCategoryLabel: { ...typography.caption, color: colors.primaryDark, fontWeight: "600" },
  eventDescription: { ...typography.body, color: colors.primaryDark, marginTop: spacing.sm },
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
