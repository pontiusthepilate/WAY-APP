import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackground } from "../components/PageBackground";
import { Avatar } from "../components/Avatar";
import { EpisodeActionRow } from "../components/EpisodeActionRow";
import { getEpisodesFeed } from "../api/episodes";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { safeBack } from "../lib/navigation";
import { useSession } from "../context/SessionContext";
import type { Episode } from "../types";

export default function PodcastsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeProfile } = useSession();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getEpisodesFeed({ viewerProfileId: activeProfile?.id })
      .then((page) => setEpisodes(page.episodes))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeProfile?.id]);

  useFocusEffect(load);

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Podcasts</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={episodes}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => router.push(`/episode/${item.id}`)}>
              {item.coverImageUrl ? (
                <View style={styles.coverWrap}>
                  <Avatar uri={item.coverImageUrl} displayName={item.title} size={48} />
                </View>
              ) : (
                <View style={[styles.coverWrap, styles.coverPlaceholder]}>
                  <Ionicons name={item.type === "audio" ? "mic-outline" : "videocam-outline"} size={20} color={colors.primaryDark} />
                </View>
              )}
              <View style={styles.rowBody}>
                <Text style={styles.episodeTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.episodeMeta}>
                  WAY/{item.profile.wayId} · {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
              <Ionicons name={item.type === "audio" ? "play-circle-outline" : "videocam-outline"} size={26} color={colors.primary} />
            </Pressable>
            <EpisodeActionRow
              episode={item}
              onChange={(updated) => setEpisodes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
              onOpenComments={() => router.push(`/episode/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No episodes yet.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: spacing.md },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  listPadding: { paddingTop: spacing.sm, paddingBottom: spacing.xl },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowMain: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  coverWrap: { width: 48, height: 48, borderRadius: radii.md, overflow: "hidden" },
  coverPlaceholder: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  episodeTitle: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  episodeMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
