import React, { useCallback, useState } from "react";
import { Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { PostGridItem } from "../../components/PostGridItem";
import { useSession } from "../../context/SessionContext";
import { getProfilePosts } from "../../api/posts";
import { getScheduledLiveSessions, startLiveSession } from "../../api/live";
import { getIncomingCameraRequests } from "../../api/remoteCamera";
import type { LiveSession, Post, RemoteCameraRequest } from "../../types";

const COLUMNS = 3;
const TILE_SIZE = Dimensions.get("window").width / COLUMNS;

export default function ProfileScreen() {
  const router = useRouter();
  const { activeProfile, profiles, setActiveProfileId, signOut } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [scheduled, setScheduled] = useState<LiveSession[]>([]);
  const [cameraRequests, setCameraRequests] = useState<RemoteCameraRequest[]>([]);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    try {
      const [page, upcoming, incoming] = await Promise.all([
        getProfilePosts(activeProfile.id, { viewerProfileId: activeProfile.id, limit: 60 }),
        getScheduledLiveSessions(activeProfile.id).catch(() => []),
        getIncomingCameraRequests(activeProfile.id).catch(() => []),
      ]);
      setPosts(page.posts);
      setScheduled(upcoming);
      setCameraRequests(incoming.filter((r) => r.status === "pending"));
    } catch {
      setPosts([]);
    }
  }, [activeProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleStartNow(sessionId: string) {
    await startLiveSession(sessionId);
    router.push(`/live/${sessionId}`);
  }

  if (!activeProfile) return null;

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(p) => p.id}
      numColumns={COLUMNS}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            {activeProfile.displayPictureUrl ? (
              <Image source={{ uri: activeProfile.displayPictureUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{activeProfile.displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.name}>
              {activeProfile.displayName}
              {activeProfile.isVerified ? " ✓" : ""}
            </Text>
            <Text style={styles.way}>WAY/{activeProfile.wayId}</Text>
            {activeProfile.bio && <Text style={styles.bio}>{activeProfile.bio}</Text>}

            <View style={styles.statsRow}>
              <Stat label="Posts" value={posts.length} />
              <Stat label="Followers" value={activeProfile.followersCount} />
              <Stat label="Following" value={activeProfile.followingCount} />
            </View>
          </View>

          {profiles.length > 1 && (
            <View style={styles.switcherRow}>
              {profiles.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.switcherChip, p.id === activeProfile.id && styles.switcherChipActive]}
                  onPress={() => setActiveProfileId(p.id)}
                >
                  <Text style={[styles.switcherLabel, p.id === activeProfile.id && styles.switcherLabelActive]}>
                    WAY/{p.wayId}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {scheduled.length > 0 && (
            <View style={styles.upcomingSection}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              {scheduled.map((s) => (
                <View key={s.id} style={styles.upcomingRow}>
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingTitle}>{s.title ?? "Live session"}</Text>
                    <Text style={styles.upcomingTime}>
                      {s.scheduledFor ? new Date(s.scheduledFor).toLocaleString() : ""}
                    </Text>
                  </View>
                  <Pressable style={styles.startButton} onPress={() => handleStartNow(s.id)}>
                    <Text style={styles.startButtonText}>Start Now</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {cameraRequests.length > 0 && (
            <View style={styles.upcomingSection}>
              <Text style={styles.sectionTitle}>Camera Requests</Text>
              {cameraRequests.map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.upcomingRow}
                  onPress={() => router.push(`/camera-request/${r.id}`)}
                >
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingTitle}>{r.fromProfile?.displayName ?? "Someone"} wants your camera</Text>
                    <Text style={styles.upcomingTime}>{r.message ?? "Tap to review"}</Text>
                  </View>
                  <View style={styles.startButton}>
                    <Text style={styles.startButtonText}>Review</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionButton} onPress={() => router.push("/post-composer")}>
              <Text style={styles.actionButtonText}>New Post</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.goLiveButton]} onPress={() => router.push("/go-live")}>
              <Text style={styles.actionButtonText}>Go Live</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.signOutButton]} onPress={signOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <PostGridItem post={item} size={TILE_SIZE} onPress={() => router.push(`/post/${item.id}`)} />
      )}
      ListEmptyComponent={<Text style={styles.empty}>No posts yet — tap New Post to share something.</Text>}
    />
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: radii.pill, backgroundColor: colors.primaryLight },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700", fontSize: 32 },
  name: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.sm },
  way: { ...typography.body, color: colors.textSecondary },
  bio: { ...typography.body, color: colors.textPrimary, textAlign: "center", marginTop: spacing.xs },
  statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md },
  stat: { alignItems: "center" },
  statValue: { ...typography.h3, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  switcherRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xs, marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  switcherChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  switcherChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  switcherLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  switcherLabelActive: { color: colors.textOnPrimary },
  upcomingSection: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  upcomingInfo: { flex: 1, marginRight: spacing.sm },
  upcomingTitle: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  upcomingTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  startButton: { backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  startButtonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  actionButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: spacing.sm, alignItems: "center" },
  actionButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  goLiveButton: { backgroundColor: colors.danger },
  signOutButton: { backgroundColor: colors.surfaceAlt },
  signOutText: { color: colors.danger, fontWeight: "700" },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
