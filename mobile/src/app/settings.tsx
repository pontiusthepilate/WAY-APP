import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { safeBack } from "../lib/navigation";
import { PageBackground } from "../components/PageBackground";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeProfile, profiles, signOut } = useSession();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setNotificationsEnabled(p.status === "granted"));
  }, []);

  async function handleEnableNotifications() {
    const result = await Notifications.requestPermissionsAsync();
    setNotificationsEnabled(result.status === "granted");
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/welcome");
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.sectionLabel}>Account</Text>
      <Row icon="person-outline" label="Edit profile" onPress={() => router.push("/edit-profile")} />
      <Row icon="eye-off-outline" label="Blocked accounts" onPress={() => router.push("/blocked-accounts")} />
      {profiles.length > 1 && (
        <Row icon="link-outline" label="Linked profiles" onPress={() => router.push("/profile-links")} />
      )}
      {activeProfile?.kind === "business" && (
        <Row
          icon="shield-checkmark-outline"
          label="Business verification"
          onPress={() => router.push("/business-verification")}
        />
      )}

      <Text style={styles.sectionLabel}>Notifications</Text>
      <View style={styles.infoRow}>
        <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
        <View style={styles.infoRowBody}>
          <Text style={styles.infoLabel}>Push notifications</Text>
          <Text style={styles.rowSub}>
            {notificationsEnabled === null ? "Checking…" : notificationsEnabled ? "Enabled" : "Off"}
          </Text>
        </View>
        {notificationsEnabled === false && (
          <Pressable style={styles.enableButton} onPress={handleEnableNotifications}>
            <Text style={styles.enableButtonText}>Enable</Text>
          </Pressable>
        )}
      </View>
      {notificationsEnabled === false && (
        <Text style={styles.hint}>
          If you&apos;ve denied this before, enable it from the iOS Settings app instead — WAY can&apos;t re-ask directly.
        </Text>
      )}

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function Row({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
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
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  rowLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  infoRowBody: { flex: 1 },
  infoLabel: { ...typography.body, color: colors.textPrimary },
  enableButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  enableButtonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 13 },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  signOutButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
