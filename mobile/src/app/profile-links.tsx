import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackground } from "../components/PageBackground";
import { useSession } from "../context/SessionContext";
import { getProfileLinks, setProfileLinks } from "../api/profileLinks";
import { Avatar } from "../components/Avatar";
import { safeBack } from "../lib/navigation";
import type { Profile } from "../types";

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  business: "shield-checkmark-outline",
  podcast: "mic-outline",
};

export default function ProfileLinksScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile, profiles } = useSession();
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const siblings = profiles.filter((p) => p.id !== activeProfile?.id);

  const load = useCallback(() => {
    if (!activeProfile) return;
    getProfileLinks(activeProfile.id)
      .then((links) => setLinkedIds(new Set(links.map((l) => l.id))))
      .catch(() => {});
  }, [activeProfile]);

  useFocusEffect(load);

  async function handleToggle(target: Profile, nextValue: boolean) {
    if (!activeProfile) return;
    const next = new Set(linkedIds);
    if (nextValue) next.add(target.id);
    else next.delete(target.id);
    setLinkedIds(next);
    setSavingId(target.id);
    try {
      await setProfileLinks(activeProfile.id, [...next]);
    } catch {
      // Revert on failure.
      setLinkedIds(linkedIds);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Linked profiles</Text>
        <View style={{ width: 24 }} />
      </View>

      {activeProfile && (
        <Text style={styles.subtitle}>
          Choose which of your other profiles show as a link on WAY/{activeProfile.wayId}.
        </Text>
      )}

      <FlatList
        data={siblings}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar uri={item.displayPictureUrl} displayName={item.displayName} size={44} />
            <View style={styles.rowBody}>
              <View style={styles.nameRow}>
                {KIND_ICON[item.kind] && (
                  <Ionicons name={KIND_ICON[item.kind]} size={14} color={colors.textSecondary} style={styles.kindIcon} />
                )}
                <Text style={styles.name}>{item.displayName}</Text>
              </View>
              <Text style={styles.wayId}>WAY/{item.wayId}</Text>
            </View>
            <Switch
              value={linkedIds.has(item.id)}
              onValueChange={(v) => handleToggle(item, v)}
              disabled={savingId === item.id}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Create another profile to link it from this one.</Text>}
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
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
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
  nameRow: { flexDirection: "row", alignItems: "center" },
  kindIcon: { marginRight: 4 },
  name: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  wayId: { ...typography.caption, color: colors.textSecondary },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
