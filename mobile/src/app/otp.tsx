import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { verifyOtp } from "../api/auth";
import { ApiError } from "../api/client";
import { useSession } from "../context/SessionContext";
import { SkyOceanBackground } from "../components/SkyOceanBackground";
import { findCountryByIdentifier } from "../lib/countries";

export default function OtpScreen() {
  const { identifier, devCode } = useLocalSearchParams<{ identifier: string; devCode?: string }>();
  const router = useRouter();
  const [code, setCode] = useState(devCode ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onSignedIn } = useSession();

  // A flag next to the number it's actually going to, purely for visual
  // consistency with the country picker on the previous screen — there's
  // nothing to pick here, the number was already chosen.
  const identifierCountry = findCountryByIdentifier(identifier ?? "");

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      const result = await verifyOtp(identifier, code.trim());
      onSignedIn(result.profiles);
      router.replace(result.profiles.length > 0 ? "/feed" : "/create-profile");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify that code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="medium" />
      <View style={styles.titleRow}>
        <Ionicons name="keypad-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.title}>Enter your code</Text>
      </View>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to {identifierCountry ? `${identifierCountry.flag} ` : ""}
        {identifier}
      </Text>

      {!!devCode && <Text style={styles.devHint}>Dev mode — code prefilled: {devCode}</Text>}

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (code.length !== 6 || loading) && styles.buttonDisabled]}
        disabled={code.length !== 6 || loading}
        onPress={handleVerify}
      >
        {loading ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <>
            <Text style={styles.buttonText}>Verify</Text>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.textOnPrimary} />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  titleRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.xs },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  devHint: { ...typography.caption, color: colors.horizonDeep, textAlign: "center", marginTop: spacing.md },
  inputWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  input: {
    textAlign: "center",
    fontSize: 28,
    letterSpacing: 8,
    color: colors.textPrimary,
  },
  error: { color: colors.danger, marginTop: spacing.sm, ...typography.caption, textAlign: "center" },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
});
