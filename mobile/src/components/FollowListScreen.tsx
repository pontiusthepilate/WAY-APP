import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackground } from "./PageBackground";
import { getFollowers, getFollowing } from "../api/follow";
import { Avatar } from "./Avatar";
import { MiniProfileModal } from "./MiniProfileModal";
import { safeBack } from "../lib/navigation";
import { formatProfileHandle } from "../lib/profileHandle";
import { startConversation } from "../api/messages";
import { useSession } from "../context/SessionContext";
import type { FollowListEntry, NearbyResult } from "../types";

interface Props {
  profileId: string;
  mode: "followers" | "following";
}

// Shared by mobile/src/app/followers/[profileId].tsx and following/[profileId].tsx
// — same row rendering and empty state, same MiniProfileModal-on-tap pattern
// already used from search/feed, just a different fetch and title.
export function FollowListScreen({ profileId, mode }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeProfile } = useSession();
  const [entries, setEntries] = useState<FollowListEntry[]>([]);
  const [selected, setSelected] = useState<NearbyResult | null>(null);

  const load = useCallback(() => {
    const fetcher = mode === "followers" ? getFollowers : getFollowing;
    fetcher(profileId)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [profileId, mode]);

  useFocusEffect(load);

  function openProfile(entry: FollowListEntry) {
    // FollowListEntry is a narrower shape than NearbyResult (no
    // categories/visibility fields — those aren't meaningful for a list
    // row). MiniProfileModal fetches the full Profile itself on open, so
    // these defaults only cover its first paint.
    setSelected({
      id: entry.id,
      wayId: entry.wayId,
      displayName: entry.displayName,
      displayPictureUrl: entry.displayPictureUrl,
      categories: [],
      visibilityText: null,
      visibilityImageUrl: null,
      isLocationOverridden: false,
    });
  }

  async function handleMessage(result: NearbyResult) {
    if (!activeProfile) return;
    const conversation = await startConversation(activeProfile.id, result.id);
    router.push(`/messages/${conversation.id}`);
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{mode === "followers" ? "Followers" : "Following"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openProfile(item)}>
            <Avatar uri={item.displayPictureUrl} displayName={item.displayName} size={44} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.wayId}>{formatProfileHandle(item)}</Text>
            </View>
            {/* isAutoFollow rows (always sorted first) show why they're
                there instead of a follow/unfollow control — there's
                nothing to toggle on these. */}
            {item.isAutoFollow && item.defaultLabel && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{item.defaultLabel}</Text>
              </View>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{mode === "followers" ? "No followers yet." : "Not following anyone yet."}</Text>
        }
      />

      <MiniProfileModal
        result={selected}
        onClose={() => setSelected(null)}
        onSendRequest={(r) => router.push({ pathname: "/way-request", params: { toWayId: r.wayId, toDisplayName: r.displayName } })}
        onRequestCamera={(r) => router.push({ pathname: "/request-camera", params: { toWayId: r.wayId, toDisplayName: r.displayName } })}
        onMessage={handleMessage}
        onOpenProfile={setSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  listPadding: { paddingTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowBody: { flex: 1 },
  name: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  wayId: { ...typography.caption, color: colors.textSecondary },
  defaultBadge: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  defaultBadgeText: { ...typography.caption, color: colors.primaryDark, fontWeight: "700" },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
