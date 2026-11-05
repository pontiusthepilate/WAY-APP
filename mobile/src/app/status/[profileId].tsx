import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { deleteStatus, getStatusesByProfile } from "../../api/status";
import { safeBack } from "../../lib/navigation";
import type { Status } from "../../types";

const SLIDE_DURATION_MS = 5000;

export default function StatusViewerScreen() {
  const { profileId, displayName } = useLocalSearchParams<{ profileId: string; displayName?: string }>();
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();

  const [statuses, setStatuses] = useState<Status[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const isOwn = activeProfile?.id === profileId;

  useEffect(() => {
    if (!profileId) return;
    getStatusesByProfile(profileId)
      .then((rows) => {
        setStatuses(rows);
        setLoading(false);
        if (rows.length === 0) safeBack();
      })
      .catch(() => safeBack());
  }, [profileId]);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= statuses.length) {
        safeBack();
        return i;
      }
      return i + 1;
    });
  }, [statuses.length]);

  useEffect(() => {
    if (loading || statuses.length === 0) return;
    const timer = setTimeout(advance, SLIDE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [loading, statuses.length, index, advance]);

  async function handleDelete() {
    const current = statuses[index];
    if (!current) return;
    await deleteStatus(current.id).catch(() => {});
    if (statuses.length <= 1) {
      // Deferred a tick: navigating synchronously here, right after the
      // await resumes inside a Pressable's handler, raced React's own
      // update of that Pressable and logged a "cannot update a component"
      // warning even though the navigation itself behaved correctly.
      setTimeout(() => safeBack(), 0);
      return;
    }
    setStatuses((prev) => prev.filter((s) => s.id !== current.id));
    setIndex((i) => Math.max(0, i - 1));
  }

  if (loading || statuses.length === 0) return <View style={styles.container} />;
  const current = statuses[index];

  return (
    <View style={styles.container}>
      <View style={[styles.progressRow, { top: spacing.sm + insets.top }]}>
        {statuses.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <View style={[styles.progressFill, i < index && styles.progressFillDone, i === index && styles.progressFillDone]} />
          </View>
        ))}
      </View>

      <View style={[styles.header, { top: spacing.lg + insets.top }]}>
        <Text style={styles.headerName}>{displayName ?? "Status"}</Text>
        <View style={styles.headerActions}>
          {isOwn && (
            <Pressable onPress={handleDelete} hitSlop={10}>
              <Ionicons name="trash-outline" size={22} color={colors.textOnPrimary} />
            </Pressable>
          )}
          <Pressable onPress={() => safeBack()} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.textOnPrimary} />
          </Pressable>
        </View>
      </View>

      {current.mediaUrl && current.mediaType === "image" && (
        <Image source={{ uri: current.mediaUrl }} style={styles.media} resizeMode="cover" />
      )}
      {current.mediaUrl && current.mediaType === "video" && <StatusVideo uri={current.mediaUrl} />}
      {!current.mediaUrl && (
        <View style={[styles.textCard, { backgroundColor: current.backgroundColor ?? colors.primaryDark }]}>
          <Text style={styles.textCardCaption}>{current.caption}</Text>
        </View>
      )}
      {current.mediaUrl && current.caption && <Text style={styles.mediaCaption}>{current.caption}</Text>}

      <View style={styles.tapZones} pointerEvents="box-none">
        <Pressable style={styles.tapZone} onPress={() => setIndex((i) => Math.max(0, i - 1))} />
        <Pressable style={styles.tapZone} onPress={advance} />
      </View>
    </View>
  );
}

function StatusVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={styles.media} nativeControls={false} contentFit="cover" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryDark },
  progressRow: { position: "absolute", left: spacing.sm, right: spacing.sm, flexDirection: "row", gap: 4, zIndex: 2 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.textOnPrimary, width: 0 },
  progressFillDone: { width: "100%" },
  header: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  headerName: { ...typography.h3, color: colors.textOnPrimary },
  headerActions: { flexDirection: "row", gap: spacing.md },
  media: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  textCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  textCardCaption: { ...typography.h2, color: colors.textOnPrimary, textAlign: "center" },
  mediaCaption: {
    position: "absolute",
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    ...typography.body,
    color: colors.textOnPrimary,
    textAlign: "center",
  },
  tapZones: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" },
  tapZone: { flex: 1 },
});
