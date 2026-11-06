import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { safeBack } from "../lib/navigation";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.banner}>
        <Ionicons name="alert-circle-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.bannerText}>Placeholder text — pending legal review. Not final.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.paragraph}>
          WAY collects the information you provide directly — your phone number or email, profile details, posts,
          and messages — and uses it to operate and improve the app.
        </Text>
        <Text style={styles.paragraph}>
          Location data you choose to share is used to power nearby search and location-based features, and is
          never sold to third parties.
        </Text>
        <Text style={styles.paragraph}>
          You can control what others see about you through the Privacy and Notification settings in the app, and
          can request account deletion at any time from Settings &gt; Account details.
        </Text>
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  body: { paddingBottom: spacing.xl },
  paragraph: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.md },
});
