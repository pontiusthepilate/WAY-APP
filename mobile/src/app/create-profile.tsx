import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { createProfile, getProfileByWay } from "../api/profiles";
import { ApiError } from "../api/client";
import { useSession } from "../context/SessionContext";
import { SkyOceanBackground } from "../components/SkyOceanBackground";
import { DotOutline } from "../components/DotOutline";

const KINDS: { key: "personal" | "business"; label: string }[] = [
  { key: "personal", label: "Personal" },
  { key: "business", label: "Business" },
];

// Mirrors backend/src/lib/wayId.ts's WAY_ID_PATTERN — the mobile app has no
// package shared with the backend, so this is kept in sync by hand.
const WAY_ID_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

type WayIdStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

const WAY_ID_STATUS_MESSAGE: Partial<Record<WayIdStatus, string>> = {
  invalid: "3-20 characters, starting with a letter — lowercase letters, numbers, underscore",
  taken: "That WAY is already taken",
  available: "It's yours — nice pick!",
  error: "Couldn't check availability right now",
};

// Mirrors backend/src/routes/profiles.ts's createProfileBody displayName
// max length.
const DISPLAY_NAME_MAX_LENGTH = 40;

export default function CreateProfileScreen() {
  const router = useRouter();
  const [wayId, setWayId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<"personal" | "business">("personal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wayIdStatus, setWayIdStatus] = useState<WayIdStatus>("idle");
  const { refreshProfiles, profiles } = useSession();

  // Debounced live availability check — only hits the network once the
  // format is already valid, and ignores a stale response if the field
  // changed again before it came back.
  useEffect(() => {
    if (!wayId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWayIdStatus("idle");
      return;
    }
    if (!WAY_ID_PATTERN.test(wayId)) {
      setWayIdStatus("invalid");
      return;
    }
    setWayIdStatus("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await getProfileByWay(wayId);
        if (!cancelled) setWayIdStatus("taken");
      } catch (err) {
        if (cancelled) return;
        setWayIdStatus(err instanceof ApiError && err.status === 404 ? "available" : "error");
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wayId]);

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
    <View style={styles.root}>
      <SkyOceanBackground tone="pale" />
      <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Choose your WAY</Text>
      <Text style={styles.subtitle}>
        This is what people will ask you for socially — &ldquo;what&apos;s your WAY?&rdquo; — instead of a username.
        {"\n"}You have {2 - profiles.length} free profile{2 - profiles.length === 1 ? "" : "s"} left.
      </Text>

      <Text style={styles.label}>Your WAY</Text>
      <View style={styles.wayInputWrap}>
        <Ionicons name="at-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <Text style={styles.wayPrefix}>WAY/</Text>
        <TextInput
          style={styles.wayInput}
          placeholder="yourname"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          value={wayId}
          onChangeText={(v) => setWayId(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
        />
        {wayIdStatus === "checking" && <ActivityIndicator size="small" color={colors.textSecondary} />}
        {wayIdStatus === "available" && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
        {(wayIdStatus === "invalid" || wayIdStatus === "taken") && (
          <Ionicons name="close-circle" size={20} color={colors.danger} />
        )}
      </View>
      {!!WAY_ID_STATUS_MESSAGE[wayIdStatus] && (
        <Text style={[styles.wayIdHint, wayIdStatus === "available" && styles.wayIdHintAvailable]}>
          {WAY_ID_STATUS_MESSAGE[wayIdStatus]}
        </Text>
      )}

      <Text style={styles.label}>Display name</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="How you'll appear to others"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
        />
        <Text style={[styles.charCount, displayName.length === DISPLAY_NAME_MAX_LENGTH && styles.charCountMax]}>
          {displayName.length}/{DISPLAY_NAME_MAX_LENGTH}
        </Text>
      </View>

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

      <DotOutline radius={radii.pill} tone="onDark" style={styles.buttonSpacing}>
        <Pressable
          style={[styles.button, (wayIdStatus !== "available" || !displayName || loading) && styles.buttonDisabled]}
          disabled={wayIdStatus !== "available" || !displayName || loading}
          onPress={handleCreate}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.buttonText}>Create profile</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textOnPrimary} />
            </>
          )}
        </Pressable>
      </DotOutline>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  wayInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.xs },
  wayPrefix: { ...typography.body, color: colors.primaryDark, fontWeight: "700" },
  wayInput: { flex: 1, paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary },
  wayIdHint: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  wayIdHintAvailable: { color: colors.primary },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
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
  charCount: { ...typography.caption, color: colors.textSecondary },
  charCountMax: { color: colors.danger },
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
  buttonSpacing: { marginTop: spacing.xl },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
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
