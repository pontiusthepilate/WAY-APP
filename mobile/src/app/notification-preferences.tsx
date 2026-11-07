import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { safeBack } from "../lib/navigation";
import { PageBackgroundVideo } from "../components/PageBackgroundVideo";
import { updateNotificationPrefs } from "../api/profiles";
import type { Profile } from "../types";

type PrefKey =
  | "notifyLikes"
  | "notifyComments"
  | "notifyFollows"
  | "notifyMessages"
  | "notifyCalls"
  | "notifyLive"
  | "notifyWayRequests"
  | "notifyCameraRequests";

const PREFS: { key: PrefKey; label: string }[] = [
  { key: "notifyLikes", label: "Likes" },
  { key: "notifyComments", label: "Comments" },
  { key: "notifyFollows", label: "New followers" },
  { key: "notifyMessages", label: "Messages" },
  { key: "notifyCalls", label: "Calls" },
  { key: "notifyLive", label: "Live broadcasts" },
  { key: "notifyWayRequests", label: "WAY requests" },
  { key: "notifyCameraRequests", label: "Camera requests" },
];

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile, refreshProfiles } = useSession();

  if (!activeProfile) return null;

  async function toggle(key: PrefKey, next: boolean) {
    await updateNotificationPrefs(activeProfile!.id, { [key]: next } as Partial<Profile>);
    await refreshProfiles();
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackgroundVideo />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notification preferences</Text>
        <View style={{ width: 24 }} />
      </View>

      {PREFS.map((pref) => (
        <View key={pref.key} style={styles.row}>
          <Text style={styles.rowLabel}>{pref.label}</Text>
          <Switch value={activeProfile[pref.key] ?? true} onValueChange={(next) => toggle(pref.key, next)} />
        </View>
      ))}
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
  headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  rowLabel: { ...typography.body, color: colors.textPrimary },
});
