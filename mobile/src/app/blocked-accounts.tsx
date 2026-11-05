import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackground } from "../components/PageBackground";
import { useSession } from "../context/SessionContext";
import { getMyBlocks, removeBlock, type Block } from "../api/safety";
import { Avatar } from "../components/Avatar";
import { safeBack } from "../lib/navigation";

export default function BlockedAccountsScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!activeProfile) return;
    getMyBlocks(activeProfile.id, "block").then(setBlocks).catch(() => {});
  }, [activeProfile]);

  useFocusEffect(load);

  async function handleUnblock(targetProfileId: string) {
    if (!activeProfile) return;
    setUnblockingId(targetProfileId);
    try {
      await removeBlock(activeProfile.id, targetProfileId, "block");
      setBlocks((prev) => prev.filter((b) => b.targetProfileId !== targetProfileId));
    } finally {
      setUnblockingId(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Blocked accounts</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={blocks}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar uri={item.targetProfile?.displayPictureUrl ?? null} displayName={item.targetProfile?.displayName ?? "?"} size={44} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.targetProfile?.displayName ?? "Unknown"}</Text>
              {item.targetProfile?.wayId && <Text style={styles.wayId}>WAY/{item.targetProfile.wayId}</Text>}
            </View>
            <Pressable
              style={styles.unblockButton}
              onPress={() => handleUnblock(item.targetProfileId)}
              disabled={unblockingId === item.targetProfileId}
            >
              <Text style={styles.unblockButtonText}>Unblock</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>You haven&apos;t blocked anyone.</Text>}
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
  unblockButton: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  unblockButtonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
