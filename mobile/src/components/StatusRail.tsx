import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import { colors, spacing, typography } from "../theme/theme";
import type { StatusFeedEntry } from "../types";

interface Props {
  entries: StatusFeedEntry[];
  activeProfileId: string;
}

// The feed's status rail: a row of circular avatars for the viewer's own
// profile plus everyone they follow with an active (< 24h old) status —
// tap one to view it, same ring/Avatar pattern already used on PostCard
// and the profile header. Always shows the viewer's own circle first, even
// with no active status, as the entry point into status-composer.
export function StatusRail({ entries, activeProfileId }: Props) {
  const router = useRouter();
  const own = entries.find((e) => e.profile.id === activeProfileId);
  const others = entries.filter((e) => e.profile.id !== activeProfileId);

  function openViewer(entry: StatusFeedEntry) {
    router.push({
      pathname: "/status/[profileId]",
      params: { profileId: entry.profile.id, displayName: entry.profile.displayName },
    });
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={others}
        keyExtractor={(e) => e.profile.id}
        contentContainerStyle={styles.row}
        ListHeaderComponent={
          <Pressable
            style={styles.item}
            onPress={() => (own ? openViewer(own) : router.push("/status-composer"))}
          >
            <View>
              <Avatar
                uri={own?.profile.displayPictureUrl ?? null}
                displayName="You"
                size={56}
                hasActiveStatus={!!own}
              />
              {!own && (
                <View style={styles.addBadge}>
                  <Ionicons name="add" size={12} color={colors.textOnPrimary} />
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {own ? "My status" : "Add status"}
            </Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => openViewer(item)}>
            <Avatar uri={item.profile.displayPictureUrl} displayName={item.profile.displayName} size={56} hasActiveStatus />
            <Text style={styles.name} numberOfLines={1}>
              {item.profile.displayName}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.sm },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
  item: { alignItems: "center", width: 68, marginRight: spacing.sm },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.xs, textAlign: "center" },
});
