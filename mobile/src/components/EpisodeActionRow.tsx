import React from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/theme";
import type { Episode } from "../types";
import { registerEpisodeShare, toggleEpisodeLike } from "../api/episodes";
import { useSession } from "../context/SessionContext";

interface Props {
  episode: Episode;
  onChange: (episode: Episode) => void;
  // Omitted on episode/[id].tsx, where comments already render inline below
  // this row — passed by podcasts.tsx/profile.tsx's list rows to navigate
  // to the episode instead.
  onOpenComments?: () => void;
}

// Like/comment/share for episodes — same icon set and layout as
// PostCard's action row, but a plain like toggle (no reaction-type picker:
// EpisodeLike has no `type` field, see its schema comment) and no view
// count here (episode.playsCount is already shown by the player itself).
export function EpisodeActionRow({ episode, onChange, onOpenComments }: Props) {
  const { activeProfile } = useSession();

  async function handleLike() {
    if (!activeProfile) return;
    const optimistic = {
      ...episode,
      viewerLiked: !episode.viewerLiked,
      likesCount: episode.likesCount + (episode.viewerLiked ? -1 : 1),
    };
    onChange(optimistic);
    try {
      const result = await toggleEpisodeLike(episode.id, activeProfile.id);
      onChange({ ...optimistic, viewerLiked: result.liked, likesCount: result.likesCount });
    } catch {
      onChange(episode);
    }
  }

  async function handleShare() {
    try {
      await Share.share({ message: `${episode.title}\n\nvia WAY/${episode.profile.wayId}` });
      const result = await registerEpisodeShare(episode.id);
      onChange({ ...episode, sharesCount: result.sharesCount });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  return (
    <View style={styles.actionRow}>
      <Pressable style={styles.action} onPress={handleLike} hitSlop={6}>
        <Text style={[styles.actionIcon, episode.viewerLiked && styles.actionIconLiked]}>
          {episode.viewerLiked ? "♥" : "♡"}
        </Text>
        <Text style={styles.actionCount}>{episode.likesCount}</Text>
      </Pressable>
      <Pressable style={styles.action} onPress={onOpenComments} hitSlop={6}>
        <Text style={styles.actionIcon}>💬</Text>
        <Text style={styles.actionCount}>{episode.commentsCount}</Text>
      </Pressable>
      <Pressable style={styles.action} onPress={handleShare} hitSlop={6}>
        <Text style={styles.actionIcon}>↗</Text>
        <Text style={styles.actionCount}>{episode.sharesCount}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: "row", gap: spacing.lg },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionIcon: { fontSize: 20, color: colors.textSecondary },
  actionIconLiked: { color: colors.danger },
  actionCount: { ...typography.caption, color: colors.textSecondary },
});
