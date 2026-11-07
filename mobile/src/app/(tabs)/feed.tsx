import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme/theme";
import { PostCard } from "../../components/PostCard";
import { WayButton } from "../../components/WayButton";
import { AutoScrollSpotlight } from "../../components/AutoScrollSpotlight";
import { ShakeTipToast } from "../../components/ShakeTipToast";
import { LiveRail } from "../../components/LiveRail";
import { StatusRail } from "../../components/StatusRail";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";
import { useSession } from "../../context/SessionContext";
import { useAutoScroll } from "../../lib/useAutoScroll";
import { getDiscoverFeed, getFeed } from "../../api/posts";
import { getActiveLiveSessions } from "../../api/live";
import { getUnreadNotificationCount } from "../../api/notifications";
import { getActiveStatusIds, getStatusFeed } from "../../api/status";
import type { AutoScrollSpeed, LiveSession, Post, StatusFeedEntry } from "../../types";

// Not as time-sensitive as a chat thread, so a longer interval than
// live/[id].tsx's 4s chat poll is plenty.
const UNREAD_POLL_MS = 15000;

type FeedTab = "following" | "discover";

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const listRef = useRef<FlatList<Post>>(null);
  const [speed, setSpeed] = useState<AutoScrollSpeed>("off");
  const [spotlightPost, setSpotlightPost] = useState<Post | null>(null);
  const lastSpotlightedIdRef = useRef<string | null>(null);
  // Paused (effective speed "off") while a post is spotlighted, so the list
  // holds still under it; resumes on its own once the spotlight clears.
  const autoScrollHandlers = useAutoScroll(listRef, spotlightPost ? "off" : speed);

  // FlatList requires onViewableItemsChanged to keep the same identity
  // across renders, so it's a stable ref that reads the latest speed/
  // spotlight state via these mirrored refs rather than closing over them.
  const speedRef = useRef(speed);
  const spotlightActiveRef = useRef(false);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    spotlightActiveRef.current = !!spotlightPost;
  }, [spotlightPost]);

  // Auto-scroll's "spotlight": when a post becomes the dominant one on
  // screen while auto-scrolling, it takes over the screen for a hold (see
  // AutoScrollSpotlight) instead of just sliding past like a normal scroll.
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 80 });
  const onViewableItemsChangedRef = useRef(({ viewableItems }: { viewableItems: { item: Post }[] }) => {
    if (speedRef.current === "off" || spotlightActiveRef.current) return;
    const top = viewableItems[0]?.item;
    if (!top || top.id === lastSpotlightedIdRef.current) return;
    lastSpotlightedIdRef.current = top.id;
    setSpotlightPost(top);
  });

  const [tab, setTab] = useState<FeedTab>("following");
  const [posts, setPosts] = useState<Post[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusAuthorIds, setStatusAuthorIds] = useState<Set<string>>(new Set());
  const [statusFeed, setStatusFeed] = useState<StatusFeedEntry[]>([]);

  // Batched per page — one call for every author on the page, not one per
  // avatar. "replace" on a fresh load (first page/refresh/tab switch) so
  // stale ids from a previous post set don't linger; "merge" on loadMore so
  // paginating doesn't drop ring state already known for earlier posts.
  async function refreshStatusAuthors(pagePosts: Post[], mode: "replace" | "merge") {
    const ids = [...new Set(pagePosts.map((p) => p.profile.id))];
    const active = await getActiveStatusIds(ids).catch(() => []);
    setStatusAuthorIds((prev) => new Set(mode === "merge" ? [...prev, ...active] : active));
  }

  useEffect(() => {
    if (!activeProfile) return;
    const load = () => getUnreadNotificationCount(activeProfile.id).then((r) => setUnreadCount(r.count)).catch(() => {});
    load();
    const poll = setInterval(load, UNREAD_POLL_MS);
    return () => clearInterval(poll);
  }, [activeProfile]);

  // Independent of the following/discover tab — the status rail is always
  // "my status + who I follow", not scoped to whichever posts are showing.
  useFocusEffect(
    useCallback(() => {
      if (!activeProfile) return;
      getStatusFeed(activeProfile.id).then(setStatusFeed).catch(() => {});
    }, [activeProfile])
  );

  const loadFirstPage = useCallback(async () => {
    if (!activeProfile) return;
    setError(null);
    try {
      if (tab === "following") {
        const [page, active] = await Promise.all([
          getFeed({ viewerProfileId: activeProfile.id, limit: 20 }),
          getActiveLiveSessions().catch(() => []),
        ]);
        setPosts(page.posts);
        setCursor(page.nextCursor);
        setLiveSessions(active);
        refreshStatusAuthors(page.posts, "replace");
      } else {
        const page = await getDiscoverFeed({ profileId: activeProfile.id, limit: 20 });
        setPosts(page.posts);
        setCursor(page.nextCursor);
        setLiveSessions([]);
        refreshStatusAuthors(page.posts, "replace");
      }
    } catch {
      setError("Couldn't load the feed. Pull to retry.");
    }
  }, [activeProfile, tab]);

  // Loads on mount, whenever the tab (following/discover) changes, and
  // again whenever the screen regains focus (e.g. right after posting).
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
      const page =
        tab === "following"
          ? await getFeed({ viewerProfileId: activeProfile.id, cursor, limit: 20 })
          : await getDiscoverFeed({ profileId: activeProfile.id, cursor, limit: 20 });
      setPosts((prev) => [...prev, ...page.posts]);
      setCursor(page.nextCursor);
      refreshStatusAuthors(page.posts, "merge");
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
          <Pressable style={styles.bellButton} onPress={() => router.push("/podcasts")} hitSlop={8}>
            <Ionicons name="mic-outline" size={22} color={colors.primaryDark} />
          </Pressable>
          <Pressable style={styles.bellButton} onPress={() => router.push("/event-composer")} hitSlop={8}>
            <Ionicons name="calendar-outline" size={22} color={colors.primaryDark} />
          </Pressable>
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

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabPill, tab === "following" && styles.tabPillActive]} onPress={() => setTab("following")}>
          <Text style={[styles.tabLabel, tab === "following" && styles.tabLabelActive]}>Following</Text>
        </Pressable>
        <Pressable style={[styles.tabPill, tab === "discover" && styles.tabPillActive]} onPress={() => setTab("discover")}>
          <Text style={[styles.tabLabel, tab === "discover" && styles.tabLabelActive]}>Discover</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View>
            {activeProfile && <StatusRail entries={statusFeed} activeProfileId={activeProfile.id} />}
            <LiveRail sessions={liveSessions} onSelect={(session) => router.push(`/live/${session.id}`)} />
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onChange={updatePost}
            onOpenComments={(post) => router.push(`/post/${post.id}`)}
            hasActiveStatus={statusAuthorIds.has(item.profile.id)}
          />
        )}
        onScroll={(e) => autoScrollHandlers.onScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
        // FlatList requires these two to keep the same identity across
        // renders (it logs an error if onViewableItemsChanged changes), so
        // they're read from refs rather than state/inline functions.
        // eslint-disable-next-line react-hooks/refs
        viewabilityConfig={viewabilityConfigRef.current}
        // eslint-disable-next-line react-hooks/refs
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        onEndReachedThreshold={0.6}
        onEndReached={loadMore}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={!error ? <Text style={styles.empty}>No posts yet — be the first to share something.</Text> : null}
        ListFooterComponent={loading ? <ActivityIndicator color={colors.primaryDark} style={styles.spinner} /> : null}
        contentContainerStyle={[styles.listPadding, posts.length === 0 && styles.emptyContainer]}
      />

      <WayButton speed={speed} onChange={setSpeed} />
      {spotlightPost && <AutoScrollSpotlight post={spotlightPost} onDismiss={() => setSpotlightPost(null)} />}
      <ShakeTipToast topOffset={insets.top} />
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
  tabRow: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  tabPill: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 999, backgroundColor: colors.surfaceAlt },
  tabPillActive: { backgroundColor: colors.primary },
  tabLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  tabLabelActive: { color: colors.textOnPrimary },
  error: { color: colors.danger, textAlign: "center", ...typography.caption, marginBottom: spacing.xs },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  // The floating nav icons now wander the whole screen instead of
  // reserving a fixed bottom strip, so content extends to the true bottom.
  listPadding: { paddingBottom: spacing.xl },
  spinner: { marginVertical: spacing.lg },
});
