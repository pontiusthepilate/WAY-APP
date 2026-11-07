import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { safeBack } from "../lib/navigation";
import { PageBackgroundVideo } from "../components/PageBackgroundVideo";
import { updatePrivacy } from "../api/profiles";
import type { Profile } from "../types";

type MessagePrivacy = Profile["messagePrivacy"];

const OPTIONS: { key: MessagePrivacy; label: string; description: string }[] = [
  { key: "everyone", label: "Everyone", description: "Any WAY user can start a conversation with you." },
  { key: "following", label: "Only people I follow", description: "Only profiles you already follow can message you." },
  { key: "no_one", label: "No one", description: "Nobody can start a new conversation with you." },
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

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackgroundVideo />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy</Text>
        <View style={{ width: 24 }} />
      </View>

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
});
