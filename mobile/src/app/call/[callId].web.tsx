import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme/theme";
import { safeBack } from "../../lib/navigation";

// Expo Router only loads this file on web (it requires the non-suffixed
// call/[callId].tsx to exist as the native fallback, which it does). Calling
// relies on @livekit/react-native + react-native-callkeep, both native-only
// with no web build — a real web calling UI would need a parallel
// implementation on livekit-client's own web SDK, a separate project, not
// attempted here. Keeping those imports out of this file entirely is the
// point: the native screen's heavy imports never reach the web bundle.
export default function CallScreenWeb() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable style={styles.closeButton} onPress={() => safeBack()} hitSlop={12}>
        <Ionicons name="close" size={26} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.body}>
        <Ionicons name="call-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.title}>Calling isn&apos;t available on web yet</Text>
        <Text style={styles.subtitle}>Open WAY on your phone to make or receive calls.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  closeButton: { padding: spacing.md, alignSelf: "flex-start" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  title: { ...typography.h3, color: colors.textPrimary, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
});
