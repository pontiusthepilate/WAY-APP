import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { TransactionRow } from "../../components/TransactionRow";
import { useSession } from "../../context/SessionContext";
import { getTransactions, getWallet } from "../../api/wallet";
import type { Transaction, WalletBalance } from "../../types";
import { formatCurrency } from "../../lib/formatCurrency";

export default function WalletScreen() {
  const router = useRouter();
  const { activeProfile } = useSession();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    const [wallet, history] = await Promise.all([
      getWallet(activeProfile.id),
      getTransactions({ profileId: activeProfile.id, limit: 5 }),
    ]);
    setBalances(wallet.balances);
    setRecent(history.transactions);
  }, [activeProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!activeProfile) return null;

  return (
    <FlatList
      style={styles.container}
      data={recent}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => <TransactionRow tx={item} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.headerTitle}>Wallet</Text>

          {balances.length === 0 ? (
            <View style={styles.emptyBalanceCard}>
              <Text style={styles.emptyBalanceText}>No funds yet</Text>
            </View>
          ) : (
            <FlatList
              horizontal
              data={balances}
              keyExtractor={(b) => b.currency}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.balanceRow}
              renderItem={({ item }) => (
                <View style={styles.balanceCard}>
                  <Text style={styles.balanceCurrency}>{item.currency}</Text>
                  <Text style={styles.balanceAmount}>{formatCurrency(item.amount, item.currency)}</Text>
                </View>
              )}
            />
          )}

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionButton} onPress={() => router.push("/wallet-fund")}>
              <Text style={styles.actionButtonText}>Fund Wallet</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.sendButton]} onPress={() => router.push("/wallet-send")}>
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <Pressable onPress={() => router.push("/wallet-history")}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerTitle: { ...typography.h1, color: colors.primaryDark, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  balanceRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  balanceCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    padding: spacing.lg,
    minWidth: 160,
    marginRight: spacing.sm,
  },
  balanceCurrency: { ...typography.caption, color: colors.primaryLight, fontWeight: "700" },
  balanceAmount: { ...typography.h2, color: colors.textOnPrimary, marginTop: spacing.xs },
  emptyBalanceCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyBalanceText: { ...typography.body, color: colors.textSecondary },
  actionsRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  actionButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: spacing.sm, alignItems: "center" },
  actionButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  sendButton: { backgroundColor: colors.warning },
  sendButtonText: { color: colors.primaryDark, fontWeight: "700" },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  viewAll: { ...typography.caption, color: colors.primary, fontWeight: "600" },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
});
