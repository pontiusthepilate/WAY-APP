import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { getWallet, transferFunds } from "../api/wallet";
import { formatCurrency, toMinorUnits } from "../lib/formatCurrency";
import type { Currency, WalletBalance } from "../types";
import { ApiError } from "../api/client";

export default function WalletSendScreen() {
  const router = useRouter();
  const { activeProfile } = useSession();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [toWayId, setToWayId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    const wallet = await getWallet(activeProfile.id);
    setBalances(wallet.balances);
    setCurrency((prev) => prev ?? wallet.balances[0]?.currency ?? null);
  }, [activeProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selectedBalance = balances.find((b) => b.currency === currency);
  const parsedAmount = parseFloat(amount);
  const isValid = currency && !Number.isNaN(parsedAmount) && parsedAmount > 0 && toWayId.trim().length > 0;

  async function handleSend() {
    if (!activeProfile || !currency || !isValid) return;
    setLoading(true);
    setError(null);
    try {
      await transferFunds({
        fromProfileId: activeProfile.id,
        toWayId: toWayId.trim().toLowerCase(),
        currency,
        amount: toMinorUnits(parsedAmount),
        note: note.trim() || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send funds.");
    } finally {
      setLoading(false);
    }
  }

  if (balances.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Send Funds</Text>
        <Text style={styles.empty}>Fund your wallet first — there&apos;s nothing to send yet.</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/wallet-fund")}>
          <Text style={styles.buttonText}>Fund Wallet</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Send Funds</Text>

      <Text style={styles.label}>From currency</Text>
      <View style={styles.chipRow}>
        {balances.map((b) => (
          <Pressable key={b.currency} style={[styles.chip, currency === b.currency && styles.chipActive]} onPress={() => setCurrency(b.currency)}>
            <Text style={[styles.chipLabel, currency === b.currency && styles.chipLabelActive]}>{b.currency}</Text>
          </Pressable>
        ))}
      </View>
      {selectedBalance && (
        <Text style={styles.balanceHint}>Available: {formatCurrency(selectedBalance.amount, selectedBalance.currency)}</Text>
      )}

      <Text style={styles.label}>Send to (WAY)</Text>
      <View style={styles.wayInputWrap}>
        <Text style={styles.wayPrefix}>WAY/</Text>
        <TextInput
          style={styles.wayInput}
          placeholder="theirname"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          value={toWayId}
          onChangeText={setToWayId}
        />
      </View>

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor={colors.textSecondary}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.label}>Note (optional)</Text>
      <TextInput
        style={styles.noteInput}
        placeholder="What's this for?"
        placeholderTextColor={colors.textSecondary}
        value={note}
        onChangeText={setNote}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, !isValid && styles.buttonDisabled]} onPress={handleSend} disabled={!isValid || loading}>
        {loading ? <ActivityIndicator color={colors.primaryDark} /> : <Text style={styles.buttonText}>Send</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  chipLabelActive: { color: colors.textOnPrimary },
  balanceHint: { ...typography.caption, color: colors.primaryDark, marginTop: spacing.xs },
  wayInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  wayPrefix: { ...typography.body, color: colors.primaryDark, fontWeight: "700" },
  wayInput: { flex: 1, paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 24,
    color: colors.textPrimary,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md, ...typography.caption },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.warning,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
