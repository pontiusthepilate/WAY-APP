import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { TransactionRow } from "../components/TransactionRow";
import { useSession } from "../context/SessionContext";
import { getTransactions } from "../api/wallet";
import { safeBack } from "../lib/navigation";
import { SkyOceanBackground } from "../components/SkyOceanBackground";
import type { Transaction } from "../types";

export default function WalletHistoryScreen() {
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();
  const [filterWayId, setFilterWayId] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<string | undefined>(undefined);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (withWayId?: string) => {
      if (!activeProfile) return;
      setLoading(true);
      try {
        const page = await getTransactions({ profileId: activeProfile.id, withWayId, limit: 30 });
        setTransactions(page.transactions);
        setCursor(page.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [activeProfile]
  );

  useEffect(() => {
    // Re-fetches whenever the WAY-ID filter changes — a legitimate
    // fetch-on-dependency-change effect, not a focus-driven refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(appliedFilter);
  }, [load, appliedFilter]);

  async function loadMore() {
    if (!activeProfile || !cursor || loading) return;
    setLoading(true);
    try {
      const page = await getTransactions({ profileId: activeProfile.id, withWayId: appliedFilter, cursor, limit: 30 });
      setTransactions((prev) => [...prev, ...page.transactions]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  function applyFilter() {
    setAppliedFilter(filterWayId.trim() ? filterWayId.trim().toLowerCase() : undefined);
  }

  function clearFilter() {
    setFilterWayId("");
    setAppliedFilter(undefined);
  }

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={[styles.headerRow, { paddingTop: spacing.lg + insets.top }]}>
        <Pressable onPress={() => safeBack("/wallet")}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Transaction History</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.filterRow}>
        <View style={styles.wayInputWrap}>
          <Ionicons name="at-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.wayInput}
            placeholder="Filter by person"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            value={filterWayId}
            onChangeText={setFilterWayId}
            onSubmitEditing={applyFilter}
          />
        </View>
        {appliedFilter ? (
          <Pressable style={styles.clearButton} onPress={clearFilter}>
            <Text style={styles.clearButtonText}>Clear</Text>
            <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable style={styles.filterButton} onPress={applyFilter}>
            <Text style={styles.filterButtonText}>Filter</Text>
            <Ionicons name="funnel-outline" size={16} color={colors.textOnPrimary} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        onEndReachedThreshold={0.6}
        onEndReached={loadMore}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {appliedFilter ? `No transactions with ${appliedFilter} yet.` : "No transactions yet."}
            </Text>
          ) : null
        }
        ListFooterComponent={loading ? <ActivityIndicator color={colors.primaryDark} style={styles.spinner} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  back: { ...typography.body, color: colors.primary },
  title: { ...typography.h3, color: colors.textPrimary },
  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  wayInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.xs },
  wayInput: { flex: 1, paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary },
  filterButton: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  clearButton: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.12)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: { color: colors.textSecondary, fontWeight: "700" },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  spinner: { marginVertical: spacing.lg },
});
