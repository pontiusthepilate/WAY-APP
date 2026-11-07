import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { colors, radii, spacing, typography } from "../theme/theme";
import { safeBack } from "../lib/navigation";
import { PageBackground } from "../components/PageBackground";

const SUPPORT_EMAIL = "support@wwwaaayyy.com";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.brandBlock}>
        <Image source={require("../../assets/way-mark.png")} style={styles.mark} />
        <Text style={styles.appName}>WAY</Text>
        <Text style={styles.version}>Version {version}</Text>
      </View>

      <Row label="Terms of Service" onPress={() => router.push("/terms")} />
      <Row label="Privacy Policy" onPress={() => router.push("/privacy-policy")} />
      <Row label="Support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />

      <Text style={styles.tipsHeading}>Tips</Text>
      <View style={styles.tipCard}>
        <Text style={styles.tipText}>
          Shake your phone while on the Feed to show or hide the auto-scroll playback controls.
        </Text>
      </View>
    </View>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
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
  brandBlock: { alignItems: "center", marginVertical: spacing.xl },
  mark: { width: 56, height: 56, borderRadius: 28 },
  appName: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.sm },
  version: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
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
  tipsHeading: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs },
  tipCard: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md },
  tipText: { ...typography.body, color: colors.textPrimary },
});
