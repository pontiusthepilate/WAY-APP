import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../theme/theme";
import { requestOtp } from "../api/auth";
import { ApiError } from "../api/client";

export default function WelcomeScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      const { devCode } = await requestOtp(identifier.trim());
      router.push({ pathname: "/otp", params: { identifier: identifier.trim(), devCode: devCode ?? "" } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/way-logo-lockup.png")} style={styles.logo} resizeMode="contain" />

      <Text style={styles.tagline}>Find your WAY to anyone, anywhere.</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Phone number or email</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 555 123 4567 or you@example.com"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={identifier}
          onChangeText={setIdentifier}
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, (!identifier || loading) && styles.buttonDisabled]}
          disabled={!identifier || loading}
          onPress={handleContinue}
        >
          {loading ? <ActivityIndicator color={colors.primaryDark} /> : <Text style={styles.buttonText}>Continue</Text>}
        </Pressable>
      </View>

      <Text style={styles.footnote}>We&apos;ll text or email you a 6-digit code to verify it&apos;s you.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  logo: { width: 140, height: 210, marginBottom: spacing.md },
  tagline: { ...typography.h3, color: colors.primaryLight, marginBottom: spacing.xl, textAlign: "center" },
  form: { width: "100%" },
  label: { ...typography.caption, color: colors.primaryLight, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  error: { color: colors.warning, marginTop: spacing.xs, ...typography.caption },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.warning,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
  footnote: { ...typography.caption, color: colors.primaryLight, marginTop: spacing.xl, textAlign: "center" },
});
