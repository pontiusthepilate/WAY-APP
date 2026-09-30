import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../theme/theme";
import { verifyOtp } from "../api/auth";
import { ApiError } from "../api/client";
import { useSession } from "../context/SessionContext";

export default function OtpScreen() {
  const { identifier, devCode } = useLocalSearchParams<{ identifier: string; devCode?: string }>();
  const router = useRouter();
  const [code, setCode] = useState(devCode ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onSignedIn } = useSession();

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
      <Text style={styles.title}>Enter your code</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {identifier}</Text>

      {!!devCode && <Text style={styles.devHint}>Dev mode — code prefilled: {devCode}</Text>}

      <TextInput
        style={styles.input}
        placeholder="123456"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (code.length !== 6 || loading) && styles.buttonDisabled]}
        disabled={code.length !== 6 || loading}
        onPress={handleVerify}
      >
        {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.buttonText}>Verify</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: "center" },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  devHint: { ...typography.caption, color: colors.horizonDeep, textAlign: "center", marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    textAlign: "center",
    fontSize: 28,
    letterSpacing: 8,
    color: colors.textPrimary,
  },
  error: { color: colors.danger, marginTop: spacing.sm, ...typography.caption, textAlign: "center" },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
});
