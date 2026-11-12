import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { addEpisodeComment, getEpisode, getEpisodeComments, registerPlay, retryEpisodeTranscription } from "../../api/episodes";
import { safeBack } from "../../lib/navigation";
import { Avatar } from "../../components/Avatar";
import { PodcastVisualizer } from "../../components/PodcastVisualizer";
import { PageBackground } from "../../components/PageBackground";
import { EpisodeActionRow } from "../../components/EpisodeActionRow";
import { useSession } from "../../context/SessionContext";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import type { Episode, EpisodeComment } from "../../types";

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
  const { activeProfile } = useSession();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [comments, setComments] = useState<EpisodeComment[]>([]);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const playedRef = useRef(false);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([getEpisode(id, activeProfile?.id), getEpisodeComments(id)])
      .then(([episodeResult, commentsResult]) => {
        setEpisode(episodeResult);
        setComments(commentsResult);
      })
      .catch(() => safeBack());
  }, [id, activeProfile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id || playedRef.current) return;
    playedRef.current = true;
    registerPlay(id).catch(() => {});
  }, [id]);

  async function handleSend() {
    if (!activeProfile || !id || !draft.trim()) return;
    setSending(true);
    try {
      const comment = await addEpisodeComment(id, { profileId: activeProfile.id, text: draft.trim() });
      setComments((prev) => [...prev, comment]);
      setDraft("");
      setEpisode((prev) => (prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev));
    } finally {
      setSending(false);
    }
  }

  async function handleRetryTranscription() {
    if (!id) return;
    setRetrying(true);
    try {
      const result = await retryEpisodeTranscription(id);
      setEpisode((prev) => (prev ? { ...prev, transcriptStatus: result.transcriptStatus } : prev));
    } finally {
      setRetrying(false);
    }
  }

  if (!episode) return null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Episode</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listPadding}
        ListHeaderComponent={
          <>
            <Pressable style={styles.authorRow} onPress={() => router.push(`/profile`)} hitSlop={6}>
              <Avatar uri={episode.profile.displayPictureUrl} displayName={episode.profile.displayName} size={32} />
              <Text style={styles.authorName}>{episode.profile.displayName}</Text>
              <Text style={styles.authorWay}>{episode.profile.wayId}</Text>
            </Pressable>

            {episode.type === "video" ? (
              <VideoEpisode mediaUrl={episode.mediaUrl} title={episode.title} playsCount={episode.playsCount} />
            ) : (
              <AudioEpisode episode={episode} />
            )}

            <View style={styles.actionRowWrap}>
              <EpisodeActionRow episode={episode} onChange={setEpisode} />
            </View>

            {episode.showNotes && (
              <View style={styles.showNotesWrap}>
                <Text style={styles.sectionLabel}>Show Notes</Text>
                <Text style={styles.showNotesText}>{episode.showNotes}</Text>
              </View>
            )}

            {episode.transcriptStatus === "pending" && (
              <Text style={[styles.transcriptStatusText, styles.transcriptStatusPadded]}>Transcribing…</Text>
            )}

            {episode.transcriptStatus === "failed" && (
              <View style={styles.transcriptStatusRow}>
                <Text style={styles.transcriptStatusText}>Transcript unavailable</Text>
                {activeProfile?.id === episode.profileId && (
                  <Pressable onPress={handleRetryTranscription} disabled={retrying} hitSlop={8}>
                    <Text style={styles.retryLink}>{retrying ? "Retrying…" : "Retry"}</Text>
                  </Pressable>
                )}
              </View>
            )}

            {episode.transcript && (
              <View style={styles.transcriptWrap}>
                <Pressable onPress={() => setTranscriptExpanded((v) => !v)} style={styles.transcriptHeaderRow}>
                  <Text style={styles.sectionLabel}>Transcript</Text>
                  <Ionicons name={transcriptExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
                </Pressable>
                {transcriptExpanded && <Text style={styles.transcriptText}>{episode.transcript}</Text>}
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <Text style={styles.commentAuthor}>{item.profile?.displayName ?? "Someone"}</Text>
            <Text style={styles.commentText}>{item.text}</Text>
            <Text style={styles.commentTime}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No comments yet.</Text>}
      />

      <View style={styles.composerRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Add a comment…"
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
          />
        </View>
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending || !draft.trim()}>
          <Ionicons name="paper-plane-outline" size={16} color={colors.textOnPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
  audioWrap: { alignItems: "center", paddingTop: spacing.xl },
  actionRowWrap: { alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.md },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  showNotesWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  showNotesText: { ...typography.body, color: colors.textPrimary, marginTop: spacing.xs },
  transcriptStatusText: { ...typography.caption, color: colors.textSecondary },
  transcriptStatusPadded: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  transcriptStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  retryLink: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  transcriptWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  transcriptHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  transcriptText: { ...typography.body, color: colors.textPrimary, marginTop: spacing.xs },
  listPadding: { paddingBottom: spacing.xl },
  commentRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  commentAuthor: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  commentText: { ...typography.body, color: colors.textPrimary, marginTop: 2 },
  commentTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", padding: spacing.lg },
  composerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.xs },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: radii.pill,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
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
