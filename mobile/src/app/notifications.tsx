import React, { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackground } from "../components/PageBackground";
import { useSession } from "../context/SessionContext";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../api/notifications";
import { safeBack } from "../lib/navigation";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import type { AppNotification, NotificationType } from "../types";

const MESSAGE_BY_TYPE: Record<NotificationType, (name: string) => string> = {
  like: (name) => `${name} liked your post`,
  comment: (name) => `${name} commented on your post`,
  follow: (name) => `${name} started following you`,
  way_request: (name) => `${name} sent you a WAY request`,
  way_request_accepted: (name) => `${name} accepted your WAY request`,
  way_request_declined: (name) => `${name} declined your WAY request`,
  camera_request: (name) => `${name} wants to see your camera`,
  go_live: (name) => `${name} is live now`,
  profile_access_request: (name) => `${name} requested access to your full profile`,
  profile_access_response: (name) => `${name} responded to your profile access request`,
};

// like/comment target either a Post or an Episode (disambiguated by which
// id is present, same as the tap-navigation below) — every other type is
// never about a specific piece of content, so the plain map covers it.
function formatNotificationMessage(item: AppNotification): string {
  const name = item.actor?.displayName ?? "Someone";
  if (item.episodeId && (item.type === "like" || item.type === "comment")) {
    return item.type === "like" ? `${name} liked your episode` : `${name} commented on your episode`;
  }
  return MESSAGE_BY_TYPE[item.type](name);
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    try {
      const page = await getNotifications({ profileId: activeProfile.id, limit: 50 });
      setNotifications(page.notifications);
    } catch {
      // next focus will retry
    }
  }, [activeProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePress(notification: AppNotification) {
    if (!activeProfile) return;
    if (!notification.read) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
      markNotificationRead(notification.id, activeProfile.id).catch(() => {});
    }
    if (notification.episodeId) router.push(`/episode/${notification.episodeId}`);
    else if (notification.postId) router.push(`/post/${notification.postId}`);
    else if (notification.profileAccessRequestId) router.push(`/profile-access-request/${notification.profileAccessRequestId}`);
    else if (notification.wayRequestId) router.push(`/way-request/${notification.wayRequestId}`);
  }

  async function handleMarkAllRead() {
    if (!activeProfile) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead(activeProfile.id).catch(() => {});
  }

  return (
    <View style={styles.container}>
      <PageBackground />
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable onPress={handleMarkAllRead} hitSlop={12}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, !item.read && styles.rowUnread]} onPress={() => handlePress(item)}>
            {item.actor?.displayPictureUrl ? (
              <Image source={{ uri: item.actor.displayPictureUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{(item.actor?.displayName ?? "?").charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={styles.message}>{formatNotificationMessage(item)}</Text>
              <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  markAllText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  listPadding: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  rowUnread: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, paddingHorizontal: spacing.xs },
  avatar: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.primaryLight },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700" },
  rowText: { flex: 1 },
  message: { ...typography.body, color: colors.textPrimary },
  time: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
