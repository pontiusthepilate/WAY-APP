import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../theme/theme";
import { createProfile } from "../api/profiles";
import { ApiError } from "../api/client";
import { useSession } from "../context/SessionContext";

const KINDS: { key: "personal" | "business"; label: string }[] = [
  { key: "personal", label: "Personal" },
  { key: "business", label: "Business" },
];

export default function CreateProfileScreen() {
  const router = useRouter();
  const [wayId, setWayId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<"personal" | "business">("personal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshProfiles, profiles } = useSession();

  async function handleCreate() {
    setError(null);
    setLoading(true);
    try {
      await createProfile({ wayId: wayId.trim(), displayName: displayName.trim(), kind });
      await refreshProfiles();
      router.replace("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Choose your WAY</Text>
      <Text style={styles.subtitle}>
        This is what people will ask you for socially — &ldquo;what&apos;s your WAY?&rdquo; — instead of a username.
        {"\n"}You have {2 - profiles.length} free profile{2 - profiles.length === 1 ? "" : "s"} left.
      </Text>

      <Text style={styles.label}>Your WAY</Text>
      <View style={styles.wayInputWrap}>
        <Text style={styles.wayPrefix}>WAY/</Text>
        <TextInput
          style={styles.wayInput}
          placeholder="yourname"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          value={wayId}
          onChangeText={(v) => setWayId(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
        />
      </View>

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        placeholder="How you'll appear to others"
        placeholderTextColor={colors.textSecondary}
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Profile type</Text>
      <View style={styles.kindRow}>
        {KINDS.map((k) => (
          <Pressable
            key={k.key}
            style={[styles.kindPill, kind === k.key && styles.kindPillActive]}
            onPress={() => setKind(k.key)}
          >
            <Text style={[styles.kindLabel, kind === k.key && styles.kindLabelActive]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (!wayId || !displayName || loading) && styles.buttonDisabled]}
        disabled={!wayId || !displayName || loading}
        onPress={handleCreate}
      >
        {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.buttonText}>Create profile</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: "center" },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
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
    ...typography.body,
    color: colors.textPrimary,
  },
  kindRow: { flexDirection: "row", gap: spacing.sm },
  kindPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  kindPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindLabel: { color: colors.textSecondary, fontWeight: "600" },
  kindLabelActive: { color: colors.textOnPrimary },
  error: { color: colors.danger, marginTop: spacing.md, ...typography.caption, textAlign: "center" },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
});
