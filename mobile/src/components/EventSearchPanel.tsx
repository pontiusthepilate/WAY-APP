import React, { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { searchEvents } from "../api/posts";
import { useSession } from "../context/SessionContext";
import type { Post } from "../types";

const CATEGORIES = [
  "Music",
  "Sports",
  "Business",
  "Tech",
  "Food & Drink",
  "Arts & Culture",
  "Networking",
  "Education",
  "Health & Wellness",
  "Community",
];

// The events search surface: free text (title/location) plus an optional
// interest-category filter, against event posts — a separate domain from
// the rest of this screen's profile search (nearby/address/wayid).
export function EventSearchPanel() {
  const router = useRouter();
  const { activeProfile } = useSession();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [events, setEvents] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await searchEvents({
        q: query.trim() || undefined,
        category: category ?? undefined,
        profileId: activeProfile?.id,
      });
      setEvents(page.posts);
    } catch {
      setError("Couldn't load events. Try again.");
    } finally {
      setLoading(false);
    }
  }, [query, category, activeProfile]);

  useFocusEffect(
    useCallback(() => {
      runSearch();
      // Only the initial load on focus — typing/filter changes are applied
      // explicitly via the search button/chip tap, not on every keystroke.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.inputWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder="Search events by title or location"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
        />
      </View>

      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.categoryPill, category === c && styles.categoryPillActive]}
            onPress={() => {
              setCategory((prev) => (prev === c ? null : c));
            }}
          >
            <Text style={[styles.categoryLabel, category === c && styles.categoryLabelActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.searchButton} onPress={runSearch} disabled={loading}>
        <Text style={styles.searchButtonText}>{loading ? "Searching…" : "Search"}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/post/${item.id}`)}>
            {item.mediaUrl &&
              (item.eventMediaType === "video" ? (
                <View style={[styles.cardPhoto, styles.cardVideoBadge]}>
                  <Ionicons name="videocam" size={20} color={colors.primaryDark} />
                </View>
              ) : (
                <Image source={{ uri: item.mediaUrl }} style={styles.cardPhoto} resizeMode="cover" />
              ))}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.eventTitle}
              </Text>
              {item.eventStartsAt && <Text style={styles.cardMeta}>{new Date(item.eventStartsAt).toLocaleString()}</Text>}
              {item.eventLocation && (
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.eventLocation}
                </Text>
              )}
              <Text style={styles.cardBy} numberOfLines={1}>
                by {item.profile.wayId}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>No events found.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  categoryPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  categoryLabelActive: { color: colors.textOnPrimary },
  searchButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  searchButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.sm, ...typography.caption },
  listPadding: { paddingTop: spacing.md, paddingBottom: 110 },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg, ...typography.body },
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPhoto: { width: 88, height: 88, backgroundColor: colors.surfaceAlt },
  cardVideoBadge: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, padding: spacing.sm, justifyContent: "center" },
  cardTitle: { ...typography.h3, color: colors.textPrimary },
  cardMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardBy: { ...typography.caption, color: colors.textSecondary, marginTop: 4, fontStyle: "italic" },
});
