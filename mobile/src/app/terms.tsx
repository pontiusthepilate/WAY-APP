import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { safeBack } from "../lib/navigation";
import { PageBackgroundVideo } from "../components/PageBackgroundVideo";

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackgroundVideo />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.banner}>
        <Ionicons name="alert-circle-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.bannerText}>Placeholder text — pending legal review. Not final.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.paragraph}>
          These Terms of Service govern your use of the WAY app. By creating an account, you agree to use WAY
          responsibly and in accordance with applicable laws.
        </Text>
        <Text style={styles.paragraph}>
          You are responsible for the content you post, the profiles you create, and your interactions with other
          users. WAY may suspend or remove accounts that violate these terms or harm the safety of the community.
        </Text>
        <Text style={styles.paragraph}>
          WAY provides the app &quot;as is&quot; without warranties of any kind, and reserves the right to change
          these terms as the service evolves.
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
