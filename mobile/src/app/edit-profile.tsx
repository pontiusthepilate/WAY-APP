import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { updateProfile } from "../api/profiles";
import { ApiError } from "../api/client";
import { safeBack } from "../lib/navigation";

// Mirrors backend/src/routes/profiles.ts's updateProfileBody limits.
const DISPLAY_NAME_MAX_LENGTH = 40;
const BIO_MAX_LENGTH = 280;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile, refreshProfiles } = useSession();
  const [displayName, setDisplayName] = useState(activeProfile?.displayName ?? "");
  const [bio, setBio] = useState(activeProfile?.bio ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeProfile) return null;

  async function handleSave() {
    setError(null);
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError("Display name can't be empty");
      return;
    }
    setLoading(true);
    try {
      await updateProfile(activeProfile!.id, { displayName: trimmedName, bio: bio.trim() });
      await refreshProfiles();
      safeBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={(v) => setDisplayName(v.slice(0, DISPLAY_NAME_MAX_LENGTH))}
        placeholder="Your name"
        placeholderTextColor={colors.textSecondary}
      />
      <Text style={styles.counter}>
        {displayName.length}/{DISPLAY_NAME_MAX_LENGTH}
      </Text>

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={(v) => setBio(v.slice(0, BIO_MAX_LENGTH))}
        placeholder="Tell people about yourself"
        placeholderTextColor={colors.textSecondary}
        multiline
      />
      <Text style={styles.counter}>
        {bio.length}/{BIO_MAX_LENGTH}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.saveButton, loading && styles.saveButtonDisabled]} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.saveButtonText}>Save</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.lg,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bioInput: { minHeight: 100, textAlignVertical: "top" },
  counter: { ...typography.caption, color: colors.textSecondary, textAlign: "right", marginTop: 4 },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  saveButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
});
