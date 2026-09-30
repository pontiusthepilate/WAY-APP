import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/theme";
import type { Transaction } from "../types";
import { formatCurrency } from "../lib/formatCurrency";
import { formatRelativeTime } from "../lib/formatRelativeTime";

const LABEL_BY_TYPE: Record<Transaction["type"], string> = {
  fund: "Wallet funded",
  transfer_out: "Sent",
  transfer_in: "Received",
};

export function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.type === "fund" || tx.type === "transfer_in";
  const counterpartyLabel = tx.counterparty ? `WAY/${tx.counterparty.wayId}` : tx.method === "card" ? "Card" : null;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.label}>
          {LABEL_BY_TYPE[tx.type]}
          {counterpartyLabel ? ` · ${counterpartyLabel}` : ""}
        </Text>
        {tx.description ? <Text style={styles.description}>{tx.description}</Text> : null}
        <Text style={styles.time}>{formatRelativeTime(tx.createdAt)}</Text>
      </View>
      <Text style={[styles.amount, isCredit ? styles.credit : styles.debit]}>
        {isCredit ? "+" : "−"}
        {formatCurrency(tx.amount, tx.currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  info: { flex: 1, marginRight: spacing.sm },
  label: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  description: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  time: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  amount: { ...typography.h3 },
  credit: { color: colors.primaryDark },
  debit: { color: colors.danger },
});
