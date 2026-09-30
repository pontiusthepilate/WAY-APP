import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { fundWallet } from "../api/wallet";
import { toMinorUnits } from "../lib/formatCurrency";
import { CURRENCIES, type Currency } from "../types";
import { ApiError } from "../api/client";

const METHODS: { key: "card" | "crypto"; label: string }[] = [
  { key: "card", label: "Card" },
  { key: "crypto", label: "Crypto" },
];

export default function WalletFundScreen() {
  const router = useRouter();
  const { activeProfile } = useSession();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [method, setMethod] = useState<"card" | "crypto">("card");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseFloat(amount);
  const isValid = !Number.isNaN(parsedAmount) && parsedAmount > 0;

  async function handleFund() {
    if (!activeProfile || !isValid) return;
    setLoading(true);
    setError(null);
    try {
      await fundWallet({ profileId: activeProfile.id, currency, amount: toMinorUnits(parsedAmount), method });
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) {
        setError("Crypto funding is coming soon — use Card for now.");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not fund your wallet.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fund Wallet</Text>

      <Text style={styles.label}>Currency</Text>
      <View style={styles.chipRow}>
        {CURRENCIES.map((c) => (
          <Pressable key={c} style={[styles.chip, currency === c && styles.chipActive]} onPress={() => setCurrency(c)}>
            <Text style={[styles.chipLabel, currency === c && styles.chipLabelActive]}>{c}</Text>
          </Pressable>
        ))}
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

      <Text style={styles.label}>Method</Text>
      <View style={styles.chipRow}>
        {METHODS.map((m) => (
          <Pressable key={m.key} style={[styles.methodChip, method === m.key && styles.chipActive]} onPress={() => setMethod(m.key)}>
            <Text style={[styles.chipLabel, method === m.key && styles.chipLabelActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      {method === "crypto" && (
        <Text style={styles.notice}>Crypto funding is coming soon. You can still fund with a card today.</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, !isValid && styles.buttonDisabled]} onPress={handleFund} disabled={!isValid || loading}>
        {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.buttonText}>Fund</Text>}
      </Pressable>

      <Text style={styles.footnote}>
        This is a simulated top-up for testing — no real payment is charged yet.
      </Text>
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
  methodChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  chipLabelActive: { color: colors.textOnPrimary },
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
  notice: { ...typography.caption, color: colors.warning, marginTop: spacing.sm },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md, ...typography.caption },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
  footnote: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
});
