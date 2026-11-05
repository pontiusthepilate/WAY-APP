import React, { useCallback, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { PostGridItem } from "../../components/PostGridItem";
import { useSession } from "../../context/SessionContext";
import { getProfilePosts } from "../../api/posts";
import { getScheduledLiveSessions, startLiveSession } from "../../api/live";
import { getIncomingCameraRequests } from "../../api/remoteCamera";
import { getIncomingWayRequests } from "../../api/wayRequests";
import { updateProfile } from "../../api/profiles";
import { uploadMedia } from "../../api/uploads";
import { getActiveStatusIds } from "../../api/status";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";
import { Avatar } from "../../components/Avatar";
import type { LiveSession, Post, RemoteCameraRequest, WayRequest } from "../../types";

const COLUMNS = 3;
const TILE_SIZE = Dimensions.get("window").width / COLUMNS;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile, profiles, setActiveProfileId, refreshProfiles } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [scheduled, setScheduled] = useState<LiveSession[]>([]);
  const [cameraRequests, setCameraRequests] = useState<RemoteCameraRequest[]>([]);
  const [wayRequests, setWayRequests] = useState<WayRequest[]>([]);
  const [pictureMenuOpen, setPictureMenuOpen] = useState(false);
  const [pictureSaving, setPictureSaving] = useState(false);
  const [hasActiveStatus, setHasActiveStatus] = useState(false);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    try {
      const [page, upcoming, incomingCamera, incomingWay, activeStatusIds] = await Promise.all([
        getProfilePosts(activeProfile.id, { viewerProfileId: activeProfile.id, limit: 50 }).catch(() => ({ posts: [], nextCursor: null })),
        getScheduledLiveSessions(activeProfile.id).catch(() => []),
        getIncomingCameraRequests(activeProfile.id).catch(() => []),
        getIncomingWayRequests(activeProfile.id).catch(() => []),
        getActiveStatusIds([activeProfile.id]).catch((): string[] => []),
      ]);
      setPosts(page.posts);
      setScheduled(upcoming);
      setCameraRequests(incomingCamera.filter((r) => r.status === "pending"));
      setWayRequests(incomingWay.filter((r) => r.status === "pending"));
      setHasActiveStatus(activeStatusIds.includes(activeProfile.id));
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

  async function handlePickPicture() {
    setPictureMenuOpen(false);
    if (!activeProfile) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setPictureSaving(true);
    try {
      const uploaded = await uploadMedia({ uri: result.assets[0].uri, type: "image" });
      await updateProfile(activeProfile.id, { displayPictureUrl: uploaded.url });
      await refreshProfiles();
    } finally {
      setPictureSaving(false);
    }
  }

  async function handleRemovePicture() {
    setPictureMenuOpen(false);
    if (!activeProfile) return;
    setPictureSaving(true);
    try {
      await updateProfile(activeProfile.id, { displayPictureUrl: null });
      await refreshProfiles();
    } finally {
      setPictureSaving(false);
    }
  }

  if (!activeProfile) return null;

  return (
    <View style={styles.root}>
      <SkyOceanBackground tone="pale" />
      <Pressable
        style={[styles.settingsButton, { top: spacing.md + insets.top }]}
        onPress={() => router.push("/settings")}
        hitSlop={8}
      >
        <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
      </Pressable>
      <FlatList
      style={styles.container}
      contentContainerStyle={styles.listPadding}
      data={posts}
      keyExtractor={(p) => p.id}
      numColumns={COLUMNS}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <View style={styles.avatarWrap}>
              <Avatar
                uri={activeProfile.displayPictureUrl}
                displayName={activeProfile.displayName}
                size={88}
                hasActiveStatus={hasActiveStatus}
                onPress={() =>
                  hasActiveStatus
                    ? router.push({
                        pathname: "/status/[profileId]",
                        params: { profileId: activeProfile.id, displayName: activeProfile.displayName },
                      })
                    : router.push("/status-composer")
                }
              />
              <Pressable
                style={styles.avatarMenuBadge}
                onPress={() => setPictureMenuOpen(true)}
                hitSlop={8}
                disabled={pictureSaving}
              >
                {pictureSaving ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Ionicons name="chevron-down" size={14} color={colors.textOnPrimary} />
                )}
              </Pressable>
            </View>
            <Text style={styles.name}>
              {activeProfile.displayName}
              {activeProfile.isVerified ? " ✓" : ""}
            </Text>
            <Pressable style={styles.wayRow} onPress={() => router.push("/my-qr")} hitSlop={8}>
              <Text style={styles.way}>WAY/{activeProfile.wayId}</Text>
              <Ionicons name="qr-code-outline" size={16} color={colors.textSecondary} />
            </Pressable>
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

          {wayRequests.length > 0 && (
            <View style={styles.upcomingSection}>
              <Text style={styles.sectionTitle}>WAY Requests</Text>
              {wayRequests.map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.upcomingRow}
                  onPress={() => router.push(`/way-request/${r.id}`)}
                >
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingTitle}>{r.fromProfile?.displayName ?? "Someone"} sent a WAY request</Text>
                    <Text style={styles.upcomingTime}>{r.text ?? "Tap to review"}</Text>
                  </View>
                  <View style={styles.startButton}>
                    <Text style={styles.startButtonText}>Review</Text>
                  </View>
                </Pressable>
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
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <PostGridItem post={item} size={TILE_SIZE} onPress={() => router.push(`/post/${item.id}`)} />
      )}
      ListEmptyComponent={<Text style={styles.empty}>No posts yet — tap New Post to share something.</Text>}
      />

      <Modal visible={pictureMenuOpen} animationType="fade" transparent onRequestClose={() => setPictureMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setPictureMenuOpen(false)}>
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={handlePickPicture}>
              <Ionicons name="image-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.menuItemText}>{activeProfile.displayPictureUrl ? "Edit photo" : "Add photo"}</Text>
            </Pressable>
            {activeProfile.displayPictureUrl && (
              <Pressable style={styles.menuItem} onPress={handleRemovePicture}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Remove photo</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
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
  root: { flex: 1 },
  container: { flex: 1 },
  listPadding: { paddingBottom: 90 },
  header: { alignItems: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  avatarWrap: { width: 88, height: 88 },
  avatarMenuBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(16, 42, 49, 0.35)", justifyContent: "center", alignItems: "center" },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    width: 220,
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  menuItemText: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  menuItemTextDanger: { color: colors.danger },
  name: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.sm },
  wayRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
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
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  settingsButton: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
