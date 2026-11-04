import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme/theme";
import { PostCard } from "../../components/PostCard";
import { WayButton } from "../../components/WayButton";
import { LiveRail } from "../../components/LiveRail";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";
import { useSession } from "../../context/SessionContext";
import { useAutoScroll } from "../../lib/useAutoScroll";
import { getFeed } from "../../api/posts";
import { getActiveLiveSessions } from "../../api/live";
import { getUnreadNotificationCount } from "../../api/notifications";
import type { AutoScrollSpeed, LiveSession, Post } from "../../types";

// Not as time-sensitive as a chat thread, so a longer interval than
// live/[id].tsx's 4s chat poll is plenty.
const UNREAD_POLL_MS = 15000;

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const listRef = useRef<FlatList<Post>>(null);
  const [speed, setSpeed] = useState<AutoScrollSpeed>("off");
  const autoScrollHandlers = useAutoScroll(listRef, speed);

  const [posts, setPosts] = useState<Post[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!activeProfile) return;
    const load = () => getUnreadNotificationCount(activeProfile.id).then((r) => setUnreadCount(r.count)).catch(() => {});
    load();
    const poll = setInterval(load, UNREAD_POLL_MS);
    return () => clearInterval(poll);
  }, [activeProfile]);

  const loadFirstPage = useCallback(async () => {
    if (!activeProfile) return;
    setError(null);
    try {
      const [page, active] = await Promise.all([
        getFeed({ viewerProfileId: activeProfile.id, limit: 20 }),
        getActiveLiveSessions().catch(() => []),
      ]);
      setPosts(page.posts);
      setCursor(page.nextCursor);
      setLiveSessions(active);
    } catch {
      setError("Couldn't load the feed. Pull to retry.");
    }
  }, [activeProfile]);

  // Loads on mount and again whenever the tab regains focus (e.g. right after posting).
  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
    }, [loadFirstPage])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }

  async function loadMore() {
    if (!activeProfile || !cursor || loading) return;
    setLoading(true);
    try {
      const page = await getFeed({ viewerProfileId: activeProfile.id, cursor, limit: 20 });
      setPosts((prev) => [...prev, ...page.posts]);
      setCursor(page.nextCursor);
    } catch {
      // keep existing posts; next pull-to-refresh or scroll retry will attempt again
    } finally {
      setLoading(false);
    }
  }

  function updatePost(next: Post) {
    setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <Text style={styles.headerTitle}>WAY</Text>
        <View style={styles.headerButtons}>
          <Pressable style={styles.bellButton} onPress={() => router.push("/notifications")} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={colors.primaryDark} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.liveButton} onPress={() => router.push("/go-live")}>
            <Text style={styles.liveButtonText}>Go Live</Text>
          </Pressable>
          <Pressable style={styles.composeButton} onPress={() => router.push("/post-composer")}>
            <Text style={styles.composeButtonText}>+ Post</Text>
          </Pressable>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <LiveRail sessions={liveSessions} onSelect={(session) => router.push(`/live/${session.id}`)} />
        }
        renderItem={({ item }) => (
          <PostCard post={item} onChange={updatePost} onOpenComments={(post) => router.push(`/post/${post.id}`)} />
        )}
        onScroll={(e) => autoScrollHandlers.onScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
        onEndReachedThreshold={0.6}
        onEndReached={loadMore}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={!error ? <Text style={styles.empty}>No posts yet — be the first to share something.</Text> : null}
        ListFooterComponent={loading ? <ActivityIndicator color={colors.primaryDark} style={styles.spinner} /> : null}
        contentContainerStyle={[styles.listPadding, posts.length === 0 && styles.emptyContainer]}
      />

      <WayButton speed={speed} onChange={setSpeed} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.h1, color: colors.primaryDark },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bellButton: { position: "relative" },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: colors.textOnPrimary, fontSize: 10, fontWeight: "700" },
  liveButton: {
    backgroundColor: colors.danger,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  liveButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  composeButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  composeButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  error: { color: colors.danger, textAlign: "center", ...typography.caption, marginBottom: spacing.xs },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Clears the floating, transparent tab bar (see (tabs)/_layout.tsx) so the
  // last post isn't hidden underneath it.
  listPadding: { paddingBottom: 90 },
  spinner: { marginVertical: spacing.lg },
});
