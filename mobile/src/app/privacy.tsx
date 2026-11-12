import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { safeBack } from "../lib/navigation";
import { PageBackground } from "../components/PageBackground";
import { updatePrivacy, updateAccessGrants, updateVisibility } from "../api/profiles";
import type { Profile } from "../types";

type MessagePrivacy = Profile["messagePrivacy"];

const OPTIONS: { key: MessagePrivacy; label: string; description: string }[] = [
  { key: "everyone", label: "Everyone", description: "Any WAY user can start a conversation with you." },
  { key: "following", label: "Only people I follow", description: "Only profiles you already follow can message you." },
  { key: "no_one", label: "No one", description: "Nobody can start a new conversation with you." },
];

// Each enabled flag independently unlocks full profile access for an
// accepted connector matching it (OR'd together, not AND'd) — see
// backend/src/lib/profileAccess.ts. Grouped into two rows of chips here
// since they're conceptually two separate questions ("how they found you"
// vs. "what kind of profile they are"), not one flat list.
type AccessGrantKey =
  | "autoGrantAccessViaNearby"
  | "autoGrantAccessViaAddress"
  | "autoGrantAccessViaLocation"
  | "autoGrantAccessToPersonal"
  | "autoGrantAccessToBusiness"
  | "autoGrantAccessToPodcast";

const VIA_GRANTS: { key: AccessGrantKey; label: string }[] = [
  { key: "autoGrantAccessViaNearby", label: "Nearby" },
  { key: "autoGrantAccessViaAddress", label: "Address" },
  { key: "autoGrantAccessViaLocation", label: "Location" },
];

const KIND_GRANTS: { key: AccessGrantKey; label: string }[] = [
  { key: "autoGrantAccessToPersonal", label: "Personal" },
  { key: "autoGrantAccessToBusiness", label: "Business" },
  { key: "autoGrantAccessToPodcast", label: "Podcast" },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile, refreshProfiles } = useSession();
  const [saving, setSaving] = useState<MessagePrivacy | null>(null);

  if (!activeProfile) return null;

  async function select(key: MessagePrivacy) {
    if (key === activeProfile!.messagePrivacy) return;
    setSaving(key);
    try {
      await updatePrivacy(activeProfile!.id, { messagePrivacy: key });
      await refreshProfiles();
    } finally {
      setSaving(null);
    }
  }

  async function toggleGrant(key: AccessGrantKey, next: boolean) {
    await updateAccessGrants(activeProfile!.id, { [key]: next } as Partial<Profile>);
    await refreshProfiles();
  }

  async function toggleDiscoverableByPhone(next: boolean) {
    await updateVisibility(activeProfile!.id, { discoverableByPhone: next });
    await refreshProfiles();
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionLabel}>Who can message you</Text>
      {OPTIONS.map((opt) => {
        const active = activeProfile.messagePrivacy === opt.key;
        return (
          <Pressable key={opt.key} style={[styles.option, active && styles.optionActive]} onPress={() => select(opt.key)}>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
              <Text style={[styles.optionDescription, active && styles.optionDescriptionActive]}>{opt.description}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={20} color={colors.textOnPrimary} />}
          </Pressable>
        );
      })}
      {saving && <Text style={styles.savingHint}>Saving…</Text>}

      <Text style={[styles.sectionLabel, styles.secondSectionLabel]}>Phone number privacy</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Let people who have your number find your WAY</Text>
        <Switch value={activeProfile.discoverableByPhone} onValueChange={toggleDiscoverableByPhone} />
      </View>
      <Text style={styles.sectionHint}>
        This only controls whether someone searching by phone number can find your WAY — it doesn&apos;t reveal your
        number to anyone. Your actual number is never shown automatically to a WAY ID, Nearby, Address, or Location
        connection either. To let one specific connection see it: open their profile (tap their name anywhere, or
        find them under Followers/Following) and turn on &quot;Share my phone number with them&quot; — that switch
        only appears once you&apos;re connected, right below their name.
      </Text>

      <Text style={[styles.sectionLabel, styles.secondSectionLabel]}>
        Who gets full profile access when they connect
      </Text>
      <Text style={styles.sectionHint}>
        Applies only to people you&apos;ve already connected with — never to strangers.
      </Text>

      <Text style={styles.groupLabel}>Via how they found you</Text>
      {VIA_GRANTS.map((grant) => (
        <View key={grant.key} style={styles.row}>
          <Text style={styles.rowLabel}>{grant.label}</Text>
          <Switch value={activeProfile[grant.key] ?? false} onValueChange={(next) => toggleGrant(grant.key, next)} />
        </View>
      ))}

      <Text style={styles.groupLabel}>Via their profile type</Text>
      {KIND_GRANTS.map((grant) => (
        <View key={grant.key} style={styles.row}>
          <Text style={styles.rowLabel}>{grant.label}</Text>
          <Switch value={activeProfile[grant.key] ?? false} onValueChange={(next) => toggleGrant(grant.key, next)} />
        </View>
      ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  scrollContent: { paddingBottom: spacing.xl },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionTextWrap: { flex: 1, marginRight: spacing.sm },
  optionLabel: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  optionLabelActive: { color: colors.textOnPrimary },
  optionDescription: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  optionDescriptionActive: { color: colors.textOnPrimary },
  savingHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  secondSectionLabel: { marginTop: spacing.xl },
  sectionHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  groupLabel: { ...typography.body, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  rowLabel: { ...typography.body, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
});
