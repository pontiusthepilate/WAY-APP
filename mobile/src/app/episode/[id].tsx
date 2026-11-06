import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
// Deferred to a require() inside AudioEpisode() instead of a static import —
// see the matching note in episode-composer.tsx: expo-audio is a brand-new
// native module, and Expo Router eagerly requires every file under app/ to
// build its route table, so a top-level import here would crash the WHOLE
// app at startup until the next native rebuild.
import type { useAudioPlayer as UseAudioPlayerType, useAudioPlayerStatus as UseAudioPlayerStatusType } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { getEpisode, registerPlay } from "../../api/episodes";
import { safeBack } from "../../lib/navigation";
import { Avatar } from "../../components/Avatar";
import { PodcastVisualizer } from "../../components/PodcastVisualizer";
import { PageBackground } from "../../components/PageBackground";
import type { Episode } from "../../types";

const COVER_SIZE = 220;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EpisodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const playedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    getEpisode(id)
      .then(setEpisode)
      .catch(() => safeBack());
  }, [id]);

  useEffect(() => {
    if (!id || playedRef.current) return;
    playedRef.current = true;
    registerPlay(id).catch(() => {});
  }, [id]);

  if (!episode) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Episode</Text>
        <View style={{ width: 26 }} />
      </View>

      <Pressable style={styles.authorRow} onPress={() => router.push(`/profile`)} hitSlop={6}>
        <Avatar uri={episode.profile.displayPictureUrl} displayName={episode.profile.displayName} size={32} />
        <Text style={styles.authorName}>{episode.profile.displayName}</Text>
        <Text style={styles.authorWay}>WAY/{episode.profile.wayId}</Text>
      </Pressable>

      {episode.type === "video" ? (
        <VideoEpisode mediaUrl={episode.mediaUrl} title={episode.title} playsCount={episode.playsCount} />
      ) : (
        <AudioEpisode episode={episode} />
      )}
    </View>
  );
}

function VideoEpisode({ mediaUrl, title, playsCount }: { mediaUrl: string; title: string; playsCount: number }) {
  const player = useVideoPlayer(mediaUrl, (p) => {
    p.loop = false;
  });
  return (
    <View style={styles.videoWrap}>
      <VideoView player={player} style={styles.video} nativeControls />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.plays}>{playsCount} plays</Text>
    </View>
  );
}

function AudioEpisode({ episode }: { episode: Episode }) {
  const { useAudioPlayer, useAudioPlayerStatus } = require("expo-audio") as {
    useAudioPlayer: typeof UseAudioPlayerType;
    useAudioPlayerStatus: typeof UseAudioPlayerStatusType;
  };
  const player = useAudioPlayer(episode.mediaUrl, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  return (
    <View style={styles.audioWrap}>
      <PodcastVisualizer playing={status.playing} size={COVER_SIZE} color={colors.primary}>
        {episode.coverImageUrl ? (
          <Image source={{ uri: episode.coverImageUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="mic" size={48} color={colors.primaryDark} />
          </View>
        )}
      </PodcastVisualizer>

      <Text style={styles.title}>{episode.title}</Text>
      <Text style={styles.plays}>{episode.playsCount} plays</Text>

      <Pressable
        style={styles.playButton}
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        <Ionicons name={status.playing ? "pause" : "play"} size={32} color={colors.textOnPrimary} />
      </Pressable>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(status.currentTime)}</Text>
        <Text style={styles.timeText}>{formatTime(status.duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  authorName: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  authorWay: { ...typography.caption, color: colors.textSecondary },
  videoWrap: { paddingHorizontal: spacing.lg, alignItems: "center" },
  video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: radii.md },
  audioWrap: { flex: 1, alignItems: "center", paddingTop: spacing.xl },
  cover: { width: COVER_SIZE, height: COVER_SIZE, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  title: { ...typography.h3, color: colors.textPrimary, textAlign: "center", marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  plays: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  playButton: {
    marginTop: spacing.xl,
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  timeText: { ...typography.caption, color: colors.textSecondary },
});
