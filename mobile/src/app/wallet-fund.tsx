import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { fundWallet, verifyFunding } from "../api/wallet";
import { toMinorUnits } from "../lib/formatCurrency";
import { CURRENCIES, type Currency } from "../types";
import { ApiError } from "../api/client";

const METHODS: { key: "card" | "crypto"; label: string }[] = [
  { key: "card", label: "Card" },
  { key: "crypto", label: "Crypto" },
];

// Real card funding (Paystack) is only live for NGN right now — see
// backend/src/lib/paystack.ts. Other currencies still use the simulated
// instant-credit path the backend falls back to automatically.
const REAL_FUNDING_CURRENCIES: Currency[] = ["NGN"];
const PAYSTACK_REDIRECT_URL = "way://wallet-fund-callback";

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
  const isRealFunding = method === "card" && REAL_FUNDING_CURRENCIES.includes(currency);

  async function handleFund() {
    if (!activeProfile || !isValid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fundWallet({ profileId: activeProfile.id, currency, amount: toMinorUnits(parsedAmount), method });

      if (result.status === "completed") {
        router.back();
        return;
      }

      // requires_action: open Paystack's hosted checkout and wait for it to
      // redirect back to our app scheme, then confirm with our own server —
      // the redirect alone is never trusted as proof of payment.
      const browserResult = await WebBrowser.openAuthSessionAsync(result.authorizationUrl, PAYSTACK_REDIRECT_URL);
      if (browserResult.type !== "success") {
        setError("Payment was cancelled.");
        return;
      }

      const verified = await verifyFunding({ profileId: activeProfile.id, reference: result.reference });
      if (verified.status === "completed") {
        router.back();
      } else {
        setError(verified.error || "Payment was not successful.");
      }
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
      {method === "card" && !isRealFunding && (
        <Text style={styles.notice}>
          Real card funding is live for NGN. {currency} still uses a simulated top-up for now.
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, !isValid && styles.buttonDisabled]} onPress={handleFund} disabled={!isValid || loading}>
        {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.buttonText}>Fund</Text>}
      </Pressable>

      <Text style={styles.footnote}>
        {isRealFunding
          ? "You'll complete payment on Paystack's secure checkout page."
          : "This is a simulated top-up for testing — no real payment is charged yet."}
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
