import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, legibleText, radii, spacing, typography } from "../theme/theme";
import { requestOtp } from "../api/auth";
import { ApiError } from "../api/client";
import { OceanWavesBackground } from "../components/OceanWavesBackground";
import { CountryCodeDivider, CountryCodeTrigger, CountryPickerSheet } from "../components/CountryCodePicker";
import { DotOutline } from "../components/DotOutline";
import { DEFAULT_COUNTRY, type Country } from "../lib/countries";

export default function WelcomeScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmail = identifier.includes("@");

  // A phone number typed into the field is just the national number — the
  // selected country's dial code gets prefixed here rather than asking the
  // person to type it themselves. Someone who pastes their own full
  // international number (leading "+") is left alone.
  function resolvedIdentifier(): string {
    const trimmed = identifier.trim();
    if (isEmail || !trimmed || trimmed.startsWith("+")) return trimmed;
    return `+${country.dialCode}${trimmed.replace(/\D/g, "")}`;
  }

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      const fullIdentifier = resolvedIdentifier();
      const { devCode } = await requestOtp(fullIdentifier);
      router.push({ pathname: "/otp", params: { identifier: fullIdentifier, devCode: devCode ?? "" } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <OceanWavesBackground />
      <Image source={require("../../assets/way-logo-lockup.png")} style={styles.logo} resizeMode="contain" />

      <Text style={styles.tagline}>Find your WAY to anyone, anywhere.</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Phone number or email</Text>
        <View style={styles.inputWrap}>
          {!isEmail && (
            <>
              <CountryCodeTrigger value={country} onPress={() => setCountryPickerOpen(true)} />
              <CountryCodeDivider />
            </>
          )}
          {isEmail && <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />}
          <TextInput
            style={styles.input}
            placeholder={isEmail ? "you@example.com" : "801 234 5678 or you@example.com"}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={identifier}
            onChangeText={setIdentifier}
          />
        </View>
        <CountryPickerSheet
          open={countryPickerOpen}
          onClose={() => setCountryPickerOpen(false)}
          onSelect={(c) => {
            setCountry(c);
            setCountryPickerOpen(false);
          }}
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <DotOutline radius={radii.pill} tone="onLight" style={styles.buttonSpacing}>
          <Pressable
            style={[styles.button, (!identifier || loading) && styles.buttonDisabled]}
            disabled={!identifier || loading}
            onPress={handleContinue}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryDark} />
            ) : (
              <>
                <Text style={styles.buttonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.primaryDark} />
              </>
            )}
          </Pressable>
        </DotOutline>
      </View>

      <Text style={styles.footnote}>We&apos;ll text or email you a 6-digit code to verify it&apos;s you.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  logo: { width: 140, height: 210, marginBottom: spacing.md },
  tagline: { ...typography.h3, ...legibleText("onDark"), marginBottom: spacing.xl, textAlign: "center" },
  form: { width: "100%" },
  label: { ...typography.caption, ...legibleText("onDark"), marginBottom: spacing.xs },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  error: { color: colors.warning, marginTop: spacing.xs, ...typography.caption },
  buttonSpacing: { marginTop: spacing.lg },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.warning,
    borderWidth: 1,
    borderColor: "rgba(6, 46, 56, 0.18)",
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
  footnote: { ...typography.caption, ...legibleText("onDark"), marginTop: spacing.xl, textAlign: "center" },
});
